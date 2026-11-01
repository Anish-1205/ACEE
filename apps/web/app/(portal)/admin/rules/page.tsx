'use client';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { OFFICIAL_SCHEME_URL, ruleVersionInputSchema } from '@acee/shared';
import { formatDate, pickLocalized, type Lang } from '@acee/i18n';
import { api, apiFieldErrors, errorText, fieldErrors, type FieldErrors } from '@/lib/api';
import { Alert, Badge, Button, Card, ConfirmButton, ErrorState, Input, Loading, PageHeader, Select, Textarea } from '@/components/ui';

type Version = { id: string; category: string; version: number; rules: unknown; sourceUrl: string; goReference: string; verifiedAt: string; effectiveFrom: string; notes: string; active: boolean };
type Scheme = { id: string; code: string; name: Record<string, string>; versions: Version[] };

function NewVersionForm({ scheme, onDone }: { scheme: Scheme; onDone: () => void }) {
  const { t } = useTranslation();
  const latest = scheme.versions.find((v) => v.active) ?? scheme.versions[0];
  const today = new Date().toISOString().slice(0, 10);
  const [f, setF] = useState({ category: latest?.category ?? 'SC', sourceUrl: latest?.sourceUrl ?? OFFICIAL_SCHEME_URL, goReference: '', verifiedAt: today, effectiveFrom: today, notes: '', rules: JSON.stringify(latest?.rules ?? [], null, 2) });
  const [errors, setErrors] = useState<FieldErrors>({});
  const create = useMutation({ mutationFn: (b: object) => api.post(`/admin/schemes/${scheme.id}/versions`, b), onSuccess: onDone, onError: (e) => setErrors(apiFieldErrors(t, e)) });
  const submit = () => {
    let rules: unknown;
    try { rules = JSON.parse(f.rules); } catch { return setErrors({ rules: t('validation:json') }); }
    const p = ruleVersionInputSchema.safeParse({ ...f, rules });
    setErrors(fieldErrors(t, p));
    if (p.success) create.mutate({ ...f, rules });
  };
  return (
    <div className="mt-4 grid gap-3 rounded-xl bg-surface p-4 md:grid-cols-2">
      <Select label={t('admin:category')} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} options={[{ value: 'SC', label: 'SC' }, { value: 'ST', label: 'ST' }]} />
      <Input label={t('admin:goReference')} value={f.goReference} onChange={(e) => setF({ ...f, goReference: e.target.value })} error={errors.goReference} />
      <Input label={t('admin:sourceUrl')} type="url" value={f.sourceUrl} onChange={(e) => setF({ ...f, sourceUrl: e.target.value })} error={errors.sourceUrl} />
      <Input label={t('admin:verifiedAt')} type="date" value={f.verifiedAt} onChange={(e) => setF({ ...f, verifiedAt: e.target.value })} />
      <Input label={t('admin:effectiveFrom')} type="date" value={f.effectiveFrom} onChange={(e) => setF({ ...f, effectiveFrom: e.target.value })} />
      <Input label={t('admin:notes')} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
      <div className="md:col-span-2">
        <Textarea label={t('admin:rulesJson')} className="min-h-72 w-full rounded-xl border border-line p-3 font-mono text-xs" value={f.rules} onChange={(e) => setF({ ...f, rules: e.target.value })} error={errors.rules} />
        <p className="mt-1 text-xs text-muted">{t('admin:rulesHelp')}</p>
      </div>
      {create.error && <div className="md:col-span-2"><Alert tone="danger">{errorText(t, create.error)}</Alert></div>}
      <Button className="w-fit" loading={create.isPending} onClick={submit}>{t('admin:newVersion')}</Button>
    </div>
  );
}

export default function AdminRulesPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const qc = useQueryClient();
  const [creating, setCreating] = useState<string | null>(null);
  const q = useQuery({ queryKey: ['admin-schemes'], queryFn: () => api.get<{ schemes: Scheme[] }>('/admin/schemes') });
  const activate = useMutation({ mutationFn: (id: string) => api.post(`/admin/rule-versions/${id}/activate`), onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-schemes'] }) });
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorState onRetry={() => q.refetch()} />;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('admin:rules')} />
      {q.data!.schemes.map((s) => (
        <Card key={s.id} title={pickLocalized(s.name, lang)} action={<Button variant="outline" onClick={() => setCreating(creating === s.id ? null : s.id)}>{t('admin:newVersion')}</Button>}>
          {creating === s.id && <NewVersionForm scheme={s} onDone={() => { setCreating(null); qc.invalidateQueries({ queryKey: ['admin-schemes'] }); }} />}
          <ul className="mt-4 flex flex-col gap-3">
            {s.versions.map((v) => (
              <li key={v.id} className="rounded-xl border border-line p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold">{v.category} · {t('scholarships:ruleVersion', { version: v.version })}</span>
                  {v.active ? <Badge tone="success">{t('admin:active')}</Badge> : (
                    <ConfirmButton variant="primary" message={t('admin:activateConfirm')} onConfirm={() => activate.mutate(v.id)}>{t('admin:activate')}</ConfirmButton>
                  )}
                </div>
                <p className="mt-1">{t('admin:goReference')}: {v.goReference}</p>
                <p className="text-muted">{t('admin:verifiedAt')}: {formatDate(v.verifiedAt, lang)} · {t('admin:effectiveFrom')}: {formatDate(v.effectiveFrom, lang)}</p>
                {v.notes && <p className="mt-1 text-warning">{v.notes}</p>}
                <details className="mt-2"><summary className="cursor-pointer text-royal">{t('admin:rulesJson')}</summary><pre className="mt-2 overflow-x-auto rounded-lg bg-surface p-3 text-xs">{JSON.stringify(v.rules, null, 2)}</pre></details>
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}
