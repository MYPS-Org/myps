# FE — Claude Code Guide

## Stack

- React 19, TypeScript, Vite, Tailwind CSS v4
- Routing: React Router v7
- State: Jotai atoms
- HTTP: custom `httpClient` wrapper around Axios (`src/services/httpClient.ts`)
- Real-time: SignalR (`src/services/signalrService.ts`)
- UI: Headless UI, Heroicons, Tailwind UI components

## Key conventions

### HTTP & error handling

All API calls go through `httpClient` (`src/services/httpClient.ts`).

**Do not add toast calls in `catch` blocks for expected API errors.** The `httpClient` interceptor already shows an error toast, using the API's message, for **a 400, or any error response whose body carries a `Message`**. It then rethrows an `ErrorResponse` with that `Message`. Adding a `showToast` in the component `catch` for those produces a duplicate toast.

The interceptor shows **nothing** for a network error (no response), or for a 401/403/500 without a `Message` body. It rethrows the raw error, with no `Message`. A `catch` that only logs leaves the user with no feedback at all in those cases.

Correct pattern:

```ts
try {
  const response = await someFn(payload);
  // handle success
} catch (error) {
  // The interceptor toasted (and set Message) for any API error that carried one.
  // Toast only when it stayed silent:
  if (!(error as { Message?: string } | undefined)?.Message) {
    showToast({ type: 'error', message: 'Failed to <action>. Please try again.' });
  }
}
```

Otherwise, only show a manual `showToast` for errors that come from *frontend* validation (before the API call). Example: `BatchActionsDropdown.tsx`.

### Frontend validation before submit

Validate constraints (field lengths, required combos, etc.) in the submit handler *before* the API call. Use `showToast({ type: 'error', message: '...' })` and `return` early so the API is never called with invalid data.

Field length limits must match the backend DTO `[MaxLength(...)]` attribute values.

### Toast

Use `useToast()` from `src/components/toaster/ToasterContext.tsx`.

```ts
const { showToast } = useToast();
showToast({ type: 'success' | 'error' | 'info' | 'warning', message: 'Text.' });
```

### Field naming in error messages

Use the **UI label** of the field in validation/error messages, not the DTO property name. For example, if the UI label is "Sub Name" and the DTO field is `Name`, the error message should read "Sub Name cannot exceed 100 characters." not "Name cannot exceed 100 characters."

### Input maxLength

Always add `maxLength` on `<input>` elements to match the backend's `[MaxLength]` constraint so users cannot type past the limit.

### Date input range

All date inputs must be limited to **1990-01-01 – 2100-12-31**.

**Never use a bare `<input type="date">`.** Use the purpose-built wrappers instead — they inject the limits automatically so you never have to write `min`/`max` by hand.

| Situation | Component to use | File |
|-----------|-----------------|------|
| Plain form date field | `<DateInput>` | `src/components/tailwindui/date-input.tsx` |
| Report/filter date field (Tailwind UI style) | `<Input type="date">` | `src/components/tailwindui/input.tsx` |

Both components default `min` to `1990-01-01` and `max` to `2100-12-31` via `prop ?? default`. Pass explicit `min`/`max` props only when you need a **tighter** range — they will override the defaults.

**Exception — year-locked date ranges (ComponentCostDialog pattern):**
When a date must stay within a specific fiscal year, pass year-derived `min`/`max` and use `undefined` as the no-year fallback:
```tsx
<DateInput
  min={year ? `${year}-01-01` : undefined}   // undefined → DateInput uses 1990-01-01
  max={year ? `${year}-12-31` : undefined}   // undefined → DateInput uses 2100-12-31
/>
```
Do **not** hardcode `'1990-01-01'`/`'2100-12-31'` in the caller — let the component handle the fallback.

## Directory structure

```
src/
  components/     Shared UI components (toaster, modal, map, ui/*)
  contexts/       React contexts
  hooks/          Custom hooks
  layouts/        Page layouts
  pages/          Feature modules (each has Views/, dialogs/, Service.ts, Model.d.ts)
  services/       httpClient, signalrService
  types/          Global TypeScript types
  utils/          Utility helpers
```

## API conventions

- All requests use `httpClient.post(endpoint, payload, { preloaderMessage: '...' })`
- API base URL is `/api` (proxied by Vite in dev)
- Responses are `ApiResponse<T>` with `{ Data, Status, Message? }`

## Backend DTO limits (reference)

| Field (DTO)     | UI Label   | MaxLength |
|-----------------|------------|-----------|
| AddProgramDTO.Name | Sub Name (combined program name) | 100 |
| AddProgramDTO.SkipReason | Reason | 250 |
