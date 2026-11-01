'use client';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { invitableRoles, inviteSchema } from '@acee/shared';
import { api, errorText, fieldErrors, type FieldErrors } from '@/lib/api';
import { useMe } from '@/components/providers';
import { UsersTable } from '@/components/admin-users';
import { Alert, Button, Card, Input, PageHeader, Select } from '@/components/ui';

export default function AdminUsersPage() {
  const { t } = useTranslation();
  const { data: me } = useMe();
  const roles = me ? invitableRoles(me.role) : [];
  const [f, setF] = useState({ email: '', fullName: '', role: 'COUNSELOR' });
  const [errors, setErrors] = useState<FieldErrors>({});
  const invite = useMutation({ mutationFn: (b: object) => api.post<{ inviteUrl: string }>('/auth/invitations', b) });
  const submit = () => {
    const p = inviteSchema.safeParse(f);
    setErrors(fieldErrors(t, p));
    if (p.success) invite.mutate(p.data);
  };
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('admin:users')} />
      <Card title={t('admin:invite')}>
        <div className="grid gap-3 sm:grid-cols-4 sm:items-end">
          <Input label={t('authentication:fullName')} value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} error={errors.fullName} />
          <Input label={t('authentication:email')} type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} error={errors.email} />
          <Select label={t('admin:role')} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })} options={roles.map((r) => ({ value: r, label: t(`authentication:roles.${r}`) }))} />
          <Button loading={invite.isPending} onClick={submit}>{t('admin:invite')}</Button>
        </div>
        {invite.data && <div className="mt-3"><Alert tone="success" title={t('admin:inviteLink')}><code className="break-all text-xs">{invite.data.inviteUrl}</code></Alert></div>}
        {invite.error && <div className="mt-3"><Alert tone="danger">{errorText(t, invite.error)}</Alert></div>}
      </Card>
      <UsersTable />
    </div>
  );
}
