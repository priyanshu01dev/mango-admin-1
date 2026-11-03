import { config } from './config';
import { connectDb, disconnectDb } from './db';
import { createApp } from './app';
import { runDueRecurring } from './services/recurring';

async function main() {
  await connectDb();
  const server = createApp().listen(config.PORT, () => {
    console.log(`Mango Invoice API on http://localhost:${config.PORT} (${config.NODE_ENV}, GSP=${config.GSP_MODE}, SMS=${config.SMS_PROVIDER})`);
  });
  // recurring invoices: run once at start, then every hour (each profile is claimed atomically)
  const tick = () =>
    runDueRecurring()
      .then(r => r.length && console.log(`[recurring] ${r.map(x => x.invoice ?? `${x.profile}: ${x.error}`).join(', ')}`))
      .catch(e => console.error('[recurring]', e.message));
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
