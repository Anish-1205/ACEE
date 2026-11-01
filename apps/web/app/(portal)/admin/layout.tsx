'use client';
import { useTranslation } from 'react-i18next';
import { PortalShell } from '@/components/portal-shell';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const items: [string, string, string][] = [
    ['', 'overview', '📊'], ['/students', 'students', '🎓'], ['/inquiries', 'inquiries', '📥'], ['/rules', 'rules', '⚖️'],
    ['/coaching', 'coaching', '📘'], ['/counseling', 'counseling', '💬'], ['/applications', 'applications', '🧭'], ['/documents', 'documents', '📄'],
    ['/announcements', 'announcements', '📣'], ['/content', 'content', '📝'], ['/reports', 'reports', '📈'], ['/users', 'users', '🔐'],
    ['/audit', 'audit', '🕵️'], ['/settings', 'settings', '⚙️'],
  ];
  const nav = items.map(([p, k, icon]) => ({ href: `/admin${p}`, label: t(`admin:${k}`), icon }));
  return <PortalShell roles={['ADMIN', 'SUPER_ADMIN']} nav={nav} title={t('admin:title')}>{children}</PortalShell>;
}
