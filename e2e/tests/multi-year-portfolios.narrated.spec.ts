// =============================================================================
// multi-year-portfolios.narrated.spec.ts — the Multi-Year module, Phase 1
// (documents/plans/multi-year-phase-1-portfolio-module.md) and Phase 2
// (documents/plans/multi-year-phase-2-annual-program-linking.md), through the UI.
//
// Phase 2 also needs the RBP-stage program "E2E RBP <term start> Region III"
// (Data Security OI237, Working) and the PIP of the same term; both are made
// through the API when missing. Each run adds one planning project, proposes
// it into that RBP (a BP project lands in the program) and adds it to PIP.
// PORTFOLIOS ARE NEVER DELETED (MY-PFL-07), and neither are planning projects:
// a wrong one is cancelled. So this spec REUSES one far-future fixture term,
// RDIP of region OI237 from 2089 (opened once, through the API, when missing),
// and CANCELS the planning project it adds, which locks it. Each run leaves
// one cancelled project in that term. LOCAL DATABASE ONLY.
//
// Users (local myps_db_dev): E2E_MY_ADMIN (default almadronesat, AUC: sees every
// portfolio) and E2E_MY_OTHER_REGION (default asisjnt, DPC in region OI238:
// must not see the OI237 RDIP).
//
// Run with a config WITHOUT the repo's Lump Sum globalTeardown (it deletes data).
// =============================================================================

import { expect, test, type Page } from '@playwright/test';
import { login } from './helpers/auth';
import { narrator } from './helpers/narrate';

const ADMIN = process.env.E2E_MY_ADMIN ?? 'almadronesat';
const OTHER_REGION = process.env.E2E_MY_OTHER_REGION ?? 'asisjnt';
const PASSWORD = process.env.E2E_PASSWORD ?? 'x';
const FIXTURE_REGION = 'OI237';
const FIXTURE_FIRST_TERM = 2089;

type Portfolio = { Id: number; TermStartYear: number; Status: number; OwnerName: string; Term: string };

/** The fixture's open RDIP term, created when the database has none. */
async function fixtureTerm(page: Page): Promise<Portfolio> {
  const list = async () => {
    const response = await page.request.post('/api/MultiYear/ShowPortfolios', { data: { Kind: 1, OwnerParticipantId: FIXTURE_REGION } });
    expect(response.status()).toBe(200);
    return (await response.json()) as Portfolio[];
  };
  let open = (await list()).find((p) => p.Status === 1 && p.TermStartYear >= FIXTURE_FIRST_TERM);
  if (!open) {
    const created = await page.request.post('/api/MultiYear/CreatePortfolio', {
      data: { Kind: 1, OwnerParticipantId: FIXTURE_REGION, TermStartYear: FIXTURE_FIRST_TERM },
    });
    expect(created.status(), await created.text()).toBe(200);
    open = (await list()).find((p) => p.Status === 1 && p.TermStartYear >= FIXTURE_FIRST_TERM);
  }
  return open!;
}

