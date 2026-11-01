import Link from 'next/link';
import { MAIN_SITE, OFFICIAL_PORTAL_URL } from '@acee/shared';
import { pickLocalized } from '@acee/i18n';
import { getT } from '@/lib/i18n-server';
import { getCms, type Company } from '@/lib/cms';

/** Simple glyph icons, so no icon font is needed. */
const SOCIAL: [keyof typeof MAIN_SITE.social, string, string][] = [
  ['facebook', 'Facebook', 'f'], ['linkedin', 'LinkedIn', 'in'], ['instagram', 'Instagram', 'ig'], ['youtube', 'YouTube', '▶'],
];

const heading = 'mb-4 font-heading text-lg font-semibold text-white';
const link = 'block py-1 hover:text-white';

/** Mirrors the main site's footer: dark blue, four columns, round outline social buttons. */
export async function SiteFooter() {
  const { t, lang } = await getT();
  const company = await getCms<Company>('company');
  const c = company?.content;
  return (
    <footer className="mt-16 bg-navy text-[#9fb0c4]">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <span className="inline-block rounded-md bg-white px-3 py-2">
            <img src={MAIN_SITE.logo} alt="ACEE Review Consultants" width={150} height={29} className="h-7 w-auto" />
          </span>
          <p className="mt-4 text-sm">{t('common:tagline')}</p>
          <div className="mt-5 flex gap-2">
            {SOCIAL.map(([key, label, glyph]) => (
              <a key={key} href={MAIN_SITE.social[key]} target="_blank" rel="noopener noreferrer" aria-label={label}
                className="grid size-9 place-items-center rounded-full border border-white/60 text-xs font-bold text-white hover:bg-white hover:text-navy">{glyph}</a>
            ))}
          </div>
        </div>
        <nav aria-label="Footer" className="text-sm">
          <p className={heading}>{t('common:portalName')}</p>
          <Link href="/scholarships" className={link}>› {t('navigation:scholarships')}</Link>
          <Link href="/eligibility" className={link}>› {t('navigation:checkEligibility')}</Link>
          <Link href="/coaching" className={link}>› {t('navigation:coaching')}</Link>
          <Link href="/counseling" className={link}>› {t('navigation:bookCounseling')}</Link>
          <Link href="/login" className={link}>› {t('navigation:studentLogin')}</Link>
        </nav>
        <nav aria-label="ACEE" className="text-sm">
          <p className={heading}>ACEE</p>
          <a href={MAIN_SITE.url} className={link}>› {t('navigation:mainSite')} ↗</a>
          <a href={MAIN_SITE.about} className={link}>› {t('navigation:about')} ↗</a>
          <a href={MAIN_SITE.contact} className={link}>› {t('navigation:contact')} ↗</a>
          <Link href="/privacy" className={link}>› {t('navigation:privacy')}</Link>
          <Link href="/terms" className={link}>› {t('navigation:terms')}</Link>
          <a href={OFFICIAL_PORTAL_URL} target="_blank" rel="noopener noreferrer" className={link}>› {t('common:officialPortal')} ↗</a>
        </nav>
        {c && (
          <address className="text-sm not-italic">
            <p className={heading}>{t('common:home.contactTitle')}</p>
            <p>{pickLocalized(c.address, lang)}</p>
            <p className="mt-2">{c.phones.map((p, i) => <a key={p} href={`tel:+91${p}`} className="hover:text-white">{i > 0 ? ' · ' : ''}{p}</a>)}</p>
            {c.email && <p><a href={`mailto:${c.email}`} className="hover:text-white">{c.email}</a></p>}
            <p className="mt-2">{t('common:hours')}: {pickLocalized(c.hours, lang)}</p>
            {!!c.branches?.length && <p>{t('common:otherOffices')}: {c.branches.join(', ')}</p>}
            {!company.confirmed && <p className="mt-2 text-xs text-white">{t('common:unconfirmedDetails')}</p>}
          </address>
        )}
      </div>
      <div className="border-t border-white/10 px-4 py-5 text-center text-xs">
        <p>{t('common:rightsReserved', { year: new Date().getFullYear() })}</p>
        <p className="mt-1 text-white/50">{t('common:disclaimerPrivate')}</p>
      </div>
      {/* Floating WhatsApp button, as on the main site. */}
      <a href={MAIN_SITE.whatsapp} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp"
        className="fixed bottom-5 left-5 z-40 grid size-12 place-items-center rounded-full bg-[#25D366] text-white shadow-lg hover:scale-105">
        <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor" aria-hidden><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.4.8 3.2.7a2.8 2.8 0 0 0 1.8-1.3 2.3 2.3 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3Z" /></svg>
      </a>
    </footer>
  );
}
