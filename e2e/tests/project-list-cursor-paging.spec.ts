// =============================================================================
// project-list-cursor-paging.spec.ts — Projects list paging survives a "poisoned"
// cursor plan.
//
// SQL Server caches ONE plan per paging query shape (Next / Previous / Page),
// compiled for the first cursor value it sees. Before the fix, a single Next with
// an unusual cursor (NextFilteredId = 0, or any cursor that matches ~1 row) left
// an all-nested-loops plan for vProjectLatest, and every later Next with a normal
// cursor reused it and hit the 90 s command timeout — for every user. Now:
//   - FilterDataCursor treats a cursor <= 0 as missing, so it never reaches SQL;
//   - ShowProjects compiles each cursor fetch for its own value
//     (FilterDataCursor recompileCursorQueries), so nothing poisoned is cached.
// See documents/docs/engineering/PROJECTS_LIST_CURSOR_PLAN_SNIFFING.md.
//
// API level; needs no dev server. Runs as E2E_USERNAME (an unrestricted user) and,
// when that account exists, e2eauc (AUC).
//
// The "poisoned plan" case is OPT-IN, because it evicts plans from the API
// database's plan cache (only the app's vProjectLatest cursor statements):
//   E2E_ALLOW_PLAN_EVICTION=1
//   E2E_SQL_SERVER=localhost
//   E2E_SQL_DB=<the API's MYPSDb>
//   E2E_SQL_USER / E2E_SQL_PASSWORD   # omit both to use Windows auth (-E)
// It needs VIEW SERVER STATE and ALTER SERVER STATE. Without the fix its real Next
// times out (90 s) and the case fails.
// =============================================================================

import { test, expect, type Page } from '@playwright/test';
import { execFileSync } from 'child_process';
import { post } from './helpers/lumpSumFixture';

const FIRST = 0, PREVIOUS = 1, NEXT = 2, PAGE = 4;
const LIMIT = 10;
/** Paging assertions need at least three full pages. */
const MIN_ROWS = 3 * LIMIT + 1;
/**
 * A cursor fetch may take 1.5x the first page, with a 10 s floor for timer noise
 * on small or warm databases. A poisoned plan takes 90 s, so either bound catches it.
 */
const limitFor = (firstMs: number) => Math.max(1.5 * firstMs, 10_000);

const API = (process.env.E2E_API_URL ?? 'http://localhost:5015').replace(/\/$/, '');
const USERS = [process.env.E2E_USERNAME ?? 'jimeneznr', 'e2eauc'];

const SQL_SERVER = process.env.E2E_SQL_SERVER;
const SQL_DB = process.env.E2E_SQL_DB;
const SQL_USER = process.env.E2E_SQL_USER;
const SQL_PASSWORD = process.env.E2E_SQL_PASSWORD;
const ALLOW_EVICTION = process.env.E2E_ALLOW_PLAN_EVICTION === '1';

function runSql(query: string): string {
  const args = [
    '-S', SQL_SERVER ?? '', '-d', SQL_DB ?? '',
    ...(SQL_USER ? ['-U', SQL_USER] : ['-E']),
    '-C', '-W', '-h', '-1', '-b',
    '-Q', `SET NOCOUNT ON; SET QUOTED_IDENTIFIER ON; ${query}`,
  ];
  return execFileSync('sqlcmd', args, {
    encoding: 'utf-8',
    env: SQL_USER ? { ...process.env, SQLCMDPASSWORD: SQL_PASSWORD ?? '' } : process.env,
  });
}

/**
 * The app's (set_options 251) cached plans for the unfiltered vProjectLatest cursor
 * fetches: only @__take and @__cursor are declared. The statement text has CRLFs.
 */
const CURSOR_PLANS = `
  SELECT DISTINCT qs.plan_handle
  FROM sys.dm_exec_query_stats qs
  CROSS APPLY sys.dm_exec_sql_text(qs.sql_handle) st
  CROSS APPLY sys.dm_exec_plan_attributes(qs.plan_handle) pa
  WHERE pa.attribute = 'set_options' AND CAST(pa.value AS int) = 251
    AND st.text LIKE '(@\\_\\_take int,@\\_\\_cursor bigint)SELECT TOP (@\\_\\_take)%FROM \\[vProjectLatest\\] AS v%' ESCAPE '\\'`;

const evictCursorPlans = () => runSql(`
  DECLARE @h varbinary(64);
  DECLARE c CURSOR LOCAL FAST_FORWARD FOR ${CURSOR_PLANS};
  OPEN c; FETCH NEXT FROM c INTO @h;
  WHILE @@FETCH_STATUS = 0 BEGIN DBCC FREEPROCCACHE (@h) WITH NO_INFOMSGS; FETCH NEXT FROM c INTO @h; END
  CLOSE c; DEALLOCATE c;`);

/**
 * Compile and cache the plan that broke paging: the exact Next statement FilterDataCursor
 * sends without OPTION (RECOMPILE), for cursor 0. sqlcmd with QUOTED_IDENTIFIER ON runs
 * under the app's set_options (251), so the app's connection would reuse this plan.
 * The API itself can no longer send cursor 0 (it is rejected as missing).
 */
const injectCursorZeroPlan = () => runSql(`
  DECLARE @nl nchar(2) = NCHAR(13) + NCHAR(10);
  DECLARE @stmt nvarchar(max) = N'SELECT TOP (@__take)' + @nl + N'    v.*' + @nl + N'FROM [vProjectLatest] AS v'
    + @nl + N'WHERE v.[Id] < @__cursor' + @nl + N'ORDER BY v.[Id] DESC' + @nl;
  EXEC sp_executesql @stmt, N'@__take int,@__cursor bigint', @__take = 11, @__cursor = 0;`);

