import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { announcementSchema, attendanceSchema, batchSchema, courseSchema, enrollSchema, materialSchema } from '@acee/shared';
import { prisma, type Db } from '../db';
import { type AuthUser, isAdmin, requireAuth, requireRole } from '../lib/auth';
import { audit } from '../lib/audit';
import { notify } from '../lib/notify';
import { badRequest, forbidden, notFound } from '../lib/errors';
import { toCsv } from '../lib/csv';

const id = z.object({ id: z.string().min(1) });
const trainerSelect = { select: { id: true, fullName: true } } as const;

async function withSeats<T extends { id: string }>(batches: T[]) {
  const counts = await prisma.enrollment.groupBy({ by: ['batchId'], where: { batchId: { in: batches.map((b) => b.id) }, status: 'CONFIRMED' }, _count: true });
  const map = new Map(counts.map((c) => [c.batchId, c._count]));
  return batches.map((b) => ({ ...b, seatsTaken: map.get(b.id) ?? 0 }));
}

/** read: enrolled students, the batch trainer, admins. manage: trainer + admins only. */
async function assertBatchAccess(user: AuthUser, batchId: string, mode: 'read' | 'manage') {
  const batch = await prisma.batch.findUnique({ where: { id: batchId } });
  if (!batch) throw notFound('Batch');
  if (isAdmin(user) || batch.trainerId === user.id) return batch;
  if (mode === 'read' && user.role === 'STUDENT') {
    const e = await prisma.enrollment.findUnique({ where: { userId_batchId: { userId: user.id, batchId } } });
    if (e?.status === 'CONFIRMED' || e?.status === 'COMPLETED') return batch;
  }
  throw forbidden();
}

/** Promote the oldest waitlisted student when a seat frees up. */
async function promoteWaitlist(tx: Db, batchId: string) {
  const [batch, taken] = await Promise.all([
    tx.batch.findUniqueOrThrow({ where: { id: batchId }, include: { course: true } }),
    tx.enrollment.count({ where: { batchId, status: 'CONFIRMED' } }),
  ]);
  if (taken >= batch.capacity) return;
  const next = await tx.enrollment.findFirst({ where: { batchId, status: 'WAITLISTED' }, orderBy: { createdAt: 'asc' } });
  if (!next) return;
  await tx.enrollment.update({ where: { id: next.id }, data: { status: 'CONFIRMED' } });
  await notify(tx, { userId: next.userId, type: 'COACHING', titleKey: 'enrollmentConfirmed.title', bodyKey: 'enrollmentConfirmed.body', params: { course: batch.course.code, batch: batch.name }, link: '/dashboard/coaching' });
}

