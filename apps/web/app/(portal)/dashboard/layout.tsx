'use client';
import { useTranslation } from 'react-i18next';
import { PortalShell } from '@/components/portal-shell';

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const nav = [
    { href: '/dashboard', label: t('navigation:dashboard'), icon: '🏠' },
    { href: '/dashboard/profile', label: t('navigation:profile'), icon: '👤' },
    { href: '/dashboard/eligibility', label: t('navigation:myEligibility'), icon: '✅' },
    { href: '/dashboard/coaching', label: t('navigation:myCoaching'), icon: '📘' },
    { href: '/dashboard/counseling', label: t('navigation:myCounseling'), icon: '💬' },
    { href: '/dashboard/documents', label: t('navigation:documents'), icon: '📄' },
    { href: '/dashboard/application', label: t('navigation:application'), icon: '🧭' },
    { href: '/dashboard/notifications', label: t('navigation:notifications'), icon: '🔔' },
    { href: '/dashboard/settings', label: t('navigation:settings'), icon: '⚙️' },
  ];
  return <PortalShell roles={['STUDENT']} nav={nav} title={t('common:appName')}>{children}</PortalShell>;
}
