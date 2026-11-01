'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { availabilitySchema, type Stage } from '@acee/shared';
import { formatDate, type Lang } from '@acee/i18n';
import { api, errorText, fieldErrors, type FieldErrors } from '@/lib/api';
import { useMe } from '@/components/providers';
import { AppointmentsTable } from '@/components/staff';
import { useStageName } from '@/components/use-stage-name';
import { Alert, Badge, Button, Card, EmptyState, Input, PageHeader, Select } from '@/components/ui';

type Avail = { id: string; dayOfWeek: number; startTime: string; endTime: string; slotMinutes: number; mode: string };
type Student = { id: string; fullName: string; mobile: string; district: string | null; applications: { id: string; stage: Stage; updatedAt: string }[] };
type FollowUp = { id: string; body: string; followUpDate: string | null; student: { id: string; fullName: string } };

function WorkingHours() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['availability'], queryFn: () => api.get<{ items: Avail[] }>('/counselor/availability') });
  const [f, setF] = useState({ dayOfWeek: '1', startTime: '10:00', endTime: '13:00', slotMinutes: '30', mode: 'BOTH' });
  const [errors, setErrors] = useState<FieldErrors>({});
  const add = useMutation({ mutationFn: (b: object) => api.post('/counselor/availability', b), onSuccess: () => qc.invalidateQueries({ queryKey: ['availability'] }) });
  const remove = useMutation({ mutationFn: (id: string) => api.del(`/counselor/availability/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ['availability'] }) });
  const submit = () => {
    const parsed = availabilitySchema.safeParse({ ...f, dayOfWeek: Number(f.dayOfWeek), slotMinutes: Number(f.slotMinutes) });
    setErrors(fieldErrors(t, parsed));
    if (parsed.success) add.mutate(parsed.data);
  };
  const modeLabel = (m: string) => t(m === 'BOTH' ? 'common:both' : m === 'ONLINE' ? 'common:online' : 'common:offline');
  return (
    <Card title={t('counseling:workingHours')}>
      <ul className="mb-4 flex flex-col gap-1 text-sm">
        {(q.data?.items ?? []).map((a) => (
          <li key={a.id} className="flex items-center justify-between rounded-lg bg-surface px-3 py-2">
            <span>{t(`counseling:weekdays.${a.dayOfWeek}`)} {a.startTime}–{a.endTime} · {a.slotMinutes}m · {modeLabel(a.mode)}</span>
            <Button variant="ghost" onClick={() => remove.mutate(a.id)}>{t('common:delete')}</Button>
          </li>
        ))}
      </ul>
      {add.error && <Alert tone="danger">{errorText(t, add.error)}</Alert>}
      <div className="grid gap-2 sm:grid-cols-6 sm:items-end">
        <Select label={t('counseling:dayOfWeek')} value={f.dayOfWeek} onChange={(e) => setF({ ...f, dayOfWeek: e.target.value })} options={[0, 1, 2, 3, 4, 5, 6].map((d) => ({ value: String(d), label: t(`counseling:weekdays.${d}`) }))} />
        <Input label={t('counseling:from')} type="time" value={f.startTime} onChange={(e) => setF({ ...f, startTime: e.target.value })} error={errors.startTime} />
        <Input label={t('counseling:to')} type="time" value={f.endTime} onChange={(e) => setF({ ...f, endTime: e.target.value })} error={errors.endTime} />
        <Input label={t('counseling:slotLength')} type="number" min={15} max={120} value={f.slotMinutes} onChange={(e) => setF({ ...f, slotMinutes: e.target.value })} />
        <Select label={t('counseling:chooseMode')} value={f.mode} onChange={(e) => setF({ ...f, mode: e.target.value })} options={['BOTH', 'ONLINE', 'OFFLINE'].map((m) => ({ value: m, label: modeLabel(m) }))} />
        <Button loading={add.isPending} onClick={submit}>{t('counseling:addHours')}</Button>
      </div>
    </Card>
  );
}

export default function CounselorHome() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const stageName = useStageName();
  const { data: me } = useMe();
  const qc = useQueryClient();
  const students = useQuery({ queryKey: ['counselor-students'], queryFn: () => api.get<{ items: Student[] }>('/counselor/students') });
  const followUps = useQuery({ queryKey: ['follow-ups'], queryFn: () => api.get<{ items: FollowUp[] }>('/counselor/follow-ups'), enabled: me?.role === 'COUNSELOR' });
  const done = useMutation({ mutationFn: (id: string) => api.patch(`/counselor/notes/${id}`, { followUpStatus: 'DONE' }), onSuccess: () => qc.invalidateQueries({ queryKey: ['follow-ups'] }) });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('counseling:counselorTitle')} />
      <Card title={t('counseling:todayAndUpcoming')}><AppointmentsTable /></Card>
      {me?.role === 'COUNSELOR' && (
        <Card title={t('counseling:followUps')}>
          {!followUps.data?.items.length ? <EmptyState>{t('counseling:noFollowUps')}</EmptyState> : (
            <ul className="flex flex-col gap-2 text-sm">
              {followUps.data.items.map((n) => (
                <li key={n.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface p-3">
                  <span><Link href={`/counselor/students/${n.student.id}`} className="font-semibold text-royal underline">{n.student.fullName}</Link> — {n.body}{n.followUpDate && <span className="text-muted"> · {formatDate(n.followUpDate, lang)}</span>}</span>
                  <Button variant="outline" onClick={() => done.mutate(n.id)}>{t('counseling:markDone')}</Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
      <Card title={t('counseling:assignedStudents')}>
        {!students.data?.items.length ? <EmptyState /> : (
          <ul className="divide-y divide-line">
            {students.data.items.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <Link href={`/counselor/students/${s.id}`} className="font-semibold text-royal underline">{s.fullName}</Link>
                <span className="text-muted">{s.district}</span>
                {s.applications[0] ? <Badge tone="info">{stageName(s.applications[0].stage)}</Badge> : <Badge>—</Badge>}
              </li>
            ))}
          </ul>
        )}
      </Card>
      {me?.role === 'COUNSELOR' && <WorkingHours />}
    </div>
  );
}
