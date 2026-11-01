import 'server-only';
import { cookies } from 'next/headers';
import { createI18n, isLang, type Lang } from '@acee/i18n';

export async function getLang(): Promise<Lang> {
  const v = (await cookies()).get('lang')?.value;
  return isLang(v) ? v : 'en';
}

export async function getT() {
  const lang = await getLang();
  return { t: createI18n(lang).t, lang };
}
