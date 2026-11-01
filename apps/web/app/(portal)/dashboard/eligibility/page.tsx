'use client';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { formatDateTime, type Lang } from '@acee/i18n';
import { api } from '@/lib/api';
import { EligibilityWizard, OUTCOME_TONE } from '@/components/eligibility-wizard';
import { Badge, Card, EmptyState, PageHeader } from '@/components/ui';

type Item = { id: string; outcome: string; createdAt: string; ruleVersion: { version: number; category: string; goReference: string } | null };

export default function StudentEligibilityPage() {
  const { t, i18n } = useTranslation();
  const history = useQuery({ queryKey: ['eligibility-history'], queryFn: () => api.get<{ items: Item[] }>('/eligibility/history') });
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('eligibility:title')} subtitle={t('eligibility:subtitle')} />
      <EligibilityWizard />
      <Card title={t('eligibility:history')}>
        {!history.data?.items.length ? <EmptyState>{t('eligibility:noHistory')}</EmptyState> : (
          <ul className="divide-y divide-line">
            {history.data.items.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <span>{formatDateTime(h.createdAt, i18n.language as Lang)}{h.ruleVersion && <span className="text-muted"> · {h.ruleVersion.category} · {t('scholarships:ruleVersion', { version: h.ruleVersion.version })}</span>}</span>
                <Badge tone={OUTCOME_TONE[h.outcome]}>{t(`eligibility:outcome${h.outcome}`)}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
