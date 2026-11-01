import Link from 'next/link';
import { OFFICIAL_PORTAL_URL } from '@acee/shared';
import { pickLocalized } from '@acee/i18n';
import { getT } from '@/lib/i18n-server';
import { getCms, type Company } from '@/lib/cms';

export async function SiteFooter() {
  const { t, lang } = await getT();
  const company = await getCms<Company>('company');
  const c = company?.content;
  return (
    <footer className="mt-16 bg-navy text-white/90">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 md:grid-cols-3">
        <div>
          <p className="text-lg font-bold text-gold">{t('common:appName')}</p>
          <p className="mt-2 text-sm">{t('common:tagline')}</p>
          <p className="mt-4 text-xs text-white/70">{t('common:disclaimerPrivate')}</p>
        </div>
        <div className="text-sm">
          {c && (
            <address className="not-italic">
              <p className="font-semibold">{c.name}</p>
              <p className="mt-1">{pickLocalized(c.address, lang)}</p>
              <p className="mt-2">{t('common:phone')}: {c.phones.map((p, i) => <a key={p} href={`tel:+91${p}`} className="underline">{i > 0 ? ', ' : ''}{p}</a>)}</p>
              <p>{t('common:hours')}: {pickLocalized(c.hours, lang)}</p>
              {!company.confirmed && <p className="mt-2 text-xs text-gold">{t('common:unconfirmedDetails')}</p>}
            </address>
          )}
        </div>
        <nav aria-label="Footer" className="flex flex-col gap-2 text-sm">
          <Link href="/privacy" className="hover:text-gold">{t('navigation:privacy')}</Link>
          <Link href="/terms" className="hover:text-gold">{t('navigation:terms')}</Link>
          <Link href="/contact" className="hover:text-gold">{t('navigation:contact')}</Link>
          <a href={OFFICIAL_PORTAL_URL} target="_blank" rel="noopener noreferrer" className="hover:text-gold">{t('common:officialPortal')} ↗</a>
        </nav>
      </div>
      <p className="border-t border-white/10 py-4 text-center text-xs text-white/60">{t('common:rightsReserved', { year: new Date().getFullYear() })}</p>
    </footer>
  );
}
