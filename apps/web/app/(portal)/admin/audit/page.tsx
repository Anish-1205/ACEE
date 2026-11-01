'use client';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { Paged } from '@acee/shared';
import { formatDateTime, type Lang } from '@acee/i18n';
import { api } from '@/lib/api';
import { EmptyState, Input, Loading, PageHeader, Pager, Table, Td } from '@/components/ui';

type Log = { id: string; action: string; entityType: string; entityId: string | null; metadata: unknown; ip: string | null; createdAt: string; actor: { fullName: string; role: string } | null };

export default function AdminAuditPage() {
  const { t, i18n } = useTranslation();
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);
  const params = new URLSearchParams({ page: String(page), pageSize: '50', ...(action ? { action } : {}) });
  const q = useQuery({ queryKey: ['audit', params.toString()], queryFn: () => api.get<Paged<Log>>(`/admin/audit-logs?${params}`), placeholderData: keepPreviousData });
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('admin:audit')} />
      <Input label={t('admin:action')} placeholder="document." value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} />
      {q.isLoading ? <Loading /> : !q.data?.items.length ? <EmptyState /> : (
        <>
          <Table head={[t('common:date'), t('admin:actor'), t('admin:action'), t('admin:entity'), 'IP']}>
            {q.data.items.map((l) => (
              <tr key={l.id}>
                <Td>{formatDateTime(l.createdAt, i18n.language as Lang)}</Td>
                <Td>{l.actor ? `${l.actor.fullName} (${t(`authentication:roles.${l.actor.role}`)})` : '—'}</Td>
                <Td><code className="text-xs">{l.action}</code></Td>
                <Td className="text-xs">{l.entityType} {l.entityId}<br /><span className="text-muted">{JSON.stringify(l.metadata)}</span></Td>
                <Td className="text-xs">{l.ip}</Td>
              </tr>
            ))}
          </Table>
          <Pager page={page} pageSize={50} total={q.data.total} onPage={setPage} />
        </>
      )}
    </div>
  );
}
