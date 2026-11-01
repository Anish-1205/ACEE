import { createI18n, formatDateTime, isLang } from '@acee/i18n';
import type { Db } from '../db';
import { config } from '../config';
import { mailConfigured, sendMail } from './mailer';

/** Render a notification in the recipient's language (same rules as the web/mobile clients). */
export function renderNotification(lang: string, titleKey: string, bodyKey: string, params: Record<string, string> = {}) {
  const l = isLang(lang) ? lang : 'en';
  const { t } = createI18n(l);
  const p: Record<string, string> = { ...params };
  if (p.at) p.at = formatDateTime(p.at, l);
  if (p.category) p.category = t(`documents:categories.${p.category}`);
  if (p.stageCode) p.stage = t(`applications:stages.${p.stageCode}`, { defaultValue: p.stageCode });
  return { title: t(`notifications:${titleKey}`, p), body: t(`notifications:${bodyKey}`, p) };
}

type Msg = { email: string; lang: string; title: string; body: string };

/**
 * External channels. Each reports whether it is configured; unconfigured channels are skipped, never pretended.
 * SMS/WhatsApp/push need a provider chosen by ACEE: implement `send` when credentials exist.
 */
type Channel = { name: 'email' | 'sms' | 'whatsapp' | 'push'; consent: string; configured: () => boolean; send: (m: Msg) => Promise<void> };
const notWired = (name: string) => async () => { throw new Error(`${name} provider credentials present but no provider implementation is wired`); };
export const channels: Channel[] = [
  { name: 'email', consent: 'COMM_EMAIL', configured: mailConfigured, send: (m) => sendMail(m.email, m.title, m.body) },
  { name: 'sms', consent: 'COMM_SMS', configured: () => !!config.SMS_PROVIDER_KEY, send: notWired('sms') },
  { name: 'whatsapp', consent: 'COMM_WHATSAPP', configured: () => !!config.WHATSAPP_TOKEN, send: notWired('whatsapp') },
  { name: 'push', consent: 'COMM_PUSH', configured: () => config.EXPO_PUSH_ENABLED, send: notWired('push') },
];

export async function notify(db: Db, n: {
  userId: string; type: string; titleKey: string; bodyKey: string; params?: Record<string, string>; link?: string;
}) {
  const row = await db.notification.create({
    data: { userId: n.userId, type: n.type, titleKey: n.titleKey, bodyKey: n.bodyKey, params: n.params ?? {}, link: n.link ?? null },
  });
  const active = channels.filter((c) => c.configured());
  if (!active.length) return row;
  const user = await db.user.findUnique({ where: { id: n.userId }, select: { email: true, preferredLanguage: true } });
  if (!user) return row;
  const msg = { email: user.email, lang: user.preferredLanguage, ...renderNotification(user.preferredLanguage, n.titleKey, n.bodyKey, n.params) };
  for (const ch of active) {
    const consent = await db.consent.findFirst({ where: { userId: n.userId, purpose: ch.consent as never }, orderBy: { createdAt: 'desc' } });
    if (!consent?.granted) continue;
    // Delivery failures must not break the business action that triggered the notification.
    ch.send(msg).catch((e) => console.warn(`[notify:${ch.name}]`, e.message));
  }
  return row;
}
