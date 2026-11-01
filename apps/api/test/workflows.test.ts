import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { App } from '../src/app';
import { as, ip, makeUser, prisma, setup } from './helpers';
import { sendAppointmentReminders } from '../src/routes/counseling';

let app: App;
let schemeId: string;
beforeAll(async () => {
  app = await setup();
  const scheme = await prisma.scholarshipScheme.create({ data: { code: 'AMBEDKAR_OVN', name: { en: 'OVN' }, description: { en: '' }, officialUrl: 'https://telanganaepass.cgg.gov.in/' } });
  schemeId = scheme.id;
  const base = { schemeId, sourceUrl: 'https://telanganaepass.cgg.gov.in/', goReference: 'TEST', verifiedAt: new Date(), effectiveFrom: new Date(), active: true };
  await prisma.schemeRuleVersion.create({ data: { ...base, category: 'SC', version: 1, rules: [{ id: 'inc', criterion: 'annualFamilyIncome', operator: 'lt', threshold: 500000, onFail: 'NOT_MET', description: '' }] } });
  await prisma.schemeRuleVersion.create({ data: { ...base, category: 'ST', version: 1, rules: [{ id: 'inc', criterion: 'annualFamilyIncome', operator: 'lt', threshold: 800000, onFail: 'NOT_MET', description: '' }] } });
});
afterAll(async () => { await app.close(); });

const input = {
  telanganaResident: 'yes', category: 'SC', annualFamilyIncome: 600000, graduationPercentage: 70, qualification: 'UG_COMPLETED',
  intendedCountry: 'US', admissionStatus: 'OFFER_RECEIVED', examStatus: 'SCORE_AVAILABLE', priorFamilyBenefit: 'no',
};

describe('eligibility', () => {
  it('applies separate SC and ST rule sets', async () => {
    const sc = await app.inject({ method: 'POST', url: '/api/v1/eligibility/check', remoteAddress: ip(), payload: { schemeCode: 'AMBEDKAR_OVN', input } });
    expect(sc.json().outcome).toBe('NOT_MET');
    expect(sc.json().assessmentId).toBeNull(); // anonymous checks are not stored
    const st = await app.inject({ method: 'POST', url: '/api/v1/eligibility/check', remoteAddress: ip(), payload: { schemeCode: 'AMBEDKAR_OVN', input: { ...input, category: 'ST' } } });
    expect(st.json().outcome).toBe('ELIGIBLE');
  });

  it('stores signed-in results with the rule version, and new versions change future results only', async () => {
    const student = await as(app, await makeUser());
    const first = await student('POST', '/eligibility/check', { schemeCode: 'AMBEDKAR_OVN', input });
    expect(first.json().ruleVersion.version).toBe(1);

    const admin = await as(app, await makeUser('ADMIN'));
    const v2 = await admin('POST', `/admin/schemes/${schemeId}/versions`, {
      category: 'SC', sourceUrl: 'https://telanganaepass.cgg.gov.in/OverseasLinks.do', goReference: 'G.O.Ms.TEST', verifiedAt: '2026-10-01', effectiveFrom: '2026-10-01',
      rules: [{ id: 'inc', criterion: 'annualFamilyIncome', operator: 'lt', threshold: 700000, onFail: 'NOT_MET' }],
    });
    expect(v2.statusCode).toBe(201);
    expect(v2.json()).toMatchObject({ version: 2, active: false });
    expect((await admin('POST', `/admin/rule-versions/${v2.json().id}/activate`)).statusCode).toBe(200);

    const second = await student('POST', '/eligibility/check', { schemeCode: 'AMBEDKAR_OVN', input });
    expect(second.json()).toMatchObject({ outcome: 'ELIGIBLE', ruleVersion: { version: 2, goReference: 'G.O.Ms.TEST' } });
    const history = (await student('GET', '/eligibility/history')).json().items;
    expect(history.map((h: { outcome: string; ruleVersion: { version: number } }) => [h.outcome, h.ruleVersion.version])).toEqual([['ELIGIBLE', 2], ['NOT_MET', 1]]);
  });

  it('students cannot edit rules', async () => {
    const student = await as(app, await makeUser());
    expect((await student('POST', `/admin/schemes/${schemeId}/versions`, {})).statusCode).toBe(403);
  });
});