test('an AUC user adds a planning project to an RDIP term and cancels it', async ({ page }) => {
  const n = narrator(page, { total: 9 });
  await login(page, ADMIN, PASSWORD);
  const term = await fixtureTerm(page);

  await page.getByText('Multi-Year', { exact: true }).click();
  await page.getByRole('link', { name: 'Portfolios' }).click();
  await expect(page).toHaveURL(/\/multi-year\/portfolios$/);
  await expect(page.getByRole('heading', { name: 'Multi-Year Portfolios' })).toBeVisible();
  await n.check('The Multi-Year sidebar menu opens the Portfolios list');

  await page.getByLabel('Portfolio').selectOption('1');
  await page.getByLabel('Owner').selectOption(FIXTURE_REGION);
  await page.getByRole('row', { name: new RegExp(term.Term) }).getByRole('link', { name: 'RDIP' }).click();
  await expect(page.getByRole('heading', { name: new RegExp(`RDIP .*${term.Term}`) })).toBeVisible();
  await n.check(`The list filters to RDIP ${term.OwnerName} and opens ${term.Term}`);

  await page.getByRole('button', { name: 'Add Planning Project' }).click();
  await expect(page.getByRole('heading', { name: 'Add Planning Project' })).toBeVisible();
  const description = `E2E narrated planning road ${Date.now()}`;
  await page.getByLabel(/^Description/).fill(description);
  await page.getByText('Select a Category', { exact: true }).click();
  await page.getByPlaceholder('Search...').fill('Foreign Assisted');
  await page.getByText('Foreign Assisted Projects', { exact: true }).click();
  await page.getByLabel('Horizon').selectOption({ label: 'Short term (3 years)' });
  await expect(page.getByLabel('Start Year')).toHaveValue(String(term.TermStartYear));
  await page.getByLabel('Infrastructure Type').selectOption('R');
  await page.getByLabel('Dominant Type of Work').selectOption({ label: 'Construction of Asphalt Road' });
  await page.getByLabel('Physical Target (Lane Km)').fill('2.5');
  await page.getByLabel('Planned cost for year 1').fill('100');
  await page.getByRole('button', { name: 'Add Year' }).click();
  await page.getByLabel('Year 2', { exact: true }).fill(String(term.TermStartYear + 3));
  await page.getByLabel('Planned cost for year 2').fill('0');
  await page.getByRole('button', { name: 'Add Planning Project' }).click();
  await expect(page.getByText(`The planned cost for ${term.TermStartYear + 3} must be more than zero.`)).toBeVisible();
  await n.check('A zero planned cost is refused before anything is sent');

  await page.getByLabel('Planned cost for year 2').fill('10');
  await page.getByRole('button', { name: 'Add Planning Project' }).click();
  await expect(page).toHaveURL(/\/multi-year\/projects\/MY\d{8}LZ$/);
  const projectId = page.url().split('/').pop()!;
  await n.check(`Saved with an MY Project ID: ${projectId}`);

  await expect(page.getByText(/beyond the Short term horizon/)).toBeVisible();
  await n.check('A year past the horizon saves, with a warning');

  await expect(page.getByRole('heading', { name: new RegExp(description) })).toBeVisible();
  const yearly = page.locator('table', { hasText: 'Year is' });
  await expect(yearly.getByText('Planned')).toHaveCount(2);
  await n.check('Its yearly costs show every year as Planned');

  const card = page.locator('div.border', { hasText: term.Term }).filter({ has: page.getByRole('button', { name: 'Set Status' }) });
  await expect(card.getByText('New', { exact: true })).toBeVisible();
  await card.getByRole('button', { name: 'Set Status' }).click();
  await expect(page.getByText(`Set Status — ${projectId}`)).toBeVisible();
  await page.getByLabel('New status').selectOption({ label: 'Cancelled' });
  await page.getByLabel('Reason').fill('E2E narrated run: cancelled so the fixture term stays tidy.');
  await page.getByRole('button', { name: 'Set Cancelled' }).click();
  await expect(page.getByText(/Set to Cancelled in RDIP/)).toBeVisible();
  await n.check('A coordinator move from New to Cancelled is offered and saved');

  await expect(page.locator('div.border', { hasText: term.Term }).getByText('Cancelled', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Edit Project' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Edit Planning Fields' })).toHaveCount(0);
  await n.check('A cancelled project offers no edit');

  await page.goto('/code-tables');
  // The group tab reads "Multi-Year 5" (its table count); the sidebar's own "Multi-Year" stays out.
  await page.getByRole('button', { name: /^Multi-Year \d+$/ }).click();
  await expect(page.getByRole('heading', { name: 'Basis for Implementation' })).toBeVisible();
  await n.check('Code Tables has a Multi-Year tab for the planning code lists');
});

test("another region's coordinator cannot see or open the RDIP", async ({ page, browser }, testInfo) => {
  const n = narrator(page, { total: 3 });
  // The fixture is looked up as the AUC user in a context of its own, so this page signs in once.
  const adminContext = await browser.newContext({ baseURL: testInfo.project.use.baseURL });
  const adminPage = await adminContext.newPage();
  await login(adminPage, ADMIN, PASSWORD);
  const term = await fixtureTerm(adminPage);
  await adminContext.close();

  await login(page, OTHER_REGION, PASSWORD);
  await page.goto('/multi-year/portfolios');
  await expect(page.getByRole('heading', { name: 'Multi-Year Portfolios' })).toBeVisible();
  await expect(page.getByRole('row', { name: new RegExp(term.Term) })).toHaveCount(0);
  await n.check(`${term.Term} of ${term.OwnerName} is not listed`);

  await expect(page.getByRole('button', { name: 'Create Portfolio' })).toHaveCount(0);
  await n.check('No Create Portfolio for a coordinator');

  await page.goto(`/multi-year/portfolios/${term.Id}`);
  await expect(page.getByText('This portfolio could not be opened.')).toBeVisible();
  await n.check('A deep link to it is refused');
});

