/**
 * Scope set arithmetic.
 *
 * OAuth carries scope as a space-delimited string, which is why so many
 * implementations end up comparing scope with `===`, `includes()` on the raw string, or
 * — as both this codebase and the reference did — not comparing it at all and treating
 * the existence of a consent row as approval for whatever the client asked for next.
 *
 * Every scope decision in the module goes through this file, so "the user granted X,
 * the client asked for Y, therefore it gets X ∩ Y" is one function call rather than an
 * invariant maintained by hand at four call sites.
 *
 * Order is always taken from the first operand, so `format(intersect(requested, granted))`
 * reflects what the client asked for rather than the order it happens to be stored in.
 */

const WHITESPACE = /\s+/;

export const ScopeUtil = {
  /** `"openid  email openid"` → `['openid', 'email']`. Order-preserving, deduplicated. */
  parse(raw?: string | readonly string[] | null): string[] {
    const parts = Array.isArray(raw) ? raw : String(raw ?? '').split(WHITESPACE);
    const seen = new Set<string>();
    const out: string[] = [];
    for (const part of parts) {
      const value = String(part).trim();
      if (!value || seen.has(value)) continue;
      seen.add(value);
      out.push(value);
    }
    return out;
  },

  format(scopes: readonly string[]): string {
    return scopes.join(' ');
  },

  /** Members of `wanted` that also appear in `allowed`, in `wanted`'s order. */
  intersect(wanted: readonly string[], allowed: readonly string[]): string[] {
    const permitted = new Set(allowed);
    return wanted.filter((scope) => permitted.has(scope));
  },

  /** Members of `wanted` that `allowed` does not cover — what a rejection reports. */
  difference(wanted: readonly string[], allowed: readonly string[]): string[] {
    const permitted = new Set(allowed);
    return wanted.filter((scope) => !permitted.has(scope));
  },

  /**
   * True when `allowed` covers all of `wanted`.
   *
   * This is the check that replaces "a consent row exists". A client previously
   * approved for `openid` asking for `openid profile email` is *not* covered, and must
   * be sent back for consent rather than silently upgraded.
   */
  covers(allowed: readonly string[], wanted: readonly string[]): boolean {
    const permitted = new Set(allowed);
    return wanted.every((scope) => permitted.has(scope));
  },

  /** Union, preserving first-seen order. Used when a user widens an existing grant. */
  union(a: readonly string[], b: readonly string[]): string[] {
    return this.parse([...a, ...b]);
  },

  /** Membership test against a raw space-delimited string. */
  has(raw: string | undefined | null, scope: string): boolean {
    return this.parse(raw).includes(scope);
  },
};
