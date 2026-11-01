import type { Metadata } from 'next';
import Link from 'next/link';
import type { Course } from '@acee/shared';
import { pickLocalized } from '@acee/i18n';
import { getT } from '@/lib/i18n-server';
import { publicGet } from '@/lib/server-api';

export const metadata: Metadata = {
  title: 'Free coaching: IELTS, PTE, TOEFL, GRE, GMAT',
  description: 'ACEE coaching programmes for international English and admission tests, online and at our Dilsukhnagar office.',
  alternates: { canonical: '/coaching' },
};

export default async function CoachingPage() {
  const { t, lang } = await getT();
  const data = await publicGet<{ items: Course[] }>('/courses');
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-3xl font-extrabold text-navy">{t('coaching:title')}</h1>
      <p className="mt-2 text-muted">{t('coaching:subtitle')}</p>
      <ul className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {(data?.items ?? []).map((c) => (
          <li key={c.id} className="flex flex-col rounded-card border border-line bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black text-royal">{c.code}</h2>
              <span className="text-sm text-muted">{t('coaching:weeks', { count: c.durationWeeks })}</span>
            </div>
            <p className="mt-3 flex-1 text-sm">{pickLocalized(c.description, lang)}</p>
            <p className="mt-3 text-xs text-muted">
              <span className="font-semibold">{t('coaching:feeStatus')}:</span> {c.isFree ? t('common:free') : t('coaching:paid', { amount: c.feeAmount ?? 0 })} — {pickLocalized(c.feeNote, lang)}
            </p>
            <Link href={`/coaching/${c.code.toLowerCase()}`} className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-royal px-4 text-sm font-bold text-white">{t('coaching:batches')}</Link>
          </li>
        ))}
      </ul>
      {!data && <p className="mt-8 text-muted">{t('common:errorBody')}</p>}
    </div>
  );
}
