import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { App } from '../src/app';
import { PASSWORD, as, ip, makeUser, prisma, setup } from './helpers';

let app: App;
beforeAll(async () => { app = await setup(); });
afterAll(async () => { await app.close(); });

const registration = {
  fullName: 'Test Student', mobile: '9876543210', email: 'Student@Example.com', district: 'Warangal',
  preferredLanguage: 'te', password: 'GoodPassword1', acceptTerms: true,
};

describe('registration and login', () => {
  it('registers a student with a web session cookie, consents and a welcome notification', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/v1/auth/register', remoteAddress: ip(), payload: registration });
    expect(res.statusCode).toBe(201);
    expect(res.json().user).toMatchObject({ email: 'student@example.com', role: 'STUDENT', preferredLanguage: 'te' });
    expect(res.json().accessToken).toBeUndefined();
    const cookie = res.cookies.find((c) => c.name === 'acee_session');
    expect(cookie?.httpOnly).toBe(true);
    const user = await prisma.user.findUniqueOrThrow({ where: { email: 'student@example.com' }, include: { consents: true, notifications: true } });
    expect(user.passwordHash).toMatch(/^\$argon2id\$/);
    expect(user.consents.map((c) => c.purpose)).toEqual(expect.arrayContaining(['TERMS', 'PRIVACY']));
    expect(user.notifications).toHaveLength(1);

    const me = await app.inject({ method: 'GET', url: '/api/v1/auth/me', cookies: { acee_session: cookie!.value } });
    expect(me.json().user.fullName).toBe('Test Student');
  });

  it('ignores a role field so the public cannot self-register as admin', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/v1/auth/register', remoteAddress: ip(), payload: { ...registration, mobile: '9876543211', email: 'sneaky@example.com', role: 'SUPER_ADMIN' } });
    expect(res.statusCode).toBe(201);
    expect(res.json().user.role).toBe('STUDENT');
  });

  it('rejects duplicate accounts', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/v1/auth/register', remoteAddress: ip(), payload: registration });
    expect(res.statusCode).toBe(409);
  });

  it('returns field-level validation errors', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/v1/auth/register', remoteAddress: ip(), payload: { ...registration, mobile: '12345', password: 'short' } });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('VALIDATION_ERROR');
    expect(JSON.stringify(res.json().details)).toContain('validation:mobile');
  });

  it('rejects invalid credentials with a generic message', async () => {
    for (const identifier of ['student@example.com', 'nobody@example.com']) {
      const res = await app.inject({ method: 'POST', url: '/api/v1/auth/login', remoteAddress: ip(), payload: { identifier, password: 'WrongPassword9' } });
      expect(res.statusCode).toBe(401);
      expect(res.json().code).toBe('INVALID_CREDENTIALS');
    }
  });

  it('logs in by mobile number', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/v1/auth/login', remoteAddress: ip(), payload: { identifier: '9876543210', password: 'GoodPassword1' } });
    expect(res.statusCode).toBe(200);
  });

  it('rate limits repeated login attempts from one address', async () => {
    const addr = ip();
    const codes = [];
    for (let i = 0; i < 12; i++) codes.push((await app.inject({ method: 'POST', url: '/api/v1/auth/login', remoteAddress: addr, payload: { identifier: 'x@y.z', password: 'nope' } })).statusCode);
    expect(codes).toContain(429);
  });

  it('blocks cookie-authenticated writes from foreign origins (CSRF)', async () => {
    const login = await app.inject({ method: 'POST', url: '/api/v1/auth/login', remoteAddress: ip(), payload: { identifier: '9876543210', password: 'GoodPassword1' } });
    const cookie = login.cookies.find((c) => c.name === 'acee_session')!.value;
    const evil = await app.inject({ method: 'POST', url: '/api/v1/me/notifications/read', cookies: { acee_session: cookie }, headers: { origin: 'https://evil.example' }, payload: {} });
    expect(evil.statusCode).toBe(403);
    const ok = await app.inject({ method: 'POST', url: '/api/v1/me/notifications/read', cookies: { acee_session: cookie }, headers: { origin: 'http://localhost:3000' }, payload: {} });
    expect(ok.statusCode).toBe(200);
  });
});

