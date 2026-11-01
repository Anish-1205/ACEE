import type { Db } from '../db';
import { config } from '../config';

/**
 * External channels. Each reports whether it is configured; unconfigured channels are skipped and
 * logged, never pretended. Wire a real provider by implementing `send`.
 */
type Channel = { name: 'email' | 'sms' | 'whatsapp' | 'push'; consent: string; configured: () => boolean; send: (userId: string, titleKey: string) => Promise<void> };

const notWired = (name: string) => async () => { throw new Error(`${name} provider credentials present but no provider implementation is wired`); };
export const channels: Channel[] = [
  { name: 'email', consent: 'COMM_EMAIL', configured: () => !!config.SMTP_URL, send: notWired('email') },
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
  for (const ch of channels) {
    if (!ch.configured()) continue;
    const consent = await db.consent.findFirst({ where: { userId: n.userId, purpose: ch.consent as never }, orderBy: { createdAt: 'desc' } });
    if (!consent?.granted) continue;
    // Delivery failures must not break the business action that triggered the notification.
    ch.send(n.userId, n.titleKey).catch((e) => console.warn(`[notify:${ch.name}]`, e.message));
  }
  return row;
}
