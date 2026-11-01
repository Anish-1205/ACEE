import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { ALLOWED_UPLOAD_TYPES, DOCUMENT_CATEGORIES, documentReviewSchema } from '@acee/shared';
import { prisma } from '../db';
import { type AuthUser, assertStaffCanAccessStudent, isAdmin, requireAuth, requireRole } from '../lib/auth';
import { audit } from '../lib/audit';
import { notify } from '../lib/notify';
import { sniffMime, storage } from '../lib/storage';
import { HttpError, badRequest, forbidden, notFound } from '../lib/errors';

const id = z.object({ id: z.string().min(1) });
const listSelect = { id: true, category: true, fileName: true, mimeType: true, sizeBytes: true, status: true, version: true, createdAt: true } as const;

async function loadForAccess(user: AuthUser, docId: string) {
  const doc = await prisma.document.findUnique({ where: { id: docId } });
  if (!doc || doc.status === 'DELETED') throw notFound('Document');
  if (doc.ownerId === user.id) return doc;
  if (user.role === 'STUDENT' || user.role === 'TRAINER') throw forbidden();
  await assertStaffCanAccessStudent(user, doc.ownerId);
  return doc;
}

export const documentRoutes: FastifyPluginAsyncZod = async (app) => {
  app.post('/documents', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (req, reply) => {
    const user = requireRole(req, 'STUDENT');
    const file = await req.file();
    if (!file) throw badRequest('NO_FILE', 'Please choose a file');
    const category = z.enum(DOCUMENT_CATEGORIES).safeParse((file.fields.category as { value?: string } | undefined)?.value);
    if (!category.success) throw badRequest('INVALID_CATEGORY', 'Please choose a document type');
    const buf = await file.toBuffer(); // throws FST_REQ_FILE_TOO_LARGE past the multipart limit
    const sniffed = sniffMime(buf);
    if (!sniffed || !(ALLOWED_UPLOAD_TYPES as readonly string[]).includes(sniffed)) throw badRequest('INVALID_FILE_TYPE', 'Only PDF, JPG or PNG files are allowed');

    const previous = await prisma.document.findFirst({ where: { ownerId: user.id, category: category.data, status: { in: ['PENDING', 'REJECTED', 'APPROVED'] } }, orderBy: { version: 'desc' } });
    const key = await storage.put(buf);
    const fileName = file.filename.replace(/[^\w.\- ]+/g, '_').slice(0, 120) || 'document';
    try {
      const doc = await prisma.$transaction(async (tx) => {
        if (previous) await tx.document.update({ where: { id: previous.id }, data: { status: 'SUPERSEDED' } });
        const d = await tx.document.create({
          data: {
            ownerId: user.id, category: category.data, fileName, mimeType: sniffed, sizeBytes: buf.length,
            sha256: createHash('sha256').update(buf).digest('hex'), storageKey: key, version: (previous?.version ?? 0) + 1, replacesId: previous?.id ?? null,
          },
          select: listSelect,
        });
        await audit(tx, { actorId: user.id, action: 'document.upload', entityType: 'Document', entityId: d.id, ip: req.ip, metadata: { category: d.category, version: d.version } });
        return d;
      });
      reply.code(201);
      return doc;
    } catch (e) {
      await storage.remove(key); // no orphaned files if the DB write fails
      throw e;
    }
  });

  app.get('/documents/mine', async (req) => {
    const user = requireRole(req, 'STUDENT');
    const docs = await prisma.document.findMany({
      where: { ownerId: user.id, status: { not: 'DELETED' } }, orderBy: [{ category: 'asc' }, { version: 'desc' }],
      select: { ...listSelect, reviews: { orderBy: { createdAt: 'desc' }, take: 1, select: { decision: true, reason: true } } },
    });
    return { items: docs.map(({ reviews, ...d }) => ({ ...d, rejectionReason: reviews[0]?.decision === 'REJECTED' ? reviews[0].reason : null })) };
  });

  app.get('/documents/:id/download', { schema: { params: id } }, async (req, reply) => {
    const user = requireAuth(req);
    const doc = await loadForAccess(user, req.params.id);
    const data = await storage.get(doc.storageKey).catch(() => { throw new HttpError(410, 'FILE_MISSING', 'File is no longer available'); });
    await audit(prisma, { actorId: user.id, action: 'document.download', entityType: 'Document', entityId: doc.id, ip: req.ip, metadata: { ownerId: doc.ownerId } });
    return reply
      .header('Content-Type', doc.mimeType)
      .header('Content-Disposition', `attachment; filename="${doc.fileName.replace(/"/g, '')}"`)
      .header('Cache-Control', 'private, no-store')
      .header('X-Content-Type-Options', 'nosniff')
      .send(data);
  });

  /** Student deletion: file is purged from storage immediately; the row stays (status DELETED) for the audit trail. */
  app.delete('/documents/:id', { schema: { params: id } }, async (req, reply) => {
    const user = requireAuth(req);
    const doc = await loadForAccess(user, req.params.id);
    if (doc.ownerId !== user.id && !isAdmin(user)) throw forbidden();
    await storage.remove(doc.storageKey);
    await prisma.document.update({ where: { id: doc.id }, data: { status: 'DELETED', deletedAt: new Date() } });
    await audit(prisma, { actorId: user.id, action: 'document.delete', entityType: 'Document', entityId: doc.id, ip: req.ip, metadata: { ownerId: doc.ownerId } });
    return reply.code(204).send();
  });

  // ---- Review queue ----
  app.get('/staff/documents', { schema: { querystring: z.object({ status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).default('PENDING') }) } }, async (req) => {
    const user = requireRole(req, 'COUNSELOR', 'ADMIN', 'SUPER_ADMIN');
    const scope = isAdmin(user) ? {} : {
      owner: { OR: [{ applications: { some: { assignedCounselorId: user.id } } }, { studentAppointments: { some: { counselorId: user.id } } }] },
    };
    const items = await prisma.document.findMany({
      where: { status: req.query.status, ...scope }, orderBy: { createdAt: 'asc' }, take: 100,
      select: { ...listSelect, owner: { select: { id: true, fullName: true } } },
    });
    return { items };
  });

  app.post('/staff/documents/:id/review', { schema: { params: id, body: documentReviewSchema } }, async (req) => {
    const user = requireRole(req, 'COUNSELOR', 'ADMIN', 'SUPER_ADMIN');
    const doc = await loadForAccess(user, req.params.id);
    if (doc.status !== 'PENDING') throw badRequest('NOT_PENDING', 'Only pending documents can be reviewed');
    await prisma.$transaction(async (tx) => {
      await tx.documentReview.create({ data: { documentId: doc.id, reviewerId: user.id, decision: req.body.decision, reason: req.body.reason } });
      await tx.document.update({ where: { id: doc.id }, data: { status: req.body.decision } });
      await notify(tx, {
        userId: doc.ownerId, type: 'DOCUMENT',
        titleKey: req.body.decision === 'APPROVED' ? 'documentApproved.title' : 'documentRejected.title',
        bodyKey: req.body.decision === 'APPROVED' ? 'documentApproved.body' : 'documentRejected.body',
        params: { category: doc.category, reason: req.body.reason }, link: '/dashboard/documents',
      });
      await audit(tx, { actorId: user.id, action: 'document.review', entityType: 'Document', entityId: doc.id, ip: req.ip, metadata: { decision: req.body.decision } });
    });
    return { ok: true };
  });
};
