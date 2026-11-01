import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { cmsSchema, inquirySchema } from '@acee/shared';
import { prisma } from '../db';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { config } from '../config';
import { requireRole } from '../lib/auth';
import { audit } from '../lib/audit';
import { notFound } from '../lib/errors';

/** Keys whose content states business facts and therefore needs SUPER_ADMIN confirmation. */
export const FACT_KEYS = ['company'];

export const contentRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get('/cms/:key', { schema: { params: z.object({ key: z.string().regex(/^[a-z-]{2,40}$/) }) } }, async (req) => {
    const row = await prisma.cmsContent.findUnique({ where: { key: req.params.key } });
    if (!row) throw notFound('Content');
    return { key: row.key, content: row.content, confirmed: !!row.confirmedAt || !FACT_KEYS.includes(row.key), updatedAt: row.updatedAt };
  });

  app.get('/announcements', async (req) => {
    const role = req.user?.role;
    const audiences = !role ? ['PUBLIC'] : role === 'STUDENT' ? ['PUBLIC', 'STUDENTS'] : ['PUBLIC', 'STAFF', 'STUDENTS'];
    const now = new Date();
    return {
      items: await prisma.announcement.findMany({
        where: { audience: { in: audiences as never[] }, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
        orderBy: { publishedAt: 'desc' }, take: 20,
      }),
    };
  });

  /**
   * The main ACEE website's contact form may post here cross-origin (no cookies), so its leads land in the
   * portal's admin Leads list. Only origins in INQUIRY_ORIGINS get CORS headers.
   */
  const inquiryOrigins = config.INQUIRY_ORIGINS.split(',').map((s) => s.trim());
  const allowCors = (req: FastifyRequest, reply: FastifyReply) => {
    const origin = req.headers.origin;
    if (origin && inquiryOrigins.includes(origin)) {
      reply.header('Access-Control-Allow-Origin', origin).header('Vary', 'Origin');
    }
  };
  app.options('/inquiries', async (req, reply) => {
    allowCors(req, reply);
    return reply.header('Access-Control-Allow-Methods', 'POST').header('Access-Control-Allow-Headers', 'Content-Type').header('Access-Control-Max-Age', '86400').code(204).send();
  });

  app.post('/inquiries', { config: { rateLimit: { max: 5, timeWindow: '1 minute' } }, schema: { body: inquirySchema } }, async (req, reply) => {
    allowCors(req, reply);
    const { consent: _c, ...b } = req.body;
    await prisma.inquiry.create({ data: { ...b, email: b.email || null, consentAt: new Date(), ip: req.ip } });
    reply.code(201);
    return { ok: true };
  });

  // ---- Admin ----
  app.get('/admin/cms', async (req) => {
    requireRole(req, 'ADMIN', 'SUPER_ADMIN');
    return { items: await prisma.cmsContent.findMany({ orderBy: { key: 'asc' } }) };
  });

  app.put('/admin/cms/:key', { schema: { params: z.object({ key: z.string().regex(/^[a-z-]{2,40}$/) }), body: cmsSchema } }, async (req) => {
    const actor = requireRole(req, 'ADMIN', 'SUPER_ADMIN');
    // Editing business facts resets confirmation: a SUPER_ADMIN must re-confirm before it is treated as verified.
    const reset = FACT_KEYS.includes(req.params.key) ? { confirmedAt: null, confirmedById: null } : {};
    const row = await prisma.cmsContent.upsert({
      where: { key: req.params.key },
      create: { key: req.params.key, content: req.body.content as object, updatedById: actor.id },
      update: { content: req.body.content as object, updatedById: actor.id, ...reset },
    });
    await audit(prisma, { actorId: actor.id, action: 'cms.update', entityType: 'CmsContent', entityId: row.key, ip: req.ip });
    return row;
  });

  app.post('/admin/cms/:key/confirm', { schema: { params: z.object({ key: z.string() }) } }, async (req) => {
    const actor = requireRole(req, 'SUPER_ADMIN');
    const row = await prisma.cmsContent.update({ where: { key: req.params.key }, data: { confirmedAt: new Date(), confirmedById: actor.id } });
    await audit(prisma, { actorId: actor.id, action: 'cms.confirm', entityType: 'CmsContent', entityId: row.key, ip: req.ip });
    return { ok: true };
  });
};
