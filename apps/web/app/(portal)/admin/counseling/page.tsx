'use client';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { AppointmentsTable } from '@/components/staff';
import { PageHeader } from '@/components/ui';

export default function AdminCounselingPage() {
  const { t } = useTranslation();
  const [counselorId, setCounselorId] = useState('');
  const counselors = useQuery({ queryKey: ['counselors'], queryFn: () => api.get<{ items: { id: string; fullName: string }[] }>('/counselors') });
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('admin:counseling')} action={
        <select aria-label={t('counseling:counselor')} className="min-h-11 rounded-xl border border-line px-2" value={counselorId} onChange={(e) => setCounselorId(e.target.value)}>
          <option value="">{t('common:all')}</option>
          {counselors.data?.items.map((c) => <option key={c.id} value={c.id}>{c.fullName}</option>)}
        </select>
      } />
      <AppointmentsTable counselorId={counselorId || undefined} />
    </div>
  );
}
