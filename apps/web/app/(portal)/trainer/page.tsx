'use client';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import type { Batch } from '@acee/shared';
import { formatDate, type Lang } from '@acee/i18n';
import { api } from '@/lib/api';
import { batchSchedule } from '@/components/batch-list';
import { Badge, EmptyState, ErrorState, Loading, PageHeader } from '@/components/ui';

export default function TrainerHome() {
  const { t, i18n } = useTranslation();
  const q = useQuery({ queryKey: ['trainer-batches'], queryFn: () => api.get<{ items: Batch[] }>('/trainer/batches') });
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorState onRetry={() => q.refetch()} />;
  return (
    <div>
      <PageHeader title={t('coaching:trainerTitle')} />
      {!q.data!.items.length ? <EmptyState /> : (
        <ul className="grid gap-4 md:grid-cols-2">
          {q.data!.items.map((b) => (
            <li key={b.id}>
              <Link href={`/trainer/batches/${b.id}`} className="block rounded-card border border-line bg-white p-5 shadow-sm hover:border-royal">
                <div className="flex items-center justify-between"><span className="text-lg font-bold text-navy">{b.course?.code} · {b.name}</span><Badge tone="info">{t('coaching:students', { count: b.seatsTaken })}</Badge></div>
                <p className="mt-1 text-sm text-muted">{batchSchedule(t, b)} · {formatDate(b.startDate, i18n.language as Lang)} – {formatDate(b.endDate, i18n.language as Lang)}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
