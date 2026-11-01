import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { eligibilityInputSchema, evaluateEligibility, ruleSchema, ruleVersionInputSchema } from '@acee/shared';
import { prisma } from '../db';
import { requireAuth, requireRole } from '../lib/auth';
import { audit } from '../lib/audit';
import { notFound } from '../lib/errors';

const id = z.object({ id: z.string().min(1) });

export const eligibilityRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get('/schemes', async () => {
    const schemes = await prisma.scholarshipScheme.findMany({
      where: { active: true },
      include: { versions: { where: { active: true }, select: { id: true, category: true, version: true, rules: true, sourceUrl: true, goReference: true, verifiedAt: true, effectiveFrom: true, notes: true } } },
    });
    return { schemes };
  });

  app.post('/eligibility/check', {
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    schema: { body: z.object({ schemeCode: z.string().min(1).max(60), input: eligibilityInputSchema }) },
  }, async (req) => {
    const { schemeCode, input } = req.body;
    const scheme = await prisma.scholarshipScheme.findUnique({ where: { code: schemeCode } });
    if (!scheme || !scheme.active) throw notFound('Scheme');
    const version = input.category === 'OTHER' ? null : await prisma.schemeRuleVersion.findFirst({
      where: { schemeId: scheme.id, category: input.category, active: true },
      orderBy: { version: 'desc' },
    });
    const rules = version ? z.array(ruleSchema).parse(version.rules) : null;
    const result = evaluateEligibility(input, rules);

    // Only signed-in students get a stored history; anonymous checks are not persisted (data minimisation).
    let assessmentId: string | null = null;
    if (req.user?.role === 'STUDENT') {
      const a = await prisma.eligibilityAssessment.create({
        data: { userId: req.user.id, schemeId: scheme.id, ruleVersionId: version?.id ?? null, inputs: input, outcome: result.outcome, results: result.results as object },
      });
      assessmentId = a.id;
    }
    return {
      ...result,
      assessmentId,
      ruleVersion: version && { id: version.id, version: version.version, goReference: version.goReference, sourceUrl: version.sourceUrl, verifiedAt: version.verifiedAt, effectiveFrom: version.effectiveFrom },
    };
  });

  app.get('/eligibility/history', async (req) => {
    const user = requireAuth(req);
    const items = await prisma.eligibilityAssessment.findMany({
      where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 20,
      include: { ruleVersion: { select: { version: true, category: true, goReference: true } }, scheme: { select: { code: true, name: true } } },
    });
    return { items };
  });

  // ---- Admin: versioned rules ----

  app.get('/admin/schemes', async (req) => {
    requireRole(req, 'ADMIN', 'SUPER_ADMIN');
    const schemes = await prisma.scholarshipScheme.findMany({ include: { versions: { orderBy: [{ category: 'asc' }, { version: 'desc' }] } } });
    return { schemes };
  });

  app.put('/admin/schemes/:id', {
    schema: { params: id, body: z.object({ name: z.record(z.string(), z.string()), description: z.record(z.string(), z.string()), officialUrl: z.url(), active: z.boolean() }) },
  }, async (req) => {
    const actor = requireRole(req, 'ADMIN', 'SUPER_ADMIN');
    const s = await prisma.scholarshipScheme.update({ where: { id: req.params.id }, data: req.body });
    await audit(prisma, { actorId: actor.id, action: 'scheme.update', entityType: 'ScholarshipScheme', entityId: s.id, ip: req.ip });
    return s;
  });

  app.post('/admin/schemes/:id/versions', { schema: { params: id, body: ruleVersionInputSchema } }, async (req, reply) => {
    const actor = requireRole(req, 'ADMIN', 'SUPER_ADMIN');
    const v = await prisma.$transaction(async (tx) => {
      const last = await tx.schemeRuleVersion.findFirst({ where: { schemeId: req.params.id, category: req.body.category }, orderBy: { version: 'desc' } });
      return tx.schemeRuleVersion.create({
        data: { ...req.body, schemeId: req.params.id, version: (last?.version ?? 0) + 1, active: false, createdById: actor.id },
      });
    });
    await audit(prisma, { actorId: actor.id, action: 'ruleVersion.create', entityType: 'SchemeRuleVersion', entityId: v.id, ip: req.ip, metadata: { category: v.category, version: v.version } });
    reply.code(201);
    return v;
  });

  app.post('/admin/rule-versions/:id/activate', { schema: { params: id } }, async (req) => {
    const actor = requireRole(req, 'ADMIN', 'SUPER_ADMIN');
    const v = await prisma.schemeRuleVersion.findUnique({ where: { id: req.params.id } });
    if (!v) throw notFound('Rule version');
    await prisma.$transaction([
      prisma.schemeRuleVersion.updateMany({ where: { schemeId: v.schemeId, category: v.category }, data: { active: false } }),
      prisma.schemeRuleVersion.update({ where: { id: v.id }, data: { active: true } }),
    ]);
    await audit(prisma, { actorId: actor.id, action: 'ruleVersion.activate', entityType: 'SchemeRuleVersion', entityId: v.id, ip: req.ip, metadata: { category: v.category, version: v.version } });
    return { ok: true };
  });
};
