import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { acceptInviteSchema, invitableRoles, inviteSchema, loginSchema, refreshSchema, registerSchema } from '@acee/shared';
import { prisma } from '../db';
import { config } from '../config';
import {
  SESSION_COOKIE, createSession, dummyVerify, hashPassword, publicUser, requireAuth, requireRole,
  rotateRefreshToken, setSessionCookie, verifyPassword,
} from '../lib/auth';
import { HttpError, conflict, forbidden } from '../lib/errors';
import { hashToken, newToken } from '../lib/tokens';
import { audit } from '../lib/audit';
import { notify } from '../lib/notify';
import type { User } from '../generated/prisma/client';

export const TERMS_VERSION = '2026-11-01';
const strict = { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } };

async function issue(user: User, client: 'web' | 'mobile', req: FastifyRequest, reply: FastifyReply) {
  const { token, refreshToken, session } = await createSession(user.id, client === 'mobile' ? 'MOBILE' : 'WEB', req);
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  if (client === 'web') {
    setSessionCookie(reply, token);
    return { user: publicUser(user) };
  }
  return { user: publicUser(user), accessToken: token, refreshToken: refreshToken!, accessExpiresAt: session.expiresAt.toISOString() };
}

export const authRoutes: FastifyPluginAsyncZod = async (app) => {
  app.post('/register', { ...strict, schema: { body: registerSchema.extend({ client: z.enum(['web', 'mobile']).default('web') }) } }, async (req, reply) => {
    const b = req.body;
    const exists = await prisma.user.findFirst({ where: { OR: [{ email: b.email }, { mobile: b.mobile }] }, select: { id: true } });
    if (exists) throw conflict('ACCOUNT_EXISTS', 'An account with this email or mobile number already exists');
    const passwordHash = await hashPassword(b.password);
    const user = await prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          email: b.email, mobile: b.mobile, fullName: b.fullName, district: b.district,
          preferredLanguage: b.preferredLanguage, passwordHash, role: 'STUDENT',
          studentProfile: { create: {} },
        },
      });
      const consent = (purpose: string, granted: boolean) => ({ userId: u.id, purpose: purpose as never, granted, version: TERMS_VERSION, ip: req.ip });
      await tx.consent.createMany({
        data: [consent('TERMS', true), consent('PRIVACY', true), consent('COMM_EMAIL', b.consentEmail), consent('COMM_SMS', b.consentSms), consent('COMM_WHATSAPP', b.consentWhatsapp)],
      });
      await notify(tx, { userId: u.id, type: 'ACCOUNT', titleKey: 'welcome.title', bodyKey: 'welcome.body', params: { name: u.fullName }, link: '/dashboard' });
      await audit(tx, { actorId: u.id, action: 'user.register', entityType: 'User', entityId: u.id, ip: req.ip });
      return u;
    });
    reply.code(201);
    return issue(user, b.client, req, reply);
  });

  app.post('/login', { ...strict, schema: { body: loginSchema } }, async (req, reply) => {
    const { identifier, password, client } = req.body;
    const id = identifier.toLowerCase();
    const user = await prisma.user.findFirst({ where: id.includes('@') ? { email: id } : { mobile: id } });
    if (!user) {
      await dummyVerify(password);
      throw new HttpError(401, 'INVALID_CREDENTIALS', 'Incorrect email/mobile or password');
    }
    const ok = await verifyPassword(user.passwordHash, password);
    if (!ok || user.status !== 'ACTIVE') {
      await audit(prisma, { actorId: user.id, action: 'user.login_failed', entityType: 'User', entityId: user.id, ip: req.ip });
      throw new HttpError(401, 'INVALID_CREDENTIALS', 'Incorrect email/mobile or password');
    }
    await audit(prisma, { actorId: user.id, action: 'user.login', entityType: 'User', entityId: user.id, ip: req.ip, metadata: { client } });
    return issue(user, client, req, reply);
  });

  app.post('/refresh', { ...strict, schema: { body: refreshSchema } }, async (req) => {
    const { token, refreshToken, session, user } = await rotateRefreshToken(req.body.refreshToken, req);
    return { user: publicUser(user), accessToken: token, refreshToken: refreshToken!, accessExpiresAt: session.expiresAt.toISOString() };
  });

  app.post('/logout', async (req, reply) => {
    if (req.sessionId) {
      const s = await prisma.session.findUnique({ where: { id: req.sessionId } });
      if (s) await prisma.session.updateMany({ where: { familyId: s.familyId, revokedAt: null }, data: { revokedAt: new Date() } });
    }
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return reply.code(204).send();
  });

  app.get('/me', async (req) => ({ user: publicUser(requireAuth(req)) }));
  /** Same as /me but 200 with null when signed out, so the public website does not log 401s. */
  app.get('/session', async (req) => ({ user: req.user ? publicUser(req.user) : null }));

  /** OTP is an interface only until an SMS/email provider is configured; it never pretends to send. */
  app.post('/otp/request', { ...strict, schema: { body: z.object({ channel: z.enum(['sms', 'email']), destination: z.string().max(200) }) } }, async () => {
    throw new HttpError(501, 'OTP_NOT_CONFIGURED', 'OTP login is not available yet. Please use your password.');
  });

  app.post('/invitations', { schema: { body: inviteSchema } }, async (req) => {
    const actor = requireRole(req, 'ADMIN', 'SUPER_ADMIN');
    if (!invitableRoles(actor.role).includes(req.body.role)) throw forbidden();
    if (await prisma.user.findUnique({ where: { email: req.body.email } })) throw conflict('ACCOUNT_EXISTS', 'A user with this email already exists');
    const token = newToken();
    const inv = await prisma.invitation.create({
      data: { ...req.body, tokenHash: hashToken(token), invitedById: actor.id, expiresAt: new Date(Date.now() + 72 * 3600_000) },
    });
    await audit(prisma, { actorId: actor.id, action: 'invitation.create', entityType: 'Invitation', entityId: inv.id, ip: req.ip, metadata: { role: inv.role, email: inv.email } });
    // No email provider is wired: the admin shares this one-time link over a trusted channel.
    return { id: inv.id, inviteUrl: `${config.PUBLIC_WEB_URL}/invite?token=${token}`, expiresAt: inv.expiresAt };
  });

  const findInvite = async (token: string) => {
    const inv = await prisma.invitation.findUnique({ where: { tokenHash: hashToken(token) } });
    if (!inv || inv.acceptedAt || inv.expiresAt < new Date()) throw new HttpError(400, 'INVITE_INVALID', 'This invitation link is invalid or has expired');
    return inv;
  };

  app.get('/invitations/:token', { schema: { params: z.object({ token: z.string().min(20).max(200) }) } }, async (req) => {
    const inv = await findInvite(req.params.token);
    return { email: inv.email, fullName: inv.fullName, role: inv.role };
  });

  app.post('/invitations/accept', { ...strict, schema: { body: acceptInviteSchema } }, async (req, reply) => {
    const inv = await findInvite(req.body.token);
    const passwordHash = await hashPassword(req.body.password);
    const user = await prisma.$transaction(async (tx) => {
      const claimed = await tx.invitation.updateMany({ where: { id: inv.id, acceptedAt: null }, data: { acceptedAt: new Date() } });
      if (claimed.count === 0) throw new HttpError(400, 'INVITE_INVALID', 'This invitation link is invalid or has expired');
      const u = await tx.user.create({
        data: {
          email: inv.email, fullName: inv.fullName, role: inv.role, mobile: req.body.mobile, passwordHash,
          preferredLanguage: req.body.preferredLanguage, emailVerifiedAt: new Date(),
          ...(inv.role === 'COUNSELOR' ? { counselorProfile: { create: {} } } : {}),
          ...(inv.role === 'TRAINER' ? { trainerProfile: { create: {} } } : {}),
        },
      });
      await tx.consent.createMany({ data: ['TERMS', 'PRIVACY'].map((p) => ({ userId: u.id, purpose: p as never, granted: true, version: TERMS_VERSION, ip: req.ip })) });
      await audit(tx, { actorId: u.id, action: 'invitation.accept', entityType: 'User', entityId: u.id, ip: req.ip, metadata: { role: u.role } });
      return u;
    });
    reply.code(201);
    return issue(user, 'web', req, reply);
  });
};
