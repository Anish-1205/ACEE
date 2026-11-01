import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { consentSchema, profileSchema } from '@acee/shared';
import { prisma } from '../db';
import { publicUser, requireAuth, requireRole } from '../lib/auth';
import { audit } from '../lib/audit';
import { TERMS_VERSION } from './auth';
import { notFound } from '../lib/errors';

const PROFILE_FIELDS = ['qualification', 'fieldOfStudy', 'graduationYear', 'intendedCountry', 'intendedLevel', 'intendedIntake'] as const;

export function profileCompletion(user: { district: string | null }, p: Record<string, unknown> | null) {
  const filled = [user.district, ...PROFILE_FIELDS.map((f) => p?.[f])].filter((v) => v !== null && v !== undefined && v !== '').length;
  return Math.round((filled / (PROFILE_FIELDS.length + 1)) * 100);
}

export const meRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get('/profile', async (req) => {
    const user = requireRole(req, 'STUDENT');
    const p = await prisma.studentProfile.findUnique({ where: { userId: user.id } });
    return { user: publicUser(user), profile: { ...pick(p), completion: profileCompletion(user, p) } };
  });

  app.put('/profile', { schema: { body: profileSchema } }, async (req) => {
    const user = requireRole(req, 'STUDENT');
    const { fullName, district, preferredLanguage, ...rest } = req.body;
    const [u, p] = await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { fullName, district, preferredLanguage } }),
      prisma.studentProfile.upsert({ where: { userId: user.id }, create: { userId: user.id, ...rest }, update: rest }),
    ]);
    return { user: publicUser(u), profile: { ...pick(p), completion: profileCompletion(u, p) } };
  });

  /** Staff can change their own language without a student profile. */
  app.put('/language', { schema: { body: z.object({ preferredLanguage: z.enum(['en', 'te', 'hi']) }) } }, async (req) => {
    const user = requireAuth(req);
    const u = await prisma.user.update({ where: { id: user.id }, data: { preferredLanguage: req.body.preferredLanguage } });
    return { user: publicUser(u) };
  });

  app.get('/consents', async (req) => {
    const user = requireAuth(req);
    const rows = await prisma.consent.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } });
    const latest: Record<string, { granted: boolean; at: Date }> = {};
    for (const r of rows) latest[r.purpose] ??= { granted: r.granted, at: r.createdAt };
    return { consents: latest };
  });

  app.post('/consents', { schema: { body: consentSchema } }, async (req) => {
    const user = requireAuth(req);
    await prisma.consent.create({ data: { userId: user.id, ...req.body, version: TERMS_VERSION, ip: req.ip } });
    return { ok: true };
  });

  app.get('/notifications', async (req) => {
    const user = requireAuth(req);
    const [items, unread] = await Promise.all([
      prisma.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 50 }),
      prisma.notification.count({ where: { userId: user.id, readAt: null } }),
    ]);
    return { items, unread };
  });

  app.post('/notifications/read', { schema: { body: z.object({ ids: z.array(z.string()).max(100).optional() }) } }, async (req) => {
    const user = requireAuth(req);
    await prisma.notification.updateMany({
      where: { userId: user.id, readAt: null, ...(req.body.ids ? { id: { in: req.body.ids } } : {}) },
      data: { readAt: new Date() },
    });
    return { ok: true };
  });

  /** Student dashboard aggregate: one round trip for slow networks. */
  app.get('/dashboard', async (req) => {
    const user = requireRole(req, 'STUDENT');
    const now = new Date();
    const [profile, assessment, enrollments, appointments, documents, application, unread, announcements] = await Promise.all([
      prisma.studentProfile.findUnique({ where: { userId: user.id } }),
      prisma.eligibilityAssessment.findFirst({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, select: { outcome: true, createdAt: true } }),
      prisma.enrollment.findMany({ where: { userId: user.id, status: { in: ['CONFIRMED', 'WAITLISTED'] } }, include: { batch: { include: { course: true } } } }),
      prisma.appointment.findMany({ where: { studentId: user.id, status: 'BOOKED', startsAt: { gte: now } }, orderBy: { startsAt: 'asc' }, take: 3, include: { counselor: { select: { id: true, fullName: true } } } }),
      prisma.document.findMany({ where: { ownerId: user.id, status: { in: ['PENDING', 'APPROVED', 'REJECTED'] } }, select: { category: true, status: true } }),
      prisma.application.findFirst({ where: { studentId: user.id, closedAt: null }, include: { stage: true } }),
      prisma.notification.count({ where: { userId: user.id, readAt: null } }),
      prisma.announcement.findMany({ where: { audience: { in: ['PUBLIC', 'STUDENTS'] }, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }, orderBy: { publishedAt: 'desc' }, take: 3 }),
    ]);
    return {
      user: publicUser(user),
      profileCompletion: profileCompletion(user, profile),
      latestAssessment: assessment,
      enrollments, appointments, documents,
      application: application ? { id: application.id, stage: application.stage, updatedAt: application.updatedAt } : null,
      unreadNotifications: unread,
      announcements,
    };
  });

  app.post('/data-requests', { schema: { body: z.object({ type: z.enum(['DELETE_ACCOUNT', 'EXPORT']), reason: z.string().max(1000).default('') }) } }, async (req) => {
    const user = requireAuth(req);
    const r = await prisma.dataRequest.create({ data: { userId: user.id, ...req.body } });
    await audit(prisma, { actorId: user.id, action: 'dataRequest.create', entityType: 'DataRequest', entityId: r.id, ip: req.ip, metadata: { type: r.type } });
    return r;
  });

  /** Export of the caller's own personal data (DPDP right of access). */
  app.get('/export', async (req) => {
    const user = requireAuth(req);
    const data = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        fullName: true, email: true, mobile: true, district: true, preferredLanguage: true, createdAt: true,
        studentProfile: true, consents: true, assessments: true, enrollments: true, studentAppointments: { select: { startsAt: true, type: true, status: true, questions: true } },
        documents: { select: { category: true, fileName: true, status: true, createdAt: true } }, notifications: true,
      },
    });
    if (!data) throw notFound();
    return data;
  });
};

function pick(p: Record<string, unknown> | null) {
  return Object.fromEntries(PROFILE_FIELDS.map((f) => [f, p?.[f] ?? null]));
}
