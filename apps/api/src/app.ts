import Fastify, { type FastifyError } from 'fastify';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import {
  hasZodFastifySchemaValidationErrors, jsonSchemaTransform, serializerCompiler, validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { MAX_UPLOAD_BYTES } from '@acee/shared';
import { config, isProd } from './config';
import { HttpError } from './lib/errors';
import { requireRole, resolveUser } from './lib/auth';
import { authRoutes } from './routes/auth';
import { meRoutes } from './routes/me';
import { eligibilityRoutes } from './routes/eligibility';
import { coachingRoutes } from './routes/coaching';
import { counselingRoutes } from './routes/counseling';
import { applicationRoutes } from './routes/applications';
import { documentRoutes } from './routes/documents';
import { contentRoutes } from './routes/content';
import { adminRoutes } from './routes/admin';

export async function buildApp(opts: { logger?: boolean } = {}) {
  const app = Fastify({ logger: opts.logger === false ? false : isProd ? true : { level: 'info' }, trustProxy: config.TRUST_PROXY, bodyLimit: 1_000_000 })
    .withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cookie);
  await app.register(multipart, { limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 5 } });
  await app.register(rateLimit, { max: 300, timeWindow: '1 minute' });
  await app.register(swagger, {
    openapi: { info: { title: 'ACEE Global Education API', version: '1.0.0' } },
    transform: jsonSchemaTransform,
  });
  await app.register(swaggerUi, { routePrefix: '/docs' });

  app.decorateRequest('user', null);
  app.decorateRequest('sessionId', null);
  app.addHook('onRequest', resolveUser);
  // Every /admin/* route is admin-only; checked before body validation so outsiders get 401/403, not schema hints.
  app.addHook('onRequest', async (req) => { if (req.url.startsWith('/api/v1/admin/')) requireRole(req, 'ADMIN', 'SUPER_ADMIN'); });

  app.setErrorHandler((err: FastifyError, req, reply) => {
    if (hasZodFastifySchemaValidationErrors(err)) {
      return reply.code(400).send({ code: 'VALIDATION_ERROR', message: 'Please check the highlighted fields', details: err.validation });
    }
    if (err instanceof HttpError) return reply.code(err.statusCode).send({ code: err.code, message: err.message, details: err.details });
    if ((err as { code?: string }).code === 'P2002') return reply.code(409).send({ code: 'DUPLICATE', message: 'This record already exists' });
    if (err.statusCode === 429) return reply.code(429).send({ code: 'RATE_LIMITED', message: 'Too many requests. Please wait a minute.' });
    if (err.code === 'FST_REQ_FILE_TOO_LARGE') return reply.code(413).send({ code: 'FILE_TOO_LARGE', message: 'File is too large' });
    if (err.statusCode && err.statusCode < 500) return reply.code(err.statusCode).send({ code: err.code ?? 'BAD_REQUEST', message: err.message });
    req.log.error(err);
    return reply.code(500).send({ code: 'INTERNAL', message: 'Something went wrong. Please try again.' });
  });

  app.get('/health', async () => ({ ok: true }));

  await app.register(async (api) => {
    await api.register(authRoutes, { prefix: '/auth' });
    await api.register(meRoutes, { prefix: '/me' });
    await api.register(eligibilityRoutes);
    await api.register(coachingRoutes);
    await api.register(counselingRoutes);
    await api.register(applicationRoutes);
    await api.register(documentRoutes);
    await api.register(contentRoutes);
    await api.register(adminRoutes, { prefix: '/admin' });
  }, { prefix: '/api/v1' });

  return app;
}
export type App = Awaited<ReturnType<typeof buildApp>>;
