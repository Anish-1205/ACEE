'use client';
import { useTranslation } from 'react-i18next';
import type { Stage } from '@acee/shared';
import { pickLocalized, type Lang } from '@acee/i18n';

/** Built-in stages use translation keys; admin-created stages fall back to their stored localized name. */
export function useStageName() {
  const { t, i18n } = useTranslation();
  return (s: Stage) => t(`applications:stages.${s.code}`, { defaultValue: pickLocalized(s.name, i18n.language as Lang) });
}
