# MYPS e2e Tests

Playwright end-to-end tests for the MYPS frontend.

## Prerequisites

- Node.js
- The FE app running locally (these tests do **not** start it for you)

## Setup

```bash
cd e2e
npm install
npm run install:playwright   # downloads browser binaries (one-time, ~300 MB)
cp .env.example .env         # fill in real credentials if the defaults don't work for you
```

In a separate terminal, start the FE dev server (tests expect it on `http://localhost:8080`):

```bash
cd FE
npm run dev
```

## Running tests

```bash
npm test              # headless, all specs
npm run test:headed   # opens a real browser window so you can watch it run
npm run test:report   # opens the HTML report from the last run
```

Run a single spec:

```bash
npx playwright test tests/project-list.spec.ts
```

## Project structure

```
e2e/
  playwright.config.ts   # baseURL, timeouts, reporters, trace/video/screenshot-on-failure
  .env.example            # copy to .env — E2E_USERNAME / E2E_PASSWORD
  tests/
    helpers/
      auth.ts             # login(page) — reuse this, don't re-implement login in a spec
      networkCapture.ts   # captureApiCalls(page, urlPatterns) — reuse this for API assertions
    *.spec.ts             # one file per page/flow
```

## Writing a new test

1. Add a `tests/<feature>.spec.ts` file.
2. Call `login()` from `helpers/auth.ts` before navigating to a protected route — every route in this app requires auth.
3. If the test should assert on network activity, use `captureApiCalls()` from `helpers/networkCapture.ts` instead of hand-rolling a request listener.
4. This app has no `data-testid` attributes anywhere, so locators are text/role-based (e.g. `page.locator('text=Save')`). Check the real rendered copy in `FE/src/pages/**/Views/*.tsx` before writing an assertion — don't guess the text.

For the full route inventory, current test coverage map, and more implementation detail, see [`CLAUDE.md`](./CLAUDE.md) in this folder — keep that file's coverage table updated whenever you add or remove a spec.

## Troubleshooting

| Problem | Fix |
|---|---|
| `browserType.launch: Executable doesn't exist` | Run `npm run install:playwright` |
| Tests time out navigating / can't reach `localhost:8080` | Make sure `cd FE && npm run dev` is running first |
| Login fails | Check `.env` has valid credentials for your environment |
| A test asserting on API calls gets 0 results | The endpoint the spec watches for may no longer match the app (see `helpers/networkCapture.ts` usage in the spec) — check the actual request in the Network tab or the test's attached JSON in the HTML report and update the URL pattern |
