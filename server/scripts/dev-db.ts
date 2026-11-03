/**
 * Local development database without installing MongoDB: a single-node replica set
 * (needed for transactions) on 127.0.0.1:27017, data kept in .data/mongo between runs.
 * Usage: npm run db:dev   (Ctrl+C to stop). For production use MongoDB Atlas.
 */
import { mkdirSync } from 'node:fs';
import { MongoMemoryReplSet } from 'mongodb-memory-server-core';

const dbPath = '.data/mongo';
mkdirSync(dbPath, { recursive: true });

const rs = await MongoMemoryReplSet.create({
  replSet: { name: 'rs0', count: 1, storageEngine: 'wiredTiger', ip: '127.0.0.1' },
  instanceOpts: [{ port: 27017, dbPath }]
});
console.log(`Dev MongoDB ready: ${rs.getUri('mango_invoice')}`);
console.log('Data folder: .data/mongo · Ctrl+C to stop');

const stop = async () => {
  await rs.stop({ doCleanup: false });
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
