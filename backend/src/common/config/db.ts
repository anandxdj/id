import mongoose from 'mongoose';
import { Config } from './config';
import { Logger } from '../logger/index.logger';

/**
 * Deliberately plain: a try/catch and no `asyncHandler`-style abstraction. Connection
 * setup runs once at boot, outside any request, and wrapping it in shared machinery
 * only adds ways for a production start to fail confusingly.
 */
export const connectDB = async (): Promise<void> => {
  const { uri, dbName } = Config.mongo;

  // In production, indexes are built by an explicit sync step (see indexSync.ts) rather
  // than implicitly on every model at every startup.
  mongoose.set('autoIndex', !Config.server.isProduction);
  mongoose.set('strictQuery', true);

  const options: mongoose.ConnectOptions = {
    serverSelectionTimeoutMS: 10_000,
    ...(dbName ? { dbName } : {}),
  };

  try {
    const conn = await mongoose.connect(uri, options);
    Logger.info('MongoDB connected', {
      host: conn.connection.host,
      database: conn.connection.name,
    });
  } catch (error) {
    Logger.error('MongoDB connection failed', { error });
    throw error;
  }

  // Post-connection events: a later drop must not be silent, or the readiness probe is
  // the only thing that ever notices.
  mongoose.connection.on('disconnected', () => Logger.warn('MongoDB disconnected'));
  mongoose.connection.on('reconnected', () => Logger.info('MongoDB reconnected'));
  mongoose.connection.on('error', (error) => Logger.error('MongoDB error', { error }));
};

export const disconnectDB = async (): Promise<void> => {
  await mongoose.disconnect();
  Logger.info('MongoDB disconnected cleanly');
};
