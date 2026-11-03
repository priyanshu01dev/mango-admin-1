import mongoose from 'mongoose';
import { config } from './config';

mongoose.set('strictQuery', true);

export async function connectDb(uri = config.MONGODB_URI) {
  await mongoose.connect(uri, { autoIndex: true });
  return mongoose.connection;
}

export async function disconnectDb() {
  await mongoose.disconnect();
}

/**
 * Runs fn inside a MongoDB transaction so invoice, stock, party balance and payment
 * writes succeed or fail together. Requires a replica set (Atlas, or local mongod --replSet).
 */
export async function inTransaction<T>(fn: (session: mongoose.ClientSession) => Promise<T>): Promise<T> {
  const session = await mongoose.startSession();
  try {
    let result!: T;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}
