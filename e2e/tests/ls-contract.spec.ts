// =============================================================================
// ls-contract.spec.ts — the Lump Sum V2 API contract, driven end to end.
//
// WHAT THIS IS AND IS NOT.
//
// This is NOT the narrated Playwright run CLAUDE.md requires. That run clicks
// real controls, and V2 has no frontend yet — FE/src/pages/LSWallet/ is still
// the wallet-era UI calling endpoints that no longer exist. Until phase 4
// lands, there is nothing to click.
//
// What this DOES do is lock the backend contract so phase 4 builds against
// something known-good rather than something merely compiled: every action is
// exercised, the allocation arithmetic is asserted at both ends (a deduction
// and its restore), and each refusal is checked for the server's own words.
//
// It uses page.request.post throughout, which e2e/CLAUDE.md permits ONLY for
// fixtures and for reading results back. That rule assumes a UI exists to click
// instead. Once it does, these assertions move behind real clicks and this file
// becomes the API-level backstop, not the coverage.
//
// Tagged LS-CONTRACT- and swept in afterAll — an untagged run once left 191
// test projects against 9 real ones.
// =============================================================================

import { test, expect } from '@playwright/test';
// No form login here: a contract spec has no UI to drive. See apiLogin.
import { post, lumpSum, provisionLumpSum, importChild, importActivityYear, apiLogin, IMPORT_REGION_ISLAND_CODE, APPROVAL_FIXTURE_PROGRAM_GAA, type ProvisionedLumpSum } from './helpers/lumpSumFixture';
import { withFixtureProgram, STAGE_GAA } from './helpers/approvedProgramFixture';
import { API_URL, buildImportWorkbook, postImportWorkbook, withoutSheet } from './helpers/importWorkbook';

const TAG = 'LS-CONTRACT';
const created: number[] = [];

/**
 * The Lump Sum allocation invariant, in the model of 2026-09-06.
 *
 *   component Total    = Σ live funding lines = OriginalAllocation   (never falls)
 *   per-year Amount    = Remaining            = Total − ItemizedTotal
 *
 * Two stored figures, not one derived: the component carries what the project
 * was GIVEN and its single fiscal-year row carries what is LEFT. Every writer
 * that moves either goes through Helpers/LumpsumHelper.cs, and UpdateLumpSum
 * re-derives both on save. This is the check that none of them has slipped back
 * to the old reading, where Total was the balance.
 */
const expectAllocationInvariant = async (page: any, lumpSumId: number, when: string) => {
  const d = await post(page, '/api/Lumpsum/LumpSumDetails', { LumpSumId: lumpSumId });
  const ls = d.body.ComponentCosts.find((c: any) => String(c.ComponentId) === 'LS') ?? d.body.ComponentCosts[0];
  const rows = d.body.ComponentCostPerYear.filter((y: any) => y.ComponentCostFK === ls.Id);
  const funding = d.body.FundingProfiles.reduce((s: number, f: any) => s + Number(f.Amount), 0);

  expect(rows.length, `${when}: the LS component has exactly one per-year row`).toBe(1);
  expect(Number(ls.Total), `${when}: the component Total is the funded total`).toBe(funding);
  expect(Number(d.body.LumpSumProject.OriginalAllocation), `${when}: which the view calls OriginalAllocation`).toBe(funding);
  expect(Number(rows[0].Amount), `${when}: the per-year Amount is what the view calls Remaining`)
    .toBe(Number(d.body.LumpSumProject.Remaining));
  expect(Number(rows[0].Amount), `${when}: and it is the allocation less what the children drew`)
    .toBe(funding - Number(d.body.LumpSumProject.ItemizedTotal));
  return d.body;
};

/**
 * An UpdateLumpSum body that sends a project back exactly as LumpSumDetails
 * returned it, plus overrides. LumpSumDetails returns raw tProject* rows whose
 * column names are not the DTO's (SourceOrg/AgreementCode vs Source/Agreement;
 * the cost rows correlate through a client-side CostId), hence the mapping.
 *
 * THE COMPONENT ARRAYS ARE ALWAYS SENT, as the form sends them. A `withCosts:
 * false` mode existed here to avoid echoing a Total that might be stale — which
 * two changes of 2026-09-06 made pointless and then harmful: `SyncLSToFundingAsync`
 * DERIVES the component's Total and per-year Amount from the funding lines on
 * every save, so an echoed figure is ignored; and the single-component guard
 * refuses a payload whose live component count is not exactly one, so the empty
 * arrays that mode produced now answer 400 "Single Component" every time.
 */
const echoUpdate = (
  parentRef: ProvisionedLumpSum,
  b: any,
  overrides: Record<string, unknown> = {},
) => ({
  LumpSumId: parentRef.lumpSumId,
  ProgramId: parentRef.programPK,
  CategoryId: 16, SubCategoryId: 1082, OperatingUnit: 'OI46',
  RegionWide: 1, Agency: 1001, Origin: 13,
  Description: b.LumpSumProject.Description,
  FundingProfiles: b.FundingProfiles.map((f: any) => ({
    Id: f.Id, Source: f.SourceOrg, Agreement: f.AgreementCode,
    Amount: f.Amount, Percentage: f.Percentage, IsDeleted: false,
  })),
  ComponentCosts: b.ComponentCosts.map((c: any, i: number) => ({
    Id: c.Id, CostId: `c${i + 1}`, ComponentType: c.ComponentType, ComponentId: c.ComponentId,
    Description: c.Description, Total: c.Total, IsDeleted: false,
  })),
  ComponentCostPerYear: b.ComponentCostPerYear.map((y: any) => ({
    Id: y.Id,
    ComponentCostId: `c${b.ComponentCosts.findIndex((c: any) => c.Id === y.ComponentCostFK) + 1}`,
    Year: y.Year, Amount: y.Amount, StartDate: y.StartDate, EndDate: y.EndDate, IsDeleted: false,
  })),
  ...overrides,
});

test.describe.configure({ mode: 'serial' });

