import Link from 'next/link';
import { COUNTRIES, MAIN_SITE, OFFICIAL_PORTAL_URL, type Course } from '@acee/shared';
import { pickLocalized } from '@acee/i18n';
import { getT } from '@/lib/i18n-server';
import { publicGet } from '@/lib/server-api';
import { getCms, type Company, type Localized } from '@/lib/cms';

const btn = 'inline-flex min-h-12 items-center justify-center rounded-xl px-5 text-sm font-bold transition';

export default async function HomePage() {
  const { t, lang } = await getT();
  const [courses, faq, banner, company] = await Promise.all([
    publicGet<{ items: Course[] }>('/courses'),
    getCms<{ items: { q: Localized; a: Localized }[] }>('faq'),
    getCms<{ active: boolean; text: Localized }>('banner'),
    getCms<Company>('company'),
  ]);

  const jsonLd = company && {
    '@context': 'https://schema.org',
    '@type': 'EducationalOrganization',
    name: company.content.name,
    url: MAIN_SITE.url,
    telephone: company.content.phones.map((p) => `+91${p}`),
    address: { '@type': 'PostalAddress', streetAddress: company.content.address.en, addressLocality: 'Hyderabad', addressRegion: 'Telangana', postalCode: '500060', addressCountry: 'IN' },
  };

  return (
    <>
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />}
      {banner?.content.active && (
        <div className="bg-crimson px-4 py-2 text-center text-sm font-semibold text-white">{pickLocalized(banner.content.text, lang)}</div>
      )}

      {/* 1. Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-navy via-royal to-navy text-white">
        <div className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-crimson/25 blur-3xl" aria-hidden />
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 md:grid-cols-[1.2fr_1fr] md:py-20">
          <div>
            <p className="sub-title mb-3 !text-white">{t('common:taglineSub')}</p>
            <h1 className="text-4xl font-bold leading-tight md:text-6xl">{t('common:tagline')}</h1>
            <p className="mt-4 max-w-xl text-lg text-white/85">{t('common:home.heroBody')}</p>
            <p className="mt-2 text-sm text-white/70">{t('common:portalIntro')} <a href={MAIN_SITE.url} className="font-semibold text-white underline">aceereviewconsultants.com ↗</a></p>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <Link href="/eligibility" className={`${btn} bg-crimson text-white hover:brightness-95`}>{t('navigation:checkEligibility')}</Link>
              <Link href="/coaching" className={`${btn} bg-white text-navy hover:bg-surface`}>{t('navigation:registerCoaching')}</Link>
              <Link href="/counseling" className={`${btn} border border-white/40 hover:bg-white/10`}>{t('navigation:bookCounseling')}</Link>
              <Link href="/login" className={`${btn} border border-white/40 hover:bg-white/10`}>{t('navigation:studentLogin')}</Link>
            </div>
          </div>
          <ul className="flex flex-wrap justify-center gap-2 md:justify-end" aria-label={t('common:home.destinationsTitle')}>
            {COUNTRIES.map((c, i) => (
              <li key={c.code} className={`rounded-lg px-3 py-2 text-sm font-bold shadow-md ${['bg-royal', 'bg-danger', 'bg-success', 'bg-orange'][i % 4]}`} style={{ transform: `rotate(${(i % 3) - 1}deg)` }}>
                {t(`common:countries.${c.code}`)}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className="mx-auto flex max-w-6xl flex-col gap-16 px-4 py-14">
        {/* 3 + 4. Scheme and preliminary eligibility */}
        <section className="grid gap-6 md:grid-cols-2">
          <div className="rounded-card border border-line bg-white p-6 shadow-sm">
            <p className="sub-title mb-2">{t('navigation:scholarships')}</p>
            <h2 className="text-xl font-bold text-navy">{t('scholarships:title')}</h2>
            <p className="mt-2 text-sm text-muted">{t('scholarships:intro')}</p>
            <ul className="mt-4 space-y-2 text-sm">
              {(['benefit1', 'benefit2', 'benefit3'] as const).map((k) => <li key={k} className="flex gap-2"><span className="text-success" aria-hidden>✔</span>{t(`scholarships:${k}`)}</li>)}
            </ul>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/scholarships" className={`${btn} bg-royal text-white`}>{t('common:home.schemeCta')}</Link>
              <a href={OFFICIAL_PORTAL_URL} target="_blank" rel="noopener noreferrer" className={`${btn} border border-line text-navy`}>{t('common:officialPortal')} ↗</a>
            </div>
          </div>
          <div className="rounded-card border border-line bg-surface p-6">
            <p className="sub-title mb-2">{t('navigation:eligibility')}</p>
            <h2 className="text-xl font-bold text-navy">{t('common:home.eligibilityTitle')}</h2>
            <p className="mt-2 text-sm text-ink">{t('common:home.eligibilityBody')}</p>
            <ul className="mt-4 space-y-1 text-sm">
              {(['criteria1', 'criteria2', 'criteria3'] as const).map((k) => <li key={k}>• {t(`scholarships:${k}`)}</li>)}
            </ul>
            <Link href="/eligibility" className={`${btn} mt-5 bg-navy text-white`}>{t('navigation:checkEligibility')}</Link>
            <p className="mt-4 text-xs text-muted">{t('common:disclaimerDecision')}</p>
          </div>
        </section>

        {/* 5. Coaching */}
        <section aria-labelledby="coaching">
          <div className="flex items-end justify-between">
            <p className="sub-title mb-2">{t('navigation:coaching')}</p>
            <h2 id="coaching" className="text-2xl font-bold text-navy md:text-4xl">{t('coaching:title')}</h2>
            <Link href="/coaching" className="text-sm font-semibold text-royal">{t('common:viewAll')} →</Link>
          </div>
          <ul className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-5">
            {(courses?.items ?? []).map((c) => (
              <li key={c.id}>
                <Link href={`/coaching/${c.code.toLowerCase()}`} className="flex h-full flex-col rounded-card border border-line bg-white p-4 shadow-sm transition hover:border-royal">
                  <span className="text-xl font-black text-royal">{c.code}</span>
                  <span className="mt-1 text-xs text-muted">{t('coaching:weeks', { count: c.durationWeeks })}</span>
                  {c.isFree && <span className="mt-2 w-fit rounded-full bg-success/10 px-2 py-0.5 text-xs font-bold text-success">{t('common:free')}*</span>}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* 7. Counseling */}
        <section className="flex flex-col items-start gap-4 rounded-card bg-navy p-8 text-white md:flex-row md:items-center md:justify-between">
          <div>
            <p className="sub-title mb-2 !text-white">{t('navigation:counseling')}</p>
            <h2 className="text-2xl font-bold">{t('common:home.counselingTitle')}</h2>
            <p className="mt-1 text-white/80">{t('common:home.counselingBody')}</p>
          </div>
          <Link href="/counseling" className={`${btn} bg-crimson text-white`}>{t('navigation:bookCounseling')}</Link>
        </section>

        {/* 8. How ACEE assists */}
        <section aria-labelledby="how">
          <p className="sub-title mb-2">ACEE</p>
          <h2 id="how" className="text-2xl font-bold text-navy md:text-4xl">{t('scholarships:howAceeHelps')}</h2>
          <ol className="mt-6 grid gap-4 md:grid-cols-5">
            {[1, 2, 3, 4, 5].map((n) => (
              <li key={n} className="rounded-card border border-line bg-white p-4">
                <span className="grid size-9 place-items-center rounded-full bg-crimson font-black text-white">{n}</span>
                <p className="mt-3 text-sm font-semibold">{t(`scholarships:help${n}`)}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* 9. FAQ */}
        {faq && (
          <section aria-labelledby="faq">
            <h2 id="faq" className="text-2xl font-bold text-navy md:text-4xl">{t('common:home.faqTitle')}</h2>
            <div className="mt-6 divide-y divide-line rounded-card border border-line bg-white">
              {faq.content.items.map((f, i) => (
                <details key={i} className="group p-4">
                  <summary className="cursor-pointer list-none font-semibold text-navy marker:hidden">{pickLocalized(f.q, lang)}</summary>
                  <p className="mt-2 text-sm text-muted">{pickLocalized(f.a, lang)}</p>
                </details>
              ))}
            </div>
          </section>
        )}

      </div>
    </>
  );
}
