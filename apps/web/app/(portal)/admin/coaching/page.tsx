'use client';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { batchSchema, type Batch, type Course } from '@acee/shared';
import { formatDate, type Lang } from '@acee/i18n';
import { api, errorText, fieldErrors, type FieldErrors } from '@/lib/api';
import { batchSchedule } from '@/components/batch-list';
import { Alert, Badge, Button, Card, Checkbox, EmptyState, Input, Loading, PageHeader, Select, Table, Td } from '@/components/ui';

const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const;
type Staff = { id: string; fullName: string; role: string };
type EnrollmentRow = { id: string; status: string; preferredMode: string; createdAt: string; user: { fullName: string; mobile: string } };

function CourseRow({ c }: { c: Course & { active?: boolean } }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [isFree, setFree] = useState(c.isFree);
  const [fee, setFee] = useState(c.feeAmount?.toString() ?? '');
  const save = useMutation({
    mutationFn: () => api.put(`/admin/courses/${c.id}`, { code: c.code, name: c.name, description: c.description, durationWeeks: c.durationWeeks, feeNote: c.feeNote, active: c.active ?? true, isFree, feeAmount: isFree || !fee ? null : Number(fee) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-courses'] }),
  });
  return (
    <tr>
      <Td><b>{c.code}</b></Td>
      <Td><Checkbox label={t('admin:isFree')} checked={isFree} onChange={(e) => setFree(e.target.checked)} /></Td>
      <Td><input aria-label={t('admin:feeAmount')} type="number" min={0} disabled={isFree} className="min-h-10 w-28 rounded-lg border border-line px-2" value={fee} onChange={(e) => setFee(e.target.value)} /></Td>
      <Td><Button variant="outline" loading={save.isPending} onClick={() => save.mutate()}>{t('common:save')}</Button>{save.error && <p className="text-xs text-danger">{errorText(t, save.error)}</p>}</Td>
    </tr>
  );
}

function Enrollments({ batchId }: { batchId: string }) {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['admin-enrollments', batchId], queryFn: () => api.get<{ items: EnrollmentRow[] }>(`/admin/batches/${batchId}/enrollments`) });
  const update = useMutation({ mutationFn: ({ id, status }: { id: string; status: string }) => api.patch(`/admin/enrollments/${id}`, { status }), onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-enrollments', batchId] }); qc.invalidateQueries({ queryKey: ['admin-batches'] }); } });
  if (q.isLoading) return <Loading rows={1} />;
  return (
    <div className="mt-3">
      {update.error && <Alert tone="danger">{errorText(t, update.error)}</Alert>}
      {!q.data?.items.length ? <EmptyState /> : (
        <ul className="divide-y divide-line text-sm">
          {q.data.items.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>{e.user.fullName} · {e.user.mobile} · <span className="text-muted">{formatDate(e.createdAt, i18n.language as Lang)}</span></span>
              <select aria-label={t('common:status')} className="min-h-10 rounded-lg border border-line px-1" value={e.status} onChange={(ev) => update.mutate({ id: e.id, status: ev.target.value })}>
                {['CONFIRMED', 'WAITLISTED', 'CANCELLED', 'COMPLETED'].map((s) => <option key={s} value={s}>{t(`coaching:statuses.${s}`)}</option>)}
              </select>
            </li>
          ))}
        </ul>
      )}
      <a href={`/api/v1/admin/reports/attendance?batchId=${batchId}&format=csv`} className="mt-2 inline-block text-sm font-semibold text-royal underline">{t('admin:attendanceReport')} (CSV)</a>
    </div>
  );
}

