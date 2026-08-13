import { EMAIL_SUBJECTS, FRONTEND_PATHS } from '../constants/index.constants';
import { Config } from '../config/config';

/**
 * Transactional email bodies.
 *
 * Two rules this module exists to enforce:
 *
 *  1. **The token travels in the URL fragment**, never the query string. A query string
 *     is copied into `Referer` headers, browser history, and every proxy access log
 *     between the user and us; a fragment is never sent to a server at all. The reference
 *     puts both its verification and reset tokens in query strings (§2.3-14), which means
 *     the tokens are in the logs of whatever CDN sits in front of the frontend.
 *  2. **Every value interpolated into a body is escaped.** A display name is
 *     user-controlled and ends up inside HTML; not escaping it is stored XSS delivered by
 *     email, rendered by a mail client with the user's session in the next tab.
 */

/** Helper — minimal HTML entity escaping for interpolated, user-controlled text. */
const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export interface RenderedEmail {
  subject: string;
  html: string;
}

/** Internal: one visual shell for every message, so copy changes stay copy changes. */
const _layout = (heading: string, bodyHtml: string): string => `<!doctype html>
<html lang="en"><body style="margin:0;padding:24px;background:#f5f5f4;font-family:ui-sans-serif,system-ui,sans-serif;color:#1c1917">
<div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e7e5e4;padding:32px">
<h1 style="margin:0 0 16px;font-size:20px;font-weight:600">${heading}</h1>
${bodyHtml}
<p style="margin:32px 0 0;padding-top:16px;border-top:1px solid #e7e5e4;font-size:12px;color:#78716c">
If you did not expect this email you can safely ignore it.
</p>
</div></body></html>`;

/** Internal: a primary action button pointing at a frontend page. */
const _button = (href: string, label: string): string =>
  `<p style="margin:24px 0"><a href="${href}" style="display:inline-block;padding:12px 20px;background:#1c1917;color:#fafaf9;text-decoration:none;font-weight:600">${label}</a></p>
<p style="margin:0;font-size:12px;color:#78716c;word-break:break-all">Or paste this link into your browser:<br>${href}</p>`;

/**
 * Internal: build a tokenised link. The token goes after `#`, so it never leaves the
 * browser — see the note at the top of this file.
 */
const _tokenLink = (path: string, token: string): string =>
  `${Config.web.loginRedirectBase}${path}#token=${encodeURIComponent(token)}`;

export const EmailTemplates = {
  verifyEmail(input: { name: string; token: string }): RenderedEmail {
    const link = _tokenLink(FRONTEND_PATHS.VERIFY_EMAIL, input.token);
    return {
      subject: EMAIL_SUBJECTS.VERIFY_EMAIL,
      html: _layout(
        `Confirm your email, ${escapeHtml(input.name)}`,
        `<p style="margin:0;font-size:14px;line-height:1.6">Confirm this address to finish setting up your account.</p>
${_button(link, 'Confirm email address')}`,
      ),
    };
  },

  resetPassword(input: { name: string; token: string }): RenderedEmail {
    const link = _tokenLink(FRONTEND_PATHS.RESET_PASSWORD, input.token);
    return {
      subject: EMAIL_SUBJECTS.PASSWORD_RESET,
      html: _layout(
        `Reset your password, ${escapeHtml(input.name)}`,
        `<p style="margin:0;font-size:14px;line-height:1.6">Choose a new password using the link below. It can be used once, and it expires shortly.</p>
${_button(link, 'Choose a new password')}
<p style="margin:16px 0 0;font-size:14px;line-height:1.6">Resetting your password signs you out of every device.</p>`,
      ),
    };
  },

  /**
   * Sent when someone tries to register an address that already has an account.
   *
   * Registration returns the same response either way — this message is how the *mailbox
   * owner*, who is entitled to know, finds out, without the response telling the caller,
   * who is not. It carries no token: there is nothing to redeem, only two ordinary links.
   */
  alreadyRegistered(input: { name: string }): RenderedEmail {
    const signIn = `${Config.web.loginRedirectBase}${FRONTEND_PATHS.LOGIN}`;
    const forgot = `${Config.web.loginRedirectBase}${FRONTEND_PATHS.FORGOT_PASSWORD}`;
    return {
      subject: EMAIL_SUBJECTS.ALREADY_REGISTERED,
      html: _layout(
        `You already have an account, ${escapeHtml(input.name)}`,
        `<p style="margin:0;font-size:14px;line-height:1.6">Someone just tried to sign up with this email address. Your existing account is unchanged and no new account was created.</p>
<p style="margin:16px 0 0;font-size:14px;line-height:1.6">If that was you, <a href="${signIn}">sign in</a> instead — or <a href="${forgot}">reset your password</a> if you have forgotten it.</p>`,
      ),
    };
  },

  passwordChanged(input: { name: string }): RenderedEmail {
    const forgot = `${Config.web.loginRedirectBase}${FRONTEND_PATHS.FORGOT_PASSWORD}`;
    return {
      subject: EMAIL_SUBJECTS.PASSWORD_CHANGED,
      html: _layout(
        `Your password was changed, ${escapeHtml(input.name)}`,
        `<p style="margin:0;font-size:14px;line-height:1.6">Your password has been updated and every device has been signed out.</p>
<p style="margin:16px 0 0;font-size:14px;line-height:1.6">If this was not you, <a href="${forgot}">reset your password</a> immediately.</p>`,
      ),
    };
  },
};
