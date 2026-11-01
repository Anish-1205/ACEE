import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { getLocales } from 'expo-localization';
import { I18nextProvider } from 'react-i18next';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiError, type AuthResponse, type Me } from '@acee/shared';
import { createI18n, isLang, type Lang } from '@acee/i18n';
import { api, clearTokens, loadTokens, saveTokens, setLanguageHeader, setSignedOutHandler } from './api';

type Auth = {
  ready: boolean;
  user: Me | null;
  lang: Lang;
  setLang: (l: Lang) => Promise<void>;
  login: (identifier: string, password: string) => Promise<void>;
  register: (body: object) => Promise<void>;
  logout: () => Promise<void>;
};
const Ctx = createContext<Auth | null>(null);
export const useAuth = () => useContext(Ctx)!;

const LANG_KEY = 'acee.lang';
const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: (n, e) => !(e instanceof ApiError && e.status < 500) && n < 2 } },
});

export function AppProviders({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<Me | null>(null);
  const [lang, setLangState] = useState<Lang>('en');
  const i18n = useMemo(() => createI18n(lang), [lang]);

  const applyLang = useCallback(async (l: Lang) => {
    setLangState(l);
    setLanguageHeader(l);
    await SecureStore.setItemAsync(LANG_KEY, l);
  }, []);

  useEffect(() => {
    setSignedOutHandler(() => { setUser(null); queryClient.clear(); });
    (async () => {
      const stored = await SecureStore.getItemAsync(LANG_KEY);
      const device = getLocales()[0]?.languageCode;
      await applyLang(isLang(stored) ? stored : isLang(device) ? device : 'en');
      if (await loadTokens()) {
        try { setUser((await api.get<{ user: Me }>('/auth/me')).user); } catch { /* offline or expired: show welcome */ }
      }
      setReady(true);
    })();
  }, [applyLang]);

  const finish = async (r: AuthResponse) => {
    await saveTokens(r);
    setUser(r.user);
    await applyLang(r.user.preferredLanguage);
  };

  const value: Auth = {
    ready, user, lang,
    setLang: async (l) => {
      await applyLang(l);
      if (user) await api.put('/me/language', { preferredLanguage: l }).catch(() => undefined);
    },
    login: async (identifier, password) => finish(await api.post<AuthResponse>('/auth/login', { identifier, password, client: 'mobile' })),
    register: async (body) => finish(await api.post<AuthResponse>('/auth/register', { ...body, client: 'mobile' })),
    logout: async () => {
      await api.post('/auth/logout').catch(() => undefined);
      await clearTokens();
      queryClient.clear();
      setUser(null);
    },
  };

  return (
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <Ctx.Provider value={value}>{children}</Ctx.Provider>
      </I18nextProvider>
    </QueryClientProvider>
  );
}
