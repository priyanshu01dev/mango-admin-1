import { config } from './config';
import { connectDb, disconnectDb } from './db';
import { createApp } from './app';
import { runDueRecurring } from './services/recurring';
import { deliverBroadcasts, emailCaReports, onceFor, sendDueReminders } from './services/workers';
import { todayIST } from './lib/dates';

async function main() {
  await connectDb();
  const server = createApp().listen(config.PORT, () => {
    console.log(`Mango Invoice API on http://localhost:${config.PORT} (${config.NODE_ENV}, GSP=${config.GSP_MODE}, SMS=${config.SMS_PROVIDER})`);
  });
  // recurring invoices: run once at start, then every hour (each profile is claimed atomically)
  const tick = async () => {
    const log = (name: string) => (e: Error) => console.error(`[${name}]`, e.message);
    await runDueRecurring()
      .then(r => r.length && console.log(`[recurring] ${r.map(x => x.invoice ?? `${x.profile}: ${x.error}`).join(', ')}`))
      .catch(log('recurring'));
    await deliverBroadcasts().catch(log('broadcasts'));
    const istHour = new Date(Date.now() + 5.5 * 3600000).getUTCHours();
    if (istHour >= 9) {
      const today = todayIST();
      // once per day across all instances
      await onceFor(`reminders:${today}`, sendDueReminders).catch(log('reminders'));
      if (today.endsWith('-02')) await onceFor(`ca-reports:${today.slice(0, 7)}`, emailCaReports).catch(log('ca-reports'));
    }
  };
  tick();
  const timer = setInterval(tick, 60 * 60 * 1000);

  const shutdown = async () => {
    clearInterval(timer);
    server.close();
    await disconnectDb();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch(err => {
  console.error('Failed to start:', err.message);
  process.exit(1);
});
