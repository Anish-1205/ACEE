'use client';
import { useTranslation } from 'react-i18next';
import { PortalShell } from '@/components/portal-shell';

export default function TrainerLayout({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const nav = [
    { href: '/trainer', label: t('coaching:trainerTitle'), icon: '📘' },
    { href: '/trainer/notifications', label: t('navigation:notifications'), icon: '🔔' },
  ];
  return <PortalShell roles={['TRAINER', 'ADMIN', 'SUPER_ADMIN']} nav={nav} title={t('navigation:trainerPortal')}>{children}</PortalShell>;
}
