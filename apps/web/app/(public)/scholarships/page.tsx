import type { Metadata } from 'next';
import Link from 'next/link';
import { OFFICIAL_PORTAL_URL, OFFICIAL_SCHEME_URL } from '@acee/shared';
import { formatDate, pickLocalized } from '@acee/i18n';
import { getT } from '@/lib/i18n-server';
import { publicGet } from '@/lib/server-api';

export const metadata: Metadata = {
  title: 'Dr. B.R. Ambedkar Overseas Vidya Nidhi — scholarship guidance',
  description: 'What the Dr. B.R. Ambedkar Overseas Vidya Nidhi scheme offers SC & ST students of Telangana, preliminary criteria, and how ACEE helps. Official applications are made on the Telangana ePASS portal.',
  alternates: { canonical: '/scholarships' },
};

type Scheme = { code: string; name: Record<string, string>; description: Record<string, string>; versions: { id: string; category: string; version: number; goReference: string; verifiedAt: string }[] };

export default async function ScholarshipsPage() {
  const { t, lang } = await getT();
  const data = await publicGet<{ schemes: Scheme[] }>('/schemes', 300);
  const scheme = data?.schemes.find((s) => s.code === 'AMBEDKAR_OVN');
  return (
    <article className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-3xl font-extrabold text-navy">{scheme ? pickLocalized(scheme.name, lang) : t('scholarships:title')}</h1>
      <p className="mt-4 text-lg">{scheme ? pickLocalized(scheme.description, lang) : t('scholarships:intro')}</p>

      <section className="mt-8 grid gap-6 md:grid-cols-2">
        <div className="rounded-card border border-line bg-white p-6">
          <h2 className="text-lg font-bold text-navy">{t('scholarships:benefitsTitle')}</h2>
          <ul className="mt-3 space-y-2 text-sm">{(['benefit1', 'benefit2', 'benefit3'] as const).map((k) => <li key={k}>✔ {t(`scholarships:${k}`)}</li>)}</ul>
        </div>
        <div className="rounded-card border border-line bg-white p-6">
          <h2 className="text-lg font-bold text-navy">{t('scholarships:criteriaTitle')}</h2>
          <ul className="mt-3 space-y-2 text-sm">{(['criteria1', 'criteria2', 'criteria3'] as const).map((k) => <li key={k}>• {t(`scholarships:${k}`)}</li>)}</ul>
          <p className="mt-3 text-xs text-muted">{t('scholarships:criteriaNote')}</p>
        </div>
      </section>

      {scheme && scheme.versions.length > 0 && (
        <section className="mt-6 rounded-card bg-white p-5 text-sm">
          <h2 className="font-bold text-navy">{t('scholarships:ruleSource')}</h2>
          <ul className="mt-2 space-y-1">
            {scheme.versions.map((v) => (
              <li key={v.id}>
                {v.category} · {t('scholarships:ruleVersion', { version: v.version })} · {t('scholarships:goReference')}: {v.goReference} · {t('scholarships:verifiedOn', { date: formatDate(v.verifiedAt, lang) })}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-xl font-bold text-navy">{t('scholarships:howAceeHelps')}</h2>
        <ol className="mt-3 list-decimal space-y-1 pl-6">{[1, 2, 3, 4, 5].map((n) => <li key={n}>{t(`scholarships:help${n}`)}</li>)}</ol>
      </section>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/eligibility" className="inline-flex min-h-12 items-center rounded-xl bg-gold px-5 text-sm font-bold text-navy">{t('navigation:checkEligibility')}</Link>
        <a href={OFFICIAL_SCHEME_URL} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center rounded-xl bg-royal px-5 text-sm font-bold text-white">{t('scholarships:applyOfficial')} ↗</a>
      </div>
      <p className="mt-6 rounded-xl border border-gold bg-gold/10 p-4 text-sm">
        {t('common:disclaimerDecision')} <a className="underline" href={OFFICIAL_PORTAL_URL} target="_blank" rel="noopener noreferrer">{t('common:officialPortal')}</a>
      </p>
    </article>
  );
}
