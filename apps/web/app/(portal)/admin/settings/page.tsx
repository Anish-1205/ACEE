'use client';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { stageSchema, type Stage } from '@acee/shared';
import { formatDateTime, type Lang } from '@acee/i18n';
import { api, errorText, fieldErrors, type FieldErrors } from '@/lib/api';
import { useMe } from '@/components/providers';
import { useStageName } from '@/components/use-stage-name';
import { Alert, Badge, Button, Card, ConfirmButton, EmptyState, Input, PageHeader } from '@/components/ui';

type DataRequest = { id: string; type: string; status: string; createdAt: string; user: { fullName: string; email: string } };

export default function AdminSettingsPage() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const stageName = useStageName();
  const { data: me } = useMe();
  const requests = useQuery({ queryKey: ['data-requests'], queryFn: () => api.get<{ items: DataRequest[] }>('/admin/data-requests') });
  const resolve = useMutation({ mutationFn: ({ id, decision }: { id: string; decision: string }) => api.post(`/admin/data-requests/${id}/resolve`, { decision }), onSuccess: () => qc.invalidateQueries({ queryKey: ['data-requests'] }) });
  const stages = useQuery({ queryKey: ['admin-stages'], queryFn: () => api.get<{ items: (Stage & { active: boolean })[] }>('/admin/stages') });
  const [f, setF] = useState({ code: '', en: '', te: '', hi: '', order: '' });
  const [errors, setErrors] = useState<FieldErrors>({});
  const addStage = useMutation({ mutationFn: (b: object) => api.post('/admin/stages', b), onSuccess: () => { setF({ code: '', en: '', te: '', hi: '', order: '' }); qc.invalidateQueries({ queryKey: ['admin-stages'] }); qc.invalidateQueries({ queryKey: ['stages'] }); } });
  const toggle = useMutation({ mutationFn: (s: Stage & { active: boolean }) => api.put(`/admin/stages/${s.id}`, { code: s.code, name: s.name, order: s.order, active: !s.active }), onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-stages'] }) });
  const submitStage = () => {
    const body = { code: f.code, name: { en: f.en, te: f.te, hi: f.hi }, order: Number(f.order), active: true };
    const p = stageSchema.safeParse(body);
    setErrors(fieldErrors(t, p));
    if (p.success) addStage.mutate(body);
  };
  const superAdmin = me?.role === 'SUPER_ADMIN';
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('admin:settings')} />
      <Card title={t('admin:dataRequests')}>
        {resolve.error && <Alert tone="danger">{errorText(t, resolve.error)}</Alert>}
        {!requests.data?.items.length ? <EmptyState /> : (
          <ul className="divide-y divide-line text-sm">
            {requests.data.items.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <span><b>{r.user.fullName}</b> ({r.user.email}) · {r.type} · {formatDateTime(r.createdAt, i18n.language as Lang)}</span>
                {r.status !== 'OPEN' ? <Badge>{r.status}</Badge> : superAdmin ? (
                  <span className="flex gap-2">
                    <ConfirmButton message={r.type === 'DELETE_ACCOUNT' ? t('admin:deleteAccountConfirm') : t('common:confirm')} onConfirm={() => resolve.mutate({ id: r.id, decision: 'COMPLETED' })}>{t('admin:complete')}</ConfirmButton>
                    <Button variant="ghost" onClick={() => resolve.mutate({ id: r.id, decision: 'REJECTED' })}>{t('admin:reject')}</Button>
                  </span>
                ) : <span className="text-xs text-muted">{t('admin:superAdminOnly')}</span>}
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title={t('applications:history')}>
        <ul className="mb-4 divide-y divide-line text-sm">
          {stages.data?.items.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-2 py-2">
              <span>{s.order} · <code className="text-xs">{s.code}</code> · {stageName(s)}</span>
              <Button variant="ghost" onClick={() => toggle.mutate(s)}>{s.active ? t('admin:active') : t('admin:inactive')}</Button>
            </li>
          ))}
        </ul>
        <div className="grid gap-2 md:grid-cols-5 md:items-end">
          <Input label="Code" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} error={errors.code} />
          <Input label="English" value={f.en} onChange={(e) => setF({ ...f, en: e.target.value })} error={errors.name} />
          <Input label="తెలుగు" lang="te" value={f.te} onChange={(e) => setF({ ...f, te: e.target.value })} />
          <Input label="हिन्दी" lang="hi" value={f.hi} onChange={(e) => setF({ ...f, hi: e.target.value })} />
          <Input label="#" type="number" value={f.order} onChange={(e) => setF({ ...f, order: e.target.value })} error={errors.order} />
        </div>
        {addStage.error && <Alert tone="danger">{errorText(t, addStage.error)}</Alert>}
        <Button className="mt-3" loading={addStage.isPending} onClick={submitStage}>{t('common:save')}</Button>
      </Card>
    </div>
  );
}
