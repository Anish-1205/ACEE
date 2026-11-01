'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { homePathForRole, type AuthResponse } from '@acee/shared';
import { api, errorText } from '@/lib/api';
import { Alert, Button, Card, Input } from '@/components/ui';

/** Only same-site relative paths are accepted as a post-login redirect. */
const safeNext = (n: string | null) => (n && n.startsWith('/') && !n.startsWith('//') ? n : null);

function LoginForm() {
  const { t } = useTranslation();
  const router = useRouter();
  const qc = useQueryClient();
  const next = safeNext(useSearchParams().get('next'));
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      const { user } = await api.post<AuthResponse>('/auth/login', { identifier, password, client: 'web' });
      qc.setQueryData(['me'], user);
      document.cookie = `lang=${user.preferredLanguage}; path=/; max-age=31536000; samesite=lax`;
      router.push(next ?? homePathForRole(user.role));
      router.refresh();
    } catch (err) {
      setError(errorText(t, err));
      setBusy(false);
    }
  }

  return (
    <Card>
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        {error && <Alert tone="danger">{error}</Alert>}
        <Input label={t('authentication:identifier')} autoComplete="username" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required />
        <Input label={t('authentication:password')} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <Button type="submit" loading={busy} disabled={!identifier || !password}>{t('authentication:loginButton')}</Button>
      </form>
      <p className="mt-4 text-center text-sm">
        {t('authentication:noAccount')} <Link href="/register" className="font-semibold text-royal underline">{t('authentication:createAccount')}</Link>
      </p>
    </Card>
  );
}

export default function LoginPage() {
  const { t } = useTranslation();
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-3xl font-extrabold text-navy">{t('authentication:loginTitle')}</h1>
      <p className="mb-6 mt-2 text-muted">{t('authentication:loginSubtitle')}</p>
      <Suspense><LoginForm /></Suspense>
    </div>
  );
}
