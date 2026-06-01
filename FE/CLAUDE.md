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

**Do not add toast calls in `catch` blocks for expected API errors.** The `httpClient` interceptor already shows error toasts automatically for 400 and other error responses using the message from the API. Adding a `showToast` in the component `catch` produces a duplicate toast.

Correct pattern:

```ts
try {
  const response = await someFn(payload);
  // handle success
} catch {
  // httpClient interceptor already showed the API error toast
}
```

Only show a manual `showToast` for errors that come from *frontend* validation (before the API call).

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
