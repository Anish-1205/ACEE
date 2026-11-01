'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { acceptInviteSchema, homePathForRole, type AuthResponse } from '@acee/shared';
import { api, errorText, fieldErrors, type FieldErrors } from '@/lib/api';
import { Alert, Button, Card, Input, Loading } from '@/components/ui';

function InviteForm() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const qc = useQueryClient();
  const token = useSearchParams().get('token') ?? '';
  const invite = useQuery({ queryKey: ['invite', token], queryFn: () => api.get<{ email: string; fullName: string; role: string }>(`/auth/invitations/${encodeURIComponent(token)}`), enabled: token.length >= 20 });
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string>();
  const [busy, setBusy] = useState(false);

  if (token.length < 20 || invite.isError) return <Alert tone="danger">{t('authentication:inviteInvalid')}</Alert>;
  if (!invite.data) return <Loading rows={2} />;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = acceptInviteSchema.safeParse({ token, mobile, password, preferredLanguage: i18n.language });
    setErrors(fieldErrors(t, parsed));
    if (!parsed.success) return;
    setBusy(true);
    try {
      const { user } = await api.post<AuthResponse>('/auth/invitations/accept', parsed.data);
      qc.setQueryData(['me'], user);
      router.push(homePathForRole(user.role));
      router.refresh();
    } catch (err) {
      setFormError(errorText(t, err));
      setBusy(false);
    }
  }

  return (
    <Card>
      <p className="mb-4">{t('authentication:inviteFor', { role: t(`authentication:roles.${invite.data.role}`), email: invite.data.email })}</p>
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        {formError && <Alert tone="danger">{formError}</Alert>}
        <Input label={t('authentication:mobile')} type="tel" inputMode="numeric" maxLength={10} value={mobile} onChange={(e) => setMobile(e.target.value)} error={errors.mobile} />
        <Input label={t('authentication:newPassword')} hint={t('authentication:passwordHint')} type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password} />
        <Button type="submit" loading={busy}>{t('authentication:acceptInvite')}</Button>
      </form>
    </Card>
  );
}

export default function InvitePage() {
  const { t } = useTranslation();
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="mb-6 text-2xl font-extrabold text-navy">{t('authentication:inviteTitle')}</h1>
      <Suspense><InviteForm /></Suspense>
    </div>
  );
}
