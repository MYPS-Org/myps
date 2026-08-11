import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';
import { captureApiCalls } from './helpers/networkCapture';

test.describe('Project list page', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should load project list and capture network API calls', async ({ page }) => {
    const apiCalls = captureApiCalls(page, ['/api/Project/showprojects']);

    await page.goto('/projects');
    await expect(page.locator('text=Projects')).toBeVisible();
    await expect(page.locator('text=Add Project')).toBeVisible();

    test.info().attach('project-list-api-calls', {
      body: JSON.stringify(apiCalls, null, 2),
      contentType: 'application/json',
    });

    expect(apiCalls.length).toBeGreaterThan(0);
  });
});