const PIP_KIND = 3;
const rbpName = (year: number) => `E2E RBP ${year} Region III`;

/** The term's PIP, opened from the previous PIP term or created when there is none. */
async function fixturePip(page: Page, termStart: number): Promise<Portfolio> {
  const list = async () => {
    const response = await page.request.post('/api/MultiYear/ShowPortfolios', { data: { Kind: PIP_KIND } });
    expect(response.status()).toBe(200);
    return (await response.json()) as Portfolio[];
  };
  let pip = (await list()).find((p) => p.TermStartYear === termStart);
  if (!pip) {
    const previous = (await list()).find((p) => p.TermStartYear === termStart - 6 && p.Status === 1);
    const response = previous
      ? await page.request.post('/api/MultiYear/OpenNextTerm', { data: { PortfolioId: previous.Id } })
      : await page.request.post('/api/MultiYear/CreatePortfolio', { data: { Kind: PIP_KIND, OwnerParticipantId: null, TermStartYear: termStart } });
    expect(response.status(), await response.text()).toBe(200);
    pip = (await list()).find((p) => p.TermStartYear === termStart);
  }
  return pip!;
}

test('an AUC user proposes a planning project into the RBP, adds it to PIP and saves the totals', async ({ page }) => {
  const n = narrator(page, { total: 8 });
  await login(page, ADMIN, PASSWORD);
  const term = await fixtureTerm(page);
  const pip = await fixturePip(page, term.TermStartYear);

  // A located planning project starting with the term (Region III codes of local myps_db_dev).
  const form = await (await page.request.post('/api/MultiYear/InitPlanningProjectForm', { data: { PortfolioId: term.Id } })).json();
  const medium = form.HorizonTypes.find((h: { Years: number | null }) => h.Years === 6).Id;
  const description = `E2E narrated proposal ${Date.now()}`;
  const added = await page.request.post('/api/MultiYear/AddPlanningProject', {
    data: {
      PortfolioId: term.Id, Description: description, Category: 5, Thrust: null, HorizonTypeId: medium,
      StartYear: term.TermStartYear, EndYear: null, Province: '479', City: '485', LegislativeDistrict: '484',
      DEO: 'OI2504', ImplementingOffice: 'OI237', RegionWide: 2,
      Component: { Description: 'Road', InfraTypeFK: 'R', WorkTypeFK: 3, PhysicalTarget: 2 },
      YearlyCosts: [{ Year: term.TermStartYear, Amount: 120 }, { Year: term.TermStartYear + 1, Amount: 60 }],
      Membership: { ReadinessLevelIds: [], RdpOutcomes: [], McaScore: 70 },
    },
  });
  expect(added.status(), await added.text()).toBe(200);
  const { ProjectId: projectId, MemberId: memberId } = await added.json();

  // The RBP of the term's first year, made when the database has none.
  let proposeForm = await (await page.request.post('/api/MultiYear/InitProposeForm', { data: { MemberId: memberId } })).json();
  let rbp = proposeForm.Programs.find((p: { Name: string }) => p.Name === rbpName(term.TermStartYear));
  if (!rbp) {
    const created = await page.request.post('/api/Program/AddProgram', {
      data: { Stage: 8, Status: 3, Type: 1, Name: rbpName(term.TermStartYear), YearStart: term.TermStartYear, DataSecurityGroup: [FIXTURE_REGION], UserGroup: [1, 2, 3, 11] },
    });
    expect(created.status(), await created.text()).toBe(200);
    proposeForm = await (await page.request.post('/api/MultiYear/InitProposeForm', { data: { MemberId: memberId } })).json();
    rbp = proposeForm.Programs.find((p: { Name: string }) => p.Name === rbpName(term.TermStartYear));
  }

  await page.goto(`/multi-year/projects/${projectId}`);
  const card = page.locator('div.border', { hasText: term.Term }).filter({ has: page.getByRole('button', { name: 'Propose to RBP / UBP' }) });
  await card.getByRole('button', { name: 'Propose to RBP / UBP' }).click();
  await expect(page.getByText(`Propose to RBP / UBP — ${projectId}`)).toBeVisible();
  await n.check('A New RDIP project offers Propose to RBP / UBP');

  await page.getByLabel(/^Program/).selectOption(rbp.ProgramPK);
  await page.getByLabel(/^Operating Unit/).selectOption({ index: 1 });
  await page.getByLabel(/^Tier/).selectOption({ index: 1 });
  await page.getByRole('combobox', { name: /^Origin\s*\*?$/ }).selectOption({ index: 1 });
  await page.getByLabel(/^Originating Agency/).selectOption({ index: 1 });
  await page.getByLabel(/^Implementation Mode/).selectOption({ index: 1 });
  await page.getByLabel(/^Emergency Mode/).selectOption({ index: 1 });
  await page.getByLabel(/^ROW Available/).selectOption({ index: 1 });
  await page.getByLabel(/^Feasibility Study/).selectOption({ label: 'No' });
  await page.getByLabel(/^Detailed Design/).selectOption({ label: 'No' });
  await page.getByRole('button', { name: 'Propose', exact: true }).click();
  // The toast; the History line says "Proposed to ..." too, without "with the".
  await expect(page.getByText(new RegExp(`Proposed to ${rbpName(term.TermStartYear)} as BP\\d{8}LZ with the`))).toBeVisible();
  await n.check(`Proposed into ${rbpName(term.TermStartYear)}: a BP project with ${term.TermStartYear}'s planned cost`);

  await expect(page.locator('div.border', { hasText: term.Term }).getByText('Potential', { exact: true })).toBeVisible();
  const annual = page.locator('table', { hasText: 'Project ID' });
  await expect(annual.getByRole('cell', { name: rbpName(term.TermStartYear) })).toBeVisible();
  await n.check('The project is Potential, and Annual Programs lists the RBP entry');

  await page.goto(`/multi-year/portfolios/${pip.Id}`);
  await page.getByRole('button', { name: 'Add Project to PIP' }).click();
  await page.getByPlaceholder('Search by Project ID or description').fill(projectId);
  await page.getByPlaceholder('Search by Project ID or description').press('Enter');
  await page.getByRole('radio', { name: projectId }).check();
  await page.getByLabel(/^MCA Score/).fill('76.5');
  await page.getByRole('button', { name: 'Add to PIP', exact: true }).click();
  await expect(page.getByText(new RegExp(`${projectId} added to PIP`))).toBeVisible();
  await n.check('PPC-style Add to PIP: the Potential project enters PIP with an MCA Score');

  await page.getByPlaceholder('Search Project ID or description...').fill(projectId);
  await page.getByPlaceholder('Search Project ID or description...').press('Enter');
  const pipRow = page.getByRole('row', { name: new RegExp(projectId) });
  await expect(pipRow.getByText(new RegExp(`RDIP .*${term.Term}`))).toBeVisible();
  await expect(pipRow.getByRole('button', { name: 'Set PIP Cost' })).toBeVisible();
  await n.check('Its PIP row names the RDIP it came from and offers Set PIP Cost');

  await page.goto(`/multi-year/portfolios/${term.Id}`);
  await page.getByRole('button', { name: 'Saved Totals' }).click();
  await page.getByRole('button', { name: 'Save Totals' }).click();
  await page.getByLabel('Note').fill('E2E narrated run');
  await page.getByRole('dialog').getByRole('button', { name: 'Save Totals' }).click();
  await expect(page.getByText(/Totals of RDIP .* saved\./)).toBeVisible();
  await expect(page.getByText('Saved on request').first()).toBeVisible();
  await n.check('Saved Totals keeps a new snapshot on request');

  await page.getByRole('button', { name: 'Import Projects' }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download Template' }).click();
  expect((await download).suggestedFilename()).toMatch(/^PlanningProjects_RDIP_\d{4}\.xlsx$/);
  await page.getByRole('button', { name: 'Close' }).click();
  await n.check('Import Projects hands out the template');

  await page.goto('/multi-year/portfolios');
  await page.getByRole('button', { name: 'GAA Updates' }).click();
  await expect(page.getByRole('dialog', { name: 'GAA Updates' }).getByRole('columnheader', { name: 'Started by' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Run GAA Update' })).toBeVisible();
  await n.check('GAA Updates lists the runs and offers Run GAA Update');
});
