'use client';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDateTime, type Lang } from '@acee/i18n';
import { api, errorText } from '@/lib/api';
import { useMe } from '@/components/providers';
import { Alert, Badge, Button, Card, ConfirmButton, ErrorState, Loading, PageHeader, Textarea } from '@/components/ui';

type Row = { key: string; content: unknown; confirmedAt: string | null; updatedAt: string };
const FACT_KEYS = ['company'];

function Editor({ row }: { row: Row }) {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const { data: me } = useMe();
  const [text, setText] = useState(JSON.stringify(row.content, null, 2));
  const [jsonErr, setJsonErr] = useState<string>();
  const save = useMutation({ mutationFn: (content: unknown) => api.put(`/admin/cms/${row.key}`, { content }), onSuccess: () => qc.invalidateQueries({ queryKey: ['cms'] }) });
  const confirm = useMutation({ mutationFn: () => api.post(`/admin/cms/${row.key}/confirm`), onSuccess: () => qc.invalidateQueries({ queryKey: ['cms'] }) });
  const isFact = FACT_KEYS.includes(row.key);
  return (
    <Card title={row.key} action={isFact && <Badge tone={row.confirmedAt ? 'success' : 'warning'}>{row.confirmedAt ? t('admin:confirmed') : t('admin:unconfirmed')}</Badge>}>
      <Textarea label={t('admin:contentJson')} className="min-h-60 w-full rounded-xl border border-line p-3 font-mono text-xs" value={text} onChange={(e) => setText(e.target.value)} error={jsonErr} />
      <p className="mt-1 text-xs text-muted">{formatDateTime(row.updatedAt, i18n.language as Lang)}</p>
      {(save.error || confirm.error) && <Alert tone="danger">{errorText(t, save.error ?? confirm.error)}</Alert>}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button loading={save.isPending} onClick={() => { try { const c = JSON.parse(text); setJsonErr(undefined); save.mutate(c); } catch { setJsonErr(t('validation:json')); } }}>{t('common:save')}</Button>
        {isFact && !row.confirmedAt && (me?.role === 'SUPER_ADMIN'
          ? <ConfirmButton variant="gold" message={t('admin:confirmDetailsHelp')} onConfirm={() => confirm.mutate()}>{t('admin:confirmDetails')}</ConfirmButton>
          : <span className="self-center text-xs text-muted">{t('admin:superAdminOnly')}</span>)}
      </div>
    </Card>
  );
}

export default function AdminContentPage() {
  const { t } = useTranslation();
  const q = useQuery({ queryKey: ['cms'], queryFn: () => api.get<{ items: Row[] }>('/admin/cms') });
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorState onRetry={() => q.refetch()} />;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('admin:content')} />
      {q.data!.items.map((r) => <Editor key={`${r.key}${r.updatedAt}`} row={r} />)}
    </div>
  );
}
