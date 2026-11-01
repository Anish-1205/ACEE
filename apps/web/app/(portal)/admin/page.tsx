'use client';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import type { Stage } from '@acee/shared';
import { formatNumber, type Lang } from '@acee/i18n';
import { api } from '@/lib/api';
import { useStageName } from '@/components/use-stage-name';
import { Card, ErrorState, Loading, PageHeader } from '@/components/ui';

type Metrics = {
  students: number; newStudents: number; newInquiries: number; enrollments: number; upcomingAppointments: number; pendingDocuments: number;
  eligibility: Record<string, number>; applicationsByStage: { stage: Stage; count: number }[]; activeStaff: Record<string, number>;
};

export default function AdminOverview() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const stageName = useStageName();
  const q = useQuery({ queryKey: ['metrics'], queryFn: () => api.get<Metrics>('/admin/metrics') });
  if (q.isLoading) return <Loading rows={4} />;
  if (q.error || !q.data) return <ErrorState onRetry={() => q.refetch()} />;
  const m = q.data;
  const tiles: [string, number][] = [
    ['students', m.students], ['newStudents', m.newStudents], ['newInquiries', m.newInquiries],
    ['enrollments', m.enrollments], ['upcomingAppointments', m.upcomingAppointments], ['pendingDocuments', m.pendingDocuments],
  ];
  const maxStage = Math.max(1, ...m.applicationsByStage.map((s) => s.count));
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('admin:overview')} />
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {tiles.map(([k, v]) => (
          <li key={k} className="rounded-card border border-line bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase text-muted">{t(`admin:metrics.${k}`)}</p>
            <p className="mt-1 text-3xl font-black text-navy" data-testid={`metric-${k}`}>{formatNumber(v, lang)}</p>
          </li>
        ))}
      </ul>
      <div className="grid gap-6 md:grid-cols-2">
        <Card title={t('admin:metrics.eligibility')}>
          <ul className="flex flex-col gap-2 text-sm">
            {['ELIGIBLE', 'REVIEW', 'NOT_MET'].map((o) => <li key={o} className="flex justify-between"><span>{t(`eligibility:outcome${o}`)}</span><b>{m.eligibility[o] ?? 0}</b></li>)}
          </ul>
        </Card>
        <Card title={t('admin:metrics.staff')}>
          <ul className="flex flex-col gap-2 text-sm">
            {['COUNSELOR', 'TRAINER'].map((r) => <li key={r} className="flex justify-between"><span>{t(`authentication:roles.${r}`)}</span><b>{m.activeStaff[r] ?? 0}</b></li>)}
          </ul>
        </Card>
      </div>
      <Card title={t('admin:metrics.byStage')}>
        <ul className="flex flex-col gap-2 text-sm">
          {m.applicationsByStage.map(({ stage, count }) => (
            <li key={stage.id} className="grid grid-cols-[minmax(0,14rem)_1fr_2rem] items-center gap-3">
              <span className="truncate">{stageName(stage)}</span>
              <span className="h-3 rounded-full bg-surface"><span className="block h-3 rounded-full bg-royal" style={{ width: `${(count / maxStage) * 100}%` }} /></span>
              <b className="text-right">{count}</b>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
