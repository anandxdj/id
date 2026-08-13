/**
 * Shared gate for the integration suites.
 *
 * Those suites need real datastores, so they self-skip when nothing is listening —
 * otherwise `pnpm test` would be unusable without `pnpm db:up`. The hazard is that a
 * skip and a pass look identical in the summary line, so a CI run where the service
 * container never came up reports green while more than half the suite never executed.
 *
 * Setting REQUIRE_INTEGRATION=1 converts "unavailable" from a skip into a hard failure.
 * CI sets it; local dev does not.
 */
const FLAG = 'REQUIRE_INTEGRATION';

export const IntegrationGate = {
  /** True when the caller must fail rather than skip on an unreachable datastore. */
  get required(): boolean {
    const value = process.env[FLAG];
    return value === '1' || value === 'true';
  },

  /**
   * Call from the `before` hook's catch block. Re-throws under CI so the run goes red,
   * and otherwise logs one line explaining why the suite is about to skip.
   */
  reportUnavailable(suite: string, cause: unknown): void {
    if (this.required) {
      throw new Error(
        `[${suite}] ${FLAG} is set but the datastores are unreachable — refusing to skip. Cause: ${
          cause instanceof Error ? cause.message : String(cause)
        }`,
      );
    }
    console.log(`[${suite}] datastores unavailable — skipping integration tests (set ${FLAG}=1 to fail instead)`);
  },
};
