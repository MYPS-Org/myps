import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';
import { captureApiCalls } from './helpers/networkCapture';

test.describe('Project form page', () => {
  test('should load add project page and capture project APIs', async ({ page }) => {
    const apiCalls = captureApiCalls(page, [
      '/api/Project/ShowProjectDropdowns',
      '/api/Project/ShowProjectComponentDropdowns',
    ]);
    /*  The form's program type-ahead calls ShowProgram (on mount in add mode, then on typing).
        Only the Program list asks for delete eligibility (fetchProgramList): it costs an extra
        query per call, and this form never reads it (Risk #1, 2026-10-16). */
    const showProgramBodies: string[] = [];
    page.on('request', (request) => {
      if (/\/program\/showprogram$/i.test(new URL(request.url()).pathname)) {
        showProgramBodies.push(request.postData() ?? '');
      }
    });

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

    await expect.poll(() => showProgramBodies.length, { timeout: 30_000, message: 'the form loads its programs' }).toBeGreaterThanOrEqual(1);
    for (const body of showProgramBodies) {
      expect(body, 'the Project form must not ask ShowProgram for delete eligibility').not.toMatch(/"IncludeDeleteEligibility"\s*:\s*true/);
    }

    test.info().attach('project-form-api-calls', {
      body: JSON.stringify(apiCalls, null, 2),
      contentType: 'application/json',
    });
  });
});