function BatchForm({ courses, trainers, initial, onDone }: { courses: Course[]; trainers: Staff[]; initial?: Batch; onDone: () => void }) {
  const { t } = useTranslation();
  const [f, setF] = useState({
    courseId: initial?.courseId ?? courses[0]?.id ?? '', name: initial?.name ?? '', mode: initial?.mode ?? 'ONLINE',
    startDate: initial?.startDate.slice(0, 10) ?? '', endDate: initial?.endDate.slice(0, 10) ?? '', days: initial?.days ?? ['MON', 'WED', 'FRI'],
    startTime: initial?.startTime ?? '18:00', endTime: initial?.endTime ?? '19:30', capacity: String(initial?.capacity ?? 25),
    trainerId: initial?.trainer?.id ?? '', location: initial?.location ?? '',
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const save = useMutation({ mutationFn: (b: object) => (initial ? api.put(`/admin/batches/${initial.id}`, b) : api.post('/admin/batches', b)), onSuccess: onDone });
  const submit = () => {
    const body = { ...f, capacity: Number(f.capacity), trainerId: f.trainerId || null, location: f.location || null };
    const p = batchSchema.safeParse(body);
    setErrors(fieldErrors(t, p));
    if (p.success) save.mutate(body);
  };
  return (
    <div className="grid gap-3 rounded-xl bg-surface p-4 md:grid-cols-3">
      <Select label={t('admin:courses')} value={f.courseId} onChange={(e) => setF({ ...f, courseId: e.target.value })} options={courses.map((c) => ({ value: c.id, label: c.code }))} />
      <Input label={t('coaching:materialTitle')} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} error={errors.name} />
      <Select label={t('coaching:preferredMode')} value={f.mode} onChange={(e) => setF({ ...f, mode: e.target.value })} options={[['ONLINE', 'online'], ['OFFLINE', 'offline'], ['HYBRID', 'hybrid']].map(([v, k]) => ({ value: v!, label: t(`common:${k}`) }))} />
      <Input label={t('admin:startDate')} type="date" value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} error={errors.startDate} />
      <Input label={t('admin:endDate')} type="date" value={f.endDate} onChange={(e) => setF({ ...f, endDate: e.target.value })} error={errors.endDate} />
      <Input label={t('admin:capacity')} type="number" min={1} value={f.capacity} onChange={(e) => setF({ ...f, capacity: e.target.value })} error={errors.capacity} />
      <Input label={t('counseling:from')} type="time" value={f.startTime} onChange={(e) => setF({ ...f, startTime: e.target.value })} error={errors.startTime} />
      <Input label={t('counseling:to')} type="time" value={f.endTime} onChange={(e) => setF({ ...f, endTime: e.target.value })} error={errors.endTime} />
      <Select label={t('admin:trainer')} value={f.trainerId} onChange={(e) => setF({ ...f, trainerId: e.target.value })} options={[{ value: '', label: t('admin:unassigned') }, ...trainers.map((s) => ({ value: s.id, label: s.fullName }))]} />
      <fieldset className="md:col-span-2">
        <legend className="text-sm font-medium">{t('coaching:schedule')}</legend>
        <div className="mt-1 flex flex-wrap gap-2">
          {DAYS.map((d) => (
            <label key={d} className="flex min-h-10 items-center gap-1 rounded-lg border border-line bg-white px-2 text-sm">
              <input type="checkbox" checked={f.days.includes(d)} onChange={(e) => setF({ ...f, days: e.target.checked ? [...f.days, d] : f.days.filter((x) => x !== d) })} />{t(`coaching:days.${d}`)}
            </label>
          ))}
        </div>
      </fieldset>
      <Input label={t('coaching:location')} value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} />
      {save.error && <div className="md:col-span-3"><Alert tone="danger">{errorText(t, save.error)}</Alert></div>}
      <Button className="w-fit" loading={save.isPending} onClick={submit}>{t('common:save')}</Button>
    </div>
  );
}

export default function AdminCoachingPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const qc = useQueryClient();
  const [editing, setEditing] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const courses = useQuery({ queryKey: ['admin-courses'], queryFn: () => api.get<{ items: Course[] }>('/admin/courses') });
  const batches = useQuery({ queryKey: ['admin-batches'], queryFn: () => api.get<{ items: Batch[] }>('/admin/batches') });
  const staff = useQuery({ queryKey: ['admin-staff'], queryFn: () => api.get<{ items: Staff[] }>('/admin/staff') });
  const trainers = staff.data?.items.filter((s) => s.role === 'TRAINER') ?? [];
  const done = () => { setEditing(null); qc.invalidateQueries({ queryKey: ['admin-batches'] }); };
  if (courses.isLoading || batches.isLoading) return <Loading />;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('admin:coaching')} />
      <Card title={t('admin:courses')}>
        <Table head={[t('admin:courses'), t('coaching:feeStatus'), t('admin:feeAmount'), '']}>
          {courses.data?.items.map((c) => <CourseRow key={c.id} c={c} />)}
        </Table>
      </Card>
      <Card title={t('admin:batches')} action={<Button variant="outline" onClick={() => setEditing(editing === 'new' ? null : 'new')}>{t('admin:newBatch')}</Button>}>
        {editing === 'new' && courses.data && <BatchForm courses={courses.data.items} trainers={trainers} onDone={done} />}
        <ul className="mt-4 flex flex-col gap-3">
          {batches.data?.items.map((b) => (
            <li key={b.id} className="rounded-xl border border-line p-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <b className="text-navy">{b.course?.code} · {b.name}</b>
                <Badge tone={b.seatsTaken >= b.capacity ? 'warning' : 'success'}>{t('admin:seats')}: {b.seatsTaken}/{b.capacity}</Badge>
              </div>
              <p className="text-muted">{batchSchedule(t, b)} · {formatDate(b.startDate, lang)} – {formatDate(b.endDate, lang)} · {t('admin:trainer')}: {b.trainer?.fullName ?? t('admin:unassigned')}</p>
              <div className="mt-2 flex gap-2">
                <Button variant="ghost" onClick={() => setEditing(editing === b.id ? null : b.id)}>{t('common:edit')}</Button>
                <Button variant="ghost" onClick={() => setOpen(open === b.id ? null : b.id)}>{t('admin:enrollments')}</Button>
              </div>
              {editing === b.id && courses.data && <BatchForm courses={courses.data.items} trainers={trainers} initial={b} onDone={done} />}
              {open === b.id && <Enrollments batchId={b.id} />}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
