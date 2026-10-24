// =============================================================================
// code-tables-cost-type-pcma-label.spec.ts — Code Tables > Component Cost >
// Cost Type: the PCMA flag reads "Publishable to PCMA" everywhere (S04-TC005).
//
// What it guards:
//   - The column header, and the Add / Save confirm dialogs, said "Export to
//     PCMA" / "Export PCMA". QA asked for "Publishable to PCMA".
//   - Only the label changed: the flag is still ExportToPCMA on the wire, so a
//     cost type added with the box ticked must come back as "Yes".
//
// DATA: adds one cost type (e2e-<n>) and deletes it again, in the UI and once
// more through the API in afterEach, so a failed run leaves nothing behind.
//
// PREREQUISITE — Vite must proxy to the LOCAL API:
//   cd FE && VITE_API_BASE_URL=http://localhost:5015 npx vite --port 8080 --strictPort
// =============================================================================

import { test, expect, type Page, type Locator } from '@playwright/test';
import { login } from './helpers/auth';

const n = String(Date.now() % 100000).padStart(5, '0');
const COMPONENT_ID = `E2E${n}`;
const COMPONENT_NAME = `e2e cost type ${n}`;
const OLD_LABEL = /Export (to )?PCMA/;
const NEW_LABEL = 'Publishable to PCMA';

const dialog = (page: Page) => page.getByRole('dialog');
const row = (page: Page, text: string): Locator => page.locator('table tbody tr', { hasText: text });

/** The confirm dialog's summary row for one field: "<label> <value>". */
const field = (page: Page, label: string) =>
  dialog(page).locator('div.divide-y > div', { has: page.getByText(label, { exact: true }) });

async function openCostType(page: Page) {
  await page.goto('/code-tables');
  await page.getByRole('button', { name: /^Component Cost/ }).click();
  await expect(page.getByRole('button', { name: 'Add Cost Type' })).toBeVisible();
}

test.describe('Code Tables — Cost Type "Publishable to PCMA" label [S04-TC005]', () => {
  test.afterEach(async ({ page }) => {
    // Delete by Id through the same endpoint the trash button uses, if the row survived.
    const res = await page.request.post('/api/CodeTable/GetAllCodeTables').catch(() => null);
    if (!res?.ok()) return;
    const body = await res.json().catch(() => null);
    const item = body?.ProjectComponents?.find((c: { ComponentId: string }) => c.ComponentId === COMPONENT_ID);
    if (item) {
      await page.request
        .post('/api/CodeTable/UpdateCodeTable', { data: { Code: 'ProjectComponent', TransactionType: 2, Json: JSON.stringify(item) } })
        .catch(() => {});
    }
  });

  test('header, add and edit dialogs say "Publishable to PCMA", and the flag still saves', async ({ page }) => {
    await login(page);
    await openCostType(page);

    await test.step('column header', async () => {
      const headers = page.locator('table thead th');
      await expect(headers.filter({ hasText: NEW_LABEL })).toHaveCount(1);
      await expect(headers.filter({ hasText: OLD_LABEL })).toHaveCount(0);
    });

    await test.step('Add confirm dialog', async () => {
      await page.getByRole('button', { name: 'Add Cost Type' }).click();
      const addRow = page.locator('table tbody tr').first();
      await addRow.getByPlaceholder('Component ID').fill(COMPONENT_ID);
      await addRow.getByPlaceholder('Name...').fill(COMPONENT_NAME);
      await addRow.locator('input[type="checkbox"]').check();
      await addRow.locator('button').first().click();

      await expect(dialog(page)).toContainText('Add New Cost Type');
      await expect(field(page, NEW_LABEL)).toContainText('Yes');
      await expect(dialog(page)).not.toContainText(OLD_LABEL);
      await dialog(page).getByRole('button', { name: /Confirm|Add|Save/ }).last().click();
      await expect(dialog(page)).toBeHidden();
    });

    await test.step('saved row keeps the flag', async () => {
      const saved = row(page, COMPONENT_ID);
      await expect(saved).toBeVisible();
      // Columns: ID, Component ID, Name, Publishable to PCMA, Active, Actions.
      await expect(saved.locator('td').nth(3)).toHaveText('Yes');
    });

    await test.step('Save confirm dialog', async () => {
      const saved = row(page, COMPONENT_ID);
      await saved.locator('td').last().locator('button').first().click(); // pencil
      await page.locator('table tbody tr.bg-amber-50 input[type="checkbox"]').uncheck();
      await page.locator('table tbody tr.bg-amber-50 td').last().locator('button').first().click();

      await expect(dialog(page)).toContainText('Save Changes to Cost Type');
      await expect(field(page, NEW_LABEL)).toContainText('No');
      await expect(dialog(page)).not.toContainText(OLD_LABEL);
      await dialog(page).getByRole('button', { name: /Confirm|Save/ }).last().click();
      await expect(dialog(page)).toBeHidden();
      await expect(row(page, COMPONENT_ID).locator('td').nth(3)).toHaveText('No');
    });

    await test.step('delete through the UI', async () => {
      const saved = row(page, COMPONENT_ID);
      await saved.locator('td').last().locator('button').nth(1).click(); // trash
      await saved.getByRole('button', { name: 'Yes' }).click();
      await expect(row(page, COMPONENT_ID)).toHaveCount(0);
    });
  });
});
