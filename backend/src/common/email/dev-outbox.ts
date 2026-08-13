import { Config } from '../config/config';
import { EMAIL_DELIVERY } from '../constants/index.constants';

/**
 * A bounded, in-memory record of the mail that *would* have been sent, kept only when no
 * provider is configured and only outside production.
 *
 * This exists to answer a specific question: with no Resend key, how does a developer get
 * the verification link? The reference project's answer was to log the entire HTML body —
 * tokenised link included — which means anyone with log access owns every account that
 * ever signed up (§2.3-14). Our logger redacts by key pattern, but a token interpolated
 * into a message *string* defeats that entirely, so the rule is simply that tokens never
 * go to a log sink at all.
 *
 * A process-local ring buffer is the smallest thing that satisfies both constraints: the
 * link is reachable through a deliberate, gated developer endpoint, and it is nowhere else
 * — not on stdout, not in Mongo, not in the events store, and gone at restart.
 *
 * Deliberately not a queue and not durable. It is a development affordance; the
 * production recovery path for undelivered mail is the resend endpoint.
 */

export interface OutboxEntry {
  to: string;
  subject: string;
  html: string;
  capturedAt: Date;
}

// Internal: newest-first ring, capped so this cannot become a memory leak.
const _entries: OutboxEntry[] = [];

export const DevOutbox = {
  /**
   * True when capture is permitted: never in production, and only while there is no
   * provider — a configured provider means real delivery, so there is nothing to capture
   * and no reason to hold message bodies in memory.
   */
  get enabled(): boolean {
    return !Config.server.isProduction && !Config.email.configured;
  },

  capture(entry: Omit<OutboxEntry, 'capturedAt'>): void {
    if (!this.enabled) return;
    _entries.unshift({ ...entry, capturedAt: new Date() });
    if (_entries.length > EMAIL_DELIVERY.DEV_OUTBOX_SIZE) {
      _entries.length = EMAIL_DELIVERY.DEV_OUTBOX_SIZE;
    }
  },

  /** Newest first, optionally narrowed to one recipient. */
  list(to?: string): OutboxEntry[] {
    if (!this.enabled) return [];
    const normalized = to?.toLowerCase().trim();
    return normalized ? _entries.filter((entry) => entry.to === normalized) : [..._entries];
  },

  clear(): void {
    _entries.length = 0;
  },
};
