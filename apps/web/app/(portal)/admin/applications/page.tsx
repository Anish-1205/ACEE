'use client';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { ApplicationDto, Paged, Stage } from '@acee/shared';
import { formatDate, type Lang } from '@acee/i18n';
import { api } from '@/lib/api';
import { ApplicationPanel } from '@/components/staff';
import { useStageName } from '@/components/use-stage-name';
import { Badge, Button, EmptyState, Input, Loading, PageHeader, Pager } from '@/components/ui';

export default function AdminApplicationsPage() {
  const { t, i18n } = useTranslation();
  const stageName = useStageName();
  const [q, setQ] = useState('');
  const [stageId, setStageId] = useState('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(null);
  const stages = useQuery({ queryKey: ['stages'], queryFn: () => api.get<{ items: Stage[] }>('/applications/stages') });
  const params = new URLSearchParams({ page: String(page), pageSize: '20', ...(q ? { q } : {}), ...(stageId ? { stageId } : {}) });
  const list = useQuery({ queryKey: ['staff-apps', params.toString()], queryFn: () => api.get<Paged<ApplicationDto>>(`/staff/applications?${params}`), placeholderData: keepPreviousData });
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('admin:applications')} subtitle={t('applications:internalNote')} />
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-60 flex-1"><Input label={t('common:search')} placeholder={t('admin:searchPlaceholder')} value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></div>
        <select aria-label={t('applications:currentStage')} className="min-h-11 rounded-xl border border-line px-2" value={stageId} onChange={(e) => { setStageId(e.target.value); setPage(1); }}>
          <option value="">{t('common:all')}</option>
          {stages.data?.items.map((s) => <option key={s.id} value={s.id}>{stageName(s)}</option>)}
        </select>
      </div>
      {list.isLoading ? <Loading /> : !list.data?.items.length ? <EmptyState /> : (
        <>
          <ul className="flex flex-col gap-3">
            {list.data.items.map((a) => (
              <li key={a.id} className="rounded-card border border-line bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span><b>{a.student?.fullName}</b> · {a.student?.mobile} · {a.assignedCounselor?.fullName ?? t('admin:unassigned')}</span>
                  <span className="flex items-center gap-2"><Badge tone="info">{stageName(a.stage)}</Badge><span className="text-xs text-muted">{formatDate(a.updatedAt, i18n.language as Lang)}</span></span>
                </div>
                <Button variant="ghost" onClick={() => setOpen(open === a.id ? null : a.id)}>{open === a.id ? t('common:close') : t('common:viewDetails')}</Button>
                {open === a.id && <ApplicationPanel applicationId={a.id} />}
              </li>
            ))}
          </ul>
          <Pager page={page} pageSize={20} total={list.data.total} onPage={setPage} />
        </>
      )}
    </div>
  );
}
