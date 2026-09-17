// =============================================================================
// lumpSumSweeper.ts — remove everything the Lump Sum specs created.
//
// WHY THIS IS NOT AN afterAll. Because afterAll does not run when it is most
// needed. Observed twice on 2026-09-03: a run whose first request timed out
// against a cold API aborted the file before its afterAll, stranding a
// provisioned Lump Sum Project and its child. Both had to be deleted by hand.
//
// Orphans are not merely untidy here. Every stranded parent keeps its slice of
// a program's allocation, and specs assert on allocation arithmetic — so a
// leftover from a failed run shifts the figures a later run depends on, and the
// failure surfaces somewhere else entirely.
//
// This runs as Playwright's globalTeardown, which fires whatever the specs did:
// passed, failed, or aborted mid-file.
//
// IT SWEEPS BY TAG, NOT BY LIST. Every fixture writes "(e2e <ISO timestamp>)"
// into the Description it creates — provisionLumpSum and importChild both do —
// so the marker identifies test data without any spec having to register what
// it made. Anything without that marker is somebody's real data and is left
// alone; the migrated MyMYPS sample is deliberately NOT matched, because its
// descriptions carry the marker too and it must survive (see SAMPLE below).
// =============================================================================

import { request } from '@playwright/test';
import { restoreFixtureProgramsWith } from './approvedProgramFixture';

const API = (process.env.E2E_API_URL ?? 'http://localhost:5015').replace(/\/$/, '');

/** The marker every Lump Sum fixture writes into what it creates. */
const E2E_MARKER = /\(e2e \d{4}-\d{2}-\d{2}T/;

/*  THE MIGRATED SAMPLE IS NOT TEST DATA, though its descriptions look like it.
    LumpSum.SampleData.Dev.sql copies three parents out of MyMYPS whose
    descriptions already read "Demo pack rehearsal (e2e ...)". They back every
    other spec's fixtures and the module's manual testing, so sweeping them
    would quietly empty the module. Pinned by ProjectId, which is stable across
    re-runs of the sample script. */
const SAMPLE = new Set(['P00900023LS', 'P00900016LS', 'P00900040LS']);

export default async function sweepLumpSumFixtures() {
  const context = await request.newContext();

  try {
    const login = await context.post(`${API}/api/Auth/Login`, {
      data: {
        UserName: process.env.E2E_USERNAME ?? 'jimeneznr',
        Password: process.env.E2E_PASSWORD ?? 'AnyPassword',
      },
    });

    if (login.status() !== 200) {
      // Teardown must never fail a run that otherwise passed. Say so and stop.
      console.warn(`[sweeper] could not sign in (${login.status()}); nothing swept.`);
      return;
    }

    /*  THE FIXTURE PROGRAM FIRST (2026-09-09). A run that aborted while the
        approval specs held it Approved has left parents no DeleteLumpSum will
        touch — the gate refuses. Working first, then sweep. */
    await restoreFixtureProgramsWith(context);

    const listed = await context.post(`${API}/api/Lumpsum/ShowLumpSum`, {
      data: { Filters: {}, limit: 200, page: 1, sortDirection: 0 },
    });
    const rows: any[] = (await listed.json())?.lists ?? [];

    const orphans = rows.filter(
      (r) => E2E_MARKER.test(String(r.Description ?? '')) && !SAMPLE.has(r.ProjectId),
    );

    if (orphans.length === 0) {
      console.log('[sweeper] no Lump Sum fixtures left behind.');
      return;
    }

    let sweptChildren = 0;
    for (const parent of orphans) {
      /*  Children first: a parent with live children is refused, by design —
          deleting it would strand them pointing at nothing. */
      const children = await context.post(`${API}/api/Lumpsum/ShowItemizedProjects`, {
        data: { Filters: { LumpSumId: parent.Id }, limit: 200, page: 1, sortDirection: 0 },
      });

      for (const child of ((await children.json())?.lists ?? []) as any[]) {
        await context.post(`${API}/api/Lumpsum/DeleteItemizedProject`, {
          data: { ProjectId: child.ProjectPK },
        });
        sweptChildren += 1;
      }

      await context.post(`${API}/api/Lumpsum/DeleteLumpSum`, { data: { LumpSumId: parent.Id } });
    }

    console.log(
      `[sweeper] removed ${orphans.length} Lump Sum Project(s) and ${sweptChildren} child(ren): ` +
        orphans.map((p) => p.ProjectId).join(', '),
    );
  } catch (error) {
    /*  A teardown that throws turns a green run red for a reason unrelated to
        anything under test. Report and move on — the next run sweeps again. */
    console.warn(`[sweeper] sweep failed: ${error instanceof Error ? error.message : error}`);
  } finally {
    await context.dispose();
  }
}
