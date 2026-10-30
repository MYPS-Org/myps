// =============================================================================
// code-tables-s04-retest.spec.ts — the S04 Code Tables failures fixed on main, as ATA will
// re-test them (S04-TC008 to TC014, TC017 to TC024; fixes #278, #279, #280, #426).
//
// What each test guards (the ATA remark it answers):
//   TC008 Funding Agreement / TC009 Funding Source / TC013 Reasons:
//         "after editing, the Active status changes to Inactive"; TC009 also "Nature reverts to
//         the original value"; TC013 also "duplicate Active field with conflicting values".
//   TC010 Categories / TC011 Headers / TC012 Documents: "remove IsActive field"; the id
//         columns were editable but never saved (now read-only); Documents gets a Description.
//   TC014 Statuses / TC017 Program Stage: "cannot edit ... the Status is currently in use".
//         An in-use row's text can be edited now; renaming an in-use Program Stage is still
//         refused on purpose (programs store the stage by name).
//   TC018 Program Type / TC019 Program Status: no NameId; the id is assigned by the system.
//   TC020 to TC024 Admin Areas: data from AAMS, no add or delete; Regions are read-only, the
//         others can change only the link to their parent area.
//
// DATA: adds its own e2e-<n> Funding Agreement, Funding Source and Reason and deletes them in
// afterEach through the Code Tables delete call. The in-use Status and Program Stage get a
// " (e2e)" suffix on their Description and are put back in afterEach. Run on the LOCAL
// database only (see e2e/CLAUDE.md).
// =============================================================================
import { test, expect, type Page, type Locator } from '@playwright/test';
import { login } from './helpers/auth';

/* eslint-disable @typescript-eslint/no-explicit-any */
const n = String(Date.now() % 100000).padStart(5, '0');
const TAG = `e2e-${n}`;

const dialog = (page: Page) => page.getByRole('dialog');
const rows = (page: Page) => page.locator('table tbody tr');
const rowWith = (page: Page, text: string): Locator => rows(page).filter({ hasText: text });
const editRow = (page: Page) => page.locator('table tbody tr.bg-amber-50');
const headers = (page: Page) => page.locator('table thead th');
/** Every field a user can type in or pick from (the revision tables' inputs carry no type). */
const FIELDS = 'textarea, select, input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"])';

async function codeTables(page: Page): Promise<any> {
  const res = await page.request.post('/api/CodeTable/GetAllCodeTables');
  expect(res.ok(), `GetAllCodeTables ${res.status()}`).toBeTruthy();
  return res.json();
}

async function updateCodeTable(page: Page, code: string, type: 0 | 1 | 2, json: unknown) {
  const res = await page.request.post('/api/CodeTable/UpdateCodeTable', {
    data: { Code: code, TransactionType: type, Json: JSON.stringify(json) },
  });
  return { status: res.status(), body: await res.json().catch(() => null) };
}

async function open(page: Page, group: RegExp, table?: string) {
  await page.goto('/code-tables');
  await page.getByRole('button', { name: group }).click();
  if (table) await page.getByRole('button', { name: table, exact: true }).click();
  await expect(rows(page).first()).toBeVisible();
}

/** The textarea / input of the row being edited that currently holds `value`. */
async function editField(page: Page, value: string): Promise<Locator> {
  const fields = editRow(page).locator('textarea, input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"])');
  const count = await fields.count();
  for (let i = 0; i < count; i += 1) {
    if ((await fields.nth(i).inputValue()) === value) return fields.nth(i);
  }
  throw new Error(`No field in the edit row holds "${value}"`);
}

/** Click the edit row's check button, then "Save Changes" where the table asks for it (the
    Revision tables save straight away); expect the success toast. */
async function saveEdit(page: Page, toast: RegExp) {
  await editRow(page).locator('button').first().click();
  const confirmButton = dialog(page).getByRole('button', { name: 'Save Changes' });
  await expect(confirmButton.or(page.getByText(toast).first())).toBeVisible();
  if (await confirmButton.isVisible()) await confirmButton.click();
  await expect(page.getByText(toast).first()).toBeVisible();
  await expect(editRow(page)).toHaveCount(0);
}

