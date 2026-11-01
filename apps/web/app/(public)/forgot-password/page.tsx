'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { forgotPasswordSchema, resetPasswordSchema } from '@acee/shared';
import { api, errorText, fieldErrors, type FieldErrors } from '@/lib/api';
import { Alert, Button, Card, Input } from '@/components/ui';

export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [step, setStep] = useState<'request' | 'reset' | 'done'>('request');
  const [identifier, setIdentifier] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(undefined);
    try { await fn(); } catch (e) { setError(errorText(t, e)); } finally { setBusy(false); }
  };
  const request = (e?: React.FormEvent) => {
    e?.preventDefault();
    const p = forgotPasswordSchema.safeParse({ identifier });
    setErrors(fieldErrors(t, p));
    if (p.success) run(async () => { await api.post('/auth/password/forgot', p.data); setStep('reset'); });
  };
  const reset = (e: React.FormEvent) => {
    e.preventDefault();
    const p = resetPasswordSchema.safeParse({ identifier, code, password });
    setErrors(fieldErrors(t, p));
    if (p.success) run(async () => { await api.post('/auth/password/reset', p.data); setStep('done'); });
  };

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-3xl font-bold text-navy">{t('authentication:forgotTitle')}</h1>
      <p className="mb-6 mt-2 text-muted">{t('authentication:forgotSubtitle')}</p>
      <Card>
        {error && <div className="mb-4"><Alert tone="danger">{error}</Alert></div>}
        {step === 'request' && (
          <form onSubmit={request} className="flex flex-col gap-4" noValidate>
            <Input label={t('authentication:identifier')} autoComplete="username" value={identifier} onChange={(e) => setIdentifier(e.target.value)} error={errors.identifier} />
            <Button type="submit" loading={busy}>{t('authentication:sendCode')}</Button>
          </form>
        )}
        {step === 'reset' && (
          <form onSubmit={reset} className="flex flex-col gap-4" noValidate>
            <Alert tone="info">{t('authentication:codeSent')}</Alert>
            <Input label={t('authentication:code')} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} error={errors.code} />
            <Input label={t('authentication:newPassword')} hint={t('authentication:passwordHint')} type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password} />
            <Button type="submit" loading={busy}>{t('authentication:resetButton')}</Button>
            <Button type="button" variant="ghost" disabled={busy} onClick={() => request()}>{t('authentication:resendCode')}</Button>
          </form>
        )}
        {step === 'done' && (
          <div className="flex flex-col gap-4">
            <Alert tone="success">{t('authentication:resetDone')}</Alert>
            <Link href="/login" className="inline-flex min-h-11 items-center justify-center rounded-[10px] bg-crimson px-4 font-heading text-sm font-medium text-white">{t('authentication:loginButton')}</Link>
          </div>
        )}
      </Card>
      <p className="mt-4 text-center text-sm"><Link href="/login" className="text-royal underline">{t('common:back')}</Link></p>
    </div>
  );
}
