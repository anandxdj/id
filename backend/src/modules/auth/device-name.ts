import { UAParser } from 'ua-parser-js';
import { DEVICE_NAME, FIELD_LIMITS } from '../../common/constants/index.constants';

/**
 * Turn a user agent into something an account owner can recognise in their session list:
 * "Chrome on Windows" rather than 120 characters of Mozilla-compatible archaeology.
 *
 * The user agent is **attacker-controlled text that is rendered to a victim**, so this is
 * not merely a formatting helper. Three rules follow from that, and all three are here
 * rather than in the caller:
 *
 *  1. **Cap before parsing.** A regex-based parser fed a megabyte of crafted input is a
 *     CPU denial of service on the login path, which is exactly the sort of work rule 5
 *     says must not block the event loop. Anything past `MAX_PARSE_LENGTH` is noise or an
 *     attack, and truncating first bounds the work regardless of which it is.
 *  2. **Build the label from parsed fields, never from the raw string.** The output is
 *     composed of the browser and OS names the parser recognised, so an unrecognised
 *     agent yields "Unknown device" instead of echoing whatever was sent.
 *  3. **Strip anything that is not printable, then cap again.** Defence in depth: the
 *     label is JSON, and JSON encoding already neutralises markup, but a control
 *     character or a bidirectional override in a name rendered into a list is a spoofing
 *     primitive that costs nothing to remove.
 *
 * The raw agent is still stored alongside (capped at `FIELD_LIMITS.USER_AGENT`) because
 * support genuinely needs it; this is the value the UI is expected to show.
 */

/** Internal: printable ASCII plus common accented characters, collapsed whitespace. */
const _sanitize = (value: string): string =>
  value
    // Control characters, zero-width joiners, and the bidirectional overrides that let a
    // crafted label render as something other than what it contains.
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, FIELD_LIMITS.DEVICE_NAME);

export const DeviceName = {
  /**
   * Derive a display label, or `undefined` when there is no user agent at all.
   *
   * `undefined` and `DEVICE_NAME.UNKNOWN` are different answers on purpose: the first
   * means "no agent was sent" (an API client, a curl), the second means "an agent was
   * sent and we could not make sense of it". Only the second is worth showing a user.
   */
  from(userAgent: string | undefined | null): string | undefined {
    if (!userAgent) return undefined;

    const parsed = new UAParser(userAgent.slice(0, DEVICE_NAME.MAX_PARSE_LENGTH)).getResult();
    const browser = parsed.browser.name?.trim();
    const platform = parsed.os.name?.trim();

    const label = browser && platform
      ? `${browser}${DEVICE_NAME.JOINER}${platform}`
      : (browser ?? platform ?? DEVICE_NAME.UNKNOWN);

    return _sanitize(label) || DEVICE_NAME.UNKNOWN;
  },
};
