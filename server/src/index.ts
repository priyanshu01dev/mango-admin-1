import { config } from './config';
import { connectDb, disconnectDb } from './db';
import { createApp } from './app';

async function main() {
  await connectDb();
  const server = createApp().listen(config.PORT, () => {
    console.log(`Mango Invoice API on http://localhost:${config.PORT} (${config.NODE_ENV}, GSP=${config.GSP_MODE}, SMS=${config.SMS_PROVIDER})`);
  });
  const shutdown = async () => {
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
