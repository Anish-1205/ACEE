import { useState } from 'react';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/lib/auth';
import { Button, Card, Field, H1, Notice, P, Screen, useErrorText } from '@/components/ui';

export default function Login() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const errorText = useErrorText();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    setError(undefined);
    try {
      await login(identifier.trim(), password);
      router.replace('/');
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  };
  return (
    <Screen>
      <H1>{t('authentication:loginTitle')}</H1>
      <P muted>{t('authentication:loginSubtitle')}</P>
      <Card>
        {error && <Notice tone="danger" text={error} />}
        <Field testID="identifier" label={t('authentication:identifier')} autoCapitalize="none" autoComplete="username" keyboardType="email-address" value={identifier} onChangeText={setIdentifier} />
        <Field testID="password" label={t('authentication:password')} secureTextEntry autoComplete="password" value={password} onChangeText={setPassword} onSubmitEditing={submit} />
        <Button testID="login" title={t('authentication:loginButton')} onPress={submit} loading={busy} disabled={!identifier || !password} />
        <Button variant="outline" title={t('authentication:createAccount')} onPress={() => router.replace('/register')} />
      </Card>
    </Screen>
  );
}
