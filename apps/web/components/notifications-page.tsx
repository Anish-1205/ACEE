'use client';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { NotificationDto } from '@acee/shared';
import { formatDateTime, type Lang } from '@acee/i18n';
import { api } from '@/lib/api';
import { useNotificationText } from './notification-text';
import { Button, EmptyState, ErrorState, Loading, PageHeader, cx } from './ui';

type N = NotificationDto & { link: string | null };

export function NotificationsPage() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const text = useNotificationText();
  const q = useQuery({ queryKey: ['notifications'], queryFn: () => api.get<{ items: N[]; unread: number }>('/me/notifications') });
  const readAll = useMutation({ mutationFn: () => api.post('/me/notifications/read', {}), onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }) });
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorState onRetry={() => q.refetch()} />;
  return (
    <div>
      <PageHeader title={t('notifications:title')} subtitle={q.data!.unread ? t('notifications:unread', { count: q.data!.unread }) : undefined}
        action={q.data!.unread > 0 && <Button variant="outline" loading={readAll.isPending} onClick={() => readAll.mutate()}>{t('notifications:markAllRead')}</Button>} />
      {!q.data!.items.length ? <EmptyState>{t('notifications:empty')}</EmptyState> : (
        <ul className="flex flex-col gap-2">
          {q.data!.items.map((n) => {
            const { title, body } = text(n);
            const inner = (
              <>
                <p className="font-semibold text-navy">{!n.readAt && <span className="mr-2 inline-block size-2 rounded-full bg-orange align-middle" aria-hidden />}{title}</p>
                <p className="text-sm">{body}</p>
                <p className="mt-1 text-xs text-muted">{formatDateTime(n.createdAt, i18n.language as Lang)}</p>
              </>
            );
            const cls = cx('block rounded-xl border p-4', n.readAt ? 'border-line bg-white' : 'border-gold bg-gold/10');
            return <li key={n.id}>{n.link ? <Link href={n.link} className={cls}>{inner}</Link> : <div className={cls}>{inner}</div>}</li>;
          })}
        </ul>
      )}
    </div>
  );
}