/** Compiled @__cursor values of the cached unfiltered cursor plans, e.g. ['(0)']. */
const cachedCursorValues = () => runSql(`
  WITH XMLNAMESPACES (DEFAULT 'http://schemas.microsoft.com/sqlserver/2004/07/showplan')
  SELECT qp.query_plan.value('(//ParameterList/ColumnReference[@Column=''@__cursor'']/@ParameterCompiledValue)[1]', 'varchar(30)')
  FROM (${CURSOR_PLANS}) h CROSS APPLY sys.dm_exec_query_plan(h.plan_handle) qp;`)
  .split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

/** Log in as `userName`; false when the account does not exist on this database. */
const login = async (page: Page, userName: string) => {
  const res = await page.request.post(`${API}/api/Auth/Login`, {
    data: { UserName: userName, Password: process.env.E2E_PASSWORD ?? 'AnyPassword' },
  });
  return res.status() === 200;
};

const showProjects = async (page: Page, body: object) => {
  const t = Date.now();
  const res = await post(page, '/api/Project/ShowProjects', { Filters: { ProgramId: '', ProjectId: '' }, limit: LIMIT, ...body });
  return { ...res, ms: Date.now() - t };
};
const ids = (res: any): number[] => (res.body.lists as any[]).map((r) => r.Id);
const describe = (r: any) => `${r.status} in ${r.ms} ms: ${JSON.stringify(r.body).slice(0, 200)}`;

test.describe('Projects list cursor paging', () => {
  test.setTimeout(300_000);

  for (const user of USERS) {
    test(`${user}: a cursor <= 0 is rejected and paging stays consistent and fast`, async ({ page }) => {
      test.skip(!(await login(page, user)), `${user} cannot log in on this database`);

      // A cursor of 0 is "missing": rejected before any SQL runs, so it can't compile a plan.
      for (const [navigation, field] of [[NEXT, 'NextFilteredId'], [PREVIOUS, 'PreviousFilteredId'], [PAGE, 'PageCursorId']] as const) {
        const r = await showProjects(page, { page: 3, Navigation: navigation, [field]: 0 });
        expect(r.status, describe(r)).toBe(400);
        expect(String(r.body.Message), describe(r)).toMatch(new RegExp(`${field} is required`));
      }

      const p1 = await showProjects(page, { page: 1, Navigation: FIRST });
      expect(p1.status, describe(p1)).toBe(200);
      test.skip(p1.body.total < MIN_ROWS, `${user} sees ${p1.body.total} projects; paging needs ${MIN_ROWS}`);

      const p2 = await showProjects(page, { page: 2, Navigation: NEXT, NextFilteredId: p1.body.NextFilteredId });
      const p3 = await showProjects(page, { page: 3, Navigation: NEXT, NextFilteredId: p2.body.NextFilteredId });
      const back2 = await showProjects(page, { page: 2, Navigation: PREVIOUS, PreviousFilteredId: p3.body.PreviousFilteredId });
      const again3 = await showProjects(page, { page: 3, Navigation: PAGE, PageCursorId: p3.body.PageCursorId });

      const max = limitFor(p1.ms);
      for (const [name, r] of Object.entries({ p2, p3, back2, again3 })) {
        expect(r.status, `${name}: ${describe(r)}`).toBe(200);
        expect(r.ms, `${name} took ${r.ms} ms; the first page took ${p1.ms} ms`).toBeLessThan(max);
      }
      expect(ids(p1).at(-1)!).toBeGreaterThan(ids(p2)[0]);
      expect(ids(p2).at(-1)!).toBeGreaterThan(ids(p3)[0]);
      expect(ids(back2)).toEqual(ids(p2));
      expect(ids(again3)).toEqual(ids(p3));
      expect(p2.body.total).toBe(p1.body.total);
    });
  }

  test('a cached cursor-0 Next plan does not slow down later Nexts', async ({ page }) => {
    test.skip(!ALLOW_EVICTION, 'opt-in: set E2E_ALLOW_PLAN_EVICTION=1 (evicts the app\'s vProjectLatest cursor plans)');
    test.skip(!SQL_SERVER || !SQL_DB, 'E2E_SQL_SERVER and E2E_SQL_DB must name the database the API under test uses');
    expect(await login(page, USERS[0]), `${USERS[0]} must be able to log in`).toBe(true);

    const p1 = await showProjects(page, { page: 1, Navigation: FIRST });
    expect(p1.status, describe(p1)).toBe(200);
    test.skip(p1.body.total < MIN_ROWS, `only ${p1.body.total} projects visible; needs ${MIN_ROWS}`);

    try {
      evictCursorPlans();
      injectCursorZeroPlan();
      expect(cachedCursorValues(), 'the injected cursor-0 plan is cached for the app').toEqual(['(0)']);

      // Before the fix this reused the ~1-row plan and hit the 90 s command timeout.
      const real = await showProjects(page, { page: 2, Navigation: NEXT, NextFilteredId: p1.body.NextFilteredId });
      expect(real.status, `real Next with a cursor-0 plan cached: ${describe(real)}`).toBe(200);
      expect(real.ms, `real Next took ${real.ms} ms; the first page took ${p1.ms} ms`).toBeLessThan(limitFor(p1.ms));

      // With OPTION (RECOMPILE) the app's fetch is never cached: only the injected plan remains.
      expect(cachedCursorValues(), 'cached cursor plans after the real Next').toEqual(['(0)']);
    } finally {
      evictCursorPlans();
    }
  });
});
