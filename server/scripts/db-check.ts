/**
 * Checks MONGODB_URI from .env: can we connect, is it a replica set (needed for transactions),
 * which database name is used, and can we write. Usage: npm run db:check
 */
import 'dotenv/config';
import mongoose from 'mongoose';

const uri = process.env.MONGODB_URI ?? '';
const masked = uri.replace(/\/\/([^:/@]+):([^@]+)@/, '//$1:****@');

async function main() {
  if (!uri) throw new Error('MONGODB_URI is not set in .env');
  console.log(`Connecting to ${masked}`);
  const started = Date.now();
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
  const db = mongoose.connection.db!;
  const hello = await db.admin().command({ hello: 1 });
  console.log(`✓ Connected in ${Date.now() - started} ms`);
  console.log(`  Database: ${db.databaseName}${db.databaseName === 'test' ? '  ⚠ no database name in the URI; add /mango_invoice before the "?"' : ''}`);
  console.log(`  Replica set: ${hello.setName ?? 'NONE'}${hello.setName ? '' : '  ✗ transactions will fail; use Atlas or mongod --replSet'}`);
  console.log(`  Server: ${hello.me ?? hello.primary ?? 'unknown'} · MongoDB ${(await db.admin().command({ buildInfo: 1 })).version}`);

  // write + transaction test on a scratch collection
  const session = await mongoose.startSession();
  await session.withTransaction(async () => {
    await db.collection('_connection_check').insertOne({ at: new Date() }, { session });
  });
  await session.endSession();
  await db.collection('_connection_check').drop().catch(() => undefined);
  console.log('✓ Write + transaction OK');
  await mongoose.disconnect();
}

main().catch(async err => {
  const msg = String(err?.message ?? err);
  console.error('✗ ' + msg);
  if (/bad auth|Authentication failed/i.test(msg)) console.error('  → Wrong database username/password (Atlas → Database Access). Special characters in the password must be URL-encoded.');
  if (/ENOTFOUND|querySrv/i.test(msg)) console.error('  → Cluster address not found. Copy the connection string again from Atlas → Connect → Drivers.');
  if (/Server selection timed out|ECONNREFUSED|ETIMEDOUT/i.test(msg)) console.error('  → Cannot reach the cluster. Atlas → Network Access: add your current IP address.');
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
