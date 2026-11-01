import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { appointmentStatusSchema, availabilitySchema, bookAppointmentSchema, counselorNoteSchema, rescheduleSchema } from '@acee/shared';
import { prisma, type Db } from '../db';
import { type AuthUser, assertStaffCanAccessStudent, isAdmin, requireAuth, requireRole } from '../lib/auth';
import { audit } from '../lib/audit';
import { notify } from '../lib/notify';
import { HttpError, badRequest, forbidden, notFound } from '../lib/errors';

const id = z.object({ id: z.string().min(1) });
const person = { select: { id: true, fullName: true } } as const;
/** All counseling hours are Indian Standard Time (UTC+05:30, no DST). */
const IST = '+05:30';

export type Slot = { counselorId: string; counselorName: string; startsAt: string; endsAt: string; mode: string };

/** Generate open slots for one IST calendar date from weekly availability minus booked appointments. */
export async function openSlots(date: string, counselorId?: string): Promise<Slot[]> {
  const dow = new Date(`${date}T12:00:00${IST}`).getUTCDay();
  const avail = await prisma.counselingAvailability.findMany({
    where: { dayOfWeek: dow, active: true, ...(counselorId ? { counselorId } : {}), counselor: { status: 'ACTIVE', role: 'COUNSELOR' } },
    include: { counselor: person },
  });
  const dayStart = new Date(`${date}T00:00:00${IST}`);
  const dayEnd = new Date(dayStart.getTime() + 86_400_000);
  const booked = await prisma.appointment.findMany({
    where: { status: 'BOOKED', startsAt: { gte: dayStart, lt: dayEnd }, counselorId: { in: avail.map((a) => a.counselorId) } },
    select: { counselorId: true, startsAt: true },
  });
  const taken = new Set(booked.map((b) => `${b.counselorId}|${b.startsAt.toISOString()}`));
  const now = Date.now();
  const slots: Slot[] = [];
  for (const a of avail) {
    const end = new Date(`${date}T${a.endTime}:00${IST}`).getTime();
    for (let t = new Date(`${date}T${a.startTime}:00${IST}`).getTime(); t + a.slotMinutes * 60_000 <= end; t += a.slotMinutes * 60_000) {
      const startsAt = new Date(t).toISOString();
      if (t <= now || taken.has(`${a.counselorId}|${startsAt}`)) continue;
      slots.push({ counselorId: a.counselorId, counselorName: a.counselor.fullName, startsAt, endsAt: new Date(t + a.slotMinutes * 60_000).toISOString(), mode: a.mode });
    }
  }
  return slots.sort((x, y) => x.startsAt.localeCompare(y.startsAt));
}

const istDate = (d: Date) => new Date(d.getTime() + 5.5 * 3600_000).toISOString().slice(0, 10);

async function findSlot(counselorId: string, startsAt: Date, mode: string) {
  const slot = (await openSlots(istDate(startsAt), counselorId)).find((s) => s.startsAt === startsAt.toISOString());
  if (!slot) throw new HttpError(409, 'SLOT_UNAVAILABLE', 'This time slot is no longer available. Please pick another.');
  if (slot.mode !== 'BOTH' && slot.mode !== mode) throw badRequest('MODE_UNAVAILABLE', `This slot is only available ${slot.mode.toLowerCase()}`);
  return slot;
}

/** The unique slot keys turn a concurrent double booking into a unique-constraint violation. */
async function createAppointment(tx: Db, data: { studentId: string; counselorId: string; startsAt: Date; endsAt: Date; type: string; mode: string; questions: string; rescheduledFromId?: string }) {
  const iso = data.startsAt.toISOString();
  try {
    return await tx.appointment.create({
      data: { ...data, counselorSlotKey: `${data.counselorId}|${iso}`, studentSlotKey: `${data.studentId}|${iso}` },
      include: { counselor: person },
    });
  } catch (e) {
    if ((e as { code?: string }).code === 'P2002') throw new HttpError(409, 'SLOT_UNAVAILABLE', 'This time slot is no longer available. Please pick another.');
    throw e;
  }
}

