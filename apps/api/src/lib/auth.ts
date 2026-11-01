import { hash, verify } from '@node-rs/argon2';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Role } from '@acee/shared';
import { prisma } from '../db';
import { config, isProd } from '../config';
import { HttpError, forbidden } from './errors';
import { hashToken, newToken } from './tokens';
import type { User } from '../generated/prisma/client';

export const SESSION_COOKIE = 'acee_session';

export type AuthUser = Pick<User, 'id' | 'email' | 'mobile' | 'fullName' | 'role' | 'district' | 'preferredLanguage' | 'status'>;

declare module 'fastify' {
  interface FastifyRequest {
    user: AuthUser | null;
    sessionId: string | null;
  }
}

// Argon2id with OWASP-recommended minimums.
const ARGON = { memoryCost: 19456, timeCost: 2, parallelism: 1 };
export const hashPassword = (p: string) => hash(p, ARGON);
export const verifyPassword = (h: string, p: string) => verify(h, p).catch(() => false);
/** Used to equalise timing when the user does not exist. */
let dummyHash: Promise<string> | null = null;
export const dummyVerify = async (p: string) => verifyPassword(await (dummyHash ??= hashPassword('dummy-password-1')), p);

export const publicUser = (u: AuthUser) => ({
  id: u.id, fullName: u.fullName, email: u.email, mobile: u.mobile, role: u.role,
  district: u.district, preferredLanguage: u.preferredLanguage,
});

const minutes = (n: number) => new Date(Date.now() + n * 60_000);
const days = (n: number) => minutes(n * 24 * 60);

export async function createSession(userId: string, kind: 'WEB' | 'MOBILE', req: FastifyRequest, familyId?: string) {
  const token = newToken();
  const refreshToken = kind === 'MOBILE' ? newToken() : null;
  const session = await prisma.session.create({
    data: {
      userId, kind,
      tokenHash: hashToken(token),
      expiresAt: kind === 'WEB' ? days(config.WEB_SESSION_DAYS) : minutes(config.ACCESS_TOKEN_MINUTES),
      refreshTokenHash: refreshToken ? hashToken(refreshToken) : null,
      refreshExpiresAt: refreshToken ? days(config.REFRESH_TOKEN_DAYS) : null,
      familyId: familyId ?? newToken(),
      userAgent: req.headers['user-agent']?.slice(0, 300) ?? null,
      ip: req.ip,
    },
  });
  return { session, token, refreshToken };
}

export function setSessionCookie(reply: FastifyReply, token: string) {
  reply.setCookie(SESSION_COOKIE, token, {
    httpOnly: true, sameSite: 'lax', secure: isProd, path: '/', maxAge: config.WEB_SESSION_DAYS * 86400,
  });
}

/**
 * Refresh-token rotation. Presenting an already-rotated refresh token means it leaked:
 * revoke every session in that family.
 */
export async function rotateRefreshToken(refreshToken: string, req: FastifyRequest) {
  const old = await prisma.session.findUnique({ where: { refreshTokenHash: hashToken(refreshToken) }, include: { user: true } });
  if (!old || old.kind !== 'MOBILE') throw new HttpError(401, 'INVALID_REFRESH', 'Session expired. Please log in again.');
  if (old.replacedAt || old.revokedAt) {
    await prisma.session.updateMany({ where: { familyId: old.familyId, revokedAt: null }, data: { revokedAt: new Date() } });
    throw new HttpError(401, 'REFRESH_REUSED', 'Session expired. Please log in again.');
  }
  if (!old.refreshExpiresAt || old.refreshExpiresAt < new Date() || old.user.status !== 'ACTIVE') {
    throw new HttpError(401, 'INVALID_REFRESH', 'Session expired. Please log in again.');
  }
  // Conditional update so two concurrent refreshes cannot both succeed.
  const claimed = await prisma.session.updateMany({ where: { id: old.id, replacedAt: null }, data: { replacedAt: new Date(), revokedAt: new Date() } });
  if (claimed.count === 0) throw new HttpError(401, 'REFRESH_REUSED', 'Session expired. Please log in again.');
  const next = await createSession(old.userId, 'MOBILE', req, old.familyId);
  return { ...next, user: old.user };
}

/** onRequest hook: resolves the caller from a Bearer token (mobile) or the session cookie (web). */
export async function resolveUser(req: FastifyRequest) {
  req.user = null;
  req.sessionId = null;
  const header = req.headers.authorization;
  const bearer = header?.startsWith('Bearer ') ? header.slice(7) : null;
  const token = bearer ?? req.cookies[SESSION_COOKIE];
  if (!token) return;

  // CSRF: cookie-authenticated state changes must come from an allowed web origin.
  if (!bearer && !['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    const origin = req.headers.origin;
    const allowed = config.WEB_ORIGINS.split(',').map((s) => s.trim());
    if (!origin || !allowed.includes(origin)) throw new HttpError(403, 'CSRF', 'Request origin not allowed');
  }

  const session = await prisma.session.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: true } });
  if (!session || session.revokedAt || session.expiresAt < new Date() || session.user.status !== 'ACTIVE') return;
  req.user = session.user;
  req.sessionId = session.id;
}

export function requireAuth(req: FastifyRequest): AuthUser {
  if (!req.user) throw new HttpError(401, 'UNAUTHENTICATED', 'Please log in');
  return req.user;
}

export function requireRole(req: FastifyRequest, ...roles: Role[]): AuthUser {
  const user = requireAuth(req);
  if (!roles.includes(user.role)) throw forbidden();
  return user;
}

export const isAdmin = (u: AuthUser) => u.role === 'ADMIN' || u.role === 'SUPER_ADMIN';

/** Counselors may only see students assigned to them or who booked them. Admins see all. */
export async function assertStaffCanAccessStudent(user: AuthUser, studentId: string) {
  if (isAdmin(user)) return;
  if (user.role === 'COUNSELOR') {
    const [app, appt] = await Promise.all([
      prisma.application.findFirst({ where: { studentId, assignedCounselorId: user.id }, select: { id: true } }),
      prisma.appointment.findFirst({ where: { studentId, counselorId: user.id }, select: { id: true } }),
    ]);
    if (app || appt) return;
  }
  throw forbidden();
}
