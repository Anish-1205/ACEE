import { buildApp } from './app';
import { config } from './config';
import { sendAppointmentReminders } from './routes/counseling';

const app = await buildApp();
await app.listen({ port: config.PORT, host: config.HOST });

// shortcut: in-process reminder loop; move to a scheduled job/queue when running several API instances.
const timer = setInterval(() => sendAppointmentReminders().catch((e) => app.log.error(e)), 15 * 60_000);
for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, async () => { clearInterval(timer); await app.close(); process.exit(0); });
}
