import i18next, { type i18n } from 'i18next';
import en from './locales/en';
import te from './locales/te';
import hi from './locales/hi';

export const resources = { en, te, hi } as const;
export type Lang = keyof typeof resources;
export const NAMESPACES = Object.keys(en) as (keyof typeof en)[];
export const LOCALE_TAG: Record<Lang, string> = { en: 'en-IN', te: 'te-IN', hi: 'hi-IN' };

export const isLang = (v: unknown): v is Lang => v === 'en' || v === 'te' || v === 'hi';

/** A fresh, synchronously initialised instance (safe per request on the server). Missing keys fall back to English. */
export function createI18n(lng: Lang): i18n {
  const inst = i18next.createInstance();
  void inst.init({
    lng, fallbackLng: 'en', resources, ns: NAMESPACES, defaultNS: 'common',
    interpolation: { escapeValue: false }, initAsync: false, returnNull: false,
  });
  return inst;
}

/** Pick the reader's language from a CMS/DB `{en, te, hi}` object, falling back to English. */
export function pickLocalized(value: unknown, lng: Lang): string {
  if (!value || typeof value !== 'object') return typeof value === 'string' ? value : '';
  const v = value as Record<string, string | undefined>;
  return v[lng] || v.en || '';
}

export const formatDate = (d: string | Date, lng: Lang, opts: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }) =>
  new Intl.DateTimeFormat(LOCALE_TAG[lng], { timeZone: 'Asia/Kolkata', ...opts }).format(new Date(d));
export const formatDateTime = (d: string | Date, lng: Lang) => formatDate(d, lng, { dateStyle: 'medium', timeStyle: 'short' });
export const formatTime = (d: string | Date, lng: Lang) => formatDate(d, lng, { timeStyle: 'short' });
export const formatNumber = (n: number, lng: Lang) => new Intl.NumberFormat(LOCALE_TAG[lng]).format(n);
export const formatINR = (n: number, lng: Lang) => new Intl.NumberFormat(LOCALE_TAG[lng], { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

/** Translation key for a known API error code (shared by web and mobile). */
const ERROR_KEYS: Record<string, string> = {
  INVALID_CREDENTIALS: "authentication:invalidCredentials",
  ACCOUNT_EXISTS: "authentication:accountExists",
  RATE_LIMITED: "authentication:tooManyAttempts",
  UNAUTHENTICATED: "authentication:sessionExpired",
  SLOT_UNAVAILABLE: "counseling:slotTaken",
  ALREADY_ENROLLED: "coaching:alreadyEnrolled",
  INVALID_FILE_TYPE: "documents:badType",
  FILE_TOO_LARGE: "documents:tooLarge",
  INVITE_INVALID: "authentication:inviteInvalid",
  INVALID_CODE: "authentication:invalidCode",
  RESET_UNAVAILABLE: "authentication:resetUnavailable",
  VALIDATION_ERROR: "validation:generic",
};
export const errorKeyFor = (code: string): string | undefined => ERROR_KEYS[code];

export type { Resources } from './locales/en';
