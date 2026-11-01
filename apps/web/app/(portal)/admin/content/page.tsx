'use client';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LANGUAGES } from '@acee/shared';
import { formatDateTime, type Lang } from '@acee/i18n';
import { api, errorText } from '@/lib/api';
import { useMe } from '@/components/providers';
import { Alert, Badge, Button, Card, Checkbox, ConfirmButton, ErrorState, Input, Loading, PageHeader, Textarea } from '@/components/ui';

type L = { en: string; te?: string; hi?: string };
type Row = { key: string; content: Record<string, unknown>; confirmedAt: string | null; updatedAt: string };
const FACT_KEYS = ['company'];
const empty: L = { en: '', te: '', hi: '' };
const asL = (v: unknown): L => ({ ...empty, ...(v as L | undefined) });

/** One input per language for a translatable text. */
function LocalizedField({ label, value, onChange, multiline }: { label: string; value: L; onChange: (v: L) => void; multiline?: boolean }) {
  const { t } = useTranslation();
  return (
    <fieldset className="flex flex-col gap-2 rounded-[10px] border border-line p-3">
      <legend className="px-1 text-sm font-semibold text-navy">{label}</legend>
      {LANGUAGES.map((l) => {
        const props = { lang: l, label: t(`common:languages.${l}`), value: value[l] ?? '', onChange: (e: { target: { value: string } }) => onChange({ ...value, [l]: e.target.value }) };
        return multiline ? <Textarea key={l} {...props} rows={6} /> : <Input key={l} {...props} />;
      })}
    </fieldset>
  );
}

function CompanyForm({ c, set }: { c: Record<string, unknown>; set: (c: Record<string, unknown>) => void }) {
  const { t } = useTranslation();
  const list = (v: unknown) => ((v as string[] | undefined) ?? []).join(', ');
  const split = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);
  return (
    <div className="grid gap-3">
      <Input label={t('admin:cms.companyName')} value={String(c.name ?? '')} onChange={(e) => set({ ...c, name: e.target.value })} />
      <Input label={t('admin:cms.phones')} value={list(c.phones)} onChange={(e) => set({ ...c, phones: split(e.target.value) })} />
      <Input label={t('common:email')} type="email" value={String(c.email ?? '')} onChange={(e) => set({ ...c, email: e.target.value })} />
      <Input label={t('common:website')} type="url" value={String(c.website ?? '')} onChange={(e) => set({ ...c, website: e.target.value })} />
      <LocalizedField label={t('common:address')} value={asL(c.address)} onChange={(v) => set({ ...c, address: v })} />
      <LocalizedField label={t('common:hours')} value={asL(c.hours)} onChange={(v) => set({ ...c, hours: v })} />
      <Input label={t('admin:cms.branches')} value={list(c.branches)} onChange={(e) => set({ ...c, branches: split(e.target.value) })} />
    </div>
  );
}

function FaqForm({ c, set }: { c: Record<string, unknown>; set: (c: Record<string, unknown>) => void }) {
  const { t } = useTranslation();
  const items = ((c.items as { q: L; a: L }[] | undefined) ?? []).map((i) => ({ q: asL(i.q), a: asL(i.a) }));
  const update = (next: { q: L; a: L }[]) => set({ ...c, items: next });
  return (
    <div className="flex flex-col gap-4">
      {items.map((item, i) => (
        <div key={i} className="flex flex-col gap-2 rounded-[10px] bg-surface p-3">
          <LocalizedField label={`${t('admin:cms.question')} ${i + 1}`} value={item.q} onChange={(q) => update(items.map((x, j) => (j === i ? { ...x, q } : x)))} />
          <LocalizedField label={t('admin:cms.answer')} value={item.a} multiline onChange={(a) => update(items.map((x, j) => (j === i ? { ...x, a } : x)))} />
          <div className="flex gap-2">
            {i > 0 && <Button variant="ghost" onClick={() => update([...items.slice(0, i - 1), item, items[i - 1]!, ...items.slice(i + 1)])}>{t('admin:cms.moveUp')}</Button>}
            <Button variant="ghost" onClick={() => update(items.filter((_, j) => j !== i))}>{t('admin:cms.remove')}</Button>
          </div>
        </div>
      ))}
      <Button variant="outline" className="w-fit" onClick={() => update([...items, { q: { ...empty }, a: { ...empty } }])}>{t('admin:cms.addQuestion')}</Button>
    </div>
  );
}

