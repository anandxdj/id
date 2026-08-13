import { Config } from './config';
import { Logger } from '../logger/index.logger';
import { DevOutbox } from '../email/index.email';
import { EMAIL_DELIVERY } from '../constants/index.constants';

/**
 * Email transport. One provider (Resend), one method, and a hard rule about logging.
 *
 * **The rule: no message body, no token, and no link ever reaches a log sink.** Only the
 * recipient, the subject, and the provider's message id are logged. The reference
 * implementation logs the entire HTML body whenever its provider is unconfigured, so its
 * logs contain a working verification link for every account that has ever signed up
 * (§2.3-14). Our logger redacts by *key* pattern, which is no defence at all against a
 * token interpolated into a message string — so the discipline has to be here, at the
 * point where bodies exist.
 *
 * **Ordering, not queueing.** Callers persist the action token *before* calling this, and
 * do not await the result, so a provider outage cannot lose the token: it is already in
 * Mongo, and the resend endpoint reissues a fresh one. A queue and a worker would buy
 * retry-on-transient-failure, which is genuinely better, and is genuinely out of scope —
 * ordering plus a user-triggered resend is sufficient and has no moving parts.
 *
 * **The HTTP call is direct rather than through the `resend` SDK.** The API surface we
 * need is one authenticated POST; an SDK for that is a dependency, a transitive tree, and
 * a version to track in exchange for nothing. Using `fetch` also lets us own the timeout
 * explicitly, which matters more here than ergonomics: an un-timed request to a hung
 * provider holds a socket and an unresolved promise indefinitely.
 */

export interface OutboundEmail {
  to: string;
  subject: string;
  html: string;
}

export interface DeliveryResult {
  delivered: boolean;
  /** Why not, when `delivered` is false. Never contains message content. */
  reason?: string;
}

/** Internal: what Resend returns on a successful send. Narrowed, never trusted wholesale. */
const _readMessageId = (payload: unknown): string | undefined => {
  if (payload && typeof payload === 'object' && 'id' in payload) {
    const id = (payload as { id: unknown }).id;
    if (typeof id === 'string') return id;
  }
  return undefined;
};

/**
 * Internal: the no-provider path.
 *
 * In production this is an incident — the caller has already told a user that mail is on
 * its way — so it logs at error. Outside production it is the normal state, and the body
 * is handed to the development outbox so the link is reachable through a deliberate,
 * gated endpoint instead of stdout.
 */
const _suppress = (email: OutboundEmail): DeliveryResult => {
  if (Config.server.isProduction) {
    Logger.error('Email provider not configured — message dropped', {
      to: email.to,
      subject: email.subject,
    });
    return { delivered: false, reason: 'provider_not_configured' };
  }

  DevOutbox.capture(email);
  Logger.info('Email delivery skipped — no provider configured', {
    to: email.to,
    subject: email.subject,
    // Says where to find it without being the place it can be found.
    retrieveVia: 'GET /api/v1/auth/dev/outbox',
  });
  return { delivered: false, reason: 'provider_not_configured' };
};

export const EmailService = {
  /**
   * Deliver one message. Resolves rather than rejects on failure: callers dispatch this
   * without awaiting, and an unhandled rejection from a mail provider must not be able to
   * take the process down.
   */
  async send(email: OutboundEmail): Promise<DeliveryResult> {
    if (!Config.email.configured) return _suppress(email);

    try {
      const response = await fetch(EMAIL_DELIVERY.RESEND_ENDPOINT, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${Config.email.apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          from: Config.email.from,
          to: [email.to],
          subject: email.subject,
          html: email.html,
        }),
        signal: AbortSignal.timeout(EMAIL_DELIVERY.TIMEOUT_MS),
      });

      if (!response.ok) {
        // The status is the actionable part. The response body can echo the payload, so
        // it is deliberately not logged.
        Logger.error('Email delivery rejected by provider', {
          to: email.to,
          subject: email.subject,
          status: response.status,
        });
        return { delivered: false, reason: `provider_status_${response.status}` };
      }

      const messageId = _readMessageId(await response.json().catch(() => undefined));
      Logger.info('Email delivered', { to: email.to, subject: email.subject, messageId });
      return { delivered: true };
    } catch (error) {
      Logger.error('Email delivery failed', { to: email.to, subject: email.subject, error });
      return { delivered: false, reason: 'transport_error' };
    }
  },

  /**
   * Fire-and-forget delivery for the request path.
   *
   * Callers have already persisted whatever the message refers to, and the user-visible
   * response must not wait on a third party — which also flattens a timing side channel,
   * since a response that returns before delivery cannot reveal whether delivery happened.
   */
  dispatch(email: OutboundEmail): void {
    void this.send(email).catch((error: unknown) => {
      Logger.error('Email dispatch threw unexpectedly', { to: email.to, error });
    });
  },
};
