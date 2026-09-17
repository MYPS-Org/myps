// =============================================================================
// narrate.ts — step narration for the narrated specs.
//
// WHY THIS EXISTS. dashboard-real-data.narrated.spec.ts imported `narrator`
// from 'qa-kit/narrate.js' — a plain-JS kit that had been junctioned into
// node_modules on one machine and was never a dependency of this project. On
// every other machine the import fails at COLLECTION, which took down
// `npx playwright test` entirely: no spec in the suite could run, and the
// failure looked nothing like a missing test fixture.
//
// The kit's surface used here is two methods, so it is reimplemented locally
// rather than reintroduced as a dependency nobody can install.
// =============================================================================

import { test, type Page } from '@playwright/test';

export interface Narrator {
  /** Record a verified step. Counts towards the declared total. */
  check(message: string): Promise<void>;
  /** Record an observation that is not a verified step — a branch not taken. */
  say(message: string): Promise<void>;
}

/**
 * A narrator for one test.
 *
 * Steps are pushed onto the test's annotations, so they appear in the HTML
 * report beside the test rather than only in stdout — a narrated run is meant
 * to be watchable after the fact, not just while it happens.
 *
 * `total` is the number of check() calls the spec intends to make. It is
 * reported, never enforced: a spec that legitimately skips a branch says so
 * with say() and should not fail for having narrated one step fewer.
 */
export const narrator = (page: Page, opts: { total?: number } = {}): Narrator => {
  const total = opts.total;
  let done = 0;

  const record = async (type: string, message: string) => {
    const label = type === 'check' ? `${(done += 1)}${total ? `/${total}` : ''}` : '—';
    // eslint-disable-next-line no-console
    console.log(`  [${label}] ${message}`);
    test.info().annotations.push({ type, description: `[${label}] ${message}` });
  };

  return {
    check: (message: string) => record('check', message),
    say: (message: string) => record('note', message),
  };
};
