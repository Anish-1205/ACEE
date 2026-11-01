'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { LANGUAGES, TELANGANA_DISTRICTS, registerSchema, type AuthResponse } from '@acee/shared';
import { api, apiFieldErrors, errorText, fieldErrors, type FieldErrors } from '@/lib/api';
import { Alert, Button, Card, Checkbox, Input, Select } from '@/components/ui';

export default function RegisterPage() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const qc = useQueryClient();
  const [f, setF] = useState({
    fullName: '', mobile: '', email: '', district: '', preferredLanguage: i18n.language, password: '',
    acceptTerms: false, consentEmail: false, consentSms: false, consentWhatsapp: false,
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF((p) => ({ ...p, [k]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = registerSchema.safeParse(f);
    setErrors(fieldErrors(t, parsed));
    if (!parsed.success) return;
    setBusy(true);
    setFormError(undefined);
    try {
      const { user } = await api.post<AuthResponse>('/auth/register', { ...parsed.data, client: 'web' });
      qc.setQueryData(['me'], user);
      document.cookie = `lang=${user.preferredLanguage}; path=/; max-age=31536000; samesite=lax`;
      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      setErrors(apiFieldErrors(t, err));
      setFormError(errorText(t, err));
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <h1 className="text-3xl font-extrabold text-navy">{t('authentication:registerTitle')}</h1>
      <p className="mb-6 mt-2 text-muted">{t('authentication:registerSubtitle')}</p>
      <Card>
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          {formError && <Alert tone="danger">{formError}</Alert>}
          <Input label={t('authentication:fullName')} autoComplete="name" value={f.fullName} onChange={set('fullName')} error={errors.fullName} name="fullName" />
          <Input label={t('authentication:mobile')} hint={t('authentication:mobileHint')} type="tel" inputMode="numeric" autoComplete="tel-national" maxLength={10} value={f.mobile} onChange={set('mobile')} error={errors.mobile} name="mobile" />
          <Input label={t('authentication:email')} type="email" autoComplete="email" value={f.email} onChange={set('email')} error={errors.email} name="email" />
          <Select label={t('authentication:district')} placeholder={t('authentication:selectDistrict')} value={f.district} onChange={set('district')} error={errors.district} name="district"
            options={TELANGANA_DISTRICTS.map((d) => ({ value: d, label: d }))} />
          <Select label={t('authentication:preferredLanguage')} value={f.preferredLanguage} onChange={set('preferredLanguage')} name="preferredLanguage"
            options={LANGUAGES.map((l) => ({ value: l, label: t(`common:languages.${l}`) }))} />
          <Input label={t('authentication:newPassword')} hint={t('authentication:passwordHint')} type="password" autoComplete="new-password" value={f.password} onChange={set('password')} error={errors.password} name="password" />
          <fieldset className="rounded-xl border border-line p-3">
            <legend className="px-1 text-sm font-medium">{t('authentication:consentTitle')}</legend>
            <Checkbox label={t('authentication:consentEmail')} checked={f.consentEmail} onChange={set('consentEmail')} />
            <Checkbox label={t('authentication:consentSms')} checked={f.consentSms} onChange={set('consentSms')} />
            <Checkbox label={t('authentication:consentWhatsapp')} checked={f.consentWhatsapp} onChange={set('consentWhatsapp')} />
          </fieldset>
          <Checkbox
            label={<>{t('authentication:acceptTerms')} (<Link href="/terms" className="underline" target="_blank">{t('navigation:terms')}</Link>, <Link href="/privacy" className="underline" target="_blank">{t('navigation:privacy')}</Link>)</>}
            checked={f.acceptTerms} onChange={set('acceptTerms')} error={errors.acceptTerms} name="acceptTerms"
          />
          <Button type="submit" loading={busy}>{t('authentication:registerButton')}</Button>
        </form>
        <p className="mt-4 text-center text-sm">
          {t('authentication:haveAccount')} <Link href="/login" className="font-semibold text-royal underline">{t('authentication:loginButton')}</Link>
        </p>
      </Card>
    </div>
  );
}
