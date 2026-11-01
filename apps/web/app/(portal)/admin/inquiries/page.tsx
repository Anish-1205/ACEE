'use client';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Paged } from '@acee/shared';
import { formatDateTime, type Lang } from '@acee/i18n';
import { api } from '@/lib/api';
import { EmptyState, Input, Loading, PageHeader, Pager, Table, Td } from '@/components/ui';

type Inquiry = { id: string; name: string; mobile: string; email: string | null; interest: string; message: string; status: string; createdAt: string };
const STATUSES = ['NEW', 'CONTACTED', 'CONVERTED', 'CLOSED'];

export default function AdminInquiriesPage() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const params = new URLSearchParams({ page: String(page), pageSize: '20', ...(q ? { q } : {}), ...(status ? { status } : {}) });
  const list = useQuery({ queryKey: ['inquiries', params.toString()], queryFn: () => api.get<Paged<Inquiry>>(`/admin/inquiries?${params}`), placeholderData: keepPreviousData });
  const update = useMutation({ mutationFn: ({ id, status }: { id: string; status: string }) => api.patch(`/admin/inquiries/${id}`, { status }), onSuccess: () => qc.invalidateQueries({ queryKey: ['inquiries'] }) });
  const csv = new URLSearchParams(params);
  csv.set('format', 'csv');
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('admin:inquiries')} action={<a href={`/api/v1/admin/inquiries?${csv}`} className="inline-flex min-h-11 items-center rounded-xl border border-line px-4 text-sm font-semibold">{t('common:export')}</a>} />
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-60 flex-1"><Input label={t('common:search')} value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></div>
        <select aria-label={t('common:status')} className="min-h-11 rounded-xl border border-line px-2" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">{t('common:all')}</option>
          {STATUSES.map((s) => <option key={s} value={s}>{t(`admin:inquiryStatus.${s}`)}</option>)}
        </select>
      </div>
      {list.isLoading ? <Loading /> : !list.data?.items.length ? <EmptyState /> : (
        <>
          <Table head={[t('authentication:fullName'), t('admin:interest'), t('admin:message'), t('common:date'), t('common:status')]}>
            {list.data.items.map((i) => (
              <tr key={i.id}>
                <Td><b>{i.name}</b><br /><a href={`tel:+91${i.mobile}`} className="text-royal underline">{i.mobile}</a>{i.email && <><br /><span className="text-xs">{i.email}</span></>}</Td>
                <Td>{t(`common:contactPage.interests.${i.interest}`)}</Td>
                <Td className="max-w-xs">{i.message}</Td>
                <Td>{formatDateTime(i.createdAt, i18n.language as Lang)}</Td>
                <Td>
                  <select aria-label={t('common:status')} className="min-h-10 rounded-lg border border-line px-1" value={i.status} onChange={(e) => update.mutate({ id: i.id, status: e.target.value })}>
                    {STATUSES.map((s) => <option key={s} value={s}>{t(`admin:inquiryStatus.${s}`)}</option>)}
                  </select>
                </Td>
              </tr>
            ))}
          </Table>
          <Pager page={page} pageSize={20} total={list.data.total} onPage={setPage} />
        </>
      )}
    </div>
  );
}