async function loadOwnAppointment(user: AuthUser, apptId: string) {
  const a = await prisma.appointment.findUnique({ where: { id: apptId } });
  if (!a) throw notFound('Appointment');
  if (a.studentId !== user.id && a.counselorId !== user.id && !isAdmin(user)) throw forbidden();
  return a;
}

export const counselingRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get('/counselors', async () => ({
    items: await prisma.user.findMany({ where: { role: 'COUNSELOR', status: 'ACTIVE' }, select: { id: true, fullName: true, counselorProfile: { select: { bio: true, languages: true } } } }),
  }));

  app.get('/counseling/slots', { schema: { querystring: z.object({ date: z.iso.date(), counselorId: z.string().optional() }) } }, async (req) => ({
    items: await openSlots(req.query.date, req.query.counselorId),
  }));

  app.post('/appointments', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } }, schema: { body: bookAppointmentSchema } }, async (req, reply) => {
    const user = requireRole(req, 'STUDENT');
    const startsAt = new Date(req.body.startsAt);
    const slot = await findSlot(req.body.counselorId, startsAt, req.body.mode);
    const appt = await prisma.$transaction(async (tx) => {
      const a = await createAppointment(tx, { studentId: user.id, counselorId: slot.counselorId, startsAt, endsAt: new Date(slot.endsAt), type: req.body.type, mode: req.body.mode, questions: req.body.questions });
      await notify(tx, { userId: user.id, type: 'COUNSELING', titleKey: 'appointmentBooked.title', bodyKey: 'appointmentBooked.body', params: { counselor: slot.counselorName, at: slot.startsAt }, link: '/dashboard/counseling' });
      await notify(tx, { userId: slot.counselorId, type: 'COUNSELING', titleKey: 'appointmentNew.title', bodyKey: 'appointmentNew.body', params: { student: user.fullName, at: slot.startsAt }, link: '/counselor' });
      return a;
    });
    reply.code(201);
    return appt;
  });

  app.get('/appointments/mine', async (req) => {
    const user = requireRole(req, 'STUDENT');
    return { items: await prisma.appointment.findMany({ where: { studentId: user.id }, orderBy: { startsAt: 'desc' }, include: { counselor: person }, omit: { counselorSlotKey: true, studentSlotKey: true } }) };
  });

  app.post('/appointments/:id/cancel', { schema: { params: id } }, async (req) => {
    const user = requireAuth(req);
    const a = await loadOwnAppointment(user, req.params.id);
    if (a.status !== 'BOOKED') throw badRequest('NOT_ACTIVE', 'This appointment is not active');
    await prisma.$transaction(async (tx) => {
      await tx.appointment.update({ where: { id: a.id }, data: { status: 'CANCELLED', cancelledAt: new Date(), counselorSlotKey: null, studentSlotKey: null } });
      const other = user.id === a.studentId ? a.counselorId : a.studentId;
      await notify(tx, { userId: other, type: 'COUNSELING', titleKey: 'appointmentCancelled.title', bodyKey: 'appointmentCancelled.body', params: { at: a.startsAt.toISOString() } });
    });
    return { ok: true };
  });

  app.post('/appointments/:id/reschedule', { schema: { params: id, body: rescheduleSchema } }, async (req) => {
    const user = requireRole(req, 'STUDENT');
    const a = await loadOwnAppointment(user, req.params.id);
    if (a.studentId !== user.id) throw forbidden();
    if (a.status !== 'BOOKED') throw badRequest('NOT_ACTIVE', 'This appointment is not active');
    const startsAt = new Date(req.body.startsAt);
    const slot = await findSlot(a.counselorId, startsAt, a.mode);
    return prisma.$transaction(async (tx) => {
      await tx.appointment.update({ where: { id: a.id }, data: { status: 'CANCELLED', cancelledAt: new Date(), counselorSlotKey: null, studentSlotKey: null } });
      const next = await createAppointment(tx, { studentId: user.id, counselorId: a.counselorId, startsAt, endsAt: new Date(slot.endsAt), type: a.type, mode: a.mode, questions: a.questions, rescheduledFromId: a.id });
      await notify(tx, { userId: a.counselorId, type: 'COUNSELING', titleKey: 'appointmentRescheduled.title', bodyKey: 'appointmentRescheduled.body', params: { student: user.fullName, at: slot.startsAt } });
      return next;
    });
  });

  // ---- Counselor ----
  app.get('/counselor/availability', async (req) => {
    const user = requireRole(req, 'COUNSELOR');
    return { items: await prisma.counselingAvailability.findMany({ where: { counselorId: user.id, active: true }, orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }] }) };
  });

  app.post('/counselor/availability', { schema: { body: availabilitySchema } }, async (req, reply) => {
    const user = requireRole(req, 'COUNSELOR');
    const overlap = await prisma.counselingAvailability.findFirst({
      where: { counselorId: user.id, active: true, dayOfWeek: req.body.dayOfWeek, startTime: { lt: req.body.endTime }, endTime: { gt: req.body.startTime } },
    });
    if (overlap) throw badRequest('OVERLAP', 'This overlaps existing working hours');
    reply.code(201);
    return prisma.counselingAvailability.create({ data: { ...req.body, counselorId: user.id } });
  });

  app.delete('/counselor/availability/:id', { schema: { params: id } }, async (req, reply) => {
    const user = requireRole(req, 'COUNSELOR');
    const r = await prisma.counselingAvailability.updateMany({ where: { id: req.params.id, counselorId: user.id }, data: { active: false } });
    if (r.count === 0) throw notFound('Availability');
    return reply.code(204).send();
  });

  app.get('/counselor/appointments', { schema: { querystring: z.object({ from: z.iso.date().optional(), counselorId: z.string().optional() }) } }, async (req) => {
    const user = requireRole(req, 'COUNSELOR', 'ADMIN', 'SUPER_ADMIN');
    const counselorId = isAdmin(user) ? req.query.counselorId : user.id;
    const from = req.query.from ? new Date(`${req.query.from}T00:00:00${IST}`) : new Date(Date.now() - 7 * 86_400_000);
    return {
      items: await prisma.appointment.findMany({
        where: { ...(counselorId ? { counselorId } : {}), startsAt: { gte: from } }, orderBy: { startsAt: 'asc' }, take: 200,
        include: { student: { select: { id: true, fullName: true, mobile: true } }, counselor: person },
        omit: { counselorSlotKey: true, studentSlotKey: true },
      }),
    };
  });

  app.patch('/appointments/:id', { schema: { params: id, body: appointmentStatusSchema.extend({ meetingLink: z.url().startsWith('https://').nullable().optional() }).partial({ status: true }) } }, async (req) => {
    const user = requireRole(req, 'COUNSELOR', 'ADMIN', 'SUPER_ADMIN');
    const a = await loadOwnAppointment(user, req.params.id);
    if (user.role === 'COUNSELOR' && a.counselorId !== user.id) throw forbidden();
    const releasing = !!req.body.status; // every allowed status ends the booking and frees the slot
    const updated = await prisma.appointment.update({
      where: { id: a.id },
      data: { ...req.body, ...(releasing ? { counselorSlotKey: null, studentSlotKey: null } : {}), ...(req.body.status === 'CANCELLED' ? { cancelledAt: new Date() } : {}) },
      omit: { counselorSlotKey: true, studentSlotKey: true },
    });
    if (req.body.meetingLink) await notify(prisma, { userId: a.studentId, type: 'COUNSELING', titleKey: 'meetingLink.title', bodyKey: 'meetingLink.body', params: { at: a.startsAt.toISOString() }, link: '/dashboard/counseling' });
    await audit(prisma, { actorId: user.id, action: 'appointment.update', entityType: 'Appointment', entityId: a.id, ip: req.ip, metadata: { status: req.body.status } });
    return updated;
  });

  app.get('/counselor/students', async (req) => {
    const user = requireRole(req, 'COUNSELOR', 'ADMIN', 'SUPER_ADMIN');
    const where = isAdmin(user) ? { role: 'STUDENT' as const } : {
      role: 'STUDENT' as const,
      OR: [{ applications: { some: { assignedCounselorId: user.id } } }, { studentAppointments: { some: { counselorId: user.id } } }],
    };
    const items = await prisma.user.findMany({
      where, take: 200, orderBy: { fullName: 'asc' },
      select: { id: true, fullName: true, mobile: true, district: true, applications: { where: { closedAt: null }, select: { id: true, stage: true, updatedAt: true } } },
    });
    return { items };
  });

  app.get('/counselor/students/:id', { schema: { params: id } }, async (req) => {
    const user = requireRole(req, 'COUNSELOR', 'ADMIN', 'SUPER_ADMIN');
    await assertStaffCanAccessStudent(user, req.params.id);
    const student = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true, fullName: true, email: true, mobile: true, district: true, preferredLanguage: true, role: true, studentProfile: true,
        assessments: { orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, outcome: true, createdAt: true, inputs: true } },
        documents: { where: { status: { not: 'DELETED' } }, orderBy: { createdAt: 'desc' }, select: { id: true, category: true, fileName: true, status: true, createdAt: true, mimeType: true, sizeBytes: true } },
        applications: { include: { stage: true } },
        studentAppointments: { orderBy: { startsAt: 'desc' }, take: 10, select: { id: true, startsAt: true, status: true, type: true, questions: true } },
        notesAbout: { orderBy: { createdAt: 'desc' }, include: { author: person } },
      },
    });
    if (!student || student.role !== 'STUDENT') throw notFound('Student');
    await audit(prisma, { actorId: user.id, action: 'student.view', entityType: 'User', entityId: student.id, ip: req.ip });
    return student;
  });

  app.post('/counselor/notes', { schema: { body: counselorNoteSchema } }, async (req, reply) => {
    const user = requireRole(req, 'COUNSELOR', 'ADMIN', 'SUPER_ADMIN');
    await assertStaffCanAccessStudent(user, req.body.studentId);
    reply.code(201);
    return prisma.counselorNote.create({ data: { ...req.body, followUpDate: req.body.followUpDate ? new Date(req.body.followUpDate) : null, authorId: user.id } });
  });

  app.patch('/counselor/notes/:id', { schema: { params: id, body: z.object({ followUpStatus: z.enum(['NONE', 'PENDING', 'DONE']) }) } }, async (req) => {
    const user = requireRole(req, 'COUNSELOR', 'ADMIN', 'SUPER_ADMIN');
    const r = await prisma.counselorNote.updateMany({ where: { id: req.params.id, ...(isAdmin(user) ? {} : { authorId: user.id }) }, data: req.body });
    if (r.count === 0) throw notFound('Note');
    return { ok: true };
  });

  app.get('/counselor/follow-ups', async (req) => {
    const user = requireRole(req, 'COUNSELOR');
    return { items: await prisma.counselorNote.findMany({ where: { authorId: user.id, followUpStatus: 'PENDING' }, orderBy: { followUpDate: 'asc' }, include: { student: person } }) };
  });
};

/** Creates one in-app reminder per appointment starting in the next 24 hours. Called on an interval by server.ts. */
export async function sendAppointmentReminders() {
  const due = await prisma.appointment.findMany({
    where: { status: 'BOOKED', reminderSentAt: null, startsAt: { gt: new Date(), lte: new Date(Date.now() + 86_400_000) } },
    include: { counselor: person },
  });
  for (const a of due) {
    const claimed = await prisma.appointment.updateMany({ where: { id: a.id, reminderSentAt: null }, data: { reminderSentAt: new Date() } });
    if (claimed.count) await notify(prisma, { userId: a.studentId, type: 'COUNSELING', titleKey: 'appointmentReminder.title', bodyKey: 'appointmentReminder.body', params: { counselor: a.counselor.fullName, at: a.startsAt.toISOString() }, link: '/dashboard/counseling' });
  }
  return due.length;
}