describe('coaching', () => {
  it('enforces capacity with a waitlist and promotes on cancellation', async () => {
    const trainer = await makeUser('TRAINER');
    const course = await prisma.course.create({ data: { code: 'IELTS', name: { en: 'IELTS' }, description: { en: '' }, durationWeeks: 6, isFree: true, feeNote: { en: '' } } });
    const batch = await prisma.batch.create({ data: { courseId: course.id, name: 'B1', mode: 'ONLINE', startDate: new Date(), endDate: new Date(Date.now() + 30 * 86_400_000), days: ['MON'], startTime: '07:00', endTime: '08:00', capacity: 2, trainerId: trainer.id } });
    const users = await Promise.all([makeUser(), makeUser(), makeUser()]);
    const clients = await Promise.all(users.map((u) => as(app, u)));
    // Concurrent enrollments: the row lock must keep confirmed seats at capacity.
    const results = await Promise.all(clients.map((c) => c('POST', '/enrollments', { batchId: batch.id, preferredMode: 'ONLINE' })));
    const statuses = results.map((r) => r.json().status).sort();
    expect(statuses).toEqual(['CONFIRMED', 'CONFIRMED', 'WAITLISTED']);
    expect((await clients[0]!('POST', '/enrollments', { batchId: batch.id, preferredMode: 'ONLINE' })).statusCode).toBe(400);

    const confirmedIdx = results.findIndex((r) => r.json().status === 'CONFIRMED');
    const waitIdx = results.findIndex((r) => r.json().status === 'WAITLISTED');
    await clients[confirmedIdx]!('POST', `/enrollments/${results[confirmedIdx]!.json().id}/cancel`);
    const promoted = await prisma.enrollment.findUniqueOrThrow({ where: { id: results[waitIdx]!.json().id } });
    expect(promoted.status).toBe('CONFIRMED');

    // Trainer marks attendance for enrolled students only.
    const t = await as(app, trainer);
    const roster = (await t('GET', `/batches/${batch.id}/roster`)).json().items;
    expect(roster).toHaveLength(2);
    expect(roster[0].user).not.toHaveProperty('mobile');
    const mark = await t('POST', `/batches/${batch.id}/attendance`, { date: '2026-11-02', records: roster.map((r: { userId: string }) => ({ userId: r.userId, status: 'PRESENT' })) });
    expect(mark.statusCode).toBe(200);
    const outsider = await makeUser();
    expect((await t('POST', `/batches/${batch.id}/attendance`, { date: '2026-11-02', records: [{ userId: outsider.id, status: 'PRESENT' }] })).statusCode).toBe(400);
    const otherTrainer = await as(app, await makeUser('TRAINER'));
    expect((await otherTrainer('GET', `/batches/${batch.id}/roster`)).statusCode).toBe(403);
  });
});

describe('counseling', () => {
  it('prevents double booking even under concurrency, and supports reschedule/cancel', async () => {
    const counselor = await makeUser('COUNSELOR');
    for (let dow = 0; dow < 7; dow++) await prisma.counselingAvailability.create({ data: { counselorId: counselor.id, dayOfWeek: dow, startTime: '10:00', endTime: '12:00', slotMinutes: 30 } });
    const tomorrow = new Date(Date.now() + 86_400_000 + 5.5 * 3600_000).toISOString().slice(0, 10);
    const slots = (await app.inject({ method: 'GET', url: `/api/v1/counseling/slots?date=${tomorrow}&counselorId=${counselor.id}` })).json().items;
    expect(slots).toHaveLength(4);
    const [a, b] = await Promise.all([makeUser(), makeUser()]);
    const [ca, cb] = await Promise.all([as(app, a), as(app, b)]);
    const body = { counselorId: counselor.id, startsAt: slots[0].startsAt, type: 'SCHOLARSHIP', mode: 'ONLINE', questions: 'Help' };
    const [r1, r2] = await Promise.all([ca('POST', '/appointments', body), cb('POST', '/appointments', body)]);
    expect([r1.statusCode, r2.statusCode].sort()).toEqual([201, 409]);
    const winner = r1.statusCode === 201 ? { c: ca, r: r1 } : { c: cb, r: r2 };

    const after = (await app.inject({ method: 'GET', url: `/api/v1/counseling/slots?date=${tomorrow}&counselorId=${counselor.id}` })).json().items;
    expect(after).toHaveLength(3);

    const moved = await winner.c('POST', `/appointments/${winner.r.json().id}/reschedule`, { startsAt: slots[1].startsAt });
    expect(moved.statusCode).toBe(200);
    // Original slot is free again.
    expect((await ca('POST', '/appointments', { ...body, startsAt: slots[0].startsAt })).statusCode === 201 || (await cb('POST', '/appointments', { ...body, startsAt: slots[0].startsAt })).statusCode === 201).toBe(true);

    expect(await sendAppointmentReminders()).toBeGreaterThanOrEqual(1);
    expect(await sendAppointmentReminders()).toBe(0); // idempotent

    const c = await as(app, counselor);
    const list = (await c('GET', '/counselor/appointments')).json().items;
    expect(list.filter((x: { status: string }) => x.status === 'BOOKED')).toHaveLength(2);
    const note = await c('POST', '/counselor/notes', { studentId: a.id, body: 'Follow up on documents', followUpStatus: 'PENDING' });
    expect(note.statusCode).toBe(201);
    const strangerCounselor = await as(app, await makeUser('COUNSELOR'));
    expect((await strangerCounselor('POST', '/counselor/notes', { studentId: a.id, body: 'x' })).statusCode).toBe(403);
    expect((await strangerCounselor('GET', `/counselor/students/${a.id}`)).statusCode).toBe(403);
  });
});

