import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  HOST: z.string().default('0.0.0.0'),
  /** Which proxies may set X-Forwarded-For: 'loopback' (Next.js on the same host), 'false', or a comma-separated IP/CIDR list. */
  TRUST_PROXY: z.string().default('loopback').transform((v) => (v === 'false' ? false : v === 'true' ? true : v)),
  DATABASE_URL: z.string().min(1),
  /** Comma-separated origins allowed to make cookie-authenticated mutating requests. */
  WEB_ORIGINS: z.string().default('http://localhost:3000'),
  PUBLIC_WEB_URL: z.string().default('http://localhost:3000'),
  /** Sites allowed to post the public inquiry form cross-origin (the main ACEE website). */
  INQUIRY_ORIGINS: z.string().default('https://www.aceereviewconsultants.com,https://aceereviewconsultants.com'),
  STORAGE_DRIVER: z.enum(['local']).default('local'),
  STORAGE_LOCAL_DIR: z.string().default('./storage'),
  ACCESS_TOKEN_MINUTES: z.coerce.number().default(15),
  REFRESH_TOKEN_DAYS: z.coerce.number().default(30),
  WEB_SESSION_DAYS: z.coerce.number().default(7),
  SMTP_URL: z.string().optional(),
  MAIL_FROM: z.string().default('ACEE Student Portal <no-reply@aceereviewconsultants.com>'),
  SMS_PROVIDER_KEY: z.string().optional(),
  WHATSAPP_TOKEN: z.string().optional(),
  EXPO_PUSH_ENABLED: z.stringbool().default(false),
});

export const config = schema.parse(process.env);
export const isProd = config.NODE_ENV === 'production';
