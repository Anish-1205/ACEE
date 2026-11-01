import type { Metadata } from 'next';
import { CmsDoc } from '@/components/cms-doc';
import { getT } from '@/lib/i18n-server';

export const metadata: Metadata = { title: 'About ACEE', alternates: { canonical: '/about' } };

export default async function AboutPage() {
  const { t } = await getT();
  return (
    <CmsDoc cmsKey="about" titleKey="common:aboutTitle">
      <ul className="mt-8 grid gap-3 sm:grid-cols-2">
        {[1, 2, 3, 4, 5].map((n) => <li key={n} className="rounded-xl border border-line bg-white p-4 text-sm font-semibold">✔ {t(`scholarships:help${n}`)}</li>)}
      </ul>
      <p className="mt-8 rounded-xl bg-white p-4 text-sm text-muted">{t('common:disclaimerPrivate')}</p>
    </CmsDoc>
  );
}
