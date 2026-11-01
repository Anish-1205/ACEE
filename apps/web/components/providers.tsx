'use client';
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query';
import { I18nextProvider, useTranslation } from 'react-i18next';
import { useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { ApiError, type Me } from '@acee/shared';
import { createI18n, type Lang } from '@acee/i18n';
import { api } from '@/lib/api';

export function Providers({ lang, children }: { lang: Lang; children: ReactNode }) {
  const [client] = useState(() => new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: (n, e) => !(e instanceof ApiError && e.status < 500) && n < 2 },
    },
  }));
  const i18n = useMemo(() => createI18n(lang), [lang]);
  return (
    <QueryClientProvider client={client}>
      <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
    </QueryClientProvider>
  );
}

/** Current user, or null when signed out. */
export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: async () => (await api.get<{ user: Me | null }>('/auth/session')).user,
  });
}

export function useLogout() {
  const qc = useQueryClient();
  const router = useRouter();
  return async () => {
    await api.post('/auth/logout').catch(() => undefined);
    qc.clear();
    router.push('/');
    router.refresh();
  };
}

/** Sets the language cookie, saves it to the profile when signed in, and re-renders server components. */
export function useSetLanguage() {
  const router = useRouter();
  const { data: me } = useMe();
  const { i18n } = useTranslation();
  return async (lang: Lang) => {
    document.cookie = `lang=${lang}; path=/; max-age=31536000; samesite=lax`;
    await i18n.changeLanguage(lang);
    if (me) await api.put('/me/language', { preferredLanguage: lang }).catch(() => undefined);
    router.refresh();
  };
}