function Editor({ row }: { row: Row }) {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const { data: me } = useMe();
  const [content, setContent] = useState<Record<string, unknown>>(row.content);
  const [json, setJson] = useState<string | null>(null);
  const [jsonErr, setJsonErr] = useState<string>();
  const save = useMutation({ mutationFn: (c: unknown) => api.put(`/admin/cms/${row.key}`, { content: c }), onSuccess: () => qc.invalidateQueries({ queryKey: ['cms'] }) });
  const confirm = useMutation({ mutationFn: () => api.post(`/admin/cms/${row.key}/confirm`), onSuccess: () => qc.invalidateQueries({ queryKey: ['cms'] }) });
  const isFact = FACT_KEYS.includes(row.key);
  const title = i18n.exists(`admin:cms.${row.key}`) ? t(`admin:cms.${row.key}`) : row.key;

  const submit = () => {
    if (json === null) return save.mutate(content);
    try { const c = JSON.parse(json); setJsonErr(undefined); save.mutate(c); } catch { setJsonErr(t('validation:json')); }
  };

  let form: React.ReactNode;
  if (json !== null) form = <Textarea label={t('admin:contentJson')} className="min-h-60 w-full rounded-xl border border-line p-3 font-mono text-xs" value={json} onChange={(e) => setJson(e.target.value)} error={jsonErr} />;
  else if (row.key === 'company') form = <CompanyForm c={content} set={setContent} />;
  else if (row.key === 'faq') form = <FaqForm c={content} set={setContent} />;
  else if (row.key === 'banner') form = (
    <div className="flex flex-col gap-3">
      <Checkbox label={t('admin:cms.bannerActive')} checked={!!content.active} onChange={(e) => setContent({ ...content, active: e.target.checked })} />
      <LocalizedField label={t('admin:cms.bannerText')} value={asL(content.text)} onChange={(v) => setContent({ ...content, text: v })} />
    </div>
  );
  else if ('body' in content) form = <LocalizedField label={t('admin:cms.body')} value={asL(content.body)} multiline onChange={(v) => setContent({ ...content, body: v })} />;
  else form = <Textarea label={t('admin:contentJson')} className="min-h-60 w-full rounded-xl border border-line p-3 font-mono text-xs" value={JSON.stringify(content, null, 2)} readOnly />;

  return (
    <Card title={title} action={isFact && <Badge tone={row.confirmedAt ? 'success' : 'warning'}>{row.confirmedAt ? t('admin:confirmed') : t('admin:unconfirmed')}</Badge>}>
      <p className="mb-3 text-xs text-muted">{t('admin:cms.translationHint')} · {formatDateTime(row.updatedAt, i18n.language as Lang)}</p>
      {form}
      {(save.error || confirm.error) && <div className="mt-3"><Alert tone="danger">{errorText(t, save.error ?? confirm.error)}</Alert></div>}
      {save.isSuccess && <p className="mt-3 text-sm text-success">{t('common:saved')}</p>}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button loading={save.isPending} onClick={submit}>{t('common:save')}</Button>
        <Button variant="ghost" onClick={() => setJson(json === null ? JSON.stringify(content, null, 2) : null)}>{json === null ? t('admin:cms.advanced') : t('common:back')}</Button>
        {isFact && !row.confirmedAt && (me?.role === 'SUPER_ADMIN'
          ? <ConfirmButton variant="gold" message={t('admin:confirmDetailsHelp')} onConfirm={() => confirm.mutate()}>{t('admin:confirmDetails')}</ConfirmButton>
          : <span className="text-xs text-muted">{t('admin:superAdminOnly')}</span>)}
      </div>
    </Card>
  );
}

const ORDER = ['company', 'banner', 'faq', 'privacy', 'terms', 'about'];

export default function AdminContentPage() {
  const { t } = useTranslation();
  const q = useQuery({ queryKey: ['cms'], queryFn: () => api.get<{ items: Row[] }>('/admin/cms') });
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorState onRetry={() => q.refetch()} />;
  const rows = [...q.data!.items].sort((a, b) => (ORDER.indexOf(a.key) + 99) % 99 - (ORDER.indexOf(b.key) + 99) % 99);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('admin:content')} />
      {rows.map((r) => <Editor key={r.key} row={r} />)}
    </div>
  );
}
