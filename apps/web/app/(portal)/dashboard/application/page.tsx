'use client';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { OFFICIAL_PORTAL_URL, type ApplicationDto, type Stage } from '@acee/shared';
import { formatDate, formatDateTime, type Lang } from '@acee/i18n';
import { api, errorText } from '@/lib/api';
import { useStageName } from '@/components/use-stage-name';
import { Alert, Button, Card, EmptyState, ErrorState, Loading, PageHeader, Textarea, cx } from '@/components/ui';

export default function ApplicationPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const qc = useQueryClient();
  const stageName = useStageName();
  const apps = useQuery({ queryKey: ['applications'], queryFn: () => api.get<{ items: ApplicationDto[] }>('/applications/mine') });
  const stages = useQuery({ queryKey: ['stages'], queryFn: () => api.get<{ items: Stage[] }>('/applications/stages') });
  const start = useMutation({ mutationFn: () => api.post('/applications/mine'), onSuccess: () => qc.invalidateQueries({ queryKey: ['applications'] }) });
  const app = apps.data?.items[0];
  const [govt, setGovt] = useState('');
  useEffect(() => { if (app) setGovt(app.studentReportedGovtStatus); }, [app]);
  const saveGovt = useMutation({ mutationFn: () => api.patch(`/applications/mine/${app!.id}`, { studentReportedGovtStatus: govt }) });

  if (apps.isLoading || stages.isLoading) return <Loading />;
  if (apps.error) return <ErrorState onRetry={() => apps.refetch()} />;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('applications:title')} subtitle={t('applications:subtitle')} />
      <Alert tone="info">{t('applications:internalNote')}</Alert>
      {!app ? (
        <EmptyState action={<Button loading={start.isPending} onClick={() => start.mutate()}>{t('applications:start')}</Button>}>
          {t('applications:none')}
          {start.error && <span className="block text-danger">{errorText(t, start.error)}</span>}
        </EmptyState>
      ) : (
        <>
          <Card>
            <p className="text-sm text-muted">{t('applications:currentStage')}</p>
            <p className="text-2xl font-extrabold text-navy" data-testid="current-stage">{stageName(app.stage)}</p>
            <p className="mt-1 text-xs text-muted">{t('applications:lastUpdated', { date: formatDate(app.updatedAt, lang) })}</p>
            <p className="mt-3 text-sm"><b>{t('applications:assignedCounselor')}:</b> {app.assignedCounselor?.fullName ?? t('applications:notAssigned')}</p>
            {app.pendingActions && <div className="mt-3"><Alert tone="warning" title={t('applications:pendingActions')}>{app.pendingActions}</Alert></div>}
          </Card>

          <Card title={t('applications:history')}>
            <ol className="relative ml-3 border-l-2 border-line">
              {(stages.data?.items ?? []).map((s) => {
                const done = app.history.find((h) => h.toStage.id === s.id);
                const current = app.stage.id === s.id;
                return (
                  <li key={s.id} className="mb-4 ml-5">
                    <span className={cx('absolute -left-[9px] mt-1 size-4 rounded-full border-2', current ? 'border-gold bg-gold' : done ? 'border-success bg-success' : 'border-line bg-white')} aria-hidden />
                    <p className={cx('text-sm', current ? 'font-extrabold text-navy' : done ? 'font-semibold' : 'text-muted')}>{stageName(s)}</p>
                    {done && <p className="text-xs text-muted">{formatDateTime(done.createdAt, lang)}{done.note ? ` — ${done.note}` : ''}</p>}
                  </li>
                );
              })}
            </ol>
          </Card>

          <Card title={t('applications:messages')}>
            {!app.notes.length ? <EmptyState /> : (
              <ul className="flex flex-col gap-3 text-sm">{app.notes.map((n) => <li key={n.id} className="rounded-xl bg-surface p-3"><p>{n.body}</p><p className="mt-1 text-xs text-muted">{n.author.fullName} · {formatDateTime(n.createdAt, lang)}</p></li>)}</ul>
            )}
          </Card>

          <Card title={t('applications:govtStatus')}>
            <p className="mb-3 text-sm text-muted">{t('applications:govtStatusHint')} <a href={OFFICIAL_PORTAL_URL} target="_blank" rel="noopener noreferrer" className="text-royal underline">{t('common:officialPortal')} ↗</a></p>
            <Textarea label={t('applications:govtStatus')} value={govt} onChange={(e) => setGovt(e.target.value)} maxLength={500} />
            <div className="mt-3 flex items-center gap-3">
              <Button variant="outline" loading={saveGovt.isPending} onClick={() => saveGovt.mutate()}>{t('common:save')}</Button>
              {saveGovt.isSuccess && <span className="text-sm text-success">{t('applications:govtStatusSaved')}</span>}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