/** The Active toggle / badge text of a row. */
const activeOf = (row: Locator) => row.getByText(/^\s*(Active|Inactive)\s*$/).first();

test.describe('S04 Code Tables re-test (fixed on main)', () => {
  const cleanups: Array<(page: Page) => Promise<void>> = [];

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test.afterEach(async ({ page }) => {
    while (cleanups.length) {
      const undo = cleanups.pop()!;
      await undo(page).catch((e) => console.warn(`cleanup failed: ${e}`));
    }
  });

  test('S04-TC008: editing a Funding Agreement keeps it Active', async ({ page }) => {
    const tables = await codeTables(page);
    const sourceOrg = tables.FundingSources.find((s: any) => s.IsActive !== false)?.Organization;
    expect(sourceOrg, 'an active Funding Source to attach the agreement to').toBeTruthy();
    const code = `E2E${n}`;
    cleanups.push(async (p) => {
      const item = (await codeTables(p)).FundingAgreements.find((a: any) => a.Code === code);
      if (item) await updateCodeTable(p, 'FundingAgreement', 2, item);
    });

    await open(page, /^Funding Profile/, 'Funding Agreement');
    await page.getByRole('button', { name: /^Add$/ }).click();
    await page.getByPlaceholder('Source org *').fill(sourceOrg);
    await page.getByPlaceholder('Code *').fill(code);
    await page.getByPlaceholder('Agreement name *').fill(`${TAG} agreement`);
    await rows(page).first().locator('button').first().click();
    await dialog(page).getByRole('button', { name: 'Confirm Add' }).click();
    await expect(rowWith(page, code)).toHaveCount(1);
    await expect(activeOf(rowWith(page, code))).toHaveText('Active');

    await rowWith(page, code).locator('button').filter({ has: page.locator('svg') }).first().click(); // the pencil
    await (await editField(page, `${TAG} agreement`)).fill(`${TAG} agreement edited`);
    await saveEdit(page, /Funding agreement updated|updated successfully/i);
    await expect(rowWith(page, `${TAG} agreement edited`)).toHaveCount(1);
    await expect(activeOf(rowWith(page, code)), 'still Active after an edit (the TC008 bug)').toHaveText('Active');
  });

  test('S04-TC009: editing a Funding Source keeps it Active and saves its Nature', async ({ page }) => {
    const org = `E2E${n}`;
    cleanups.push(async (p) => {
      const item = (await codeTables(p)).FundingSources.find((s: any) => s.Organization === org);
      if (item) await updateCodeTable(p, 'FundingSource', 2, item);
    });

    await open(page, /^Funding Profile/, 'Funding Source');
    await page.getByRole('button', { name: /Add Source/ }).click();
    await page.getByPlaceholder('Org code...').fill(org);
    await page.getByPlaceholder('Description...').fill(`${TAG} source`);
    await rows(page).first().locator('button').first().click();
    await dialog(page).getByRole('button', { name: 'Confirm Add' }).click();
    await expect(rowWith(page, org)).toContainText('Local');

    await rowWith(page, org).locator('button').filter({ has: page.locator('svg') }).first().click();
    await editRow(page).locator('select').selectOption('Foreign');
    await (await editField(page, `${TAG} source`)).fill(`${TAG} source edited`);
    await saveEdit(page, /Funding source updated successfully/);

    await page.reload();
    await page.getByRole('button', { name: /^Funding Profile/ }).click();
    await page.getByRole('button', { name: 'Funding Source', exact: true }).click();
    const row = rowWith(page, org);
    await expect(row, 'Nature saved (the TC009 "reverts" bug)').toContainText('Foreign');
    await expect(row).toContainText(`${TAG} source edited`);
    await expect(activeOf(row), 'still Active after an edit').toHaveText('Active');
  });

  for (const { tc, table, editable } of [
    { tc: 'S04-TC010', table: 'Categories', editable: 1 },
    { tc: 'S04-TC011', table: 'Headers', editable: 1 },
    { tc: 'S04-TC012', table: 'Documents', editable: 2 },
  ]) {
    test(`${tc}: Revision ${table} has no IsActive field and only its text columns are editable`, async ({ page }) => {
      await open(page, /^Revisions/, table);
      await expect(headers(page).filter({ hasText: /IsActive/i }), 'no raw IsActive column').toHaveCount(0);
      await expect(headers(page).filter({ hasText: /^Active$/ }), 'one Active column').toHaveCount(1);
      if (table === 'Documents') {
        await expect(headers(page).filter({ hasText: /Description/ }), 'Documents shows a Description').toHaveCount(1);
      }
      await rows(page).first().locator('button').filter({ has: page.locator('svg') }).first().click();
      await expect(editRow(page)).toHaveCount(1);
      await expect(editRow(page).locator(FIELDS), 'editable fields').toHaveCount(editable);
      await editRow(page).locator('button').nth(1).click(); // cancel, nothing saved
      await expect(editRow(page)).toHaveCount(0);
    });
  }

  test('S04-TC013: editing a Revision Reason keeps it Active; one Active column', async ({ page }) => {
    const reasonText = `${TAG} reason`;
    cleanups.push(async (p) => {
      const item = (await codeTables(p)).Reasons.find((r: any) => String(r.Reason).startsWith(reasonText));
      if (item) await updateCodeTable(p, 'RevisionReasons', 2, item);
    });

    await open(page, /^Revisions/, 'Reasons');
    await expect(headers(page).filter({ hasText: /Active/ }), 'no duplicate Active field').toHaveCount(1);
    await page.getByRole('button', { name: /Add Reason/ }).click();
    const header = rows(page).first().locator('select');
    await header.selectOption({ index: 1 });
    await page.getByPlaceholder('Reason text *').fill(reasonText);
    await rows(page).first().locator('button').first().click();
    await dialog(page).getByRole('button', { name: 'Confirm Add' }).click();
    // The list reloads after a save (and clears the search): search only once it has.
    await expect(page.getByText(/added/i).first()).toBeVisible();
    await expect(dialog(page)).toBeHidden();
    await page.getByPlaceholder('Search...').fill(reasonText);
    await expect(rowWith(page, reasonText)).toHaveCount(1);
    await expect(activeOf(rowWith(page, reasonText))).toHaveText('Active');

    await rowWith(page, reasonText).locator('button').filter({ has: page.locator('svg') }).first().click();
    await (await editField(page, reasonText)).fill(`${reasonText} edited`);
    await saveEdit(page, /updated/i);
    await expect(activeOf(rowWith(page, `${reasonText} edited`)), 'still Active after an edit (the TC013 bug)').toHaveText('Active');
  });

  test('S04-TC014: an in-use Revision Status can be edited', async ({ page }) => {
    const status = (await codeTables(page)).RevisionStatuses[0];
    expect(status, 'a Revision Status row').toBeTruthy();
    cleanups.push(async (p) => {
      const res = await updateCodeTable(p, 'RevisionStatus', 1, status);
      expect(res.status, `restore Revision Status: ${JSON.stringify(res.body)}`).toBe(200);
    });

    await open(page, /^Revisions/, 'Statuses');
    const row = rowWith(page, status.Name).first();
    await row.locator('button').filter({ has: page.locator('svg') }).first().click();
    const description = status.Description ?? '';
    await (await editField(page, description)).fill(`${description} (e2e)`);
    await saveEdit(page, /updated/i);
    await expect(page.getByText(/currently in use|already in use/i), 'no "in use" refusal').toHaveCount(0);
  });

  test('S04-TC017: an in-use Program Stage takes a new Description; a rename is refused with the reason', async ({ page }) => {
    const stage = (await codeTables(page)).ProgramStages.find((s: any) => s.Name === 'BP');
    expect(stage, 'the BP stage').toBeTruthy();
    cleanups.push(async (p) => {
      const res = await updateCodeTable(p, 'ProgramStage', 1, stage);
      expect(res.status, `restore BP: ${JSON.stringify(res.body)}`).toBe(200);
    });

    await open(page, /^Programs/, 'Program Stage');
    await rowWith(page, stage.Description ?? 'BP').first().locator('button').filter({ has: page.locator('svg') }).first().click();
    await (await editField(page, stage.Description ?? '')).fill(`${stage.Description ?? ''} (e2e)`);
    await saveEdit(page, /updated/i);

    const rename = await updateCodeTable(page, 'ProgramStage', 1, { ...stage, Name: `${stage.Name}-e2e` });
    expect(rename.status, 'renaming an in-use stage is refused').toBe(400);
    expect(JSON.stringify(rename.body)).toContain('cannot be renamed');
  });

  test('S04-TC018 / TC019: Program Type and Program Status have no NameId; the id is assigned', async ({ page }) => {
    await open(page, /^Programs/, 'Program Type');
    await expect(headers(page).filter({ hasText: /Name ?Id/i })).toHaveCount(0);
    await expect(headers(page).filter({ hasText: /Description/ }), 'TC018: no Description').toHaveCount(0);
    await page.getByRole('button', { name: /^Add$/ }).click();
    await expect(rows(page).first().locator(FIELDS), 'only the name is typed').toHaveCount(1);
    await rows(page).first().locator('button').nth(1).click();

    await page.getByRole('button', { name: 'Program Status', exact: true }).click();
    await expect(headers(page).filter({ hasText: /Name ?Id/i })).toHaveCount(0);
    await page.getByRole('button', { name: /^Add$/ }).click();
    await expect(rows(page).first().getByPlaceholder('Status name *')).toBeVisible();
    await expect(rows(page).first().locator('input[type="number"]'), 'no id to type').toHaveCount(0);
    await rows(page).first().locator('button').nth(1).click();
  });

  test('S04-TC020 to TC024: Admin Areas cannot be added or deleted; only the parent link is editable', async ({ page }) => {
    await open(page, /^Admin Areas/, 'Regions');
    await expect(page.getByRole('button', { name: /Add/ })).toHaveCount(0);
    await expect(headers(page).filter({ hasText: 'Actions' }), 'TC020: Regions are read-only').toHaveCount(0);
    await expect(page.getByText(/Maintained in AAMS/)).toBeVisible();

    for (const table of ['Provinces', 'Cities/Municipalities', 'Legislative Districts', 'DEOs']) {
      await page.getByRole('button', { name: table, exact: true }).click();
      await expect(rows(page).first()).toBeVisible();
      await expect(page.getByRole('button', { name: /Add/ }), `${table}: no Add`).toHaveCount(0);
      await expect(rows(page).first().locator('button'), `${table}: one action, the pencil`).toHaveCount(1);
      await rows(page).first().locator('button').click();
      await expect(editRow(page).locator('select'), `${table}: the parent link is a dropdown`).toHaveCount(1);
      await expect(editRow(page).locator('textarea, input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"])'), `${table}: no name to retype`).toHaveCount(0);
      await editRow(page).locator('button').nth(1).click(); // cancel
    }
  });
});

