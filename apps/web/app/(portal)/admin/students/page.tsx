'use client';
import { useTranslation } from 'react-i18next';
import { UsersTable } from '@/components/admin-users';
import { PageHeader } from '@/components/ui';

export default function AdminStudentsPage() {
  const { t } = useTranslation();
  return (
    <div>
      <PageHeader title={t('admin:students')} />
      <UsersTable role="STUDENT" />
    </div>
  );
}
