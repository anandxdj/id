import { Config } from './config';
import { Logger } from '../logger/index.logger';

/**
 * Email transport seam. A real provider (Resend) is wired in M2 alongside the
 * verification and password-reset flows.
 *
 * Note what is deliberately *not* here: the reference implementation logged the full
 * HTML body — tokenised verification and reset links included — whenever its provider
 * was unconfigured. Anyone with log access owned every account that signed up. Only the
 * recipient and subject are ever logged; the body is not.
 */

export interface OutboundEmail {
  to: string;
  subject: string;
  html: string;
}

export const sendEmail = async (email: OutboundEmail): Promise<void> => {
  if (!Config.email.configured) {
    if (Config.server.isProduction) {
      // Loud, because the caller believes the user was told something.
      Logger.error('Email provider not configured — message dropped', {
        to: email.to,
        subject: email.subject,
      });
      return;
    }
    Logger.info('Email suppressed (no provider configured)', {
      to: email.to,
      subject: email.subject,
    });
    return;
  }

  // TODO(M2): Resend delivery + retry via the background queue, so a transient provider
  // outage cannot silently lose the only verification token a user will ever receive.
  Logger.warn('Email provider configured but delivery is not yet implemented', {
    to: email.to,
    subject: email.subject,
  });
};
