'use client';
import { useTranslation } from 'react-i18next';
import type { NotificationDto } from '@acee/shared';
import { formatDateTime, type Lang } from '@acee/i18n';

/** Notifications are stored as i18n keys + params so each reader sees them in their own language. */
export function useNotificationText() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  return (n: NotificationDto) => {
    const p: Record<string, string> = { ...n.params };
    if (p.at) p.at = formatDateTime(p.at, lang);
    if (p.category) p.category = t(`documents:categories.${p.category}`);
    if (p.stageCode) p.stage = t(`applications:stages.${p.stageCode}`, { defaultValue: p.stageCode });
    return { title: t(`notifications:${n.titleKey}`, p), body: t(`notifications:${n.bodyKey}`, p) };
  };
}