describe('mobile refresh token rotation', () => {
  it('rotates refresh tokens and revokes the family on reuse', async () => {
    const u = await makeUser();
    const login = await app.inject({ method: 'POST', url: '/api/v1/auth/login', remoteAddress: ip(), payload: { identifier: u.email, password: PASSWORD, client: 'mobile' } });
    const { refreshToken, accessToken } = login.json();
    const r1 = await app.inject({ method: 'POST', url: '/api/v1/auth/refresh', remoteAddress: ip(), payload: { refreshToken } });
    expect(r1.statusCode).toBe(200);
    expect(r1.json().refreshToken).not.toBe(refreshToken);
    // Old access token is revoked with its session.
    const old = await app.inject({ method: 'GET', url: '/api/v1/auth/me', headers: { authorization: `Bearer ${accessToken}` } });
    expect(old.statusCode).toBe(401);
    // Reusing the first refresh token kills the newer session too.
    const reuse = await app.inject({ method: 'POST', url: '/api/v1/auth/refresh', remoteAddress: ip(), payload: { refreshToken } });
    expect(reuse.json().code).toBe('REFRESH_REUSED');
    const newer = await app.inject({ method: 'GET', url: '/api/v1/auth/me', headers: { authorization: `Bearer ${r1.json().accessToken}` } });
    expect(newer.statusCode).toBe(401);
  });
});

describe('role enforcement and provisioning', () => {
  it('denies students and anonymous users admin endpoints', async () => {
    const student = await as(app, await makeUser());
    expect((await student('GET', '/admin/metrics')).statusCode).toBe(403);
    expect((await app.inject({ method: 'GET', url: '/api/v1/admin/metrics' })).statusCode).toBe(401);
    expect((await student('GET', '/trainer/batches')).statusCode).toBe(403);
    expect((await student('GET', '/staff/documents')).statusCode).toBe(403);
  });

  it('lets admins see metrics', async () => {
    const admin = await as(app, await makeUser('ADMIN'));
    const res = await admin('GET', '/admin/metrics');
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveProperty('students');
  });

  it('admins invite counselors but not admins; only super admins change roles', async () => {
    const adminUser = await makeUser('ADMIN');
    const admin = await as(app, adminUser);
    expect((await admin('POST', '/auth/invitations', { email: 'new.admin@test.local', fullName: 'New Admin', role: 'ADMIN' })).statusCode).toBe(403);
    const inv = await admin('POST', '/auth/invitations', { email: 'coun@test.local', fullName: 'New Counselor', role: 'COUNSELOR' });
    expect(inv.statusCode).toBe(200);
    const token = new URL(inv.json().inviteUrl).searchParams.get('token')!;
    const accept = await app.inject({ method: 'POST', url: '/api/v1/auth/invitations/accept', remoteAddress: ip(), payload: { token, mobile: '9123456780', password: 'CounselorPass1' } });
    expect(accept.statusCode).toBe(201);
    expect(accept.json().user.role).toBe('COUNSELOR');
    const again = await app.inject({ method: 'POST', url: '/api/v1/auth/invitations/accept', remoteAddress: ip(), payload: { token, mobile: '9123456781', password: 'CounselorPass1' } });
    expect(again.statusCode).toBe(400);

    const student = await makeUser();
    expect((await admin('PATCH', `/admin/users/${student.id}`, { role: 'ADMIN' })).statusCode).toBe(403);
    const sup = await as(app, await makeUser('SUPER_ADMIN'));
    expect((await sup('PATCH', `/admin/users/${student.id}`, { role: 'TRAINER' })).statusCode).toBe(200);
  });

  it('OTP is honestly reported as not configured', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/v1/auth/otp/request', remoteAddress: ip(), payload: { channel: 'sms', destination: '9876543210' } });
    expect(res.statusCode).toBe(501);
  });
});
