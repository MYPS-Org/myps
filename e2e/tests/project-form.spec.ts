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

    await expect(page.getByRole('heading', { name: 'Project Details' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Save/ })).toBeVisible();

    await expect.poll(() => apiCalls.length, { timeout: 30_000 }).toBeGreaterThanOrEqual(1);

    /*  STATUS, not just arrival. captureApiCalls records every request that
        FINISHED, so a 400 satisfies a bare length check — see the note in
        project-list.spec.ts. Both dropdown endpoints must actually have
        answered, or the form renders with empty pickers and still "passes". */
    for (const call of apiCalls) {
      expect(call.status, `${call.url} -> ${JSON.stringify(call.responseBody)}`).toBe(200);
    }

    test.info().attach('project-form-api-calls', {
      body: JSON.stringify(apiCalls, null, 2),
      contentType: 'application/json',
    });
  });
});
