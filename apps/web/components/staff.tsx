'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApplicationDto, Appointment, DocumentDto, Stage } from '@acee/shared';
import { formatDateTime, type Lang } from '@acee/i18n';
import { api, errorText } from '@/lib/api';
import { useMe } from './providers';
import { useStageName } from './use-stage-name';
import { Alert, Badge, Button, Card, Checkbox, EmptyState, ErrorState, Input, Loading, Select, Table, Td, Textarea } from './ui';

const useLang = () => useTranslation().i18n.language as Lang;

/** Appointment list with counselor actions. `counselorId` filter is admin-only (the API ignores it for counselors). */
export function AppointmentsTable({ counselorId }: { counselorId?: string }) {
  const { t } = useTranslation();
  const lang = useLang();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['staff-appointments', counselorId], queryFn: () => api.get<{ items: Appointment[] }>(`/counselor/appointments${counselorId ? `?counselorId=${counselorId}` : ''}`) });
  const [link, setLink] = useState<Record<string, string>>({});
  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: object }) => api.patch(`/appointments/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staff-appointments'] }),
  });
  if (q.isLoading) return <Loading rows={2} />;
  if (q.error) return <ErrorState onRetry={() => q.refetch()} />;
  if (!q.data!.items.length) return <EmptyState>{t('students:noAppointments')}</EmptyState>;
  return (
    <div className="flex flex-col gap-3">
      {update.error && <Alert tone="danger">{errorText(t, update.error)}</Alert>}
      {q.data!.items.map((a) => (
        <div key={a.id} className="rounded-xl border border-line bg-white p-4 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-bold text-navy">{formatDateTime(a.startsAt, lang)}</span>
            <Badge tone={a.status === 'BOOKED' ? 'info' : a.status === 'COMPLETED' ? 'success' : 'neutral'}>{t(`counseling:statuses.${a.status}`)}</Badge>
          </div>
          <p className="mt-1">
            {a.student && <Link href={`/counselor/students/${a.student.id}`} className="font-semibold text-royal underline">{a.student.fullName}</Link>}
            {' '}· {t(`counseling:types.${a.type}`)} · {a.mode === 'ONLINE' ? t('common:online') : t('common:offline')}
            {counselorId === undefined && ` · ${a.counselor.fullName}`}
          </p>
          {a.questions && <p className="mt-1 text-muted">“{a.questions}”</p>}
          {a.status === 'BOOKED' && (
            <div className="mt-3 flex flex-wrap items-end gap-2">
              {a.mode === 'ONLINE' && (
                <>
                  <div className="min-w-56 flex-1"><Input label={t('counseling:setMeetingLink')} type="url" placeholder="https://" value={link[a.id] ?? a.meetingLink ?? ''} onChange={(e) => setLink({ ...link, [a.id]: e.target.value })} /></div>
                  <Button variant="outline" disabled={!link[a.id]?.startsWith('https://')} onClick={() => update.mutate({ id: a.id, body: { meetingLink: link[a.id] } })}>{t('common:save')}</Button>
                </>
              )}
              <Button variant="outline" onClick={() => update.mutate({ id: a.id, body: { status: 'COMPLETED' } })}>{t('counseling:markCompleted')}</Button>
              <Button variant="ghost" onClick={() => update.mutate({ id: a.id, body: { status: 'NO_SHOW' } })}>{t('counseling:markNoShow')}</Button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

type StaffApplication = Omit<ApplicationDto, 'history' | 'notes'> & {
  history: (ApplicationDto['history'][number] & { changedBy: { fullName: string } })[];
  notes: (ApplicationDto['notes'][number] & { visibleToStudent: boolean })[];
};

/** Stage changes, notes and (admin) counselor assignment for one application. */
export function ApplicationPanel({ applicationId }: { applicationId: string }) {
  const { t } = useTranslation();
  const lang = useLang();
  const qc = useQueryClient();
  const stageName = useStageName();
  const { data: me } = useMe();
  const isAdmin = me?.role === 'ADMIN' || me?.role === 'SUPER_ADMIN';
  const app = useQuery({ queryKey: ['staff-app', applicationId], queryFn: () => api.get<StaffApplication>(`/staff/applications/${applicationId}`) });
  const stages = useQuery({ queryKey: ['stages'], queryFn: () => api.get<{ items: Stage[] }>('/applications/stages') });
  const staff = useQuery({ queryKey: ['admin-staff'], queryFn: () => api.get<{ items: { id: string; fullName: string; role: string }[] }>('/admin/staff'), enabled: isAdmin });
  const [stageId, setStageId] = useState('');
  const [stageNote, setStageNote] = useState('');
  const [note, setNote] = useState('');
  const [visible, setVisible] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const refresh = () => { qc.invalidateQueries({ queryKey: ['staff-app', applicationId] }); qc.invalidateQueries({ queryKey: ['staff-apps'] }); };
  const move = useMutation({ mutationFn: () => api.post(`/staff/applications/${applicationId}/stage`, { stageId, note: stageNote }), onSuccess: () => { setStageNote(''); refresh(); } });
  const addNote = useMutation({ mutationFn: () => api.post(`/staff/applications/${applicationId}/notes`, { body: note, visibleToStudent: visible }), onSuccess: () => { setNote(''); refresh(); } });
  const patch = useMutation({ mutationFn: (body: object) => api.patch(`/staff/applications/${applicationId}`, body), onSuccess: refresh });

  if (app.isLoading) return <Loading rows={2} />;
  if (app.error || !app.data) return <ErrorState onRetry={() => app.refetch()} />;
  const a = app.data;
  const err = move.error ?? addNote.error ?? patch.error;
  return (
    <div className="flex flex-col gap-4 text-sm">
      {err && <Alert tone="danger">{errorText(t, err)}</Alert>}
      <p><b>{t('applications:currentStage')}:</b> {stageName(a.stage)}</p>
      {a.studentReportedGovtStatus && <p><b>{t('applications:govtStatus')}:</b> {a.studentReportedGovtStatus}</p>}
      {isAdmin && (
        <Select label={t('admin:assignCounselor')} value={a.assignedCounselor?.id ?? ''} onChange={(e) => patch.mutate({ assignedCounselorId: e.target.value || null })}
          options={[{ value: '', label: t('admin:unassigned') }, ...(staff.data?.items.filter((s) => s.role === 'COUNSELOR').map((s) => ({ value: s.id, label: s.fullName })) ?? [])]} />
      )}
      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <Select label={t('applications:moveStage')} value={stageId} onChange={(e) => setStageId(e.target.value)} placeholder="—" options={(stages.data?.items ?? []).map((s) => ({ value: s.id, label: stageName(s) }))} />
        <Input label={t('applications:stageNote')} value={stageNote} onChange={(e) => setStageNote(e.target.value)} />
        <Button disabled={!stageId || stageId === a.stage.id} loading={move.isPending} onClick={() => move.mutate()}>{t('common:save')}</Button>
      </div>
      <div className="flex flex-col gap-2">
        <Textarea label={t('applications:pendingActions')} value={pending ?? a.pendingActions} onChange={(e) => setPending(e.target.value)} maxLength={2000} />
        <Button variant="outline" className="w-fit" disabled={pending === null} loading={patch.isPending} onClick={() => patch.mutate({ pendingActions: pending })}>{t('common:save')}</Button>
      </div>
      <div className="flex flex-col gap-2 rounded-xl bg-surface p-3">
        <Textarea label={t('applications:addMessage')} value={note} onChange={(e) => setNote(e.target.value)} maxLength={5000} />
        <Checkbox label={t('applications:visibleToStudent')} checked={visible} onChange={(e) => setVisible(e.target.checked)} />
        <Button variant="outline" className="w-fit" disabled={!note.trim()} loading={addNote.isPending} onClick={() => addNote.mutate()}>{t('applications:addMessage')}</Button>
      </div>
      <ul className="flex flex-col gap-2">
        {a.notes.map((n) => (
          <li key={n.id} className="rounded-xl border border-line p-3">
            <p>{n.body}</p>
            <p className="mt-1 text-xs text-muted">{n.author.fullName} · {formatDateTime(n.createdAt, lang)} · {n.visibleToStudent ? t('applications:visibleToStudent') : t('applications:internalOnly')}</p>
          </li>
        ))}
      </ul>
      <details>
        <summary className="cursor-pointer font-semibold text-navy">{t('applications:history')}</summary>
        <ol className="mt-2 flex flex-col gap-1">{a.history.map((h) => <li key={h.id}>{formatDateTime(h.createdAt, lang)} — {stageName(h.toStage)} ({h.changedBy.fullName}){h.note && `: ${h.note}`}</li>)}</ol>
      </details>
    </div>
  );
}

/** Pending documents the caller may review (counselors: their students only — enforced by the API). */
export function DocumentQueue() {
  const { t } = useTranslation();
  const lang = useLang();
  const qc = useQueryClient();
  const [status, setStatus] = useState('PENDING');
  const q = useQuery({ queryKey: ['doc-queue', status], queryFn: () => api.get<{ items: DocumentDto[] }>(`/staff/documents?status=${status}`) });
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const review = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: string }) => api.post(`/staff/documents/${id}/review`, { decision, reason: reasons[id] ?? '' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['doc-queue'] }),
  });
  return (
    <Card title={t('documents:reviewQueue')} action={
      <select className="min-h-10 rounded-lg border border-line px-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value)} aria-label={t('common:status')}>
        {['PENDING', 'APPROVED', 'REJECTED'].map((s) => <option key={s} value={s}>{t(`documents:statuses.${s}`)}</option>)}
      </select>
    }>
      {review.error && <Alert tone="danger">{errorText(t, review.error)}</Alert>}
      {q.isLoading ? <Loading rows={2} /> : !q.data?.items.length ? <EmptyState>{t('documents:noPending')}</EmptyState> : (
        <Table head={[t('documents:owner'), t('admin:category'), t('common:date'), t('common:actions')]}>
          {q.data.items.map((d) => (
            <tr key={d.id}>
              <Td><Link className="text-royal underline" href={`/counselor/students/${d.owner?.id}`}>{d.owner?.fullName}</Link></Td>
              <Td>{t(`documents:categories.${d.category}`)}<br /><a className="text-xs text-royal underline" href={`/api/v1/documents/${d.id}/download`}>{d.fileName}</a></Td>
              <Td>{formatDateTime(d.createdAt, lang)}</Td>
              <Td>
                {d.status === 'PENDING' ? (
                  <div className="flex min-w-56 flex-col gap-2">
                    <Button onClick={() => review.mutate({ id: d.id, decision: 'APPROVED' })}>{t('documents:approve')}</Button>
                    <input className="min-h-10 rounded-lg border border-line px-2" placeholder={t('documents:rejectReason')} aria-label={t('documents:rejectReason')} value={reasons[d.id] ?? ''} onChange={(e) => setReasons({ ...reasons, [d.id]: e.target.value })} />
                    <Button variant="danger" disabled={!reasons[d.id]?.trim()} onClick={() => review.mutate({ id: d.id, decision: 'REJECTED' })}>{t('documents:reject')}</Button>
                  </div>
                ) : <Badge>{t(`documents:statuses.${d.status}`)}</Badge>}
              </Td>
            </tr>
          ))}
        </Table>
      )}
    </Card>
  );
}
