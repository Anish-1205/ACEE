import { buildApp, type App } from '../src/app';
import { prisma } from '../src/db';
import { hashPassword } from '../src/lib/auth';

export const PASSWORD = 'TestPassword123';
let ipCounter = 1;
/** Each call gets its own client IP so per-IP rate limits do not interfere between tests. */
export const ip = () => `10.0.${Math.floor(ipCounter / 250)}.${(ipCounter++ % 250) + 1}`;

export async function resetDb() {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  await prisma.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(', ')} CASCADE`);
}

let n = 0;
export async function makeUser(role: 'STUDENT' | 'COUNSELOR' | 'TRAINER' | 'ADMIN' | 'SUPER_ADMIN' = 'STUDENT') {
  n++;
  return prisma.user.create({
    data: {
      email: `${role.toLowerCase()}${n}-${Date.now()}@test.local`, mobile: `9${String(Date.now() % 1e6).padStart(6, '0')}${String(n).padStart(3, '0')}`,
      fullName: `${role} ${n}`, role, passwordHash: await hashPassword(PASSWORD), district: 'Hyderabad',
      ...(role === 'STUDENT' ? { studentProfile: { create: {} } } : {}),
    },
  });
}

/** Logs in as a mobile client and returns an inject wrapper that sends the bearer token. */
export async function as(app: App, user: { email: string }) {
  const res = await app.inject({ method: 'POST', url: '/api/v1/auth/login', remoteAddress: ip(), payload: { identifier: user.email, password: PASSWORD, client: 'mobile' } });
  if (res.statusCode !== 200) throw new Error(`login failed: ${res.body}`);
  const token = res.json().accessToken as string;
  return (method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', url: string, payload?: unknown) =>
    app.inject({ method, url: `/api/v1${url}`, remoteAddress: ip(), headers: { authorization: `Bearer ${token}` }, ...(payload !== undefined ? { payload: payload as object } : {}) });
}

export async function setup() {
  await resetDb();
  return buildApp({ logger: false });
}
export { prisma };
