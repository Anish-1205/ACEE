'use client';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, ErrorState, Input, Loading, PageHeader } from '@/components/ui';

type Summary = { registrations: number; eligibility: Record<string, number>; enrollments: Record<string, number>; appointments: Record<string, number>; documents: Record<string, number>; inquiries: Record<string, number> };
const iso = (d: Date) => d.toISOString().slice(0, 10);

export default function AdminReportsPage() {
  const { t } = useTranslation();
  const [from, setFrom] = useState(iso(new Date(Date.now() - 30 * 86_400_000)));
  const [to, setTo] = useState(iso(new Date()));
  const q = useQuery({ queryKey: ['report', from, to], queryFn: () => api.get<Summary>(`/admin/reports/summary?from=${from}&to=${to}`) });
  const block = (title: string, data: Record<string, number>, label: (k: string) => string) => (
    <Card title={title}>
      <ul className="flex flex-col gap-1 text-sm">{Object.entries(data).length ? Object.entries(data).map(([k, v]) => <li key={k} className="flex justify-between"><span>{label(k)}</span><b>{v}</b></li>) : <li className="text-muted">0</li>}</ul>
    </Card>
  );
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('admin:reports')} action={
        <div className="flex flex-wrap gap-2">
          <Input label={t('counseling:from')} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input label={t('counseling:to')} type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      } />
      {q.isLoading ? <Loading /> : q.error || !q.data ? <ErrorState onRetry={() => q.refetch()} /> : (
        <div className="grid gap-4 md:grid-cols-3">
          <Card title={t('admin:registrations')}><p className="text-4xl font-black text-navy">{q.data.registrations}</p></Card>
          {block(t('admin:metrics.eligibility'), q.data.eligibility, (k) => t(`eligibility:outcome${k}`))}
          {block(t('admin:enrollments'), q.data.enrollments, (k) => t(`coaching:statuses.${k}`))}
          {block(t('admin:counseling'), q.data.appointments, (k) => t(`counseling:statuses.${k}`))}
          {block(t('admin:documents'), q.data.documents, (k) => t(`documents:statuses.${k}`))}
          {block(t('admin:inquiries'), q.data.inquiries, (k) => t(`admin:inquiryStatus.${k}`))}
        </div>
      )}
      <Card title={t('common:export')}>
        <div className="flex flex-wrap gap-3 text-sm">
          <a className="text-royal underline" href="/api/v1/admin/users?role=STUDENT&format=csv">{t('admin:students')} (CSV)</a>
          <a className="text-royal underline" href="/api/v1/admin/inquiries?format=csv">{t('admin:inquiries')} (CSV)</a>
        </div>
      </Card>
    </div>
  );
}
