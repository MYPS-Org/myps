// =============================================================================
// project-list-cursor-paging.spec.ts — Projects list paging survives a "poisoned"
// cursor plan.
//
// SQL Server caches ONE plan per paging query shape (Next / Previous / Page),
// compiled for the first cursor value it sees. Before the fix, a single Next with
// an unusual cursor (NextFilteredId = 0 matches ~1 row) left an all-nested-loops
// plan for vProjectLatest, and every later Next with a normal cursor reused it and
// hit the 90 s command timeout — for every user. ShowProjects now compiles each
// cursor fetch for its own value (FilterDataCursor recompileCursorQueries).
// See documents/docs/engineering/PROJECTS_LIST_CURSOR_PLAN_SNIFFING.md.
//
// API level; needs no dev server. Runs as E2E_USERNAME (an unrestricted user).
// The poisoning request is harmless on its own: it answers a "stale cursor" 400.
// =============================================================================

import { test, expect } from '@playwright/test';
import { post, apiLogin } from './helpers/lumpSumFixture';

const FIRST = 0, PREVIOUS = 1, NEXT = 2, PAGE = 4;
/** Well under the 90 s command timeout a poisoned plan hits, well over a normal page (~5 s locally). */
const MAX_MS = 30_000;

const showProjects = async (page: any, body: object) => {
  const t = Date.now();
  const res = await post(page, '/api/Project/ShowProjects', { Filters: { ProgramId: '', ProjectId: '' }, limit: 10, ...body });
  return { ...res, ms: Date.now() - t };
};
const ids = (res: any) => (res.body.lists as any[]).map((r) => r.Id);

test.describe('Projects list cursor paging', () => {
  test.setTimeout(240_000);

  test('a cursor-0 Next does not break paging for later requests', async ({ page }) => {
    await apiLogin(page);

    // The request that used to poison the cached Next plan.
    const poison = await showProjects(page, { page: 2, Navigation: NEXT, NextFilteredId: 0 });
    expect(poison.status).toBe(400);
    expect(String(poison.body.Message)).toMatch(/cursor may be stale/);

    const p1 = await showProjects(page, { page: 1, Navigation: FIRST });
    const p2 = await showProjects(page, { page: 2, Navigation: NEXT, NextFilteredId: p1.body.NextFilteredId });
    const p3 = await showProjects(page, { page: 3, Navigation: NEXT, NextFilteredId: p2.body.NextFilteredId });
    const back2 = await showProjects(page, { page: 2, Navigation: PREVIOUS, PreviousFilteredId: p3.body.PreviousFilteredId });
    const again3 = await showProjects(page, { page: 3, Navigation: PAGE, PageCursorId: p3.body.PageCursorId });

    for (const [name, r] of Object.entries({ p1, p2, p3, back2, again3 })) {
      expect(r.status, `${name}: ${JSON.stringify(r.body).slice(0, 200)}`).toBe(200);
      expect(r.ms, `${name} took ${r.ms} ms`).toBeLessThan(MAX_MS);
    }
    expect(ids(p1)[ids(p1).length - 1]).toBeGreaterThan(ids(p2)[0]);
    expect(ids(p2)[ids(p2).length - 1]).toBeGreaterThan(ids(p3)[0]);
    expect(ids(back2)).toEqual(ids(p2));
    expect(ids(again3)).toEqual(ids(p3));
  });
});
