'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { homePathForRole } from '@acee/shared';
import { LANGUAGES } from '@acee/shared';
import type { Lang } from '@acee/i18n';
import { useMe, useSetLanguage } from './providers';
import { LinkButton, cx } from './ui';

export function LanguageSwitcher({ className }: { className?: string }) {
  const { t, i18n } = useTranslation();
  const setLanguage = useSetLanguage();
  return (
    <label className={cx('flex items-center gap-2 text-sm', className)}>
      <span className="sr-only">{t('common:language')}</span>
      <span aria-hidden>🌐</span>
      <select
        className="min-h-10 rounded-lg border border-line bg-white px-2 text-sm"
        value={i18n.language}
        onChange={(e) => setLanguage(e.target.value as Lang)}
        data-testid="language-switcher"
      >
        {LANGUAGES.map((l) => <option key={l} value={l} lang={l}>{t(`common:languages.${l}`)}</option>)}
      </select>
    </label>
  );
}

const NAV = [
  ['/', 'home'], ['/scholarships', 'scholarships'], ['/eligibility', 'eligibility'], ['/coaching', 'coaching'],
  ['/countries', 'countries'], ['/counseling', 'counseling'], ['/about', 'about'], ['/contact', 'contact'],
] as const;

export function SiteHeader() {
  const { t } = useTranslation();
  const path = usePathname();
  const { data: me } = useMe();
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:rounded focus:bg-gold focus:px-3 focus:py-2">{t('common:skipToContent')}</a>
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="flex items-center gap-2" aria-label={t('common:appName')}>
          <span className="grid size-10 place-items-center rounded-xl bg-navy text-lg font-black text-gold" aria-hidden>A</span>
          <span className="leading-tight">
            <span className="block text-base font-extrabold text-navy">ACEE</span>
            <span className="block text-xs text-muted">Global Education</span>
          </span>
        </Link>
        <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
          {NAV.map(([href, key]) => (
            <Link key={href} href={href} className={cx('rounded-lg px-3 py-2 text-sm font-medium hover:bg-surface', path === href ? 'text-royal' : 'text-ink')} aria-current={path === href ? 'page' : undefined}>
              {t(`navigation:${key}`)}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <LanguageSwitcher className="hidden sm:flex" />
          {me ? <LinkButton href={homePathForRole(me.role)} variant="gold">{t('navigation:dashboard')}</LinkButton> : <LinkButton href="/login" variant="gold">{t('navigation:login')}</LinkButton>}
          <button className="grid size-11 place-items-center rounded-lg border border-line lg:hidden" aria-expanded={open} aria-controls="mobile-nav" onClick={() => setOpen(!open)}>
            <span className="sr-only">{t('common:menu')}</span>
            <span aria-hidden className="text-xl">{open ? '✕' : '☰'}</span>
          </button>
        </div>
      </div>
      {open && (
        <nav id="mobile-nav" aria-label="Main" className="border-t border-line px-4 pb-4 lg:hidden">
          {NAV.map(([href, key]) => (
            <Link key={href} href={href} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-3 text-base font-medium hover:bg-surface">{t(`navigation:${key}`)}</Link>
          ))}
          <LanguageSwitcher className="mt-2 px-3" />
        </nav>
      )}
    </header>
  );
}
