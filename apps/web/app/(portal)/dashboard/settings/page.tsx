'use client';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, errorText } from '@/lib/api';
import { LanguageSwitcher } from '@/components/site-chrome';
import { Alert, Card, Checkbox, ConfirmButton, PageHeader } from '@/components/ui';

const CHANNELS = [['COMM_EMAIL', 'consentEmail'], ['COMM_SMS', 'consentSms'], ['COMM_WHATSAPP', 'consentWhatsapp']] as const;

export default function SettingsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const consents = useQuery({ queryKey: ['consents'], queryFn: () => api.get<{ consents: Record<string, { granted: boolean }> }>('/me/consents') });
  const setConsent = useMutation({
    mutationFn: (b: { purpose: string; granted: boolean }) => api.post('/me/consents', b),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['consents'] }),
  });
  const del = useMutation({ mutationFn: () => api.post('/me/data-requests', { type: 'DELETE_ACCOUNT' }) });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('students:settingsTitle')} />
      <Card title={t('common:language')}><LanguageSwitcher /></Card>
      <Card title={t('students:communication')}>
        {CHANNELS.map(([purpose, key]) => (
          <Checkbox key={purpose} label={t(`authentication:${key}`)} checked={!!consents.data?.consents[purpose]?.granted}
            disabled={consents.isLoading || setConsent.isPending} onChange={(e) => setConsent.mutate({ purpose, granted: e.target.checked })} />
        ))}
      </Card>
      <Card title={t('students:yourData')}>
        <div className="flex flex-wrap gap-3">
          <a href="/api/v1/me/export" download="acee-my-data.json" className="inline-flex min-h-11 items-center rounded-xl border border-line px-4 text-sm font-semibold text-navy">{t('students:exportData')}</a>
          <ConfirmButton message={t('students:deleteConfirm')} onConfirm={() => del.mutate()} loading={del.isPending}>{t('students:deleteAccount')}</ConfirmButton>
        </div>
        {del.isSuccess && <div className="mt-3"><Alert tone="success">{t('students:deleteRequested')}</Alert></div>}
        {del.error && <div className="mt-3"><Alert tone="danger">{errorText(t, del.error)}</Alert></div>}
      </Card>
    </div>
  );
}
