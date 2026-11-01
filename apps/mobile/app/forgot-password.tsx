import { useState } from 'react';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { forgotPasswordSchema, resetPasswordSchema } from '@acee/shared';
import { api } from '@/lib/api';
import { Button, Card, Field, H1, Notice, P, Screen, useErrorText } from '@/components/ui';

export default function ForgotPassword() {
  const { t } = useTranslation();
  const errorText = useErrorText();
  const [step, setStep] = useState<'request' | 'reset' | 'done'>('request');
  const [identifier, setIdentifier] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const issues = (r: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }) => {
    const e: Record<string, string> = {};
    for (const i of r.error?.issues ?? []) e[String(i.path[0])] ??= i.message.includes(':') ? t(i.message) : t('validation:required');
    setErrors(e);
    return r.success;
  };
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(undefined);
    try { await fn(); } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  };
  const request = () => {
    const p = forgotPasswordSchema.safeParse({ identifier });
    if (issues(p)) run(async () => { await api.post('/auth/password/forgot', p.data); setStep('reset'); });
  };
  const reset = () => {
    const p = resetPasswordSchema.safeParse({ identifier, code, password });
    if (issues(p)) run(async () => { await api.post('/auth/password/reset', p.data); setStep('done'); });
  };

  return (
    <Screen>
      <H1>{t('authentication:forgotTitle')}</H1>
      <P muted>{t('authentication:forgotSubtitle')}</P>
      <Card>
        {error && <Notice tone="danger" text={error} />}
        {step === 'request' && (
          <>
            <Field label={t('authentication:identifier')} autoCapitalize="none" keyboardType="email-address" value={identifier} onChangeText={setIdentifier} error={errors.identifier} />
            <Button title={t('authentication:sendCode')} onPress={request} loading={busy} />
          </>
        )}
        {step === 'reset' && (
          <>
            <Notice text={t('authentication:codeSent')} />
            <Field label={t('authentication:code')} keyboardType="number-pad" autoComplete="sms-otp" maxLength={6} value={code} onChangeText={(v) => setCode(v.replace(/\D/g, ''))} error={errors.code} />
            <Field label={t('authentication:newPassword')} hint={t('authentication:passwordHint')} secureTextEntry value={password} onChangeText={setPassword} error={errors.password} />
            <Button title={t('authentication:resetButton')} onPress={reset} loading={busy} />
            <Button variant="outline" title={t('authentication:resendCode')} onPress={request} disabled={busy} />
          </>
        )}
        {step === 'done' && (
          <>
            <Notice tone="success" text={t('authentication:resetDone')} />
            <Button variant="gold" title={t('authentication:loginButton')} onPress={() => router.replace('/login')} />
          </>
        )}
      </Card>
    </Screen>
  );
}