describe('application tracking', () => {
  it('records stage history, hides internal notes from students, and scopes counselors', async () => {
    const stages = await Promise.all(['INQUIRY_RECEIVED', 'PROFILE_CREATED', 'CLOSED'].map((code, i) => prisma.applicationStage.create({ data: { code, name: { en: code }, order: i } })));
    const student = await makeUser();
    const counselor = await makeUser('COUNSELOR');
    const s = await as(app, student);
    const created = await s('POST', '/applications/mine');
    expect(created.statusCode).toBe(201);
    expect((await s('POST', '/applications/mine')).statusCode).toBe(409);

    const admin = await as(app, await makeUser('ADMIN'));
    const appId = created.json().id;
    const c = await as(app, counselor);
    expect((await c('POST', `/staff/applications/${appId}/stage`, { stageId: stages[1]!.id })).statusCode).toBe(403);
    expect((await admin('PATCH', `/staff/applications/${appId}`, { assignedCounselorId: counselor.id })).statusCode).toBe(200);
    expect((await c('POST', `/staff/applications/${appId}/stage`, { stageId: stages[1]!.id, note: 'Profile done' })).statusCode).toBe(200);
    await c('POST', `/staff/applications/${appId}/notes`, { body: 'internal only', visibleToStudent: false });
    await c('POST', `/staff/applications/${appId}/notes`, { body: 'Please upload marksheet', visibleToStudent: true });

    const mine = (await s('GET', '/applications/mine')).json().items[0];
    expect(mine.stage.code).toBe('PROFILE_CREATED');
    expect(mine.history.map((h: { toStage: { code: string } }) => h.toStage.code)).toEqual(['INQUIRY_RECEIVED', 'PROFILE_CREATED']);
    expect(mine.notes.map((n: { body: string }) => n.body)).toEqual(['Please upload marksheet']);
    const notes = (await s('GET', '/me/notifications')).json().items.map((n: { titleKey: string }) => n.titleKey);
    expect(notes).toContain('applicationStage.title');

    await c('POST', `/staff/applications/${appId}/stage`, { stageId: stages[2]!.id });
    expect((await prisma.application.findUniqueOrThrow({ where: { id: appId } })).closedAt).not.toBeNull();
  });
});

describe('documents', () => {
  const pdf = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF');
  const upload = (client: Awaited<ReturnType<typeof as>>, token: string, file: Buffer, filename = 'marks.pdf', category = 'GRADUATION_MARKSHEET') => {
    const boundary = '----acee';
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="category"\r\n\r\n${category}\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: application/pdf\r\n\r\n`),
      file, Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);
    return app.inject({ method: 'POST', url: '/api/v1/documents', remoteAddress: ip(), headers: { authorization: `Bearer ${token}`, 'content-type': `multipart/form-data; boundary=${boundary}` }, payload: body });
  };
  const token = async (email: string) => (await app.inject({ method: 'POST', url: '/api/v1/auth/login', remoteAddress: ip(), payload: { identifier: email, password: 'TestPassword123', client: 'mobile' } })).json().accessToken as string;

  it('isolates documents between students and unrelated staff, and audits access', async () => {
    const owner = await makeUser();
    const other = await makeUser();
    const ownerToken = await token(owner.email);
    const up = await upload(null as never, ownerToken, pdf);
    expect(up.statusCode).toBe(201);
    const docId = up.json().id;
    expect(up.json()).not.toHaveProperty('storageKey');

    const o = await as(app, owner);
    expect((await o('GET', `/documents/${docId}/download`)).statusCode).toBe(200);
    const x = await as(app, other);
    expect((await x('GET', `/documents/${docId}/download`)).statusCode).toBe(403);
    expect((await x('DELETE', `/documents/${docId}`)).statusCode).toBe(403);
    const trainer = await as(app, await makeUser('TRAINER'));
    expect((await trainer('GET', `/documents/${docId}/download`)).statusCode).toBe(403);
    const unrelated = await as(app, await makeUser('COUNSELOR'));
    expect((await unrelated('GET', `/documents/${docId}/download`)).statusCode).toBe(403);
    expect((await unrelated('GET', '/staff/documents')).json().items).toHaveLength(0);

    const admin = await as(app, await makeUser('ADMIN'));
    expect((await admin('GET', `/documents/${docId}/download`)).statusCode).toBe(200);
    expect((await admin('POST', `/staff/documents/${docId}/review`, { decision: 'REJECTED' })).statusCode).toBe(400); // reason required
    expect((await admin('POST', `/staff/documents/${docId}/review`, { decision: 'REJECTED', reason: 'Blurry scan' })).statusCode).toBe(200);
    const mine = (await o('GET', '/documents/mine')).json().items;
    expect(mine[0]).toMatchObject({ status: 'REJECTED', rejectionReason: 'Blurry scan' });

    // Re-upload supersedes the rejected version.
    const re = await upload(null as never, ownerToken, pdf);
    expect(re.json().version).toBe(2);

    const logs = await prisma.auditLog.findMany({ where: { entityId: docId, action: 'document.download' } });
    expect(logs).toHaveLength(2);
  });

  it('rejects files whose content is not PDF/JPG/PNG regardless of extension', async () => {
    const u = await makeUser();
    const res = await upload(null as never, await token(u.email), Buffer.from('MZ\x90\x00 fake exe'), 'evil.pdf');
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('INVALID_FILE_TYPE');
  });
});
