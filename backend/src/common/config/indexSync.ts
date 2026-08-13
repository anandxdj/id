import mongoose from 'mongoose';
import { Config } from './config';
import { Logger } from '../logger/index.logger';
import {
  AUTH_CODE_REPLAY_RETENTION_SECONDS,
  COLLECTIONS,
  TTL_EXPIRE_AT_DATE,
} from '../constants/index.constants';

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

/**
 * Every TTL index in the system, in one reviewable list.
 *
 * The ephemeral collections expire on an absolute `expiresAt` date, so their
 * `expireAfterSeconds` is 0 — "expire when that date passes". Authorization codes are
 * the exception: they are retained past expiry so a late replay is still detectable
 * rather than silently reaped (see the constant's comment).
 *
 * None of these indexes enforce anything. They reclaim storage on a ~60 s cycle; the
 * read paths carry their own `expiresAt: { $gt: now }` predicates.
 */
const ttlTargets = (): TtlTarget[] => [
  {
    model: COLLECTIONS.AUTH_EVENT,
    field: 'createdAt',
    expireAfterSeconds: Config.retention.eventSeconds,
  },
  { model: COLLECTIONS.SESSION, field: 'expiresAt', expireAfterSeconds: TTL_EXPIRE_AT_DATE },
  { model: COLLECTIONS.OAUTH_STATE, field: 'expiresAt', expireAfterSeconds: TTL_EXPIRE_AT_DATE },
  {
    model: COLLECTIONS.OAUTH_AUTH_REQUEST,
    field: 'expiresAt',
    expireAfterSeconds: TTL_EXPIRE_AT_DATE,
  },
  {
    model: COLLECTIONS.OAUTH_AUTH_CODE,
    field: 'expiresAt',
    expireAfterSeconds: AUTH_CODE_REPLAY_RETENTION_SECONDS,
  },
  {
    model: COLLECTIONS.OAUTH_ACCESS_TOKEN,
    field: 'expiresAt',
    expireAfterSeconds: TTL_EXPIRE_AT_DATE,
  },
];

const reconcileTtl = async (target: TtlTarget): Promise<void> => {
  const model = mongoose.models[target.model];
  // A declared target whose model was never imported would reconcile nothing at all.
  // Say so rather than skipping silently — the failure mode is an unenforced retention.
  if (!model) {
    Logger.warn('TTL target model is not registered — retention not reconciled', {
      model: target.model,
    });
    return;
  }

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
