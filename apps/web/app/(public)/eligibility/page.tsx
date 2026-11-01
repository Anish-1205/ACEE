import type { Metadata } from 'next';
import { EligibilityWizard } from '@/components/eligibility-wizard';
import { getT } from '@/lib/i18n-server';

export const metadata: Metadata = {
  title: 'Check preliminary scholarship eligibility',
  description: 'A free one-minute preliminary screening for the Dr. B.R. Ambedkar Overseas Vidya Nidhi scheme. Not a government decision.',
  alternates: { canonical: '/eligibility' },
};

export default async function EligibilityPage() {
  const { t } = await getT();
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-3xl font-extrabold text-navy">{t('eligibility:title')}</h1>
      <p className="mb-6 mt-2 text-muted">{t('eligibility:subtitle')}</p>
      <EligibilityWizard />
    </div>
  );
}