// =============================================================================
// Bugs QA could not see, fixed on fix/S04-code-tables (2026-10-29 / 30). API level unless stated;
// every write is to an e2e-<n> row this file deletes, or a refusal that writes nothing.
// =============================================================================

/** A minimal PDF that passes Functions.IsPdfCorrupted (xref offset computed, %%EOF at the end). */
function tinyPdfDataUrl(): string {
  const head = '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [] /Count 0 >>\nendobj\n';
  const xref = `xref\n0 3\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \ntrailer\n<< /Size 3 /Root 1 0 R >>\nstartxref\n${head.length}\n%%EOF\n`;
  return `data:application/pdf;base64,${Buffer.from(head + xref, 'ascii').toString('base64')}`;
}

test.describe('S04 hidden bugs (fix/S04-code-tables)', () => {
  const cleanups: Array<(page: Page) => Promise<void>> = [];
  test.beforeEach(async ({ page }) => { await login(page); });
  test.afterEach(async ({ page }) => {
    while (cleanups.length) await cleanups.pop()!(page).catch((e) => console.warn(`cleanup failed: ${e}`));
  });

  test('Origin: created Active, an edit without the Active switch keeps it Active, and both changed fields are logged', async ({ page }) => {
    const name = `${TAG} origin`;
    cleanups.push(async (p) => {
      const item = (await codeTables(p)).ProjectOrigins.find((o: any) => String(o.Name).startsWith(name));
      if (item) await updateCodeTable(p, 'ProjectOrigin', 2, item);
    });
    // No IsActive, as OriginTable's add sent before the fix.
    expect((await updateCodeTable(page, 'ProjectOrigin', 0, { Name: name, Description: 'e2e' })).status).toBe(200);
    const added = (await codeTables(page)).ProjectOrigins.find((o: any) => o.Name === name);
    expect(added?.IsActive, 'created Active').toBe(true);

    // No IsActive, as OriginTable's edit sent: Name and Description changed in one save.
    expect((await updateCodeTable(page, 'ProjectOrigin', 1, { Id: added.Id, Name: `${name} edited`, Description: 'e2e edited' })).status).toBe(200);
    const edited = (await codeTables(page)).ProjectOrigins.find((o: any) => o.Id === added.Id);
    expect(edited?.IsActive, 'still Active after an edit without the switch').toBe(true);

    const log = await page.request.post('/api/CodeTable/GetTransactionLog', { data: { TableCode: 'ProjectOrigin' } });
    const logged = JSON.stringify(await log.json());
    expect(logged, 'the Name change is logged').toContain(`${name} edited`);
    expect(logged, 'and the Description change too').toContain('e2e edited');
  });

  test('Revision Rules: an edit without the Active value keeps the rule Active (it used to vanish)', async ({ page }) => {
    const rule = (await codeTables(page)).RevisionRules[0];
    expect(rule, 'an active rule').toBeTruthy();
    // Safety net: whatever happens, the rule is active again afterwards.
    cleanups.push(async (p) => { await updateCodeTable(p, 'RevisionRules', 1, { Id: rule.Id, ReasonId: rule.ReasonId, PCMA_Status: rule.PCMA_Status, Package_Status: rule.Package_Status, Field: rule.Field, IsActive: true }); });
    // RevisionFieldPermissionTable's own edit payload: no IsActive.
    const res = await updateCodeTable(page, 'RevisionRules', 1, { Id: rule.Id, ReasonId: rule.ReasonId, PCMA_Status: rule.PCMA_Status, Package_Status: rule.Package_Status, Field: rule.Field });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect((await codeTables(page)).RevisionRules.some((r: any) => r.Id === rule.Id), 'still listed, so still active').toBe(true);
  });

  test('Program Stage: adding a stage is refused, and the screen offers no Add', async ({ page }) => {
    const res = await updateCodeTable(page, 'ProgramStage', 0, { Name: `E2E${n}`, Description: 'e2e' });
    expect(res.status).toBe(400);
    expect(res.body?.Title).toBe('Program Stages Are Fixed');
    await open(page, /^Programs/, 'Program Stage');
    await expect(page.getByRole('button', { name: /^Add$/ })).toHaveCount(0);
  });

  test('Thrust, Category, Cost Type: invalid saves are refused with the reason, nothing written', async ({ page }) => {
    const tables = await codeTables(page);
    const zeroKey = await updateCodeTable(page, 'ProjectThrust', 0, { PAPKey: 0, ThrustDescription: `${TAG} thrust`, ProgramName: 'e2e', SubProgramName: 'e2e', ActivityName: 'e2e', SequenceNumber: 1 });
    expect(zeroKey.body?.Title).toBe('Invalid PAP Key');

    const thrust = tables.ProjectThrusts[0];
    const backwards = await updateCodeTable(page, 'ProjectThrust', 1, { ...thrust, ValidFromDate: 2030, ValidToDate: 2020 });
    expect(backwards.body?.Title).toBe('Invalid Validity');

    const range = await updateCodeTable(page, 'ProjectCategory', 0, { CategoryName: `${TAG} category`, Minimum: 500, Maximum: 100, ValidUntil: 0 });
    expect(range.body?.Title).toBe('Invalid Amount Range');

    const used = tables.ProjectComponents.find((c: any) => c.ComponentId === 'CW');
    expect(used, 'Civil Works (CW), used by projects').toBeTruthy();
    const del = await updateCodeTable(page, 'ProjectComponent', 2, used);
    expect(del.status).toBe(400);
    expect(del.body?.Title, 'the reason, not a generic database error').toBe('Project Component In Use');
  });

  test('S04-TC016: Validation Dates are saved, and a closed window refuses a new revision request', async ({ page }) => {
    const deleteYear = async (p: Page, year: number) => {
      const row = ((await codeTables(p)).RevisionValidationDates ?? []).find((r: any) => r.FundingYear === year);
      if (row) await updateCodeTable(p, 'RevisionValidationDates', 2, { Id: row.Id });
    };
    cleanups.push((p) => deleteYear(p, 2099));
    cleanups.push((p) => deleteYear(p, 2027));

    // The screen: add, then reload. It used to come back as the built-in sample rows.
    await open(page, /^Revisions/, 'Validation Dates');
    await page.getByRole('button', { name: /Add Date Range/ }).click();
    const addRow = rows(page).first();
    await addRow.locator('input[type="number"]').fill('2099');
    await addRow.locator('input[type="date"]').nth(0).fill('2099-01-01');
    await addRow.locator('input[type="date"]').nth(1).fill('2099-06-30');
    await addRow.locator('button').first().click();
    await dialog(page).getByRole('button', { name: 'Confirm Add' }).click();
    await expect(page.getByText(/Validation date range added/).first()).toBeVisible();
    await page.reload();
    await page.getByRole('button', { name: /^Revisions/ }).click();
    await page.getByRole('button', { name: 'Validation Dates', exact: true }).click();
    await expect(rowWith(page, '2099'), 'saved: still there after a reload').toContainText('June 30, 2099');
    await expect(rowWith(page, '2016'), 'no built-in sample rows').toHaveCount(0);

    // Enforcement: a closed window for the program year of a published GAA-R project.
    const project = { ProjectPK: 'BP01100016LZ', ProjectId: 'P01100016LZ', ProgramFK: 'salaniokaes_10232026_095939', Year: 2027 };
    expect((await updateCodeTable(page, 'RevisionValidationDates', 0, { FundingYear: project.Year, StartDate: '2020-01-01', EndDate: '2020-01-31' })).status).toBe(200);
    const details = await page.request.post('/api/Project/ShowProjectDetails', { data: { ProjectId: project.ProjectId, StageName: 'GAA-R' } });
    const detailsBody = await details.json();
    const projectDetails = (detailsBody?.Data ?? detailsBody)?.ProjectDetails;
    expect(projectDetails, `ShowProjectDetails: ${JSON.stringify(detailsBody).slice(0, 300)}`).toBeTruthy();
    // ReasonId -1: if the window did not stop it, "Invalid Revision Reason" does, so nothing is ever written.
    const request = () => page.request.post('/api/Revision/RequestRevision', {
      data: {
        RevisionDetails: {
          ReasonId: -1, ApprovalDate: '2026-10-30', ConstructionStatus: 'x', PackageStatus: 'x',
          ApprovedDocument: { Name: 'e2e.pdf', Extension: 'pdf', ContentType: 'application/pdf', DataUrl: tinyPdfDataUrl() },
        },
        ProjectDetails: { ...projectDetails, ProjectId: project.ProjectId, ProjectFK: project.ProjectPK, ProgramFK: project.ProgramFK },
        ComponentCosts: [], ComponentCostPerYear: [], MajorItemOfWorks: [], MajorItemLocations: [], FundingProfile: [],
      },
    });
    const closed = await request();
    const closedBody = await closed.json().catch(() => null);
    expect(closed.status(), JSON.stringify(closedBody)).toBe(400);
    expect(closedBody?.Title, JSON.stringify(closedBody)).toBe('Revision Period Closed');

    await deleteYear(page, project.Year);
    const reopened = await request();
    const reopenedBody = await reopened.json().catch(() => null);
    expect(reopenedBody?.Title, `without a window the request goes on to the next check: ${JSON.stringify(reopenedBody)}`).toBe('Invalid Revision Reason');
  });
});
