import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { App } from '../src/app';
import { as, ip, makeUser, prisma, setup } from './helpers';

let app: App;
beforeAll(async () => { app = await setup(); });
afterAll(async () => { await app.close(); });

const lead = { name: 'Main Site Visitor', mobile: '9876500000', interest: 'COACHING', message: 'IELTS batch?', consent: true, source: 'main-site' };

describe('main-site contact form', () => {
  it('allows CORS only for the main ACEE website and records the lead source', async () => {
    const pre = await app.inject({ method: 'OPTIONS', url: '/api/v1/inquiries', headers: { origin: 'https://www.aceereviewconsultants.com', 'access-control-request-method': 'POST' } });
    expect(pre.statusCode).toBe(204);
    expect(pre.headers['access-control-allow-origin']).toBe('https://www.aceereviewconsultants.com');

    const res = await app.inject({ method: 'POST', url: '/api/v1/inquiries', remoteAddress: ip(), headers: { origin: 'https://www.aceereviewconsultants.com' }, payload: lead });
    expect(res.statusCode).toBe(201);
    expect(res.headers['access-control-allow-origin']).toBe('https://www.aceereviewconsultants.com');
    expect((await prisma.inquiry.findFirstOrThrow({ where: { mobile: lead.mobile } })).source).toBe('main-site');

    const evil = await app.inject({ method: 'OPTIONS', url: '/api/v1/inquiries', headers: { origin: 'https://evil.example' } });
    expect(evil.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('document preview', () => {
  it('serves inline for viewing and records a separate audit action', async () => {
    const owner = await makeUser();
    const login = await app.inject({ method: 'POST', url: '/api/v1/auth/login', remoteAddress: ip(), payload: { identifier: owner.email, password: 'TestPassword123', client: 'mobile' } });
    const token = login.json().accessToken as string;
    const boundary = '----acee';
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="category"\r\n\r\nSSC_CERTIFICATE\r\n--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="ssc.pdf"\r\nContent-Type: application/pdf\r\n\r\n`),
      Buffer.from('%PDF-1.4\n%%EOF'), Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);
    const up = await app.inject({ method: 'POST', url: '/api/v1/documents', remoteAddress: ip(), headers: { authorization: `Bearer ${token}`, 'content-type': `multipart/form-data; boundary=${boundary}` }, payload: body });
    const id = up.json().id;
    const o = await as(app, owner);
    const view = await o('GET', `/documents/${id}/download?inline=1`);
    expect(view.headers['content-disposition']).toMatch(/^inline;/);
    expect(view.headers['content-type']).toBe('application/pdf');
    expect((await o('GET', `/documents/${id}/download`)).headers['content-disposition']).toMatch(/^attachment;/);
    const actions = (await prisma.auditLog.findMany({ where: { entityId: id } })).map((l) => l.action);
    expect(actions).toEqual(expect.arrayContaining(['document.view', 'document.download']));
  });
});
