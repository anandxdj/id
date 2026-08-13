import mongoose from 'mongoose';
import { Config } from './config';
import { Logger } from '../logger/index.logger';

/**
 * Index reconciliation at boot.
 *
 * Two problems this solves that Mongoose does not:
 *
 *  1. `autoIndex` is a footgun in production — it fires a background build on every
 *     model at every startup. We disable it there and run an explicit sync instead,
 *     so index changes are a deliberate, observable step.
 *
 *  2. **Mongoose will not change an existing TTL index.** If `expireAfterSeconds`
 *     differs from what is already on the collection, `syncIndexes()` silently leaves
 *     the old value in place — so raising `EVENT_RETENTION_DAYS` appears to work and
 *     does nothing. Only `collMod` can alter it, which is what `reconcileTtl` does.
 */

interface TtlTarget {
  model: string;
  field: string;
  expireAfterSeconds: number;
}

const ttlTargets = (): TtlTarget[] => [
  { model: 'AuthEvent', field: 'createdAt', expireAfterSeconds: Config.retention.eventSeconds },
];

const reconcileTtl = async (target: TtlTarget): Promise<void> => {
  const model = mongoose.models[target.model];
  if (!model) return;

  const collection = model.collection;
  const indexes = (await collection.indexes()) as Array<{
    name?: string;
    key?: Record<string, number>;
    expireAfterSeconds?: number;
  }>;

  const existing = indexes.find(
    (index) => index.expireAfterSeconds !== undefined && index.key?.[target.field] !== undefined,
  );

  if (!existing?.name) return;
  if (existing.expireAfterSeconds === target.expireAfterSeconds) return;

  await collection.conn.db?.command({
    collMod: collection.collectionName,
    index: { name: existing.name, expireAfterSeconds: target.expireAfterSeconds },
  });

  Logger.info('TTL index retention updated', {
    collection: collection.collectionName,
    index: existing.name,
    from: existing.expireAfterSeconds,
    to: target.expireAfterSeconds,
  });
};

export const IndexSync = {
  /**
   * Build/align every declared index, then fix TTL durations. Index work is slow on
   * large collections, so failures are logged rather than fatal — a stale index makes
   * queries slower, not wrong, and refusing to boot over it is the worse outcome.
   */
  async run(): Promise<void> {
    for (const [name, model] of Object.entries(mongoose.models)) {
      try {
        await model.syncIndexes();
      } catch (error) {
        Logger.error('Index sync failed', { model: name, error });
      }
    }

    for (const target of ttlTargets()) {
      try {
        await reconcileTtl(target);
      } catch (error) {
        Logger.error('TTL reconciliation failed', { model: target.model, error });
      }
    }

    Logger.info('Index sync complete', { models: Object.keys(mongoose.models).length });
  },
};
