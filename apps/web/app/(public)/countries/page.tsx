import type { Metadata } from 'next';
import Link from 'next/link';
import { COUNTRIES } from '@acee/shared';
import { getT } from '@/lib/i18n-server';

export const metadata: Metadata = { title: 'Study abroad destinations', alternates: { canonical: '/countries' } };

export default async function CountriesPage() {
  const { t } = await getT();
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-3xl font-extrabold text-navy">{t('common:home.destinationsTitle')}</h1>
      <p className="mt-2 max-w-3xl text-muted">{t('common:countriesSubtitle')}</p>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {COUNTRIES.map((c) => (
          <li key={c.code} className="rounded-card border border-line bg-white p-5 shadow-sm">
            <p className="text-xs font-bold tracking-widest text-muted">{c.code}</p>
            <p className="mt-1 text-lg font-extrabold text-navy">{t(`common:countries.${c.code}`)}</p>
          </li>
        ))}
      </ul>
      <div className="mt-10 flex flex-wrap gap-3">
        <Link href="/counseling" className="inline-flex min-h-12 items-center rounded-xl bg-royal px-5 text-sm font-bold text-white">{t('navigation:bookCounseling')}</Link>
        <Link href="/eligibility" className="inline-flex min-h-12 items-center rounded-xl border border-line px-5 text-sm font-bold text-navy">{t('navigation:checkEligibility')}</Link>
      </div>
    </div>
  );
}
