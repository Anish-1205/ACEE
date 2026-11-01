'use client';
import { useRef, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ALLOWED_UPLOAD_TYPES, DOCUMENT_CATEGORIES, MAX_UPLOAD_BYTES, REQUIRED_DOCUMENTS, missingRequiredDocuments, type DocumentDto } from '@acee/shared';
import { formatDate, type Lang } from '@acee/i18n';
import { api, errorText } from '@/lib/api';
import { Alert, Badge, Button, Card, ConfirmButton, ErrorState, LinkButton, Loading, PageHeader, type Tone } from '@/components/ui';

const TONE: Record<string, Tone> = { PENDING: 'info', APPROVED: 'success', REJECTED: 'danger', MISSING: 'neutral' };

function UploadButton({ category, label }: { category: string; label: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [err, setErr] = useState<string>();
  const upload = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append('category', category); // fields must precede the file for the multipart parser
      fd.append('file', file);
      return api.request<DocumentDto>('POST', '/documents', fd);
    },
    onSuccess: () => { setErr(undefined); qc.invalidateQueries({ queryKey: ['documents'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); },
    onError: (e) => setErr(errorText(t, e)),
  });
  const pick = (file?: File) => {
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) return setErr(t('documents:tooLarge'));
    if (!(ALLOWED_UPLOAD_TYPES as readonly string[]).includes(file.type)) return setErr(t('documents:badType'));
    upload.mutate(file);
  };
  return (
    <div className="flex flex-col gap-1">
      <input ref={input} type="file" accept={ALLOWED_UPLOAD_TYPES.join(',')} className="sr-only" aria-label={`${label}: ${t('documents:chooseFile')}`} data-testid={`upload-${category}`}
        onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
      <Button variant="outline" loading={upload.isPending} onClick={() => input.current?.click()}>{upload.isPending ? t('documents:uploading') : label}</Button>
      {err && <p role="alert" className="text-xs text-danger">{err}</p>}
      {upload.isSuccess && <p role="status" className="text-xs text-success">{t('documents:uploaded')}</p>}
    </div>
  );
}

function DocumentsContent() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const qc = useQueryClient();
  const onboarding = useSearchParams().get('welcome') === '1';
  const q = useQuery({ queryKey: ['documents'], queryFn: () => api.get<{ items: DocumentDto[] }>('/documents/mine') });
  const remove = useMutation({ mutationFn: (id: string) => api.del(`/documents/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ['documents'] }) });

  if (q.isLoading) return <Loading rows={5} />;
  if (q.error) return <ErrorState onRetry={() => q.refetch()} />;
  const current = (cat: string) => q.data!.items.find((d) => d.category === cat && d.status !== 'SUPERSEDED');
  const missing = missingRequiredDocuments(q.data!.items).length;

  return (
    <div className="flex flex-col gap-4">
      {onboarding
        ? <PageHeader title={t('documents:onboardingTitle')} subtitle={<><span className="font-semibold text-royal">{t('documents:onboardingStep')}</span> · {t('documents:onboardingBody')}</>} />
        : <PageHeader title={t('documents:title')} subtitle={t('documents:subtitle')} />}
      <Alert tone="info">{t('documents:sensitiveWarning')}</Alert>
      <Alert tone={missing ? 'warning' : 'success'}>{missing ? t('documents:requiredMissing', { count: missing }) : t('documents:allRequiredDone')}</Alert>
      {remove.error && <Alert tone="danger">{errorText(t, remove.error)}</Alert>}
      {DOCUMENT_CATEGORIES.map((cat) => {
        const d = current(cat);
        const status = d?.status ?? 'MISSING';
        const required = REQUIRED_DOCUMENTS.includes(cat);
        const hint = i18n.exists(`documents:hints.${cat}`) ? t(`documents:hints.${cat}`) : null;
        return (
          <Card key={cat}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-bold text-navy">
                  {t(`documents:categories.${cat}`)}{required && <span className="text-danger" aria-hidden> *</span>}{' '}
                  <Badge tone={required ? 'warning' : 'neutral'}>{required ? t('documents:requiredTag') : t('documents:optionalTag')}</Badge>
                </h2>
                {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
                {d && <p className="text-xs text-muted">{d.fileName} · {t('documents:version', { version: d.version })} · {formatDate(d.createdAt, lang)}</p>}
                {d?.rejectionReason && <p className="mt-1 text-sm text-danger">{t('documents:rejectionReason', { reason: d.rejectionReason })}</p>}
              </div>
              <Badge tone={TONE[status] ?? 'neutral'}>{t(`documents:statuses.${status}`)}</Badge>
            </div>
            <div className="mt-3 flex flex-wrap items-start gap-2">
              <UploadButton category={cat} label={d ? t('documents:reupload') : t('documents:upload')} />
              {d && <a href={`/api/v1/documents/${d.id}/download`} className="inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-semibold text-royal underline">{t('common:download')}</a>}
              {d && <ConfirmButton message={t('documents:deleteConfirm')} onConfirm={() => remove.mutate(d.id)}>{t('common:delete')}</ConfirmButton>}
            </div>
          </Card>
        );
      })}
      {onboarding && (
        <div className="sticky bottom-0 flex justify-end gap-3 border-t border-line bg-surface/95 py-3">
          <LinkButton href="/dashboard" variant={missing ? 'outline' : 'primary'}>{missing ? t('documents:skipForNow') : t('documents:continueToDashboard')}</LinkButton>
        </div>
      )}
    </div>
  );
}

export default function DocumentsPage() {
  return <Suspense><DocumentsContent /></Suspense>;
}
