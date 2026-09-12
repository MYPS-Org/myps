import 'dotenv/config';
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',

  /*  SWEEP WHATEVER HAPPENED. globalTeardown runs after the whole run —
      passed, failed, or aborted mid-file — which is exactly what afterAll does
      not do. A run whose first request times out against a cold API abandons
      its file before afterAll and strands a Lump Sum Project and its child;
      that happened twice on 2026-09-03 and both needed deleting by hand.

      Orphans are not cosmetic here: a stranded parent holds part of a program's
      allocation, and these specs assert on allocation arithmetic, so a leftover
      shifts figures a later run depends on. */
  globalTeardown: './tests/helpers/lumpSumSweeper.ts',

  /*  ONE WORKER, DELIBERATELY.

      Several Lump Sum specs itemize inside the same program, and run
      concurrently they deadlock SQL Server on UpdateProjectDetails — which
      reads as a product bug and is not one. */
  workers: 1,
  fullyParallel: false,
  timeout: 120000,
  expect: {
    timeout: 10000,
  },
  reporter: [ ['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }] ],
  use: {
    headless: true,
    /*  Overridable like E2E_API_URL, so a run can drive a second Vite on another
        port — needed when someone's own dev server already holds 8080 and points
        at a different API build than the one under test. */
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:8080',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
});
