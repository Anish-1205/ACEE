import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { ApiError, createApiClient, type AuthResponse } from '@acee/shared';

/** EXPO_PUBLIC_API_URL (set per EAS profile) wins; app.json `extra.apiUrl` is the dev fallback (10.0.2.2 = host from the Android emulator). */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? (Constants.expoConfig?.extra?.apiUrl as string) ?? 'http://10.0.2.2:4000';

const ACCESS = 'acee.access';
const REFRESH = 'acee.refresh';
let accessToken: string | null = null;
let refreshing: Promise<boolean> | null = null;
let onSignedOut: () => void = () => {};
let currentLang = 'en';

export const setLanguageHeader = (lang: string) => { currentLang = lang; };
export const setSignedOutHandler = (fn: () => void) => { onSignedOut = fn; };

export async function loadTokens() {
  accessToken = await SecureStore.getItemAsync(ACCESS);
  return !!(accessToken || (await SecureStore.getItemAsync(REFRESH)));
}

export async function saveTokens(r: AuthResponse) {
  accessToken = r.accessToken ?? null;
  // Encrypted at rest by Android Keystore via expo-secure-store.
  await SecureStore.setItemAsync(ACCESS, r.accessToken ?? '');
  await SecureStore.setItemAsync(REFRESH, r.refreshToken ?? '');
}

export async function clearTokens() {
  accessToken = null;
  await SecureStore.deleteItemAsync(ACCESS);
  await SecureStore.deleteItemAsync(REFRESH);
}

/** Single-flight refresh: concurrent 401s share one rotation so the refresh token is used exactly once. */
async function refresh(): Promise<boolean> {
  refreshing ??= (async () => {
    const token = await SecureStore.getItemAsync(REFRESH);
    if (!token) return false;
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/refresh`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: token }) });
      if (!res.ok) throw new ApiError(res.status, 'REFRESH_FAILED', 'refresh failed');
      await saveTokens(await res.json());
      return true;
    } catch (e) {
      // Network errors keep the session (offline); only a rejected token signs the user out.
      if (e instanceof ApiError) { await clearTokens(); onSignedOut(); }
      return false;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

export const api = createApiClient({
  baseUrl: `${API_URL}/api/v1`,
  getAccessToken: () => accessToken,
  onUnauthorized: refresh,
  getLanguage: () => currentLang,
});