test.describe('Lump Sum V2 — API contract', () => {
  let parent: ProvisionedLumpSum;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await apiLogin(page);
    parent = await provisionLumpSum(page, 250_000_000, TAG);
    created.push(parent.lumpSumId);
    await page.close();
  });

  test('creates a Lump Sum Project with no Region, and an LS-suffixed id', async ({ page }) => {
    await apiLogin(page);

    const row = await lumpSum(page, parent.lumpSumId);
    expect(row, 'the new Lump Sum Project should appear in the list').toBeTruthy();

    // The field spec makes Region optional; the fixture omits it deliberately.
    expect(row.Region ?? null, 'Region is optional and was not supplied').toBeNull();

    // IslandCode is the constant 'LS', appended by GenerateProjectID as the
    // trailing segment — so ids end in LS rather than a geographic LZ/VS/MN.
    expect(String(row.ProjectId)).toMatch(/LS$/);

    // Stage comes from the program's CURRENT stage, never from the client and
    // never assumed to be BP.
    expect(String(row.StageName)).toMatch(/GAA-R/);

    expect(Number(row.OriginalAllocation)).toBe(250_000_000);
    expect(Number(row.Remaining)).toBe(250_000_000);
  });

  test('details and balance agree with the list', async ({ page }) => {
    await apiLogin(page);

    const details = await post(page, '/api/Lumpsum/LumpSumDetails', { LumpSumId: parent.lumpSumId });
    expect(details.status).toBe(200);

    // The storage collapse: create wrote these to the tProject* tables, and the
    // detail read finds them there.
    expect(details.body.FundingProfiles).toHaveLength(1);
    expect(details.body.ComponentCosts).toHaveLength(1);
    expect(details.body.ComponentCostPerYear).toHaveLength(1);

    const balance = await post(page, '/api/Lumpsum/LumpSumBalance', { LumpSumId: parent.lumpSumId });
    expect(balance.status).toBe(200);
    expect(Number(balance.body.Total)).toBe(250_000_000);
    expect(Number(balance.body.Itemized)).toBe(0);
  });

  test('update writes the SAME rows create wrote', async ({ page }) => {
    await apiLogin(page);

    const before = await post(page, '/api/Lumpsum/LumpSumDetails', { LumpSumId: parent.lumpSumId });
    const fundingId = before.body.FundingProfiles[0].Id;
    const costId = before.body.ComponentCosts[0].Id;
    const yearId = before.body.ComponentCostPerYear[0].Id;

    const saved = await post(page, '/api/Lumpsum/UpdateLumpSum', {
      LumpSumId: parent.lumpSumId,
      ProgramId: parent.programPK,
      CategoryId: 16, SubCategoryId: 1082, OperatingUnit: 'OI46',
      Description: `${TAG} edited`,
      Tier: 3, RegionWide: 1, Agency: 1001, Origin: 13,
      FundingProfiles: [{ Id: fundingId, Source: 'GOP', Agreement: 'DPWH-GAA-2025', Amount: 300_000_000, Percentage: 100, IsDeleted: false }],
      /*  'LS' and the row's OWN year, mirroring what the Component Cost dialog
          sends: both are pinned there rather than typed, the id to the Lump Sum
          component and the year to the program's start year (which is what
          CreateLumpSum seeded this row with). Sending 'LS1' or the current
          calendar year would write back data the module no longer produces. */
      ComponentCosts: [{ Id: costId, CostId: 'c1', ComponentType: 'LS', ComponentId: 'LS', Description: 'edited', Total: 300_000_000, IsDeleted: false }],
      /*  Dates included. SaveLumpSumChildrenAsync assigns whatever arrives, so a
          payload that omits them NULLS them — and the dialog, which requires both,
          then refuses to save the project until they are re-entered. The real form
          always sends them; a spec that does not was quietly wiping them. */
      ComponentCostPerYear: [{ Id: yearId, ComponentCostId: 'c1', Year: before.body.ComponentCostPerYear[0].Year, Amount: 300_000_000, StartDate: before.body.ComponentCostPerYear[0].StartDate, EndDate: before.body.ComponentCostPerYear[0].EndDate, IsDeleted: false }],
    });
    expect(saved.status).toBe(200);

    /*  THE POINT OF V2. In V1 create wrote the project model and update wrote a
        parallel wallet model, so the two never agreed. The ids must be the same
        rows, updated in place — not a second set. */
    const after = await post(page, '/api/Lumpsum/LumpSumDetails', { LumpSumId: parent.lumpSumId });
    expect(after.body.FundingProfiles[0].Id).toBe(fundingId);
    expect(after.body.ComponentCosts[0].Id).toBe(costId);
    expect(after.body.ComponentCostPerYear[0].Id).toBe(yearId);
    expect(Number(after.body.LumpSumProject.OriginalAllocation)).toBe(300_000_000);

    // Raising the funding raised the allocation and the balance with it.
    await expectAllocationInvariant(page, parent.lumpSumId, 'after a funding edit');
  });

  test('the LS component is derived on save, and cannot be added to or removed', async ({ page }) => {
    /*  2026-09-06. The component's Total is the funded total and its per-year row
        is the balance, and BOTH are recomputed by SyncLSToFundingAsync after the
        children merge — so whatever the client echoes for them is overwritten.
        That is what makes it safe for the dialog to display two figures it does
        not own, and what closes the stale-Total hazard of a save that raced an
        import. The component itself is fixed at one: the form no longer offers
        Add or Delete, and the server refuses a payload that tries either. */
    await apiLogin(page);
    const owner = await provisionLumpSum(page, 5_000_000, `${TAG} derived`);
    created.push(owner.lumpSumId);

    const before = await post(page, '/api/Lumpsum/LumpSumDetails', { LumpSumId: owner.lumpSumId });
    const funding = before.body.FundingProfiles.reduce((s: number, f: any) => s + Number(f.Amount), 0);

    // A payload that lies about both money figures is accepted and ignored.
    const lied = await post(page, '/api/Lumpsum/UpdateLumpSum', echoUpdate(owner, before.body, {
      ComponentCosts: [{
        Id: before.body.ComponentCosts[0].Id, CostId: 'c1', ComponentType: 'LS', ComponentId: 'LS',
        Description: 'derived-test', Total: 1, IsDeleted: false,
      }],
      ComponentCostPerYear: [{
        Id: before.body.ComponentCostPerYear[0].Id, ComponentCostId: 'c1',
        Year: before.body.ComponentCostPerYear[0].Year, Amount: 1,
        StartDate: before.body.ComponentCostPerYear[0].StartDate,
        EndDate: before.body.ComponentCostPerYear[0].EndDate, IsDeleted: false,
      }],
    }));
    expect(lied.status, `echoing 1/1: ${JSON.stringify(lied.body).slice(0, 300)}`).toBe(200);

    const derived = await expectAllocationInvariant(page, owner.lumpSumId, 'after a payload that lied about both figures');
    const ls = derived.ComponentCosts.find((c: any) => String(c.ComponentId) === 'LS');
    expect(Number(ls.Total), 'Total came from the funding lines, not the payload').toBe(funding);
    expect(String(ls.Description), 'but the Description the user typed was kept').toBe('derived-test');

    // Deleting the only component: refused.
    const deleted = await post(page, '/api/Lumpsum/UpdateLumpSum', echoUpdate(owner, derived, {
      ComponentCosts: [{
        Id: ls.Id, CostId: 'c1', ComponentType: 'LS', ComponentId: 'LS',
        Description: ls.Description, Total: ls.Total, IsDeleted: true,
      }],
    }));
    expect(deleted.status).toBe(400);
    expect(deleted.body.Title).toBe('Single Component');
    expect(String(deleted.body.Message)).toContain('cannot be removed');

    // Adding a second: refused.
    const added = await post(page, '/api/Lumpsum/UpdateLumpSum', echoUpdate(owner, derived, {
      ComponentCosts: [
        { Id: ls.Id, CostId: 'c1', ComponentType: 'LS', ComponentId: 'LS', Description: ls.Description, Total: ls.Total, IsDeleted: false },
        { Id: 0, CostId: 'c2', ComponentType: 'LS', ComponentId: 'LS', Description: 'a second component', Total: 1_000_000, IsDeleted: false },
      ],
    }));
    expect(added.status).toBe(400);
    expect(added.body.Title).toBe('Single Component');
    expect(String(added.body.Message)).toContain('cannot be added to');

    // Neither refusal wrote anything.
    await expectAllocationInvariant(page, owner.lumpSumId, 'after both refusals');
  });

  test('Tier: absent on create defaults to 1, absent on update keeps the stored value, out of range is refused', async ({ page }) => {
    /*  2026-09-06: the form stopped collecting Tier, so the server owns it.
        Three properties, each of which a careless change would break:

          - CREATE without Tier stores 1 — not 0, which the old `?? 0` fallback
            produced and SampleData step 4b exists to clean up.
          - UPDATE without Tier keeps what is stored (ApplyDetailFields'
            `?? revision.Tier`), so the form's edit path cannot regress a Tier 2
            project to 1.
          - An EXPLICIT bad Tier is still refused with the server's own words:
            relaxing "required" did not relax the range guard. */
    await apiLogin(page);

    const base = {
      ProgramId: parent.programPK,
      CategoryId: 16, SubCategoryId: 1082, OperatingUnit: 'OI46',
      RegionWide: 1, Agency: 1001, Origin: 13,
    };

    const noTier = await post(page, '/api/Lumpsum/CreateLumpSum', {
      ...base,
      Description: `${TAG} tier-default (e2e ${new Date().toISOString().slice(0, 19)})`,
      Allocation: 1_000_000, FundingSource: 'GOP', FundingAgreement: 'DPWH-GAA-2025',
    });
    expect(noTier.status, `create without Tier: ${JSON.stringify(noTier.body)}`).toBe(200);
    created.push(noTier.body.LumpSumId);

    const stored = await post(page, '/api/Lumpsum/LumpSumDetails', { LumpSumId: noTier.body.LumpSumId });
    expect(Number(stored.body.LumpSumProject.Tier), 'an absent Tier is stored as 1').toBe(1);

    /*  The shared fixture posts Tier: 2 on purpose, so this parent is the one
        that can tell "kept" apart from "defaulted". (The update test above set
        it to 3 — read the current value rather than assume.) */
    const before = await post(page, '/api/Lumpsum/LumpSumDetails', { LumpSumId: parent.lumpSumId });
    const keptTier = Number(before.body.LumpSumProject.Tier);
    expect(keptTier, 'the fixture parent carries a non-default Tier').not.toBe(1);

    /*  LumpSumDetails returns the raw tProject* rows, whose column names are
        not the update DTO's (SourceOrg/AgreementCode vs Source/Agreement; the
        cost rows correlate through a client-side CostId). Map them the way the
        update test above does, sending everything else back unchanged. */
    const roundTrip = (b: any) => ({
      LumpSumId: parent.lumpSumId,
      ...base,
      Description: b.LumpSumProject.Description,
      FundingProfiles: b.FundingProfiles.map((f: any) => ({
        Id: f.Id, Source: f.SourceOrg, Agreement: f.AgreementCode,
        Amount: f.Amount, Percentage: f.Percentage, IsDeleted: false,
      })),
      ComponentCosts: b.ComponentCosts.map((c: any, i: number) => ({
        Id: c.Id, CostId: `c${i + 1}`, ComponentType: c.ComponentType, ComponentId: c.ComponentId,
        Description: c.Description, Total: c.Total, IsDeleted: false,
      })),
      ComponentCostPerYear: b.ComponentCostPerYear.map((y: any) => ({
        Id: y.Id,
        ComponentCostId: `c${b.ComponentCosts.findIndex((c: any) => c.Id === y.ComponentCostFK) + 1}`,
        Year: y.Year, Amount: y.Amount, StartDate: y.StartDate, EndDate: y.EndDate, IsDeleted: false,
      })),
    });

    const kept = await post(page, '/api/Lumpsum/UpdateLumpSum', roundTrip(before.body));
    expect(kept.status, `update without Tier: ${JSON.stringify(kept.body)}`).toBe(200);
    const after = await post(page, '/api/Lumpsum/LumpSumDetails', { LumpSumId: parent.lumpSumId });
    expect(Number(after.body.LumpSumProject.Tier), 'an absent Tier on update keeps the stored value').toBe(keptTier);

    const refused = await post(page, '/api/Lumpsum/UpdateLumpSum', { ...roundTrip(before.body), Tier: 9 });
    expect(refused.status).toBe(400);
    expect(refused.body.Message).toBe('Select a Tier between 1 and 5.');
    expect(refused.body.Title).toBe('Required');
  });

  /*  THE FIRST FUNDING LINE, by the server's own definition: the LIVE line with the
      smallest Id. Derived here rather than read as FundingProfiles[0] — that only
      happened to be right because LumpSumDetails orders by Id, and a test should
      assert the rule, not the endpoint's sort. Number(): a string compare on Ids
      would order lexically. */
  const firstLine = (profiles: any[]) => {
    const live = profiles.filter((f) => !f.IsDeleted);
    // A named failure, not "Reduce of empty array" from inside the helper.
    expect(live.length, 'a first funding line needs at least one live line').toBeGreaterThan(0);
    return live.reduce((lowest, f) => (Number(f.Id) < Number(lowest.Id) ? f : lowest));
  };
  /** The server's comparator (OrdinalIgnoreCase, trimmed), so "a different source" means what it means there. */
  const sameSourceCode = (a: unknown, b: unknown) =>
    String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase();

  test('replenish refuses a non-increasing amount, then raises the allocation', async ({ page }) => {
    await apiLogin(page);

    const refused = await post(page, '/api/Lumpsum/ReplenishLumpSum', {
      LumpSumId: parent.lumpSumId, NewAmount: 300_000_000,
    });
    expect(refused.status).toBe(400);
    expect(refused.body.Title).toBe('Invalid Amount');
    expect(String(refused.body.Message)).toContain('must exceed the current');

    const before = await post(page, '/api/Lumpsum/LumpSumDetails', { LumpSumId: parent.lumpSumId });
    const linesBefore = before.body.FundingProfiles.length;

    const raised = await post(page, '/api/Lumpsum/ReplenishLumpSum', {
      LumpSumId: parent.lumpSumId, NewAmount: 400_000_000,
    });
    expect(raised.status, JSON.stringify(raised.body).slice(0, 300)).toBe(200);
    expect(Number(raised.body.Added)).toBe(100_000_000);

    /*  THREE FIGURES MOVE TOGETHER (2026-09-06). Until then Replenish raised
        tProjectComponentCost.Total alone: the component's one yearly row kept
        CreateLumpSum's figure, and the funding profile never got the line the
        manual and the DTO had always described — so the Component Cost dialog's
        cap (the funded total) sat below the component itself. Now: a new funding
        line carries the top-up, copying source and agreement from the FIRST
        funding line when the request names none (2026-09-08; it was the largest
        line before that); the Total and the per-year row
        move by the same amount; and with nothing itemized yet, funding sum,
        Total and per-year Amount are one number. */
    const after = await expectAllocationInvariant(page, parent.lumpSumId, 'after a replenish');
    expect(after.FundingProfiles.length, 'one funding line was appended').toBe(linesBefore + 1);
    const added = after.FundingProfiles.find((f: any) => Number(f.Amount) === 100_000_000);
    expect(added, 'and it carries exactly the top-up').toBeTruthy();
    const first = firstLine(before.body.FundingProfiles);
    expect(String(raised.body.FundingLine?.Source), 'source copied from the first funding line').toBe(String(first.SourceOrg));
    expect(String(raised.body.FundingLine?.Agreement), 'and its agreement').toBe(String(first.AgreementCode));
    const shares = after.FundingProfiles.reduce((s: number, f: any) => s + Number(f.Percentage), 0);
    expect(Math.round(shares), 'percentages re-derived across every line').toBe(100);
    if (Number(after.LumpSumProject.ItemizedTotal) === 0) {
      const ls = after.ComponentCosts.find((c: any) => String(c.ComponentId) === 'LS');
      const funding = after.FundingProfiles.reduce((s: number, f: any) => s + Number(f.Amount), 0);
      expect(funding, 'nothing itemized: funding sum, Total and per-year are one number').toBe(Number(ls.Total));
    }
  });

  test('replenish pairs the funding source and agreement, and refuses a pair that does not belong together', async ({ page }) => {
    /*  FOUND IN REVIEW (2026-09-06). Source and Agreement were resolved
        independently: supplying only a Source took the Agreement from the largest
        line overall, which may sit under a DIFFERENT source — and the dialog makes
        that the common case, because choosing a source clears the agreement box.
        Neither code was checked against the lookup either.

        2026-09-08: the rule is stricter still — only the FIRST line is consulted,
        so a source that is not the first line's is always 400 here. This test keeps
        its either-answer tolerance because what it pins is the OWNERSHIP property
        (a 200 must never pair codes across sources); the determinism is pinned by
        step 3 of the next test. */
    await apiLogin(page);
    const owner = await provisionLumpSum(page, 5_000_000, `${TAG} pair`);
    created.push(owner.lumpSumId);

    const agreements = await post(page, '/api/Project/ShowProjectComponentDropdowns', {});
    const all = (agreements.body?.Agreements ?? []) as any[];
    const existing = (await post(page, '/api/Lumpsum/LumpSumDetails', { LumpSumId: owner.lumpSumId }))
      .body.FundingProfiles[0];

    /*  A source that owns no line on this project. Its agreements are what the
        top-up must land on; the project's own line belongs to someone else. */
    const otherSource = all.find((a) => a.SourceOrg && a.SourceOrg !== existing.SourceOrg)?.SourceOrg;
    test.skip(!otherSource, 'needs a second funding source in the lookup');

    const halfSupplied = await post(page, '/api/Lumpsum/ReplenishLumpSum', {
      LumpSumId: owner.lumpSumId, NewAmount: 6_000_000, Source: otherSource,
    });

    /*  Either answer is correct, and both are better than the old silent
        mismatch: refuse for want of an agreement under that source, or pair it
        with one that genuinely belongs to it. What must never happen is a line
        whose agreement belongs to a different source. */
    if (halfSupplied.status === 200) {
      const line = halfSupplied.body.FundingLine;
      expect(String(line.Source)).toBe(String(otherSource));
      const owns = all.some((a) => a.Code === line.Agreement && a.SourceOrg === otherSource);
      expect(owns, `agreement ${line.Agreement} must belong to ${otherSource}`).toBe(true);
    } else {
      expect(halfSupplied.status).toBe(400);
      expect(String(halfSupplied.body.Title)).toMatch(/Funding Agreement Required|Invalid Funding Line/);
    }

    // An explicitly mismatched pair is refused by name.
    const mismatched = all.find((a) => a.SourceOrg && a.SourceOrg !== existing.SourceOrg);
    const bad = await post(page, '/api/Lumpsum/ReplenishLumpSum', {
      LumpSumId: owner.lumpSumId, NewAmount: 9_000_000,
      Source: existing.SourceOrg, Agreement: mismatched.Code,
    });
    expect(bad.status, `a mismatched pair must be refused: ${JSON.stringify(bad.body).slice(0, 200)}`).toBe(400);
    expect(bad.body.Title).toBe('Invalid Funding Line');
    expect(String(bad.body.Message)).toContain('does not belong to');

    // An unknown agreement is refused by the shared validator.
    const unknown = await post(page, '/api/Lumpsum/ReplenishLumpSum', {
      LumpSumId: owner.lumpSumId, NewAmount: 9_500_000,
      Source: existing.SourceOrg, Agreement: 'NOT-A-REAL-AGREEMENT',
    });
    expect(unknown.status).toBe(400);
    expect(unknown.body.Title).toBe('Invalid Funding Line');

    // Neither refusal moved the allocation, and the invariant still holds.
    await expectAllocationInvariant(page, owner.lumpSumId, 'after refused replenishes');
  });

  test('a blank replenish follows the FIRST funding line, and a different source must name its agreement', async ({ page }) => {
    /*  THE FIRST LINE, NOT THE LARGEST (2026-09-08). The default used to copy the
        largest live line, so a top-up bigger than the project's original funding
        would flip every later blank replenish onto its source. The maintainer's
        rule: the line the project was created with is the only line the default
        reads. Nothing else in this suite can tell the two rules apart — every
        fixture has one line, and the one assertion above compares against the
        first line by Id, which is also the largest — so this case makes the larger
        line deliberately NOT the first, then asks three questions:

          1. neither code named   → the first line's codes, not the larger line's;
          2. the first line's own source named → 200, its agreement copied;
          3. the OTHER source named, which now HAS a live line under it → 400.

        Step 3 is the one "earliest line under that source" would pass. It must not. */
    await apiLogin(page);
    const owner = await provisionLumpSum(page, 5_000_000, `${TAG} first line`);
    created.push(owner.lumpSumId);

    const agreements = await post(page, '/api/Project/ShowProjectComponentDropdowns', {});
    const all = (agreements.body?.Agreements ?? []) as any[];
    const initial = await post(page, '/api/Lumpsum/LumpSumDetails', { LumpSumId: owner.lumpSumId });
    const first = firstLine(initial.body.FundingProfiles);

    /*  "Different" by the server's own comparator: a lookup row differing from the
        first line's source only by case would be the SAME source to the server,
        and step 3 would then get a 200 for the wrong reason. */
    const other = all.find((a) => a.SourceOrg && !sameSourceCode(a.SourceOrg, first.SourceOrg));
    test.skip(!other, 'needs a second funding source in the lookup');

    // A LARGER line under a different source: 7,000,000 beside the 5,000,000 first line.
    const bigger = await post(page, '/api/Lumpsum/ReplenishLumpSum', {
      LumpSumId: owner.lumpSumId, NewAmount: 12_000_000, Source: other.SourceOrg, Agreement: other.Code,
    });
    expect(bigger.status, `top-up on a second source: ${JSON.stringify(bigger.body).slice(0, 200)}`).toBe(200);
    await expectAllocationInvariant(page, owner.lumpSumId, 'after a top-up on a second source');

    // 1. Neither named: the FIRST line's codes, not the larger line's.
    const blank = await post(page, '/api/Lumpsum/ReplenishLumpSum', {
      LumpSumId: owner.lumpSumId, NewAmount: 13_000_000,
    });
    expect(blank.status, `blank replenish: ${JSON.stringify(blank.body).slice(0, 200)}`).toBe(200);
    expect(String(blank.body.FundingLine?.Source), "the first line's source, not the largest line's").toBe(String(first.SourceOrg));
    expect(String(blank.body.FundingLine?.Agreement), "and the first line's agreement").toBe(String(first.AgreementCode));
    await expectAllocationInvariant(page, owner.lumpSumId, 'after a blank replenish');

    // 2. The first line's own source, agreement blank: its agreement is copied.
    const firstSource = await post(page, '/api/Lumpsum/ReplenishLumpSum', {
      LumpSumId: owner.lumpSumId, NewAmount: 14_000_000, Source: first.SourceOrg,
    });
    expect(firstSource.status, `first source only: ${JSON.stringify(firstSource.body).slice(0, 200)}`).toBe(200);
    expect(String(firstSource.body.FundingLine?.Agreement), "the first line's agreement, under its own source").toBe(String(first.AgreementCode));
    await expectAllocationInvariant(page, owner.lumpSumId, 'after a first-source replenish');

    // 3. The second source, agreement blank — it HAS a live line now, and is still refused.
    const otherSource = await post(page, '/api/Lumpsum/ReplenishLumpSum', {
      LumpSumId: owner.lumpSumId, NewAmount: 15_000_000, Source: other.SourceOrg,
    });
    expect(otherSource.status, 'a different source must name its agreement, even with a line under it').toBe(400);
    expect(otherSource.body.Title).toBe('Funding Agreement Required');
    await expectAllocationInvariant(page, owner.lumpSumId, 'after the refused replenish');
  });

  test('a top-up saved through UpdateLumpSum is gated like Replenish, then raises all three figures', async ({ page }) => {
    /*  LOCAL UNTIL SAVE (2026-09-08). The Replenish dialog no longer posts to
        ReplenishLumpSum: it appends a line with Id 0 to the form and "Save Lump
        Sum Project" carries it through UpdateLumpSum. So the three rules
        ReplenishLumpSum enforced on a request — the pair belongs together, the
        amount is a genuine increase, the project is on a revision stage — now
        have to hold on a NEW line arriving through the composite save, or an
        API caller could do through UpdateLumpSum what V1 let them do through
        the frontend gate. The Replenish cases above stay: that endpoint is the
        API-level top-up and they are its specification. This case mirrors them
        for the path the UI actually takes now. */
    await apiLogin(page);
    const owner = await provisionLumpSum(page, 5_000_000, `${TAG} save top-up`);
    created.push(owner.lumpSumId);

    const before = (await post(page, '/api/Lumpsum/LumpSumDetails', { LumpSumId: owner.lumpSumId })).body;
    const first = firstLine(before.FundingProfiles);

    /** What the dialog builds: the first line's pair, the difference as Amount, Id 0. */
    const draft = (overrides: Record<string, unknown> = {}) => ({
      Id: 0, Source: first.SourceOrg, Agreement: first.AgreementCode,
      Amount: 1_500_000, Percentage: 0, IsDeleted: false, ...overrides,
    });
    const withNewLine = (line: Record<string, unknown>) => {
      const echo = echoUpdate(owner, before);
      return { ...echo, FundingProfiles: [...echo.FundingProfiles, line] };
    };

    // 1. A new line whose agreement belongs to another source is refused by name.
    const agreements = (await post(page, '/api/Project/ShowProjectComponentDropdowns', {})).body?.Agreements ?? [];
    const foreign = (agreements as any[]).find((a) => a.SourceOrg && !sameSourceCode(a.SourceOrg, first.SourceOrg));
    if (foreign) {
      const bad = await post(page, '/api/Lumpsum/UpdateLumpSum', withNewLine(draft({ Agreement: foreign.Code })));
      expect(bad.status, `a mismatched pair must be refused: ${JSON.stringify(bad.body).slice(0, 200)}`).toBe(400);
      expect(bad.body.Title).toBe('Invalid Funding Line');
      expect(String(bad.body.Message)).toContain('does not belong to');
    }

    // 2. A new line that adds nothing is refused: removal is the only decrease.
    const zero = await post(page, '/api/Lumpsum/UpdateLumpSum', withNewLine(draft({ Amount: 0 })));
    expect(zero.status).toBe(400);
    expect(zero.body.Title).toBe('Invalid Funding Line');
    expect(String(zero.body.Message)).toContain('greater than zero');

    // Neither refusal wrote anything.
    await expectAllocationInvariant(page, owner.lumpSumId, 'after two refused saves');
    expect(Number((await lumpSum(page, owner.lumpSumId)).OriginalAllocation)).toBe(5_000_000);

    // 3. A valid new line lands, gets an Id, and moves all three figures together.
    const saved = await post(page, '/api/Lumpsum/UpdateLumpSum', withNewLine(draft()));
    expect(saved.status, JSON.stringify(saved.body).slice(0, 300)).toBe(200);

    const after = await expectAllocationInvariant(page, owner.lumpSumId, 'after a top-up saved through UpdateLumpSum');
    expect(after.FundingProfiles.length, 'one funding line was appended').toBe(before.FundingProfiles.length + 1);
    const added = after.FundingProfiles.find((f: any) => Number(f.Amount) === 1_500_000);
    expect(added, 'and it carries exactly the top-up').toBeTruthy();
    expect(Number(added.Id), 'with a real Id — the next save must not insert it again').toBeGreaterThan(0);
    expect(Number(after.LumpSumProject.OriginalAllocation)).toBe(6_500_000);
    expect(Number(after.LumpSumProject.Remaining)).toBe(6_500_000);

    // 4. Off the revision stages a new line is refused, while a save that only
    //    carries existing lines still goes through — a removal must stay possible.
    const offStage = await provisionLumpSum(page, 5_000_000, `${TAG} save top-up off-stage`, {
      onRevisionStage: false,
    });
    created.push(offStage.lumpSumId);
    const offBefore = (await post(page, '/api/Lumpsum/LumpSumDetails', { LumpSumId: offStage.lumpSumId })).body;
    const offFirst = firstLine(offBefore.FundingProfiles);
    const offEcho = echoUpdate(offStage, offBefore);

    const gated = await post(page, '/api/Lumpsum/UpdateLumpSum', {
      ...offEcho,
      FundingProfiles: [...offEcho.FundingProfiles, {
        Id: 0, Source: offFirst.SourceOrg, Agreement: offFirst.AgreementCode,
        Amount: 1_000_000, Percentage: 0, IsDeleted: false,
      }],
    });
    expect(gated.status).toBe(400);
    expect(gated.body.Title).toBe('Stage Not Reached');
    expect(String(gated.body.Message)).toContain('only be added at GAA-R');

    const plain = await post(page, '/api/Lumpsum/UpdateLumpSum', offEcho);
    expect(plain.status, `an existing-lines-only save is not gated: ${JSON.stringify(plain.body).slice(0, 200)}`).toBe(200);
    expect(Number((await lumpSum(page, offStage.lumpSumId)).OriginalAllocation)).toBe(5_000_000);
  });

  test('reads of one parent are neither deadlocked nor blocked by hard deletes of others', async ({ page }) => {
    /*  THE DEADLOCK RCA (2026-09-06, documents/docs/engineering/MYPS_LUMPSUM_DEADLOCK_RCA.md).
        The detail read of ONE parent used to scan the whole revisions table —
        the view resolved "latest revision" with a window function the Id filter
        could not push through — taking shared locks on every other project's
        rows. Meeting the hard delete of a DIFFERENT parent, which removes stages
        before revisions (the reverse of the read's order), it deadlocked and was
        the victim every time: error 1205, a 500 to the page, six times in one
        day's logs. Now the views seek per project, so a read touches only its own
        project's rows, and the database runs READ_COMMITTED_SNAPSHOT, so a read
        holds no locks at all.

        WHAT THIS PROVES, AND WHAT IT CANNOT. Forty detail reads and ten list
        reads of A run while five other parents are hard-deleted underneath them;
        every read must answer 200 and every delete must take the hard path.
        Before the fix this produced 500s (deadlock victims) or reads that waited
        out the delete. It exercises the view rewrite and the isolation together;
        it cannot tell which of the two saved a read, and under snapshot isolation
        it cannot see lock order at all — a lock-first delete helper was tried and
        removed for exactly that reason (see the RCA).

        Failures are collected, not thrown: a request that rejects (socket error,
        Playwright's own request timeout) is recorded as status 'ERR' so the
        diagnostic lists below still print, the other requests are still awaited,
        and the deletes are never abandoned mid-transaction by a fail-fast
        Promise.all. No wall-clock bound: a blocked read on a one-revision fixture
        is bounded by a tens-of-milliseconds delete and could never reach a bound
        that a cold API would not also trip on its own. */
    test.skip(
      Number(process.env.LS_PARENT ?? 0) > 0,
      'LS_PARENT pins every fixture to one project; this test hard-deletes five of its own',
    );
    await apiLogin(page);
    const a = await provisionLumpSum(page, 5_000_000, `${TAG} race A`);
    created.push(a.lumpSumId);

    // Never revised, one revision each: DeleteLumpSum takes its HARD path on them.
    const victims: ProvisionedLumpSum[] = [];
    for (let i = 0; i < 5; i++) victims.push(await provisionLumpSum(page, 1_000_000, `${TAG} race B${i}`));
    expect(new Set([a.lumpSumId, ...victims.map((v) => v.lumpSumId)]).size, 'six distinct projects').toBe(6);

    const timed = async (url: string, body: unknown) => {
      const started = Date.now();
      try {
        const r = await post(page, url, body);
        return { url, status: r.status as number | 'ERR', ms: Date.now() - started, body: r.body };
      } catch (e) {
        return { url, status: 'ERR' as const, ms: Date.now() - started, body: String(e) };
      }
    };

    const reads: Promise<any>[] = [];
    const deletes: Promise<any>[] = [];
    for (let i = 0; i < 40; i++) {
      reads.push(timed('/api/Lumpsum/LumpSumDetails', { LumpSumId: a.lumpSumId }));
      if (i % 4 === 0) reads.push(timed('/api/Lumpsum/ShowLumpSum', { Filters: {}, limit: 10, page: 1, sortDirection: 0 }));
      if (i % 8 === 0) deletes.push(timed('/api/Lumpsum/DeleteLumpSum', { LumpSumId: victims[i / 8].lumpSumId }));
    }
    const [readResults, deleteResults] = await Promise.all([Promise.all(reads), Promise.all(deletes)]);

    const badDeletes = deleteResults.filter((d) => d.status !== 200 || d.body?.Tier !== 'Hard');
    expect(badDeletes.map((d) => `${d.status} ${JSON.stringify(d.body).slice(0, 160)}`), 'every victim is hard-deleted').toEqual([]);
    const failed = readResults.filter((r) => r.status !== 200);
    expect(failed.map((r) => `${r.url} ${r.status} ${JSON.stringify(r.body).slice(0, 120)}`), 'no read is a deadlock victim or an error').toEqual([]);

    const max = Math.max(...readResults.map((r) => r.ms));
    console.log(`race: ${readResults.length} reads during ${deleteResults.length} hard deletes, slowest read ${max} ms`);

    // And A is untouched by any of it.
    await expectAllocationInvariant(page, a.lumpSumId, 'after the race');
  });

  /*  THE REVISION-STAGE GATE. Replenish and Import both require GAA-R — a
      client business rule, narrowed from GAA-R/TF-R on 2026-09-04, and
      membership in that set rather than a threshold. V2 first shipped Replenish
      as "GAA onwards", which admitted GAA itself, where there is no revision to
      carry the top-up. A GAA program is therefore exactly the case this pins: it
      passed the old gate and must not pass this one. */
  test('replenish and import are refused off the revision stages', async ({ page }) => {
    await apiLogin(page);

    const offStage = await provisionLumpSum(page, 50_000_000, `${TAG} off-stage`, {
      onRevisionStage: false,
    });
    created.push(offStage.lumpSumId);

    const replenish = await post(page, '/api/Lumpsum/ReplenishLumpSum', {
      LumpSumId: offStage.lumpSumId, NewAmount: 60_000_000,
    });
    expect(replenish.status).toBe(400);
    expect(replenish.body.Title).toBe('Stage Not Reached');
    expect(String(replenish.body.Message)).toContain('only available at GAA-R');

    const imported = await importChild(page, offStage, 1_000_000, `${TAG} off-stage child`);
    expect(imported.status).toBe(400);
    expect(String(imported.body.Message)).toContain('only available at GAA-R');

    // Refused, not partially applied.
    const after = await lumpSum(page, offStage.lumpSumId);
    expect(Number(after.Remaining)).toBe(50_000_000);
    expect(Number(after.ItemizedCount)).toBe(0);
  });

  /*  AN APPROVED PROGRAM CLOSES THE RECORD, NOT THE MONEY (rule revised
      2026-09-09 by the client, narrowing the same day's first cut).

      Once the program's latest revision is Approved at GAA-R, exactly two
      actions are refused: CREATING a Lump Sum Project in that program and
      DELETING one. Everything the client calls normal work at that stage keeps
      working — Save (which is how a Replenish and a funding-line removal reach
      the database), Replenish, Import, deleting an itemized child, and the
      itemization pre-flight. The first cut refused all of them; GAA-R is
      precisely the stage this work happens at, so it was wrong about the
      business rather than merely strict.

      THIS TEST IS THE RULE'S BOUNDARY. It asserts both halves, because a gate
      that creeps back onto Save or Replenish is the regression to catch, and so
      is one that stops refusing the delete.

      The fixture program is the ONLY program this suite approves: approving one
      runs pRecomputeProjectPublishable over every project in it. */
  test('an Approved GAA-R program refuses only Create and Delete, and keeps the money moving', async ({ page }) => {
    await apiLogin(page);

    await withFixtureProgram(page, async ({ program, approve, restore }) => {
      // Provisioned while Working: CreateLumpSum is one of the two things approval refuses.
      const owner = await provisionLumpSum(page, 20_000_000, `${TAG} approved`, { programPK: program.ProgramPK });
      created.push(owner.lumpSumId);
      const imported = await importChild(page, owner, 1_000_000, `${TAG} approved child`);
      expect(imported.status, JSON.stringify(imported.body).slice(0, 300)).toBe(200);
      await expectAllocationInvariant(page, owner.lumpSumId, 'before the program is approved');
      const child = (await post(page, '/api/Lumpsum/ShowItemizedProjects', {
        Filters: { LumpSumId: owner.lumpSumId }, limit: 200, page: 1, sortDirection: 0,
      })).body.lists[0];

      await approve();

      // The page learns it from the same payload it already re-reads.
      const details = await post(page, '/api/Lumpsum/LumpSumDetails', { LumpSumId: owner.lumpSumId });
      expect(details.body.ProgramApproval?.StageName, 'LumpSumDetails carries the approval').toBe('GAA-R');
      expect(details.body.ProgramApproval?.Status).toBe('Approved');
      expect(String(details.body.ProgramApproval?.ProgramName)).toBe(program.Name);

      // ── The two that are refused ──────────────────────────────────────────
      const stamp = new Date().toISOString().slice(0, 19);
      const refusals: Array<[string, { status: number; body: any }]> = [
        ['CreateLumpSum', await post(page, '/api/Lumpsum/CreateLumpSum', {
          ProgramId: program.ProgramPK, CategoryId: 16, SubCategoryId: 1082, OperatingUnit: 'OI46',
          Description: `${TAG} approved create (e2e ${stamp})`, Tier: 2, RegionWide: 1, Agency: 1001, Origin: 13,
          Allocation: 1_000_000, FundingSource: 'GOP', FundingAgreement: 'DPWH-GAA-2025',
        })],
        ['DeleteLumpSum', await post(page, '/api/Lumpsum/DeleteLumpSum', { LumpSumId: owner.lumpSumId })],
      ];
      for (const [action, res] of refusals) {
        expect(res.status, `${action} must be refused: ${JSON.stringify(res.body).slice(0, 200)}`).toBe(400);
        expect(res.body.Title, `${action}'s title`).toBe('Program Approved');
        expect(String(res.body.Message), `${action}'s message names the stage`).toContain('Approved at GAA-R');
        expect(String(res.body.Message), `${action}'s message names the program`).toContain(program.Name);
      }
      const stillThere = await lumpSum(page, owner.lumpSumId);
      expect(stillThere, 'the refused delete left the project alone').toBeTruthy();

      // ── Everything else keeps working ─────────────────────────────────────
      const topUp = await post(page, '/api/Lumpsum/ReplenishLumpSum', {
        LumpSumId: owner.lumpSumId, NewAmount: 30_000_000,
      });
      expect(topUp.status, `Replenish is allowed: ${JSON.stringify(topUp.body).slice(0, 200)}`).toBe(200);

      const raised = await expectAllocationInvariant(page, owner.lumpSumId, 'after a top-up on an Approved program');
      expect(Number(raised.LumpSumProject.OriginalAllocation), 'and the allocation actually rose').toBe(30_000_000);

      // Save, carrying a NEW funding line — the path the Replenish dialog uses.
      const withDraft = echoUpdate(owner, raised);
      const first = raised.FundingProfiles[0];
      const saved = await post(page, '/api/Lumpsum/UpdateLumpSum', {
        ...withDraft,
        FundingProfiles: [...withDraft.FundingProfiles, {
          Id: 0, Source: first.SourceOrg, Agreement: first.AgreementCode,
          Amount: 2_000_000, Percentage: 0, IsDeleted: false,
        }],
      });
      expect(saved.status, `Save is allowed: ${JSON.stringify(saved.body).slice(0, 200)}`).toBe(200);
      const afterSave = await expectAllocationInvariant(page, owner.lumpSumId, 'after a save on an Approved program');
      expect(Number(afterSave.LumpSumProject.OriginalAllocation)).toBe(32_000_000);

      // A funding-line removal, the other thing Save is left enabled for.
      const removable = afterSave.FundingProfiles.find((f: any) => Number(f.Amount) === 2_000_000);
      const echo = echoUpdate(owner, afterSave);
      const removed = await post(page, '/api/Lumpsum/UpdateLumpSum', {
        ...echo,
        FundingProfiles: echo.FundingProfiles.map((f: any) =>
          Number(f.Id) === Number(removable.Id) ? { ...f, IsDeleted: true } : f),
      });
      expect(removed.status, `a funding-line removal is allowed: ${JSON.stringify(removed.body).slice(0, 200)}`).toBe(200);
      const afterRemoval = await expectAllocationInvariant(page, owner.lumpSumId, 'after a line removal on an Approved program');
      expect(Number(afterRemoval.LumpSumProject.OriginalAllocation)).toBe(30_000_000);

      // Itemization: the pre-flight says yes and the import lands.
      const check = await post(page, '/api/Lumpsum/ValidateForItemization', { LumpSumId: owner.lumpSumId });
      expect(check.body.Valid, `the pre-flight allows it: ${JSON.stringify(check.body).slice(0, 200)}`).toBe(true);

      const secondChild = await importChild(page, owner, 1_000_000, `${TAG} approved second child`);
      expect(secondChild.status, `Import is allowed: ${JSON.stringify(secondChild.body).slice(0, 300)}`).toBe(200);
      const afterImport = await expectAllocationInvariant(page, owner.lumpSumId, 'after an import on an Approved program');
      expect(Number(afterImport.LumpSumProject.ItemizedCount)).toBe(2);

      // And a child delete, so an import mistake stays correctable.
      const childDeleted = await post(page, '/api/Lumpsum/DeleteItemizedProject', { ProjectId: child.ProjectPK });
      expect(childDeleted.status, `a child delete is allowed: ${JSON.stringify(childDeleted.body).slice(0, 200)}`).toBe(200);
      const settled = await expectAllocationInvariant(page, owner.lumpSumId, 'after a child delete on an Approved program');

      // ── The record is closed: a changed detail is refused by NAME ─────────
      /*  A CHANGE IS REFUSED; AN ECHO IS NOT (server-side since 2026-09-09).
          echoUpdate re-sends what LumpSumDetails returned, so it is the echo; each
          override below is the one field that differs. The message names it, so a
          refusal that fires on the wrong field fails here rather than passing by
          accident. The owner is childless by now, so the UACS case reaches THIS
          rule and not the "UACS Locked" guard for itemized parents. */
      const echoOf = () => echoUpdate(owner, settled);
      const refusedDetail = async (label: string, body: Record<string, unknown>, field: RegExp) => {
        const res = await post(page, '/api/Lumpsum/UpdateLumpSum', body);
        expect(res.status, `${label} must be refused: ${JSON.stringify(res.body).slice(0, 200)}`).toBe(400);
        expect(res.body.Title, label).toBe('Program Approved');
        expect(String(res.body.Message), `${label} names the field`).toMatch(field);
      };
      // The echo itself passes — that is the control for every refusal below.
      const plainEcho = await post(page, '/api/Lumpsum/UpdateLumpSum', echoOf());
      expect(plainEcho.status, `a pure echo is accepted: ${JSON.stringify(plainEcho.body).slice(0, 200)}`).toBe(200);
      await refusedDetail('Description', { ...echoOf(), Description: `${settled.LumpSumProject.Description} changed` }, /Description would change/);
      await refusedDetail('Tier', { ...echoOf(), Tier: 5 }, /Tier would change/);
      await refusedDetail('Rank (stored null, sent)', { ...echoOf(), Rank: 3 }, /Rank would change/);
      await refusedDetail('MYCA date', { ...echoOf(), MycaApprovalDate: '2026-03-15T00:00:00' }, /MycaApprovalDate would change/);
      await refusedDetail('UACS on a childless parent', { ...echoOf(), Uacs: 'LS-APPROVED-X1' }, /Uacs would change/);

      // The Component Cost is part of the record.
      const costChanged = echoOf();
      costChanged.ComponentCosts = costChanged.ComponentCosts.map((c: any) => ({ ...c, Description: 'changed' }));
      await refusedDetail('component Description', costChanged, /Component Cost's Description/);
      /*  FINDING 3 OF THE 2026-09-10 REVIEW. The guard's doc claimed the
          single-component rule fixed ComponentId. That rule constrains
          ComponentType only, and the merge writes ComponentId unconditionally —
          so an echo that merely OMITTED it blanked the stored code on a record
          the approval calls closed. */
      const idChanged = echoOf();
      idChanged.ComponentCosts = idChanged.ComponentCosts.map((c: any) => ({ ...c, ComponentId: 'ZZ99' }));
      await refusedDetail('component ComponentId', idChanged, /Component ID/);
      const idDropped = echoOf();
      idDropped.ComponentCosts = idDropped.ComponentCosts.map(({ ComponentId, ...rest }: any) => rest);
      await refusedDetail('component ComponentId omitted', idDropped, /Component ID/);
      const dateMoved = echoOf();
      dateMoved.ComponentCostPerYear = dateMoved.ComponentCostPerYear.map((y: any) => ({ ...y, StartDate: '2030-01-01T00:00:00' }));
      await refusedDetail('per-year Start Date', dateMoved, /Start Date/);

      // What is NOT a change: the keep-guarded fields omitted (echoUpdate omits
      // Tier), UACS omitted (tri-state keep), and the derived figures lied about.
      const lied = echoOf();
      lied.ComponentCosts = lied.ComponentCosts.map((c: any) => ({ ...c, Total: 1 }));
      lied.ComponentCostPerYear = lied.ComponentCostPerYear.map((y: any) => ({ ...y, Amount: 1 }));
      const stillEcho = await post(page, '/api/Lumpsum/UpdateLumpSum', lied);
      expect(stillEcho.status, `derived figures are not compared: ${JSON.stringify(stillEcho.body).slice(0, 200)}`).toBe(200);
      await expectAllocationInvariant(page, owner.lumpSumId, 'after an echo that lied about the derived figures');

      // Working again: the parent's own delete comes back, and so does a detail change.
      await restore();
      const lifted = await post(page, '/api/Lumpsum/LumpSumDetails', { LumpSumId: owner.lumpSumId });
      expect(lifted.body.ProgramApproval, 'the approval is gone from the payload').toBeNull();
      const editable = await post(page, '/api/Lumpsum/UpdateLumpSum', {
        ...echoUpdate(owner, lifted.body), Description: `${lifted.body.LumpSumProject.Description} edited`,
      });
      expect(editable.status, `a detail change is accepted once Working: ${JSON.stringify(editable.body).slice(0, 200)}`).toBe(200);
    });
  });



  /*  FINDING 15 OF THE 2026-09-10 REVIEW. The allocation IS the component: a
      project is in vLumpSumSet only while its revision holds a live Lump Sum
      component cost, and the balance is that component's one live per-year row.

      The rule protecting it read the PAYLOAD — count the live LS-type rows,
      resolve the survivor's type — and never asked whether that row's Id was
      this revision's. The merge skips an Id it does not own and copies
      IsDeleted onto the one it does. So a phantom live row beside the real one
      flagged deleted passed the count, soft-deleted the allocation, and
      committed: the project left the module, and every itemized child became
      unsaveable because the helper that keeps them in step resolves the parent
      through the same view.

      The page cannot send any of these — the Component Cost table has no delete
      and no add — so this is the API caller's shape, like the per-year UACS
      hijack was. */
  test('the allocation component cannot be removed or replaced through a save', async ({ page }) => {
    await apiLogin(page);
    const owner = await provisionLumpSum(page, 3_000_000, `${TAG} ls component`);
    created.push(owner.lumpSumId);

    const before = await post(page, '/api/Lumpsum/LumpSumDetails', { LumpSumId: owner.lumpSumId });
    const lsCost = before.body.ComponentCosts.find((c: any) => !c.IsDeleted);
    expect(lsCost, 'the allocation row').toBeTruthy();
    const lsYear = before.body.ComponentCostPerYear.find((y: any) => !y.IsDeleted);
    expect(lsYear, 'and the balance row it hangs on').toBeTruthy();

    const stillHealthy = async (label: string) => {
      const row = await lumpSum(page, owner.lumpSumId);
      expect(row, `${label}: the project is still a Lump Sum Project`).toBeTruthy();
      expect(Number(row.OriginalAllocation), `${label}: the allocation is untouched`).toBe(3_000_000);
      const now = await post(page, '/api/Lumpsum/LumpSumDetails', { LumpSumId: owner.lumpSumId });
      expect(now.body.ComponentCosts.filter((c: any) => !c.IsDeleted).length, `${label}: one live component`).toBe(1);
      expect(now.body.ComponentCostPerYear.filter((y: any) => !y.IsDeleted).length, `${label}: one live per-year row`).toBe(1);
      return now;
    };

    /*  (a) THE PHANTOM. The real row is flagged deleted; a live LS-type row
        carrying an Id from nowhere stands in for it. The count sees one live
        LS row and is satisfied. */
    const phantom = echoUpdate(owner, before.body);
    phantom.ComponentCosts = [
      { ...phantom.ComponentCosts[0], IsDeleted: true },
      { ...phantom.ComponentCosts[0], Id: 2_000_000_000, CostId: 'phantom', IsDeleted: false },
    ];
    const swapped = await post(page, '/api/Lumpsum/UpdateLumpSum', phantom);
    expect(swapped.status, `a phantom replacement must be refused: ${JSON.stringify(swapped.body).slice(0, 250)}`).toBe(400);
    expect(swapped.body.Title).toBe('Single Component');
    await stillHealthy('after the phantom');

    /*  (b) THE SAME MOVE WITH Id 0, which reads as "insert a new allocation".
        Today this leaves TWO live LS components — the same hole, other
        direction — and the project's own component is no longer the one the
        module reads. */
    const reborn = echoUpdate(owner, before.body);
    reborn.ComponentCosts = [
      { ...reborn.ComponentCosts[0], IsDeleted: true },
      { ...reborn.ComponentCosts[0], Id: 0, CostId: 'newLs', IsDeleted: false },
    ];
    const inserted = await post(page, '/api/Lumpsum/UpdateLumpSum', reborn);
    expect(inserted.status, `a re-created allocation must be refused: ${JSON.stringify(inserted.body).slice(0, 250)}`).toBe(400);
    expect(inserted.body.Title).toBe('Single Component');
    await stillHealthy('after the Id-0 replacement');

    /*  (c) THE BALANCE ROW. The component is echoed live and only its per-year
        row is flagged deleted, with nothing attached to replace it. The
        existing check asks whether EVERY per-year row in the payload is
        deleted, which a payload with one row satisfies — but a payload that
        also carried an unrelated live row would slip past it. */
    const noBalance = echoUpdate(owner, before.body);
    noBalance.ComponentCostPerYear = noBalance.ComponentCostPerYear.map((y: any) => ({ ...y, IsDeleted: true }));
    const emptied = await post(page, '/api/Lumpsum/UpdateLumpSum', noBalance);
    expect(emptied.status, `removing the balance row must be refused: ${JSON.stringify(emptied.body).slice(0, 250)}`).toBe(400);
    expect(emptied.body.Title).toBe('Cost Per Year Required');
    await stillHealthy('after the balance-row removal');

    /*  (c2) THE SAME REMOVAL, HIDDEN BEHIND A DUPLICATE. The merge walks the
        payload in order and last write wins, so listing one Id twice — live,
        then deleted — ends with the row deleted. A guard that asks "is any
        entry live" reads the first and passes. The check has to reason about
        the payload's FINAL state, and the outcome check after the merge is what
        makes that certain: SyncLSToFundingAsync answers true for a component
        with no live per-year row (LumpsumHelper "Rows.Count == 0 return true"),
        so it cannot be the thing that catches this. Found by review. */
    const duplicated = echoUpdate(owner, before.body);
    duplicated.ComponentCostPerYear = [
      ...duplicated.ComponentCostPerYear.map((y: any) => ({ ...y, IsDeleted: false })),
      ...duplicated.ComponentCostPerYear.map((y: any) => ({ ...y, IsDeleted: true })),
    ];
    const sneaked = await post(page, '/api/Lumpsum/UpdateLumpSum', duplicated);
    expect(sneaked.status, `a duplicate-Id removal must be refused: ${JSON.stringify(sneaked.body).slice(0, 250)}`).toBe(400);
    expect(sneaked.body.Title).toBe('Cost Per Year Required');
    await stillHealthy('after the duplicate-Id removal');

    /*  (d) THE CONTROLS. Everything the page actually sends still saves: the
        plain echo, and an echo that REPLACES the per-year row with a new one
        attached to the same component — which is a legitimate shape, and the
        one a check written as "no per-year row may be deleted" would break. */
    const plain = await post(page, '/api/Lumpsum/UpdateLumpSum', echoUpdate(owner, before.body));
    expect(plain.status, `the echo still saves: ${JSON.stringify(plain.body).slice(0, 250)}`).toBe(200);

    const swapRow = echoUpdate(owner, before.body);
    swapRow.ComponentCostPerYear = [
      ...swapRow.ComponentCostPerYear.map((y: any) => ({ ...y, IsDeleted: true })),
      {
        Id: 0, ComponentCostId: 'c1', Year: Number(lsYear.Year), Amount: lsYear.Amount,
        StartDate: lsYear.StartDate, EndDate: lsYear.EndDate, IsDeleted: false,
      },
    ];
    const replaced = await post(page, '/api/Lumpsum/UpdateLumpSum', swapRow);
    expect(replaced.status, `replacing the balance row is allowed: ${JSON.stringify(replaced.body).slice(0, 250)}`).toBe(200);
    const after = await post(page, '/api/Lumpsum/LumpSumDetails', { LumpSumId: owner.lumpSumId });
    expect(after.body.ComponentCostPerYear.filter((y: any) => !y.IsDeleted).length, 'still exactly one balance row').toBe(1);
    expect(Number(after.body.LumpSumProject.OriginalAllocation), 'and the allocation is unmoved').toBe(3_000_000);
    await expectAllocationInvariant(page, owner.lumpSumId, 'after the balance row was replaced');
  });

  /*  FINDING 1 OF THE 2026-09-20 REVIEW — THE COMPONENT ID IS THE SERVER'S.

      A Lump Sum parent adds its appropriation to its program's cost, and the
      rule finds that row by tProjectComponentCost.ComponentId = 'LS' (section 11
      of Migration.SchemaAndProgrammability.2026-09-10.sql). Every OTHER reader —
      vLumpSumSet, FindLSComponentAsync, Replenish, the import — finds it by the
      component type's NAME. Two markers on one row, and the save validated only
      the second: ComponentType was resolved and checked, while ComponentId was
      copied from the payload, defaulting to ''.

      So a body sending ComponentId '' or 'X' was accepted, the module went on
      looking healthy, and the parent's whole appropriation dropped out of
      program cost. Silently, and late: the recompute is gated on the
      allocation's Total, which such a save does not move, so the figure only
      fell at the next unrelated recompute of that program.

      The page always sends 'LS' (the dialog pins it), so this is the API
      caller's shape, like the phantom component and the per-year UACS hijack
      above. The server now writes the code it resolved from ComponentType and
      ignores the field. */
  test('the allocation component keeps its LS ComponentId whatever the payload says', async ({ page }) => {
    await apiLogin(page);
    const owner = await provisionLumpSum(page, 4_000_000, `${TAG} component id`);
    created.push(owner.lumpSumId);

    const before = await post(page, '/api/Lumpsum/LumpSumDetails', { LumpSumId: owner.lumpSumId });
    const lsCost = before.body.ComponentCosts.find((c: any) => !c.IsDeleted);
    expect(String(lsCost.ComponentId), 'created with the code').toBe('LS');

    const savedWith = async (componentId: unknown, label: string) => {
      const sent = await post(page, '/api/Lumpsum/UpdateLumpSum', echoUpdate(owner, before.body, {
        ComponentCosts: [{
          Id: lsCost.Id, CostId: 'c1', ComponentType: 'LS', ComponentId: componentId,
          Description: lsCost.Description, Total: lsCost.Total, IsDeleted: false,
        }],
      }));
      expect(sent.status, `${label} is accepted: ${JSON.stringify(sent.body).slice(0, 250)}`).toBe(200);

      const now = await post(page, '/api/Lumpsum/LumpSumDetails', { LumpSumId: owner.lumpSumId });
      const row = now.body.ComponentCosts.find((c: any) => !c.IsDeleted);
      expect(String(row.ComponentId), `${label}: the server kept 'LS'`).toBe('LS');
      /*  The per-year row duplicates its parent's code, so it must not drift
          either — a replacement balance row inherits whatever the cost carries. */
      const year = now.body.ComponentCostPerYear.find((y: any) => !y.IsDeleted);
      expect(String(year.ComponentId), `${label}: and so did the balance row`).toBe('LS');
      return now;
    };

    await savedWith('', 'an empty ComponentId');
    await savedWith('XX', 'a foreign ComponentId');
    await savedWith(null, 'a missing ComponentId');

    /*  And the project still counts where it is read by that code: the module
        view still shows the appropriation, which is what program cost sums. */
    const row = await lumpSum(page, owner.lumpSumId);
    expect(Number(row.OriginalAllocation), 'the appropriation is still readable by code').toBe(4_000_000);
    await expectAllocationInvariant(page, owner.lumpSumId, 'after three payloads lied about ComponentId');
  });

  /*  FINDING 1 OF THE 2026-09-10 REVIEW. There is no project-level UACS column:
      the storage is tProjectComponentCostPerYear.UACS, the details form's Uacs
      is fanned out across every live row, and vLumpSumSet reads the first row
      back. The merge ALSO wrote that column from the payload's per-year rows,
      which made a second writer nobody guarded — both the itemized freeze and
      the Approved-program guard read dto.Uacs and nothing else. So a payload
      that omitted Uacs and set it on a row changed a frozen parent's code
      while every child kept the old one. The rows are not an input. */
  test('a per-year UACS in the payload is ignored: the details form is the only writer', async ({ page }) => {
    await apiLogin(page);
    const owner = await provisionLumpSum(page, 6_000_000, `${TAG} uacs rows`);
    created.push(owner.lumpSumId);

    const CODE = `LS-ROWS-${Date.now().toString().slice(-8)}`;
    const seeded = await post(page, '/api/Lumpsum/LumpSumDetails', { LumpSumId: owner.lumpSumId });
    const setIt = await post(page, '/api/Lumpsum/UpdateLumpSum', { ...echoUpdate(owner, seeded.body), Uacs: CODE });
    expect(setIt.status, `the form sets the code: ${JSON.stringify(setIt.body).slice(0, 200)}`).toBe(200);
    expect(String((await lumpSum(page, owner.lumpSumId)).UACS), 'and it reads back').toBe(CODE);

    /*  A child inherits it at import, and from that moment the code is frozen —
        the fan-out is scoped to this revision and cannot reach the children. */
    const imported = await importChild(page, owner, 1_000_000, `${TAG} uacs child`);
    expect(imported.status, JSON.stringify(imported.body).slice(0, 300)).toBe(200);

    const details = await post(page, '/api/Lumpsum/LumpSumDetails', { LumpSumId: owner.lumpSumId });
    expect(details.body.ComponentCostPerYear.length, 'a row to aim at').toBeGreaterThan(0);

    // Sent on the rows, with no project-level Uacs: accepted, and it changes nothing.
    const hijack = echoUpdate(owner, details.body);
    hijack.ComponentCostPerYear = hijack.ComponentCostPerYear.map((y: any) => ({ ...y, UACS: 'HIJACKED-CODE' }));
    const res = await post(page, '/api/Lumpsum/UpdateLumpSum', hijack);
    expect(res.status, `an echo carrying a row UACS is still an echo: ${JSON.stringify(res.body).slice(0, 200)}`).toBe(200);

    const after = await post(page, '/api/Lumpsum/LumpSumDetails', { LumpSumId: owner.lumpSumId });
    expect(String(after.body.LumpSumProject.UACS), 'the parent keeps its code').toBe(CODE);
    for (const row of after.body.ComponentCostPerYear) {
      expect(row.UACS, 'and so does every row').toBe(CODE);
    }

    // The child it was frozen for still matches, which is the point of the freeze.
    const kids = await post(page, '/api/Lumpsum/ShowItemizedProjects', {
      Filters: { LumpSumId: owner.lumpSumId }, limit: 200, page: 1, sortDirection: 0,
    });
    for (const child of kids.body.lists ?? []) {
      expect(child.UACS, `child ${child.ProjectId} still matches its parent`).toBe(CODE);
    }

    // And the project-level route still works, because that is the one writer.
    const NEXT = `${CODE}-B`;
    const lifted = await post(page, '/api/Lumpsum/DeleteItemizedProject', { ProjectId: (kids.body.lists ?? [])[0]?.ProjectPK });
    expect(lifted.status, 'unfreeze by removing the child').toBe(200);
    const reread = await post(page, '/api/Lumpsum/LumpSumDetails', { LumpSumId: owner.lumpSumId });
    const changed = await post(page, '/api/Lumpsum/UpdateLumpSum', { ...echoUpdate(owner, reread.body), Uacs: NEXT });
    expect(changed.status, `the form can still change it: ${JSON.stringify(changed.body).slice(0, 200)}`).toBe(200);
    expect(String((await lumpSum(page, owner.lumpSumId)).UACS)).toBe(NEXT);
  });

  /*  FINDINGS 5 AND 4 OF THE 2026-09-10 REVIEW, which travel together because
      both moved when Replenish became local-until-Save.

      5. The strictly-increasing rule lived in ReplenishLumpSum, comparing the
         new total against the STORED allocation. The dialog now sizes the draft
         against the form's own lines and Save carries it, and Save never had the
         rule — so a save that appends a line while the lines add up to less than
         the allocation writes the allocation DOWN, with an audit note that says
         increased. The money's one honest signal lied.
      4. ReplenishLumpSum re-derived every line's share; Save stores what it is
         sent. The form's table re-derives on screen, but it is unmounted while
         the Funding Profile section is collapsed, so a top-up from a collapsed
         page persisted 100/0. */
  test('a top-up must raise the allocation, and the shares are re-derived server-side', async ({ page }) => {
    await apiLogin(page);
    const owner = await provisionLumpSum(page, 4_000_000, `${TAG} topup rules`);
    created.push(owner.lumpSumId);

    const before = await post(page, '/api/Lumpsum/LumpSumDetails', { LumpSumId: owner.lumpSumId });
    const original = Number(before.body.LumpSumProject.OriginalAllocation);
    expect(original, 'the allocation the top-up must beat').toBe(4_000_000);
    const founding = before.body.FundingProfiles.find((f: any) => !f.IsDeleted);
    expect(founding, 'a line to copy the pair from').toBeTruthy();

    /*  (a) A save that ADDS a line and still lands at or below the stored
        allocation. Nothing is deleted, so this is a top-up by shape — and a
        top-up that lowers the allocation is a contradiction. */
    const shrink = echoUpdate(owner, before.body);
    shrink.FundingProfiles = [
      ...shrink.FundingProfiles.map((f: any) => ({ ...f, Amount: 1_000_000 })),
      { Id: 0, Source: founding.SourceOrg, Agreement: founding.AgreementCode, Amount: 500_000, Percentage: 0, IsDeleted: false },
    ];
    const refused = await post(page, '/api/Lumpsum/UpdateLumpSum', shrink);
    expect(refused.status, `a lowering top-up must be refused: ${JSON.stringify(refused.body).slice(0, 250)}`).toBe(400);
    expect(refused.body.Title).toBe('Allocation Mismatch');
    expect(String(refused.body.Message), 'the message names both figures').toContain('4,000,000');
    expect(String(refused.body.Message)).toContain('1,500,000');
    expect(Number((await lumpSum(page, owner.lumpSumId)).OriginalAllocation), 'and nothing moved').toBe(original);

    /*  (b) A real top-up of the same size as the founding line: accepted, and
        the shares come back derived from the amounts rather than as sent. */
    const topUp = echoUpdate(owner, before.body);
    topUp.FundingProfiles = [
      ...topUp.FundingProfiles,
      { Id: 0, Source: founding.SourceOrg, Agreement: founding.AgreementCode, Amount: 4_000_000, Percentage: 0, IsDeleted: false },
    ];
    const saved = await post(page, '/api/Lumpsum/UpdateLumpSum', topUp);
    expect(saved.status, `a real top-up is accepted: ${JSON.stringify(saved.body).slice(0, 250)}`).toBe(200);

    const after = await post(page, '/api/Lumpsum/LumpSumDetails', { LumpSumId: owner.lumpSumId });
    expect(Number(after.body.LumpSumProject.OriginalAllocation), 'the allocation doubled').toBe(8_000_000);
    const live = after.body.FundingProfiles.filter((f: any) => !f.IsDeleted);
    expect(live.length, 'two lines now').toBe(2);
    for (const line of live) {
      expect(Number(line.Percentage), `${line.Amount} of 8,000,000 is half`).toBeCloseTo(50, 4);
    }
    await expectAllocationInvariant(page, owner.lumpSumId, 'after a server-derived top-up');
  });

  /*  THE GAA-R HALF OF THE RULE. The Project module gates on Approved at ANY
      stage; the maintainer chose GAA-R only for this module. A program Approved
      at GAA (no "-R") must therefore gate nothing — this is the test that keeps
      someone from "simplifying" the predicate to Status alone. It asserts on
      CREATE, since that is one of the two actions the rule still reaches. */
  test('a program Approved off the revision stage does not gate', async ({ page }) => {
    await apiLogin(page);

    await withFixtureProgram(page, async ({ program, approve }) => {
      const owner = await provisionLumpSum(page, 5_000_000, `${TAG} gaa approved`, { programPK: program.ProgramPK });
      created.push(owner.lumpSumId);

      await approve();

      const details = await post(page, '/api/Lumpsum/LumpSumDetails', { LumpSumId: owner.lumpSumId });
      expect(String(details.body.LumpSumProject.StageName)).toBe('GAA');
      expect(details.body.ProgramApproval, 'Approved at GAA is not the gated state').toBeNull();

      const stamp = new Date().toISOString().slice(0, 19);
      const another = await post(page, '/api/Lumpsum/CreateLumpSum', {
        ProgramId: program.ProgramPK, CategoryId: 16, SubCategoryId: 1082, OperatingUnit: 'OI46',
        Description: `${TAG} gaa approved create (e2e ${stamp})`, Tier: 2, RegionWide: 1, Agency: 1001, Origin: 13,
        Allocation: 1_000_000, FundingSource: 'GOP', FundingAgreement: 'DPWH-GAA-2025',
      });
      expect(another.status, `create is still accepted: ${JSON.stringify(another.body).slice(0, 200)}`).toBe(200);
      created.push(Number(another.body.LumpSumId));

      // And a detail change: the field guard is GAA-R-only too.
      const changed = await post(page, '/api/Lumpsum/UpdateLumpSum', {
        ...echoUpdate(owner, details.body), Description: `${details.body.LumpSumProject.Description} changed at GAA`,
      });
      expect(changed.status, `a detail change is accepted off the revision stage: ${JSON.stringify(changed.body).slice(0, 200)}`).toBe(200);
    }, { name: APPROVAL_FIXTURE_PROGRAM_GAA, stage: STAGE_GAA });
  });

  test('import deducts from the parent, and overdraw is refused whole', async ({ page }) => {
    await apiLogin(page);

    const before = await lumpSum(page, parent.lumpSumId);
    const remainingBefore = Number(before.Remaining);

    const imported = await importChild(page, parent, 40_000_000, `${TAG}-CHILD`);
    expect(imported.status, JSON.stringify(imported.body)).toBe(200);

    const after = await lumpSum(page, parent.lumpSumId);
    expect(Number(after.Remaining)).toBe(remainingBefore - 40_000_000);
    expect(Number(after.ItemizedTotal)).toBe(Number(before.ItemizedTotal) + 40_000_000);

    // Total = Remaining + Itemized is derived, so it cannot drift.
    expect(Number(after.OriginalAllocation)).toBe(Number(after.Remaining) + Number(after.ItemizedTotal));

    // The deduction reaches the per-year row too, not just the component Total.
    await expectAllocationInvariant(page, parent.lumpSumId, 'after an import deducted');

    /*  Overdraw: refused naming BOTH figures, and the parent is left untouched —
        the whole workbook rolls back together. */
    const overdrawn = await importChild(page, parent, 999_000_000, `${TAG}-OVER`);
    expect(overdrawn.status).toBe(400);
    expect(overdrawn.body.Title).toBe('Insufficient Balance');

    const unchanged = await lumpSum(page, parent.lumpSumId);
    expect(Number(unchanged.Remaining)).toBe(Number(after.Remaining));
  });

  test('a workbook that fails validation is refused row by row, with an error workbook, and writes nothing', async ({ page }) => {
    await apiLogin(page);

    const before = await lumpSum(page, parent.lumpSumId);
    const childrenBefore = Number(before.ItemizedCount);

    /*  One bad cell — a Tier that is not in tOptionProjectTier — and the whole
        workbook is turned away with ImportingHelper's own wording, the same
        rule the Program import applies. */
    const rejected = await importChild(page, parent, 1_000_000, `${TAG}-BADTIER`, {
      projectDetails: { '*Tier': 'Tier 9' },
    });
    expect(rejected.status, JSON.stringify(rejected.body)).toBe(400);
    expect(rejected.body.Title).toBe('Import Rejected');
    expect(Array.isArray(rejected.body.Errors)).toBe(true);
    expect(rejected.body.Errors.join('\n')).toContain('Incorrect Tier');

    /*  The annotated workbook is served by the Importing module's own download
        endpoint, and it is a workbook, not an error page. */
    expect(String(rejected.body.ErrorFileName)).toMatch(/^LumpSumImportErrors_.*\.xlsm$/);
    const download = await page.request.get(
      `${API_URL}/api/Importing/DownloadImportFile?fileName=${encodeURIComponent(rejected.body.ErrorFileName)}`,
    );
    expect(download.status()).toBe(200);
    expect((await download.body()).length).toBeGreaterThan(1000);

    /*  Nothing written: same child count, same Remaining. */
    const after = await lumpSum(page, parent.lumpSumId);
    expect(Number(after.ItemizedCount)).toBe(childrenBefore);
    expect(Number(after.Remaining)).toBe(Number(before.Remaining));

    /*  The file gates are the server's, not the browser's: a workbook missing
        a sheet is refused by name before any row is read. */
    const workbook = await buildImportWorkbook(page, [{
      placeholderId: `${TAG}-NOSHEET`,
      description: `${TAG}-NOSHEET`,
      cost: 1_000_000,
      activityYear: importActivityYear(parent),
    }]);
    const missingSheet = await postImportWorkbook(page, parent, withoutSheet(workbook, 'FUNDING PROFILE'));
    expect(missingSheet.status).toBe(400);
    expect(missingSheet.body.Title).toBe('Missing Sheets');
    expect(String(missingSheet.body.Message)).toContain('FUNDING PROFILE');
  });

  test('deleting a child RESTORES its cost to the parent', async ({ page }) => {
    await apiLogin(page);

    const children = await post(page, '/api/Lumpsum/ShowItemizedProjects', {
      Filters: { LumpSumId: parent.lumpSumId }, Navigation: 0, PageSize: 50,
    });
    expect(children.status).toBe(200);

    const child = (children.body.lists as any[])[0];
    expect(child, 'the imported child should be listed').toBeTruthy();

    /*  ONLY THE PARENT ENDS IN 'LS'. A child is an ordinary project with a
        geographic ID, so its trailing segment is its Region's IslandCode. */
    expect(String(child.ProjectPK)).toMatch(new RegExp(`${IMPORT_REGION_ISLAND_CODE}$`));
    expect(String(child.ProjectPK)).not.toMatch(/LS$/);

    /*  A CHILD'S ALTERNATE ID IS ITS PARENT'S PROJECT ID (business rule,
        2026-09-05) — not the workbook's placeholder, which only tied the four
        sheets together during validation. */
    expect(String(child.AlternateId)).toBe(String(parent.projectId));

    const before = await lumpSum(page, parent.lumpSumId);
    const cost = Number(child.ComponentCostTotal);

    const deleted = await post(page, '/api/Lumpsum/DeleteItemizedProject', { ProjectId: child.ProjectPK });
    expect(deleted.status).toBe(200);

    /*  The inverse of the deduction — "the total Allocation of the deleted
        itemized Projects shall be added to the LS allocation". */
    const after = await lumpSum(page, parent.lumpSumId);
    expect(Number(after.Remaining)).toBe(Number(before.Remaining) + cost);
    expect(Number(after.OriginalAllocation)).toBe(Number(after.Remaining) + Number(after.ItemizedTotal));

    // The restore reaches the per-year row too.
    await expectAllocationInvariant(page, parent.lumpSumId, 'after a child delete restored');
  });

  test('activity emits no revision events, and the gate reports available', async ({ page }) => {
    await apiLogin(page);

    const activity = await post(page, '/api/Lumpsum/ShowLumpSumActivity', { LumpSumId: parent.lumpSumId });
    expect(activity.status).toBe(200);

    /*  WF-6 left the module: the reference unioned revision events in from
        tLSWalletProjectRevisions, which does not exist here. */
    const kinds = (activity.body.Events as any[]).map((e) => String(e.Kind));
    expect(kinds.some((k) => k.startsWith('Revision'))).toBe(false);

    const gate = await post(page, '/api/Lumpsum/ValidateForItemization', { LumpSumId: parent.lumpSumId });
    expect(gate.status).toBe(200);
    expect(gate.body.Valid).toBe(true);
  });

  test('the removed actions are gone, not merely hidden', async ({ page }) => {
    await apiLogin(page);

    /*  Decisions 7, 8, 11 and 12. These are not flagged-off endpoints — the
        methods do not exist, so the route does not resolve. */
    for (const action of [
      'ItemizeProject', 'ShowItemizableProjects',      // Mode 2 — decision 11
      'ScheduleItemizedProjects', 'UpdateDrawAmount',  // decision 12
      'PublishItemizedProject',                        // decision 8
      'SubmitWalletRevision', 'ApproveWalletRevision', // decision 7
    ]) {
      const res = await post(page, `/api/Lumpsum/${action}`, {});
      expect(res.status, `${action} should not route`).toBe(405);
    }
  });

  test('UACS: set on create lands on the per-year row and the view; absent keeps; empty clears; too long is refused', async ({ page }) => {
    /*  2026-09-06: the details form is the single writer of UACS, and the server
        fans dto.Uacs across every per-year row. There is no project-level column,
        so BOTH reads are asserted each time — the row (storage) and
        LumpSumProject.UACS (vLumpSumSet's TOP 1 over the rows). */
    await apiLogin(page);
    const code = `LS-CONTRACT-${Date.now().toString().slice(-8)}`;

    const made = await post(page, '/api/Lumpsum/CreateLumpSum', {
      ProgramId: parent.programPK,
      CategoryId: 16, SubCategoryId: 1082, OperatingUnit: 'OI46',
      RegionWide: 1, Agency: 1001, Origin: 13,
      Description: `${TAG} uacs (e2e ${new Date().toISOString().slice(0, 19)})`,
      Uacs: `  ${code}  `,   // trimmed by the server
      Allocation: 1_000_000, FundingSource: 'GOP', FundingAgreement: 'DPWH-GAA-2025',
    });
    expect(made.status, `create: ${JSON.stringify(made.body)}`).toBe(200);
    const id: number = made.body.LumpSumId;
    created.push(id);
    const ref: ProvisionedLumpSum = { ...parent, lumpSumId: id, projectId: made.body.LumpSumProject.ProjectId };

    const both = async () => {
      const d = await post(page, '/api/Lumpsum/LumpSumDetails', { LumpSumId: id });
      return { row: d.body.ComponentCostPerYear[0].UACS ?? null, view: d.body.LumpSumProject.UACS ?? null, body: d.body };
    };

    // SET on create: the create payload carries no per-year rows, so dto.Uacs
    // is the only way the code reaches the derived row.
    let r = await both();
    expect(r.row, 'stored on the derived per-year row, trimmed').toBe(code);
    expect(r.view, 'and read back through the view').toBe(code);

    // ABSENT on update: keep. (echoUpdate never sets Uacs unless told to.)
    const kept = await post(page, '/api/Lumpsum/UpdateLumpSum', echoUpdate(ref, r.body));
    expect(kept.status, `update without Uacs: ${JSON.stringify(kept.body)}`).toBe(200);
    r = await both();
    expect(r.row, 'absent keeps the row').toBe(code);
    expect(r.view, 'absent keeps the view').toBe(code);

    // TOO LONG: model validation on [MaxLength(50)] refuses before the controller
    // runs — the generic shape, not the module's, and no second check is wanted.
    const long = await post(page, '/api/Lumpsum/UpdateLumpSum', echoUpdate(ref, r.body, { Uacs: 'X'.repeat(51) }));
    expect(long.status).toBe(400);
    r = await both();
    expect(r.row, 'a refused save changes nothing').toBe(code);

    // EMPTY on update: clear, on the row and therefore in the view.
    const cleared = await post(page, '/api/Lumpsum/UpdateLumpSum', echoUpdate(ref, r.body, { Uacs: '' }));
    expect(cleared.status, `update with Uacs "": ${JSON.stringify(cleared.body)}`).toBe(200);
    r = await both();
    expect(r.row, 'empty clears the row').toBeNull();
    expect(r.view, 'and the view').toBeNull();
  });

  test('a warned row is imported and reported; a failed row still refuses the workbook', async ({ page }) => {
    /*  WARN IS IMPORTED AGAIN (2026-09-06), reversing V3's promotion. Four
        properties, and each one is a different way to get this wrong:

          a. a value that could not be READ warns and is stored NULL (Rank);
          b. a value that could be read but is WRONG warns and is stored as typed
             (an end date before its start);
          c. a Fail is still a Fail — the workbook is refused whole;
          d. a warned row travelling with a failed one is refused with it, because
             the structural cascade and the workbook-level HasErrors still apply.

        Written against a parent of its own: these imports draw the allocation
        down, and the shared fixture parent is the concurrency test's subject. */
    await apiLogin(page);
    const owner = await provisionLumpSum(page, 20_000_000, `${TAG} warn`);
    created.push(owner.lumpSumId);

    const childOf = async (label: string) => {
      const kids = await post(page, '/api/Lumpsum/ShowItemizedProjects', {
        Filters: { LumpSumId: owner.lumpSumId }, Navigation: 0, PageSize: 100,
      });
      return ((kids.body?.lists ?? []) as any[]).find((c) => String(c.Description).includes(label));
    };

    // (a) CLASS A — unreadable, dropped to NULL.
    const rankLabel = `${TAG}-warn-rank-${Date.now().toString().slice(-6)}`;
    const warned = await importChild(page, owner, 1_000_000, rankLabel, {
      projectDetails: { Rank: 'abc' },
    });
    expect(warned.status, `a warned row must import: ${JSON.stringify(warned.body).slice(0, 300)}`).toBe(200);
    expect(Number(warned.body.Count), 'the project was created').toBe(1);
    expect(Number(warned.body.WarningCount), 'and reported once').toBe(1);
    expect(String((warned.body.Warnings ?? []).join('\n'))).toContain('Incorrect Rank');
    expect(String((warned.body.Warnings ?? []).join('\n'))).toContain('PROJECT DETAILS');
    expect(String(warned.body.Message)).toContain('imported with warnings');

    /*  THE REPORT IS THE DURABLE HALF. Warnings[] is shown once; this file is what
        answers the same question next week, so it must exist and name the row. */
    const reportName = String(warned.body.ReportFileName ?? '');
    expect(reportName, 'a warning report was written').toMatch(/^LumpSumImportWarnings_.*\.txt$/);
    const report = await page.request.get(
      `${API_URL}/api/Importing/DownloadImportFile?fileName=${encodeURIComponent(reportName)}`,
    );
    expect(report.status(), 'and is served by the Importing module').toBe(200);
    const reportText = await report.text();
    expect(reportText).toContain('--- WARNING: PROJECT DETAILS ---');
    expect(reportText).toContain('Incorrect Rank');

    const rankChild = await childOf(rankLabel);
    expect(rankChild, 'the warned child exists').toBeTruthy();
    expect(rankChild.Rank ?? null, 'an unreadable Rank is stored blank, not "abc"').toBeNull();

    /*  The report names the project the row BECAME, not the workbook placeholder.
        The placeholder is discarded at import (a child's AlternateId is its
        parent's Project ID), so a report naming it would not lead anyone to the
        project they have to correct. */
    expect(reportText, 'the report names the created project').toContain(String(rankChild.ProjectId));
    expect(reportText, 'and not the placeholder it was').not.toContain(rankLabel);

    // (b) CLASS B — readable but wrong, stored as typed.
    const dateLabel = `${TAG}-warn-dates-${Date.now().toString().slice(-6)}`;
    const year = importActivityYear(owner);
    const badDates = await importChild(page, owner, 1_000_000, dateLabel, {
      componentDetails: { plannedStart: `${year}-12-31`, plannedEnd: `${year}-01-01` },
    });
    expect(badDates.status, `end-before-start must import: ${JSON.stringify(badDates.body).slice(0, 300)}`).toBe(200);
    expect(String((badDates.body.Warnings ?? []).join('\n')))
      .toContain('Planned End Date cannot be earlier than Planned Start Date');
    expect(String((badDates.body.Warnings ?? []).join('\n'))).toContain('COMPONENT DETAILS');

    // (c) A FAIL IS STILL A FAIL, and still produces the annotated workbook.
    const refused = await importChild(page, owner, 1_000_000, `${TAG}-warn-badtier`, {
      projectDetails: { '*Tier': 'Tier 9' },
    });
    expect(refused.status).toBe(400);
    expect(refused.body.Title).toBe('Import Rejected');
    expect(String((refused.body.Errors ?? []).join('\n'))).toContain('Incorrect Tier');
    expect(refused.body.ErrorFileName, 'the annotated workbook is still written').toBeTruthy();
    expect(refused.body.Warnings ?? null, 'a refusal carries no warnings section').toBeFalsy();

    /*  (d) A WARNED PROJECT BESIDE A FAILED ONE — PER-PROJECT ATOMICITY (2026-09-06).
        The failed project is refused and reported with its error workbook; the
        warned one is imported and reported with the warning report; both travel in
        ONE 200 body, the Program importer's shape. The parent is drawn down by the
        accepted project only. This replaces V2's "the whole import succeeds or fails
        together", which held every good project hostage to one bad cell. */
    const beforeMixed = await lumpSum(page, owner.lumpSumId);
    const mixedLabel = `${TAG}-warn-mixed-${Date.now().toString().slice(-6)}`;
    const mixed = await postImportWorkbook(page, owner, await buildImportWorkbook(page, [
      { placeholderId: `${mixedLabel}-A`, description: `${mixedLabel}-A`, cost: 1_000_000, activityYear: year, projectDetails: { Rank: 'abc' } },
      { placeholderId: `${mixedLabel}-B`, description: `${mixedLabel}-B`, cost: 1_000_000, activityYear: year, projectDetails: { '*Tier': 'Tier 9' } },
    ]));
    expect(mixed.status, `a mixed workbook is imported in part: ${JSON.stringify(mixed.body).slice(0, 300)}`).toBe(200);
    expect(mixed.body.Title).toBe('Imported with Exceptions');
    expect(Number(mixed.body.Count), 'the warned project went in').toBe(1);
    expect(Number(mixed.body.RefusedCount), 'the failed project was left out').toBe(1);
    expect(String((mixed.body.Errors ?? []).join('\n'))).toContain('Incorrect Tier');
    expect(String((mixed.body.Errors ?? []).join('\n'))).toContain(`${mixedLabel}-B`);
    expect(String((mixed.body.Errors ?? []).join('\n')), 'the accepted project is not in the error list').not.toContain(`${mixedLabel}-A:`);
    expect(mixed.body.ErrorFileName, 'the refused project has its annotated workbook').toMatch(/^LumpSumImportErrors_.*\.xlsm$/);
    expect(String((mixed.body.Warnings ?? []).join('\n'))).toContain('Incorrect Rank');
    expect(mixed.body.ReportFileName, 'and the warned one its report').toMatch(/^LumpSumImportWarnings_.*\.txt$/);
    expect(String(mixed.body.Message)).toContain('1 project(s) refused');

    const afterMixed = await lumpSum(page, owner.lumpSumId);
    expect(Number(afterMixed.Remaining), 'drawn down by the accepted project only')
      .toBe(Number(beforeMixed.Remaining) - 1_000_000);
    expect(Number(afterMixed.ItemizedCount)).toBe(Number(beforeMixed.ItemizedCount) + 1);
    expect(await childOf(`${mixedLabel}-A`), 'the warned project exists').toBeTruthy();
    expect(await childOf(`${mixedLabel}-B`), 'the failed one does not').toBeFalsy();

    // (e) When NOTHING passes, the old answer stands: 400, nothing written.
    const beforeAllBad = await lumpSum(page, owner.lumpSumId);
    const allBad = await importChild(page, owner, 1_000_000, `${TAG}-warn-allbad`, {
      projectDetails: { '*Tier': 'Tier 9' },
    });
    expect(allBad.status, 'a workbook with no acceptable project is refused whole').toBe(400);
    expect(allBad.body.Title).toBe('Import Rejected');
    const afterAllBad = await lumpSum(page, owner.lumpSumId);
    expect(Number(afterAllBad.Remaining)).toBe(Number(beforeAllBad.Remaining));
  });

  /*  THE ITEMIZED FREEZE IS A FRONTEND RULE, BY DECISION (2026-09-06). Once a
      Lump Sum Project has a child, the details page renders its details, funding
      and component read-only and disables Save; deleting the last child makes
      them editable again. UpdateLumpSum is deliberately unchanged, so there is no
      contract case to write here — this note exists so that a later reader does
      not add one and conclude the server is broken when it accepts the save. The
      page behaviour is covered where it lives, in ls-module-ui-walkthrough. */

  test('every funding line is deletable, including the last, and Replenish puts one back', async ({ page }) => {
    /*  2026-09-07, on the maintainer's instruction. The table went read-only on
        2026-09-06 with Delete kept, so a line recorded against the wrong source
        could only be REMOVED, never retyped — but the update path refused a
        payload leaving no live line ("Funding Profile Required"), and
        CreateLumpSum writes exactly one. The ordinary single-line project was
        therefore stuck with a wrong line for good. Zero lines is now legitimate:
        the allocation derives from the lines, so it becomes 0, and Replenish
        restores it. */
    await apiLogin(page);
    const owner = await provisionLumpSum(page, 4_000_000, `${TAG} last line`);
    created.push(owner.lumpSumId);

    const before = await post(page, '/api/Lumpsum/LumpSumDetails', { LumpSumId: owner.lumpSumId });
    expect(before.body.FundingProfiles.filter((f: any) => !f.IsDeleted).length, 'create writes exactly one line').toBe(1);
    const only = before.body.FundingProfiles[0];

    // Delete the ONLY line. Costs omitted: the server derives them from the funding.
    const emptied = await post(page, '/api/Lumpsum/UpdateLumpSum',
      echoUpdate(owner, before.body, {
        FundingProfiles: [{ Id: only.Id, Source: only.SourceOrg, Agreement: only.AgreementCode, Amount: only.Amount, Percentage: only.Percentage, IsDeleted: true }],
      }));
    expect(emptied.status, `deleting the last line: ${JSON.stringify(emptied.body).slice(0, 200)}`).toBe(200);

    const empty = await post(page, '/api/Lumpsum/LumpSumDetails', { LumpSumId: owner.lumpSumId });
    expect(empty.body.FundingProfiles.filter((f: any) => !f.IsDeleted).length, 'no live line remains').toBe(0);
    expect(Number(empty.body.LumpSumProject.OriginalAllocation), 'the allocation derives to zero').toBe(0);
    expect(Number(empty.body.LumpSumProject.Remaining), 'and so does the balance').toBe(0);
    // The project is still a Lump Sum Project: it keeps its LS component and its place in the list.
    const listed = await post(page, '/api/Lumpsum/ShowLumpSum', { Filters: {}, limit: 200, page: 1, sortDirection: 0 });
    expect((listed.body?.lists ?? []).some((r: any) => r.Id === owner.lumpSumId), 'still listed with no funding').toBe(true);

    /*  Replenish restores it — and must be TOLD the source, there being no line
        left to copy one from (the codes are the ones create used). */
    const restored = await post(page, '/api/Lumpsum/ReplenishLumpSum', {
      LumpSumId: owner.lumpSumId, NewAmount: 4_000_000,
      Source: only.SourceOrg, Agreement: only.AgreementCode,
    });
    expect(restored.status, `replenish onto an empty profile: ${JSON.stringify(restored.body).slice(0, 200)}`).toBe(200);

    /*  "FIRST" MEANS THE EARLIEST LIVE LINE (2026-09-08). The line CreateLumpSum
        wrote is soft-deleted above; the restored line is now the earliest survivor,
        so a blank replenish copies IT — a literal "the CreateLumpSum row" would
        have found a deleted line. The codes happen to match `only`'s, so this
        asserts against the live line by Id rather than against `only`. The
        invariant helper returns the details body it read, so it is not fetched twice. */
    const afterRestore = await expectAllocationInvariant(page, owner.lumpSumId, 'after restoring the funding');
    const survivor = firstLine(afterRestore.FundingProfiles);
    expect(Number(survivor.Id), 'the surviving first line is the restored one, not the deleted original').toBeGreaterThan(Number(only.Id));
    const blankAfter = await post(page, '/api/Lumpsum/ReplenishLumpSum', {
      LumpSumId: owner.lumpSumId, NewAmount: 5_000_000,
    });
    expect(blankAfter.status, `blank replenish after the first line was deleted: ${JSON.stringify(blankAfter.body).slice(0, 200)}`).toBe(200);
    expect(String(blankAfter.body.FundingLine?.Source)).toBe(String(survivor.SourceOrg));
    expect(String(blankAfter.body.FundingLine?.Agreement)).toBe(String(survivor.AgreementCode));
    await expectAllocationInvariant(page, owner.lumpSumId, 'after a blank replenish on the surviving line');

    /*  BUT a parent its children draw from cannot be emptied: "Below Committed
        Draw" is what the removed guard is NOT needed for. */
    const withChild = await provisionLumpSum(page, 3_000_000, `${TAG} last line child`);
    created.push(withChild.lumpSumId);
    const imported = await importChild(page, withChild, 1_000_000, `${TAG} draws on it`);
    expect(imported.status, JSON.stringify(imported.body).slice(0, 200)).toBe(200);

    const parentNow = await post(page, '/api/Lumpsum/LumpSumDetails', { LumpSumId: withChild.lumpSumId });
    const live = parentNow.body.FundingProfiles.filter((f: any) => !f.IsDeleted);
    const refused = await post(page, '/api/Lumpsum/UpdateLumpSum',
      echoUpdate(withChild, parentNow.body, {
        FundingProfiles: live.map((f: any) => ({ Id: f.Id, Source: f.SourceOrg, Agreement: f.AgreementCode, Amount: f.Amount, Percentage: f.Percentage, IsDeleted: true })),
      }));
    expect(refused.status, 'emptying a parent with children is refused').toBe(400);
    expect(refused.body.Title).toBe('Below Committed Draw');
    await expectAllocationInvariant(page, withChild.lumpSumId, 'after the refused emptying');
  });

  test('ShowLumpSum pages by cursor: Next walks, Page returns, and a bare page number does not', async ({ page }) => {
    /*  THE LIST'S PAGING LIVES ON THIS CONTRACT (2026-09-10). The frontend used
        to send a bare `page: N`, which this endpoint answers as First — the same
        top rows, with page 1 echoed — so the grid could never leave page 1. The
        fix was frontend-only, which is exactly why the server half is pinned
        here: if paging breaks again, this says which layer moved.

        limit: 1 keeps it cheap — two projects is a two-page list. */
    await apiLogin(page);

    const ask = (body: Record<string, unknown>) =>
      post(page, '/api/Lumpsum/ShowLumpSum', { Filters: {}, limit: 1, sortDirection: 0, ...body });

    let first = await ask({ page: 1, Navigation: 0 });
    expect(first.status, JSON.stringify(first.body).slice(0, 200)).toBe(200);
    // Two rows have to exist; provision the shortfall rather than assume the machine has them.
    for (let i = Number(first.body?.total ?? 0); i < 2; i += 1) {
      created.push((await provisionLumpSum(page, 1_000_000, `${TAG} pager ${i + 1}`)).lumpSumId);
    }
    first = await ask({ page: 1, Navigation: 0 });

    const firstId = Number(first.body.lists[0].Id);
    expect(first.body.page, 'page 1 is page 1').toBe(1);
    expect(first.body.HasNext, 'and it says another page follows').toBe(true);
    expect(first.body.NextFilteredId, 'and hands back the cursor to reach it').toBeTruthy();

    // NEXT walks from that cursor to a different row.
    const second = await ask({ page: 2, Navigation: 2, NextFilteredId: first.body.NextFilteredId });
    expect(second.status, JSON.stringify(second.body).slice(0, 200)).toBe(200);
    expect(second.body.page, 'the server counts the page it walked to').toBe(2);
    expect(Number(second.body.lists[0].Id), 'and it is a different project').not.toBe(firstId);
    expect(second.body.HasPrevious, 'with a way back').toBe(true);

    // PAGE returns to a page already visited, by its own first-row cursor.
    const back = await ask({ page: 1, Navigation: 4, PageCursorId: first.body.PageCursorId });
    expect(back.status, JSON.stringify(back.body).slice(0, 200)).toBe(200);
    expect(Number(back.body.lists[0].Id), 'the same row page 1 opened with').toBe(firstId);

    /*  And the shape the broken frontend sent: a page number with no cursor is
        NOT an error — it is silently answered as page 1, which is what made the
        defect so quiet. */
    const bare = await ask({ page: 2 });
    expect(bare.status).toBe(200);
    expect(bare.body.page, 'a bare page number is answered as page 1').toBe(1);
    expect(Number(bare.body.lists[0].Id), 'with page 1 rows').toBe(firstId);

    // Asking to walk without the cursor is refused by name.
    const noCursor = await ask({ page: 2, Navigation: 2 });
    expect(noCursor.status, JSON.stringify(noCursor.body).slice(0, 200)).toBe(400);
    expect(String(noCursor.body?.Message ?? '')).toContain('NextFilteredId');
  });

  test('a parent is locked while it is itemized: a racing replenish is serialized or told Busy, never half-applied', async ({ page }) => {
    /*  THE LOCK (2026-09-06). Every parent mutator takes one sp_getapplock per
        parent inside its transaction; the import takes it before reading the
        parent. So an import and a replenish fired together either serialize
        (both 200) or the loser waits 5 s and gets 409 Busy. What may never happen
        is a 500, a child created without its deduction, or a top-up lost.

        REPLENISH is the racing partner, not a form save, because both operations
        are pure server-side arithmetic on the same LS component row — the import
        deducts, the replenish adds — which is exactly the read-modify-write the
        lock exists to serialize. (A form save is not usable here for a different
        reason: it must echo the LS component's Total, and a Total read before the
        import landed would write the pre-import figure back. That is a
        pre-existing lost-update hazard of the merge, in the payload rather than
        the server, which the lock cannot close; recorded in lump-sum-v2.md.) */
    await apiLogin(page);

    const start = await post(page, '/api/Lumpsum/LumpSumDetails', { LumpSumId: parent.lumpSumId });
    const original = Number(start.body.LumpSumProject.OriginalAllocation);
    const childrenBefore = Number(start.body.LumpSumProject.ItemizedCount ?? 0);
    const cost = 1_000_000;
    const topUp = 500_000;
    let imported = 0;
    let replenished = 0;

    for (let round = 0; round < 5; round += 1) {
      const snapshot = await post(page, '/api/Lumpsum/LumpSumDetails', { LumpSumId: parent.lumpSumId });
      const nowOriginal = Number(snapshot.body.LumpSumProject.OriginalAllocation);
      const [imp, rep] = await Promise.all([
        importChild(page, parent, cost, `${TAG}-race-${round}-${Date.now().toString().slice(-6)}`),
        post(page, '/api/Lumpsum/ReplenishLumpSum', {
          LumpSumId: parent.lumpSumId, NewAmount: nowOriginal + topUp, Source: 'GOP', Agreement: 'DPWH-GAA-2025',
        }),
      ]);

      for (const [name, res] of [['import', imp], ['replenish', rep]] as const) {
        expect([200, 409], `${name} round ${round}: ${res.status} ${JSON.stringify(res.body).slice(0, 300)}`).toContain(res.status);
        if (res.status === 409) expect(res.body.Title).toBe('Busy');
      }
      if (imp.status === 200) imported += 1;
      if (rep.status === 200) replenished += 1;
    }

    const end = await post(page, '/api/Lumpsum/LumpSumDetails', { LumpSumId: parent.lumpSumId });
    const ls = end.body.LumpSumProject;
    expect(Number(ls.ItemizedCount), 'every 200 import produced exactly one child').toBe(childrenBefore + imported);
    expect(Number(ls.OriginalAllocation), 'every 200 replenish raised the allocation by its top-up, and nothing else moved it').toBe(original + replenished * topUp);
    expect(Number(ls.ItemizedTotal) - Number(start.body.LumpSumProject.ItemizedTotal), 'each child drew its cost').toBe(imported * cost);
    expect(Number(ls.Remaining) + Number(ls.ItemizedTotal), 'Remaining and Itemized still add up').toBe(Number(ls.OriginalAllocation));
  });

  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage();
    await apiLogin(page);

    /*  Sweep whatever this run made. Deletions go through the module's own
        endpoints so its rules still apply — children first, since a parent with
        live children is blocked. */
    for (const id of created) {
      const children = await post(page, '/api/Lumpsum/ShowItemizedProjects', {
        Filters: { LumpSumId: id }, Navigation: 0, PageSize: 100,
      });
      for (const child of (children.body?.lists ?? []) as any[]) {
        await post(page, '/api/Lumpsum/DeleteItemizedProject', { ProjectId: child.ProjectPK });
      }
      await post(page, '/api/Lumpsum/DeleteLumpSum', { LumpSumId: id });
    }
    await page.close();
  });
});