export const coachingRoutes: FastifyPluginAsyncZod = async (app) => {
  // ---- Public catalogue ----
  app.get('/courses', async () => ({ items: await prisma.course.findMany({ where: { active: true }, orderBy: { code: 'asc' } }) }));

  app.get('/courses/:code', { schema: { params: z.object({ code: z.string().max(20) }) } }, async (req) => {
    const course = await prisma.course.findUnique({ where: { code: req.params.code.toUpperCase() } });
    if (!course || !course.active) throw notFound('Course');
    const batches = await prisma.batch.findMany({
      where: { courseId: course.id, active: true, endDate: { gte: new Date() } }, orderBy: { startDate: 'asc' },
      include: { trainer: trainerSelect },
    });
    return { course, batches: await withSeats(batches) };
  });

  // ---- Student ----
  app.post('/enrollments', { schema: { body: enrollSchema } }, async (req, reply) => {
    const user = requireRole(req, 'STUDENT');
    const enrollment = await prisma.$transaction(async (tx) => {
      // Row lock serialises concurrent enrollments for the same batch so capacity cannot be exceeded.
      await tx.$queryRaw`SELECT id FROM "Batch" WHERE id = ${req.body.batchId} FOR UPDATE`;
      const batch = await tx.batch.findUnique({ where: { id: req.body.batchId }, include: { course: true } });
      if (!batch || !batch.active || batch.endDate < new Date()) throw notFound('Batch');
      const existing = await tx.enrollment.findUnique({ where: { userId_batchId: { userId: user.id, batchId: batch.id } } });
      if (existing && existing.status !== 'CANCELLED') throw badRequest('ALREADY_ENROLLED', 'You are already registered for this batch');
      const taken = await tx.enrollment.count({ where: { batchId: batch.id, status: 'CONFIRMED' } });
      const status = taken < batch.capacity ? 'CONFIRMED' : 'WAITLISTED';
      const e = existing
        ? await tx.enrollment.update({ where: { id: existing.id }, data: { status, preferredMode: req.body.preferredMode, createdAt: new Date() } })
        : await tx.enrollment.create({ data: { userId: user.id, batchId: batch.id, preferredMode: req.body.preferredMode, status } });
      await notify(tx, {
        userId: user.id, type: 'COACHING',
        titleKey: status === 'CONFIRMED' ? 'enrollmentConfirmed.title' : 'enrollmentWaitlisted.title',
        bodyKey: status === 'CONFIRMED' ? 'enrollmentConfirmed.body' : 'enrollmentWaitlisted.body',
        params: { course: batch.course.code, batch: batch.name }, link: '/dashboard/coaching',
      });
      return e;
    });
    reply.code(201);
    return enrollment;
  });

  app.get('/enrollments/mine', async (req) => {
    const user = requireRole(req, 'STUDENT');
    const items = await prisma.enrollment.findMany({
      where: { userId: user.id }, orderBy: { createdAt: 'desc' },
      include: { batch: { include: { course: true, trainer: trainerSelect } } },
    });
    return { items };
  });

  app.post('/enrollments/:id/cancel', { schema: { params: id } }, async (req) => {
    const user = requireAuth(req);
    await prisma.$transaction(async (tx) => {
      const e = await tx.enrollment.findUnique({ where: { id: req.params.id } });
      if (!e) throw notFound('Enrollment');
      if (e.userId !== user.id && !isAdmin(user)) throw forbidden();
      await tx.$queryRaw`SELECT id FROM "Batch" WHERE id = ${e.batchId} FOR UPDATE`;
      await tx.enrollment.update({ where: { id: e.id }, data: { status: 'CANCELLED' } });
      if (e.status === 'CONFIRMED') await promoteWaitlist(tx, e.batchId);
    });
    return { ok: true };
  });

  app.get('/batches/:id/materials', { schema: { params: id } }, async (req) => {
    const user = requireAuth(req);
    const batch = await assertBatchAccess(user, req.params.id, 'read');
    const items = await prisma.studyMaterial.findMany({ where: { OR: [{ batchId: batch.id }, { courseId: batch.courseId, batchId: null }] }, orderBy: { createdAt: 'desc' } });
    return { items };
  });

  app.get('/batches/:id/announcements', { schema: { params: id } }, async (req) => {
    const user = requireAuth(req);
    await assertBatchAccess(user, req.params.id, 'read');
    return { items: await prisma.announcement.findMany({ where: { batchId: req.params.id }, orderBy: { publishedAt: 'desc' }, take: 50 }) };
  });

  app.get('/attendance/mine', async (req) => {
    const user = requireRole(req, 'STUDENT');
    const rows = await prisma.attendance.findMany({ where: { userId: user.id }, orderBy: { date: 'desc' }, include: { batch: { select: { id: true, name: true } } } });
    return { items: rows };
  });

  // ---- Trainer ----
  app.get('/trainer/batches', async (req) => {
    const user = requireRole(req, 'TRAINER', 'ADMIN', 'SUPER_ADMIN');
    const batches = await prisma.batch.findMany({ where: { trainerId: user.id }, include: { course: true, trainer: trainerSelect }, orderBy: { startDate: 'asc' } });
    return { items: await withSeats(batches) };
  });

  app.get('/batches/:id/roster', { schema: { params: id } }, async (req) => {
    const user = requireRole(req, 'TRAINER', 'ADMIN', 'SUPER_ADMIN');
    await assertBatchAccess(user, req.params.id, 'manage');
    const items = await prisma.enrollment.findMany({
      where: { batchId: req.params.id, status: { in: ['CONFIRMED', 'COMPLETED'] } },
      // Trainers get names only, not contact details or other student records.
      include: { user: { select: { id: true, fullName: true } } }, orderBy: { createdAt: 'asc' },
    });
    return { items };
  });

  app.get('/batches/:id/attendance', { schema: { params: id, querystring: z.object({ date: z.iso.date() }) } }, async (req) => {
    const user = requireRole(req, 'TRAINER', 'ADMIN', 'SUPER_ADMIN');
    await assertBatchAccess(user, req.params.id, 'manage');
    return { items: await prisma.attendance.findMany({ where: { batchId: req.params.id, date: new Date(req.query.date) } }) };
  });

  app.post('/batches/:id/attendance', { schema: { params: id, body: attendanceSchema } }, async (req) => {
    const user = requireRole(req, 'TRAINER', 'ADMIN', 'SUPER_ADMIN');
    const batch = await assertBatchAccess(user, req.params.id, 'manage');
    const enrolled = new Set((await prisma.enrollment.findMany({ where: { batchId: batch.id, status: { in: ['CONFIRMED', 'COMPLETED'] } }, select: { userId: true } })).map((e) => e.userId));
    const bad = req.body.records.find((r) => !enrolled.has(r.userId));
    if (bad) throw badRequest('NOT_ENROLLED', 'Attendance can only be marked for students enrolled in this batch');
    const date = new Date(req.body.date);
    await prisma.$transaction(req.body.records.map((r) => prisma.attendance.upsert({
      where: { batchId_userId_date: { batchId: batch.id, userId: r.userId, date } },
      create: { batchId: batch.id, userId: r.userId, date, status: r.status, markedById: user.id },
      update: { status: r.status, markedById: user.id },
    })));
    await audit(prisma, { actorId: user.id, action: 'attendance.mark', entityType: 'Batch', entityId: batch.id, ip: req.ip, metadata: { date: req.body.date, count: req.body.records.length } });
    return { ok: true, count: req.body.records.length };
  });

  app.post('/batches/:id/materials', { schema: { params: id, body: materialSchema } }, async (req, reply) => {
    const user = requireRole(req, 'TRAINER', 'ADMIN', 'SUPER_ADMIN');
    const batch = await assertBatchAccess(user, req.params.id, 'manage');
    reply.code(201);
    return prisma.studyMaterial.create({ data: { ...req.body, batchId: batch.id, createdById: user.id } });
  });

  app.post('/batches/:id/announcements', {
    schema: { params: id, body: z.object({ title: z.string().trim().min(2).max(200), body: z.string().trim().min(1).max(5000) }) },
  }, async (req, reply) => {
    const user = requireRole(req, 'TRAINER', 'ADMIN', 'SUPER_ADMIN');
    const batch = await assertBatchAccess(user, req.params.id, 'manage');
    const students = await prisma.enrollment.findMany({ where: { batchId: batch.id, status: 'CONFIRMED' }, select: { userId: true } });
    const a = await prisma.$transaction(async (tx) => {
      // Trainer-written text is stored as-is in every language slot; it is shown verbatim.
      const t = req.body.title, b = req.body.body;
      const ann = await tx.announcement.create({ data: { title: { en: t, te: t, hi: t }, body: { en: b, te: b, hi: b }, audience: 'BATCH', batchId: batch.id, createdById: user.id } });
      for (const s of students) await notify(tx, { userId: s.userId, type: 'CLASS', titleKey: 'classAnnouncement.title', bodyKey: 'classAnnouncement.body', params: { batch: batch.name, title: t }, link: '/dashboard/coaching' });
      return ann;
    });
    reply.code(201);
    return a;
  });

  // ---- Admin ----
  app.get('/admin/courses', async (req) => {
    requireRole(req, 'ADMIN', 'SUPER_ADMIN');
    return { items: await prisma.course.findMany({ orderBy: { code: 'asc' } }) };
  });

  app.put('/admin/courses/:id', { schema: { params: id, body: courseSchema } }, async (req) => {
    const actor = requireRole(req, 'ADMIN', 'SUPER_ADMIN');
    const c = await prisma.course.update({ where: { id: req.params.id }, data: req.body });
    await audit(prisma, { actorId: actor.id, action: 'course.update', entityType: 'Course', entityId: c.id, ip: req.ip });
    return c;
  });

  app.post('/admin/courses', { schema: { body: courseSchema } }, async (req, reply) => {
    const actor = requireRole(req, 'ADMIN', 'SUPER_ADMIN');
    const c = await prisma.course.create({ data: req.body });
    await audit(prisma, { actorId: actor.id, action: 'course.create', entityType: 'Course', entityId: c.id, ip: req.ip });
    reply.code(201);
    return c;
  });

  app.get('/admin/batches', async (req) => {
    requireRole(req, 'ADMIN', 'SUPER_ADMIN');
    const batches = await prisma.batch.findMany({ include: { course: true, trainer: trainerSelect }, orderBy: { startDate: 'desc' } });
    return { items: await withSeats(batches) };
  });

  const checkTrainer = async (trainerId: string | null) => {
    if (!trainerId) return;
    const t = await prisma.user.findUnique({ where: { id: trainerId } });
    if (!t || t.role !== 'TRAINER' || t.status !== 'ACTIVE') throw badRequest('INVALID_TRAINER', 'Selected user is not an active trainer');
  };

  app.post('/admin/batches', { schema: { body: batchSchema } }, async (req, reply) => {
    const actor = requireRole(req, 'ADMIN', 'SUPER_ADMIN');
    await checkTrainer(req.body.trainerId);
    const b = await prisma.batch.create({ data: req.body });
    await audit(prisma, { actorId: actor.id, action: 'batch.create', entityType: 'Batch', entityId: b.id, ip: req.ip });
    reply.code(201);
    return b;
  });

  app.put('/admin/batches/:id', { schema: { params: id, body: batchSchema } }, async (req) => {
    const actor = requireRole(req, 'ADMIN', 'SUPER_ADMIN');
    await checkTrainer(req.body.trainerId);
    const b = await prisma.$transaction(async (tx) => {
      const updated = await tx.batch.update({ where: { id: req.params.id }, data: req.body });
      await promoteWaitlist(tx, updated.id);
      return updated;
    });
    await audit(prisma, { actorId: actor.id, action: 'batch.update', entityType: 'Batch', entityId: b.id, ip: req.ip });
    return b;
  });

  app.get('/admin/batches/:id/enrollments', { schema: { params: id } }, async (req) => {
    requireRole(req, 'ADMIN', 'SUPER_ADMIN');
    return { items: await prisma.enrollment.findMany({ where: { batchId: req.params.id }, include: { user: { select: { id: true, fullName: true, mobile: true, email: true } } }, orderBy: { createdAt: 'asc' } }) };
  });

  app.patch('/admin/enrollments/:id', { schema: { params: id, body: z.object({ status: z.enum(['CONFIRMED', 'WAITLISTED', 'CANCELLED', 'COMPLETED']) }) } }, async (req) => {
    const actor = requireRole(req, 'ADMIN', 'SUPER_ADMIN');
    const e = await prisma.$transaction(async (tx) => {
      const cur = await tx.enrollment.findUnique({ where: { id: req.params.id } });
      if (!cur) throw notFound('Enrollment');
      await tx.$queryRaw`SELECT id FROM "Batch" WHERE id = ${cur.batchId} FOR UPDATE`;
      if (req.body.status === 'CONFIRMED' && cur.status !== 'CONFIRMED') {
        const [batch, taken] = await Promise.all([tx.batch.findUniqueOrThrow({ where: { id: cur.batchId } }), tx.enrollment.count({ where: { batchId: cur.batchId, status: 'CONFIRMED' } })]);
        if (taken >= batch.capacity) throw badRequest('BATCH_FULL', 'This batch is full. Increase capacity first.');
      }
      const updated = await tx.enrollment.update({ where: { id: cur.id }, data: { status: req.body.status } });
      if (cur.status === 'CONFIRMED' && req.body.status === 'CANCELLED') await promoteWaitlist(tx, cur.batchId);
      return updated;
    });
    await audit(prisma, { actorId: actor.id, action: 'enrollment.status', entityType: 'Enrollment', entityId: e.id, ip: req.ip, metadata: { status: e.status } });
    return e;
  });

  app.post('/admin/announcements', { schema: { body: announcementSchema } }, async (req, reply) => {
    const actor = requireRole(req, 'ADMIN', 'SUPER_ADMIN');
    const a = await prisma.announcement.create({ data: { ...req.body, createdById: actor.id } });
    await audit(prisma, { actorId: actor.id, action: 'announcement.create', entityType: 'Announcement', entityId: a.id, ip: req.ip });
    reply.code(201);
    return a;
  });

  app.delete('/admin/announcements/:id', { schema: { params: id } }, async (req, reply) => {
    const actor = requireRole(req, 'ADMIN', 'SUPER_ADMIN');
    await prisma.announcement.delete({ where: { id: req.params.id } });
    await audit(prisma, { actorId: actor.id, action: 'announcement.delete', entityType: 'Announcement', entityId: req.params.id, ip: req.ip });
    return reply.code(204).send();
  });

  app.get('/admin/reports/attendance', { schema: { querystring: z.object({ batchId: z.string().min(1), format: z.enum(['json', 'csv']).default('json') }) } }, async (req, reply) => {
    requireRole(req, 'ADMIN', 'SUPER_ADMIN');
    const rows = await prisma.attendance.groupBy({ by: ['userId', 'status'], where: { batchId: req.query.batchId }, _count: true });
    const users = await prisma.user.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.userId))] } }, select: { id: true, fullName: true } });
    const report = users.map((u) => {
      const c = (s: string) => rows.find((r) => r.userId === u.id && r.status === s)?._count ?? 0;
      const total = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'].reduce((n, s) => n + c(s), 0);
      return { student: u.fullName, present: c('PRESENT'), late: c('LATE'), absent: c('ABSENT'), excused: c('EXCUSED'), total, ratePct: total ? Math.round(((c('PRESENT') + c('LATE')) / total) * 100) : 0 };
    });
    if (req.query.format === 'csv') return reply.type('text/csv').header('Content-Disposition', 'attachment; filename="attendance.csv"').send(toCsv(report));
    return { items: report };
  });
};
