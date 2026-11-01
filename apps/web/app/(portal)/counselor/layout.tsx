'use client';
import { useTranslation } from 'react-i18next';
import { PortalShell } from '@/components/portal-shell';

export default function CounselorLayout({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const nav = [
    { href: '/counselor', label: t('counseling:counselorTitle'), icon: '💬' },
    { href: '/counselor/documents', label: t('documents:reviewQueue'), icon: '📄' },
    { href: '/counselor/notifications', label: t('navigation:notifications'), icon: '🔔' },
  ];
  return <PortalShell roles={['COUNSELOR', 'ADMIN', 'SUPER_ADMIN']} nav={nav} title={t('navigation:counselorPortal')}>{children}</PortalShell>;
}
