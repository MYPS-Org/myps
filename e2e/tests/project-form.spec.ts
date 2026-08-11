import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';
import { captureApiCalls } from './helpers/networkCapture';

test.describe('Project form page', () => {
  test('should load add project page and capture project APIs', async ({ page }) => {
    const apiCalls = captureApiCalls(page, [
      '/api/Project/ShowProjectDropdowns',
      '/api/Project/ShowProjectComponentDropdowns',
    ]);

    await login(page);
    await page.goto('/projects/addproject');

    await expect(page.locator('text=Project Details')).toBeVisible();
    await expect(page.locator('button:has-text("Save")')).toBeVisible();

    test.info().attach('project-form-api-calls', {
      body: JSON.stringify(apiCalls, null, 2),
      contentType: 'application/json',
    });

    expect(apiCalls.length).toBeGreaterThanOrEqual(1);
  });
});
