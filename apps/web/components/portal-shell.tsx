'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { MAIN_SITE, type Role } from '@acee/shared';
import { api } from '@/lib/api';
import { useLogout, useMe } from './providers';
import { LanguageSwitcher } from './site-chrome';
import { Alert, Loading, cx } from './ui';

export type NavItem = { href: string; label: string; icon: string };

export function PortalShell({ roles, nav, title, children }: { roles: Role[]; nav: NavItem[]; title: string; children: ReactNode }) {
  const { t } = useTranslation();
  const path = usePathname();
  const router = useRouter();
  const logout = useLogout();
  const { data: me, isLoading } = useMe();
  const unread = useQuery({ queryKey: ['notifications'], queryFn: () => api.get<{ unread: number }>('/me/notifications'), enabled: !!me, refetchInterval: 60_000 });

  useEffect(() => {
    if (!isLoading && me === null) router.replace(`/login?next=${encodeURIComponent(path)}`);
  }, [isLoading, me, path, router]);

  const allowed = me && roles.includes(me.role);
  return (
    <div className="min-h-screen md:grid md:grid-cols-[240px_1fr]">
      <aside className="border-b border-line bg-navy text-white md:sticky md:top-0 md:h-screen md:border-b-0">
        <div className="flex items-center justify-between gap-2 px-4 py-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="rounded-md bg-white px-2 py-1.5"><img src="/acee-logo.svg" alt="ACEE Review Consultants" width={96} height={18} className="h-4 w-auto" /></span>
            <span className="text-sm font-bold leading-tight">{title}</span>
          </Link>
          <button onClick={logout} className="rounded-lg px-2 py-2 text-xs text-white/80 hover:bg-white/10 md:hidden">{t('navigation:logout')}</button>
        </div>
        <nav aria-label={title} className="flex gap-1 overflow-x-auto px-2 pb-3 md:flex-col md:overflow-visible">
          {nav.map((n) => {
            const active = path === n.href || (n.href.split('/').length > 2 && path.startsWith(n.href));
            return (
              <Link key={n.href} href={n.href} aria-current={active ? 'page' : undefined}
                className={cx('flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-medium', active ? 'bg-white text-navy' : 'text-white/85 hover:bg-white/10')}>
                <span aria-hidden>{n.icon}</span>{n.label}
                {n.href.endsWith('/notifications') && !!unread.data?.unread && <span className="ml-auto rounded-full bg-orange px-2 text-xs text-white">{unread.data.unread}</span>}
              </Link>
            );
          })}
        </nav>
        <div className="hidden px-4 py-4 md:absolute md:bottom-0 md:block md:w-full">
          <LanguageSwitcher className="mb-3 [&_select]:text-ink" />
          {me && <p className="truncate text-xs text-white/70">{me.fullName} · {t(`authentication:roles.${me.role}`)}</p>}
          <button onClick={logout} className="mt-2 text-sm font-semibold text-white underline">{t('navigation:logout')}</button>
        </div>
      </aside>
      <main id="main" className="mx-auto w-full max-w-5xl px-4 py-6 md:px-8 md:py-10">
        <div className="mb-4 md:hidden"><LanguageSwitcher /></div>
        {isLoading || !me ? <Loading /> : allowed ? children : <Alert tone="danger">{t('common:forbidden')}</Alert>}
      </main>
    </div>
  );
}
