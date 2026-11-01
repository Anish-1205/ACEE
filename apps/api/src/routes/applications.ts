import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { applicationNoteSchema, applicationUpdateSchema, paginationSchema, stageChangeSchema, stageSchema } from '@acee/shared';
import { prisma } from '../db';
import { type AuthUser, isAdmin, requireRole } from '../lib/auth';
import { audit } from '../lib/audit';
import { notify } from '../lib/notify';
import { badRequest, conflict, forbidden, notFound } from '../lib/errors';

const id = z.object({ id: z.string().min(1) });
const person = { select: { id: true, fullName: true } } as const;
const CLOSED_CODE = 'CLOSED';

async function loadForStaff(user: AuthUser, appId: string) {
  const a = await prisma.application.findUnique({ where: { id: appId } });
  if (!a) throw notFound('Application');
  if (!isAdmin(user) && a.assignedCounselorId !== user.id) throw forbidden();
  return a;
}

export const applicationRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get('/applications/stages', async () => ({ items: await prisma.applicationStage.findMany({ where: { active: true }, orderBy: { order: 'asc' } }) }));

  // ---- Student ----
  app.get('/applications/mine', async (req) => {
    const user = requireRole(req, 'STUDENT');
    const items = await prisma.application.findMany({
      where: { studentId: user.id }, orderBy: { createdAt: 'desc' },
      include: {
        stage: true, assignedCounselor: person,
        history: { orderBy: { createdAt: 'asc' }, include: { toStage: true } },
        // Internal staff notes stay internal; only notes marked for the student are returned.
        notes: { where: { visibleToStudent: true }, orderBy: { createdAt: 'desc' }, include: { author: { select: { fullName: true } } } },
      },
    });
    return { items };
  });

  app.post('/applications/mine', async (req, reply) => {
    const user = requireRole(req, 'STUDENT');
    if (await prisma.application.findFirst({ where: { studentId: user.id, closedAt: null } })) throw conflict('APPLICATION_OPEN', 'You already have an open application');
    const [first, profile] = await Promise.all([
      prisma.applicationStage.findFirst({ where: { active: true }, orderBy: { order: 'asc' } }),
      prisma.studentProfile.findUnique({ where: { userId: user.id } }),
    ]);
    if (!first) throw badRequest('NO_STAGES', 'Application stages are not configured');
    const a = await prisma.application.create({
      data: {
        studentId: user.id, stageId: first.id, intendedCountry: profile?.intendedCountry ?? null, intake: profile?.intendedIntake ?? null,
        history: { create: { toStageId: first.id, changedById: user.id, note: 'Created by student' } },
      },
    });
    reply.code(201);
    return a;
  });

  app.patch('/applications/mine/:id', { schema: { params: id, body: z.object({ studentReportedGovtStatus: z.string().trim().max(500) }) } }, async (req) => {
    const user = requireRole(req, 'STUDENT');
    const r = await prisma.application.updateMany({ where: { id: req.params.id, studentId: user.id }, data: req.body });
    if (r.count === 0) throw notFound('Application');
    return { ok: true };
  });

  // ---- Counselor / admin ----
  app.get('/staff/applications', { schema: { querystring: paginationSchema.extend({ stageId: z.string().optional() }) } }, async (req) => {
    const user = requireRole(req, 'COUNSELOR', 'ADMIN', 'SUPER_ADMIN');
    const { page, pageSize, q, stageId } = req.query;
    const where = {
      ...(isAdmin(user) ? {} : { assignedCounselorId: user.id }),
      ...(stageId ? { stageId } : {}),
      ...(q ? { student: { OR: [{ fullName: { contains: q, mode: 'insensitive' as const } }, { mobile: { contains: q } }] } } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.application.findMany({ where, skip: (page - 1) * pageSize, take: pageSize, orderBy: { updatedAt: 'desc' }, include: { stage: true, assignedCounselor: person, student: { select: { id: true, fullName: true, mobile: true, email: true } } } }),
      prisma.application.count({ where }),
    ]);
    return { items, total, page, pageSize };
  });

  app.get('/staff/applications/:id', { schema: { params: id } }, async (req) => {
    const user = requireRole(req, 'COUNSELOR', 'ADMIN', 'SUPER_ADMIN');
    await loadForStaff(user, req.params.id);
    return prisma.application.findUniqueOrThrow({
      where: { id: req.params.id },
      include: {
        stage: true, assignedCounselor: person, student: { select: { id: true, fullName: true, mobile: true, email: true } },
        history: { orderBy: { createdAt: 'asc' }, include: { toStage: true, changedBy: person } },
        notes: { orderBy: { createdAt: 'desc' }, include: { author: { select: { fullName: true } } } },
      },
    });
  });

  app.post('/staff/applications/:id/stage', { schema: { params: id, body: stageChangeSchema } }, async (req) => {
    const user = requireRole(req, 'COUNSELOR', 'ADMIN', 'SUPER_ADMIN');
    const a = await loadForStaff(user, req.params.id);
    const stage = await prisma.applicationStage.findUnique({ where: { id: req.body.stageId } });
    if (!stage || !stage.active) throw badRequest('INVALID_STAGE', 'Unknown stage');
    await prisma.$transaction(async (tx) => {
      await tx.application.update({ where: { id: a.id }, data: { stageId: stage.id, closedAt: stage.code === CLOSED_CODE ? new Date() : null } });
      await tx.applicationStageHistory.create({ data: { applicationId: a.id, fromStageId: a.stageId, toStageId: stage.id, changedById: user.id, note: req.body.note } });
      await notify(tx, { userId: a.studentId, type: 'APPLICATION', titleKey: 'applicationStage.title', bodyKey: 'applicationStage.body', params: { stageCode: stage.code }, link: '/dashboard/application' });
      await audit(tx, { actorId: user.id, action: 'application.stage', entityType: 'Application', entityId: a.id, ip: req.ip, metadata: { from: a.stageId, to: stage.id } });
    });
    return { ok: true };
  });

  app.post('/staff/applications/:id/notes', { schema: { params: id, body: applicationNoteSchema } }, async (req, reply) => {
    const user = requireRole(req, 'COUNSELOR', 'ADMIN', 'SUPER_ADMIN');
    const a = await loadForStaff(user, req.params.id);
    const note = await prisma.applicationNote.create({ data: { ...req.body, applicationId: a.id, authorId: user.id } });
    if (note.visibleToStudent) await notify(prisma, { userId: a.studentId, type: 'APPLICATION', titleKey: 'applicationNote.title', bodyKey: 'applicationNote.body', link: '/dashboard/application' });
    await prisma.application.update({ where: { id: a.id }, data: { updatedAt: new Date() } });
    reply.code(201);
    return note;
  });

  app.patch('/staff/applications/:id', { schema: { params: id, body: applicationUpdateSchema } }, async (req) => {
    const user = requireRole(req, 'COUNSELOR', 'ADMIN', 'SUPER_ADMIN');
    const a = await loadForStaff(user, req.params.id);
    if (req.body.assignedCounselorId !== undefined) {
      if (!isAdmin(user)) throw forbidden();
      if (req.body.assignedCounselorId) {
        const c = await prisma.user.findUnique({ where: { id: req.body.assignedCounselorId } });
        if (!c || c.role !== 'COUNSELOR' || c.status !== 'ACTIVE') throw badRequest('INVALID_COUNSELOR', 'Not an active counselor');
      }
    }
    const updated = await prisma.application.update({ where: { id: a.id }, data: req.body });
    await audit(prisma, { actorId: user.id, action: 'application.update', entityType: 'Application', entityId: a.id, ip: req.ip, metadata: req.body });
    return updated;
  });

  // ---- Admin: configurable workflow ----
  app.get('/admin/stages', async (req) => {
    requireRole(req, 'ADMIN', 'SUPER_ADMIN');
    return { items: await prisma.applicationStage.findMany({ orderBy: { order: 'asc' } }) };
  });
  app.post('/admin/stages', { schema: { body: stageSchema } }, async (req, reply) => {
    const actor = requireRole(req, 'ADMIN', 'SUPER_ADMIN');
    const s = await prisma.applicationStage.create({ data: req.body });
    await audit(prisma, { actorId: actor.id, action: 'stage.create', entityType: 'ApplicationStage', entityId: s.id, ip: req.ip });
    reply.code(201);
    return s;
  });
  app.put('/admin/stages/:id', { schema: { params: id, body: stageSchema } }, async (req) => {
    const actor = requireRole(req, 'ADMIN', 'SUPER_ADMIN');
    const s = await prisma.applicationStage.update({ where: { id: req.params.id }, data: req.body });
    await audit(prisma, { actorId: actor.id, action: 'stage.update', entityType: 'ApplicationStage', entityId: s.id, ip: req.ip });
    return s;
  });
};
