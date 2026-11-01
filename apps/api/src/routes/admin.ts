import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { ROLES, inquiryUpdateSchema, paginationSchema, userAdminUpdateSchema } from '@acee/shared';
import { prisma } from '../db';
import { requireRole } from '../lib/auth';
import { audit } from '../lib/audit';
import { storage } from '../lib/storage';
import { badRequest, forbidden, notFound } from '../lib/errors';
import { toCsv } from '../lib/csv';
import { hashToken, newToken } from '../lib/tokens';

const id = z.object({ id: z.string().min(1) });
const csvQuery = { format: z.enum(['json', 'csv']).default('json') };
const range = z.object({ from: z.iso.date().optional(), to: z.iso.date().optional() });

export const adminRoutes: FastifyPluginAsyncZod = async (app) => {

  app.get('/metrics', async () => {
    const now = new Date();
    const weekAgo = new Date(Date.now() - 7 * 86_400_000);
    const [students, newInquiries, outcomes, enrollments, upcoming, pendingDocs, byStage, stages, staff] = await Promise.all([
      prisma.user.count({ where: { role: 'STUDENT', status: 'ACTIVE' } }),
      prisma.inquiry.count({ where: { status: 'NEW' } }),
      prisma.eligibilityAssessment.groupBy({ by: ['outcome'], _count: true }),
      prisma.enrollment.count({ where: { status: { in: ['CONFIRMED', 'WAITLISTED'] } } }),
      prisma.appointment.count({ where: { status: 'BOOKED', startsAt: { gte: now } } }),
      prisma.document.count({ where: { status: 'PENDING' } }),
      prisma.application.groupBy({ by: ['stageId'], where: { closedAt: null }, _count: true }),
      prisma.applicationStage.findMany({ orderBy: { order: 'asc' } }),
      prisma.user.groupBy({ by: ['role'], where: { role: { in: ['COUNSELOR', 'TRAINER'] }, status: 'ACTIVE' }, _count: true }),
    ]);
    const newStudents = await prisma.user.count({ where: { role: 'STUDENT', createdAt: { gte: weekAgo } } });
    return {
      students, newStudents, newInquiries, enrollments, upcomingAppointments: upcoming, pendingDocuments: pendingDocs,
      eligibility: Object.fromEntries(outcomes.map((o) => [o.outcome, o._count])),
      applicationsByStage: stages.map((s) => ({ stage: s, count: byStage.find((b) => b.stageId === s.id)?._count ?? 0 })),
      activeStaff: Object.fromEntries(staff.map((s) => [s.role, s._count])),
    };
  });

  app.get('/users', { schema: { querystring: paginationSchema.extend({ role: z.enum(ROLES).optional(), status: z.enum(['ACTIVE', 'DISABLED']).optional(), ...csvQuery }) } }, async (req, reply) => {
    const { page, pageSize, q, role, status, format } = req.query;
    const where = {
      status: status ?? { not: 'DELETED' as const }, ...(role ? { role } : {}),
      ...(q ? { OR: [{ fullName: { contains: q, mode: 'insensitive' as const } }, { email: { contains: q, mode: 'insensitive' as const } }, { mobile: { contains: q } }] } : {}),
    };
    const select = { id: true, fullName: true, email: true, mobile: true, role: true, status: true, district: true, createdAt: true, lastLoginAt: true };
    if (format === 'csv') {
      const rows = await prisma.user.findMany({ where, select, orderBy: { createdAt: 'desc' }, take: 10_000 });
      await audit(prisma, { actorId: req.user!.id, action: 'users.export', entityType: 'User', ip: req.ip, metadata: { count: rows.length } });
      return reply.type('text/csv').header('Content-Disposition', 'attachment; filename="users.csv"').send(toCsv(rows));
    }
    const [items, total] = await Promise.all([
      prisma.user.findMany({ where, select, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
      prisma.user.count({ where }),
    ]);
    return { items, total, page, pageSize };
  });

  app.get('/staff', async () => ({
    items: await prisma.user.findMany({ where: { role: { in: ['COUNSELOR', 'TRAINER'] }, status: 'ACTIVE' }, select: { id: true, fullName: true, role: true }, orderBy: { fullName: 'asc' } }),
  }));

  app.patch('/users/:id', { schema: { params: id, body: userAdminUpdateSchema } }, async (req) => {
    const actor = req.user!;
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target || target.status === 'DELETED') throw notFound('User');
    if (target.id === actor.id) throw badRequest('SELF_CHANGE', 'You cannot change your own role or status');
    const privileged = target.role === 'ADMIN' || target.role === 'SUPER_ADMIN' || req.body.role === 'ADMIN' || req.body.role === 'SUPER_ADMIN';
    if ((req.body.role || privileged) && actor.role !== 'SUPER_ADMIN') throw forbidden();
    const u = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({ where: { id: target.id }, data: req.body, select: { id: true, role: true, status: true } });
      if (req.body.status === 'DISABLED' || req.body.role) await tx.session.updateMany({ where: { userId: target.id, revokedAt: null }, data: { revokedAt: new Date() } });
      if (req.body.role === 'COUNSELOR') await tx.counselorProfile.upsert({ where: { userId: target.id }, create: { userId: target.id }, update: {} });
      if (req.body.role === 'TRAINER') await tx.trainerProfile.upsert({ where: { userId: target.id }, create: { userId: target.id }, update: {} });
      return updated;
    });
    await audit(prisma, { actorId: actor.id, action: 'user.update', entityType: 'User', entityId: target.id, ip: req.ip, metadata: { before: { role: target.role, status: target.status }, after: req.body } });
    return u;
  });

  app.get('/inquiries', { schema: { querystring: paginationSchema.extend({ status: z.enum(['NEW', 'CONTACTED', 'CONVERTED', 'CLOSED']).optional(), ...csvQuery }) } }, async (req, reply) => {
    const { page, pageSize, q, status, format } = req.query;
    const where = { ...(status ? { status } : {}), ...(q ? { OR: [{ name: { contains: q, mode: 'insensitive' as const } }, { mobile: { contains: q } }] } : {}) };
    if (format === 'csv') {
      const rows = await prisma.inquiry.findMany({ where, orderBy: { createdAt: 'desc' }, take: 10_000, omit: { ip: true } });
      return reply.type('text/csv').header('Content-Disposition', 'attachment; filename="inquiries.csv"').send(toCsv(rows));
    }
    const [items, total] = await Promise.all([
      prisma.inquiry.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize, omit: { ip: true } }),
      prisma.inquiry.count({ where }),
    ]);
    return { items, total, page, pageSize };
  });

  app.patch('/inquiries/:id', { schema: { params: id, body: inquiryUpdateSchema } }, async (req) => {
    const i = await prisma.inquiry.update({ where: { id: req.params.id }, data: { ...req.body, assignedToId: req.user!.id } });
    await audit(prisma, { actorId: req.user!.id, action: 'inquiry.update', entityType: 'Inquiry', entityId: i.id, ip: req.ip, metadata: req.body });
    return { ok: true };
  });

  app.get('/audit-logs', { schema: { querystring: paginationSchema.extend({ entityType: z.string().max(40).optional(), action: z.string().max(60).optional() }) } }, async (req) => {
    const { page, pageSize, entityType, action } = req.query;
    const where = { ...(entityType ? { entityType } : {}), ...(action ? { action: { startsWith: action } } : {}) };
    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize, include: { actor: { select: { fullName: true, role: true } } } }),
      prisma.auditLog.count({ where }),
    ]);
    return { items, total, page, pageSize };
  });

  app.get('/reports/summary', { schema: { querystring: range } }, async (req) => {
    const from = req.query.from ? new Date(req.query.from) : new Date(Date.now() - 30 * 86_400_000);
    const to = req.query.to ? new Date(new Date(req.query.to).getTime() + 86_400_000) : new Date();
    const createdAt = { gte: from, lt: to };
    const [registrations, assessments, enrollments, appointments, documents, inquiries] = await Promise.all([
      prisma.user.count({ where: { role: 'STUDENT', createdAt } }),
      prisma.eligibilityAssessment.groupBy({ by: ['outcome'], where: { createdAt }, _count: true }),
      prisma.enrollment.groupBy({ by: ['status'], where: { createdAt }, _count: true }),
      prisma.appointment.groupBy({ by: ['status'], where: { startsAt: createdAt }, _count: true }),
      prisma.document.groupBy({ by: ['status'], where: { createdAt }, _count: true }),
      prisma.inquiry.groupBy({ by: ['status'], where: { createdAt }, _count: true }),
    ]);
    const obj = (rows: { _count: number }[], k: string) => Object.fromEntries(rows.map((r) => [(r as Record<string, unknown>)[k] as string, r._count]));
    return {
      from: from.toISOString(), to: to.toISOString(), registrations,
      eligibility: obj(assessments, 'outcome'), enrollments: obj(enrollments, 'status'), appointments: obj(appointments, 'status'),
      documents: obj(documents, 'status'), inquiries: obj(inquiries, 'status'),
    };
  });

  app.get('/data-requests', async () => ({
    items: await prisma.dataRequest.findMany({ orderBy: { createdAt: 'desc' }, take: 100, include: { user: { select: { id: true, fullName: true, email: true, status: true } } } }),
  }));

  /**
   * Account deletion: purge stored files, anonymise PII, revoke sessions. Assessment/audit rows remain
   * linked to the anonymised id. Only a SUPER_ADMIN can execute it.
   */
  app.post('/data-requests/:id/resolve', { schema: { params: id, body: z.object({ decision: z.enum(['COMPLETED', 'REJECTED']) }) } }, async (req) => {
    const actor = req.user!;
    if (actor.role !== 'SUPER_ADMIN') throw forbidden();
    const dr = await prisma.dataRequest.findUnique({ where: { id: req.params.id } });
    if (!dr || dr.status !== 'OPEN') throw notFound('Open request');
    if (dr.type === 'DELETE_ACCOUNT' && req.body.decision === 'COMPLETED') {
      const docs = await prisma.document.findMany({ where: { ownerId: dr.userId, status: { not: 'DELETED' } } });
      for (const d of docs) await storage.remove(d.storageKey);
      const anon = `deleted-${dr.userId}`;
      await prisma.$transaction([
        prisma.document.updateMany({ where: { ownerId: dr.userId }, data: { status: 'DELETED', deletedAt: new Date(), fileName: 'deleted' } }),
        prisma.session.updateMany({ where: { userId: dr.userId }, data: { revokedAt: new Date() } }),
        prisma.studentProfile.deleteMany({ where: { userId: dr.userId } }),
        prisma.counselorNote.deleteMany({ where: { studentId: dr.userId } }),
        prisma.user.update({ where: { id: dr.userId }, data: { status: 'DELETED', fullName: 'Deleted user', email: `${anon}@invalid`, mobile: anon, district: null, passwordHash: hashToken(newToken()) } }),
      ]);
    }
    await prisma.dataRequest.update({ where: { id: dr.id }, data: { status: req.body.decision, resolvedAt: new Date() } });
    await audit(prisma, { actorId: actor.id, action: 'dataRequest.resolve', entityType: 'DataRequest', entityId: dr.id, ip: req.ip, metadata: { type: dr.type, decision: req.body.decision } });
    return { ok: true };
  });
};
