'use client';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AnnouncementDto, Enrollment } from '@acee/shared';
import { formatDate, pickLocalized, type Lang } from '@acee/i18n';
import { api, errorText } from '@/lib/api';
import { batchSchedule } from '@/components/batch-list';
import { Alert, Badge, Button, Card, ConfirmButton, EmptyState, ErrorState, LinkButton, Loading, PageHeader } from '@/components/ui';

type Material = { id: string; title: string; url: string; description: string };
type AttendanceRow = { id: string; date: string; status: string; batch: { id: string; name: string } };

function BatchExtras({ batchId }: { batchId: string }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const materials = useQuery({ queryKey: ['materials', batchId], queryFn: () => api.get<{ items: Material[] }>(`/batches/${batchId}/materials`) });
  const anns = useQuery({ queryKey: ['batch-ann', batchId], queryFn: () => api.get<{ items: AnnouncementDto[] }>(`/batches/${batchId}/announcements`) });
  return (
    <div className="mt-4 grid gap-4 md:grid-cols-2">
      <div>
        <h4 className="mb-2 text-sm font-bold text-navy">{t('coaching:materials')}</h4>
        {!materials.data?.items.length ? <p className="text-sm text-muted">{t('coaching:noMaterials')}</p> : (
          <ul className="space-y-2 text-sm">{materials.data.items.map((m) => <li key={m.id}><a href={m.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-royal underline">{m.title} ↗</a>{m.description && <p className="text-muted">{m.description}</p>}</li>)}</ul>
        )}
      </div>
      <div>
        <h4 className="mb-2 text-sm font-bold text-navy">{t('coaching:classAnnouncements')}</h4>
        {!anns.data?.items.length ? <p className="text-sm text-muted">{t('common:emptyTitle')}</p> : (
          <ul className="space-y-2 text-sm">{anns.data.items.map((a) => <li key={a.id}><p className="font-semibold">{pickLocalized(a.title, lang)} <span className="text-xs font-normal text-muted">{formatDate(a.publishedAt, lang)}</span></p><p>{pickLocalized(a.body, lang)}</p></li>)}</ul>
        )}
      </div>
    </div>
  );
}

export default function MyCoachingPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const qc = useQueryClient();
  const [err, setErr] = useState<string>();
  const enrollments = useQuery({ queryKey: ['enrollments'], queryFn: () => api.get<{ items: Enrollment[] }>('/enrollments/mine') });
  const attendance = useQuery({ queryKey: ['attendance'], queryFn: () => api.get<{ items: AttendanceRow[] }>('/attendance/mine') });
  const cancel = useMutation({
    mutationFn: (id: string) => api.post(`/enrollments/${id}/cancel`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['enrollments'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); },
    onError: (e) => setErr(errorText(t, e)),
  });

  if (enrollments.isLoading) return <Loading />;
  if (enrollments.error) return <ErrorState onRetry={() => enrollments.refetch()} />;
  const active = enrollments.data!.items.filter((e) => e.status !== 'CANCELLED');

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('navigation:myCoaching')} action={<LinkButton href="/coaching" variant="gold">{t('students:joinCoaching')}</LinkButton>} />
      {err && <Alert tone="danger">{err}</Alert>}
      {active.length === 0 ? <EmptyState action={<LinkButton href="/coaching">{t('students:joinCoaching')}</LinkButton>}>{t('students:noEnrollments')}</EmptyState> : active.map((e) => {
        const rows = attendance.data?.items.filter((a) => a.batch.id === e.batch.id) ?? [];
        const present = rows.filter((r) => r.status === 'PRESENT' || r.status === 'LATE').length;
        return (
          <Card key={e.id} title={`${e.batch.course?.code ?? ''} · ${e.batch.name}`} action={<Badge tone={e.status === 'CONFIRMED' ? 'success' : 'warning'}>{t(`coaching:statuses.${e.status}`)}</Badge>}>
            <p className="text-sm text-muted">{batchSchedule(t, e.batch)} · {t('coaching:startsOn', { date: formatDate(e.batch.startDate, lang) })}</p>
            {e.batch.trainer && <p className="text-sm text-muted">{t('coaching:trainer')}: {e.batch.trainer.fullName}</p>}
            <p className="mt-2 text-sm font-semibold">{rows.length ? t('coaching:attendanceRate', { pct: Math.round((present / rows.length) * 100) }) : t('coaching:noAttendance')}</p>
            {e.status === 'CONFIRMED' && <BatchExtras batchId={e.batch.id} />}
            <div className="mt-4">
              <ConfirmButton message={t('coaching:cancelConfirm')} onConfirm={() => cancel.mutate(e.id)} loading={cancel.isPending && cancel.variables === e.id}>{t('coaching:cancelEnrollment')}</ConfirmButton>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
