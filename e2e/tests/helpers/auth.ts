import { Page } from '@playwright/test';

export const DEFAULT_USERNAME = process.env.E2E_USERNAME ?? 'testuser';
export const DEFAULT_PASSWORD = process.env.E2E_PASSWORD ?? '***REMOVED***';

export async function login(page: Page, userName: string = DEFAULT_USERNAME, password: string = DEFAULT_PASSWORD) {
  await page.goto('/login');
  await page.fill('input[id="username"]', userName);
  await page.fill('input[id="password"]', password);
  await page.click('button:has-text("Sign In")');
  await page.waitForURL(/dashboard/);
}
