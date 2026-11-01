'use client';
import { use, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDate, formatDateTime, type Lang } from '@acee/i18n';
import type { Stage } from '@acee/shared';
import { api, errorText } from '@/lib/api';
import { OUTCOME_TONE } from '@/components/eligibility-wizard';
import { ApplicationPanel } from '@/components/staff';
import { Alert, Badge, Button, Card, EmptyState, ErrorState, Input, Loading, PageHeader, Select, Textarea } from '@/components/ui';

type StudentDetail = {
  id: string; fullName: string; email: string; mobile: string; district: string | null; preferredLanguage: string;
  studentProfile: Record<string, string | number | null> | null;
  assessments: { id: string; outcome: string; createdAt: string }[];
  documents: { id: string; category: string; fileName: string; status: string; createdAt: string }[];
  applications: { id: string; stage: Stage }[];
  studentAppointments: { id: string; startsAt: string; status: string; type: string; questions: string }[];
  notesAbout: { id: string; body: string; followUpStatus: string; followUpDate: string | null; createdAt: string; author: { fullName: string } }[];
};

export default function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['student', id], queryFn: () => api.get<StudentDetail>(`/counselor/students/${id}`) });
  const [note, setNote] = useState({ body: '', followUpStatus: 'NONE', followUpDate: '' });
  const addNote = useMutation({
    mutationFn: () => api.post('/counselor/notes', { studentId: id, body: note.body, followUpStatus: note.followUpStatus, followUpDate: note.followUpDate || null }),
    onSuccess: () => { setNote({ body: '', followUpStatus: 'NONE', followUpDate: '' }); qc.invalidateQueries({ queryKey: ['student', id] }); qc.invalidateQueries({ queryKey: ['follow-ups'] }); },
  });
  if (q.isLoading) return <Loading rows={4} />;
  if (q.error || !q.data) return <ErrorState message={q.error ? errorText(t, q.error) : undefined} onRetry={() => q.refetch()} />;
  const s = q.data;
  const p = s.studentProfile;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={s.fullName} subtitle={`${s.mobile} · ${s.email} · ${s.district ?? ''} · ${t(`common:languages.${s.preferredLanguage}`)}`} />
      <Card title={t('counseling:studentDetails')}>
        <dl className="grid gap-2 text-sm sm:grid-cols-3">
          {p && (['qualification', 'fieldOfStudy', 'graduationYear', 'intendedCountry', 'intendedLevel', 'intendedIntake'] as const).map((k) => (
            <div key={k}><dt className="text-muted">{t(`students:${k}`)}</dt><dd className="font-semibold">{p[k] ?? '—'}</dd></div>
          ))}
        </dl>
        <div className="mt-4 flex flex-wrap gap-2">
          {s.assessments.map((a) => <Badge key={a.id} tone={OUTCOME_TONE[a.outcome]}>{formatDate(a.createdAt, lang)}: {t(`eligibility:outcome${a.outcome}`)}</Badge>)}
        </div>
      </Card>

      {s.applications[0] && <Card title={t('applications:title')}><ApplicationPanel applicationId={s.applications[0].id} /></Card>}

      <Card title={t('navigation:documents')}>
        {!s.documents.length ? <EmptyState /> : (
          <ul className="divide-y divide-line text-sm">
            {s.documents.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>{t(`documents:categories.${d.category}`)} — <a href={`/api/v1/documents/${d.id}/download`} className="text-royal underline">{d.fileName}</a></span>
                <Badge tone={d.status === 'APPROVED' ? 'success' : d.status === 'REJECTED' ? 'danger' : 'info'}>{t(`documents:statuses.${d.status}`)}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title={t('counseling:myAppointments')}>
        <ul className="flex flex-col gap-2 text-sm">
          {s.studentAppointments.map((a) => <li key={a.id}>{formatDateTime(a.startsAt, lang)} · {t(`counseling:types.${a.type}`)} · {t(`counseling:statuses.${a.status}`)}{a.questions && <span className="text-muted"> — “{a.questions}”</span>}</li>)}
        </ul>
      </Card>

      <Card title={t('counseling:privateNotes')}>
        <div className="flex flex-col gap-3">
          <Textarea label={t('counseling:addNote')} placeholder={t('counseling:notePlaceholder')} value={note.body} onChange={(e) => setNote({ ...note, body: e.target.value })} maxLength={5000} />
          <div className="grid gap-2 sm:grid-cols-3 sm:items-end">
            <Select label={t('counseling:followUp')} value={note.followUpStatus} onChange={(e) => setNote({ ...note, followUpStatus: e.target.value })} options={['NONE', 'PENDING'].map((v) => ({ value: v, label: t(`counseling:followUpStatus.${v}`) }))} />
            <Input label={t('counseling:followUpDate')} type="date" value={note.followUpDate} onChange={(e) => setNote({ ...note, followUpDate: e.target.value })} />
            <Button disabled={!note.body.trim()} loading={addNote.isPending} onClick={() => addNote.mutate()}>{t('counseling:addNote')}</Button>
          </div>
          {addNote.error && <Alert tone="danger">{errorText(t, addNote.error)}</Alert>}
        </div>
        <ul className="mt-4 flex flex-col gap-2 text-sm">
          {s.notesAbout.map((n) => (
            <li key={n.id} className="rounded-xl bg-surface p-3">
              <p>{n.body}</p>
              <p className="mt-1 text-xs text-muted">{n.author.fullName} · {formatDateTime(n.createdAt, lang)} · {t(`counseling:followUpStatus.${n.followUpStatus}`)}</p>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
