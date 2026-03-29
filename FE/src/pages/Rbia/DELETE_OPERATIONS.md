# RBIA Delete Operations

## API Endpoints

| Entity | Endpoint | Payload |
|--------|----------|---------|
| Road | `POST /futureinfra/DeleteFutureRoad` | `{ RoadId: string }` |
| Road Section | `POST /futureinfra/DeleteFutureRoadSection` | `{ RoadSectionId: string }` |
| Bridge | `POST /futureinfra/DeleteFutureBridge` | `{ BridgeId: string }` |

## Dialog Components

All three delete dialogs (`DeleteRoadDialog`, `DeleteRoadSectionDialog`, `DeleteBridgeDialog`) follow the same pattern:

1. User types `DELETE` to confirm.
2. Dialog calls the corresponding Service function.
3. On success: `onSubmit` is called with the entity ID (for optimistic state removal), then a success toast is shown.
4. On error: error toast is shown and state is not modified.

## Toast Notifications

Uses `useToast` from `../../../components/toaster/ToasterContext`.

```tsx
import { useToast } from '../../../components/toaster/ToasterContext';

const { showToast } = useToast();

// Success
showToast({ type: 'success', message: 'Road deleted successfully.' });

// Error
showToast({ type: 'error', message: 'Failed to delete road. Please try again.' });
```

## State Removal

Each delete dialog calls `onSubmit(id)` **after** the API succeeds, which triggers the parent component's `handleConfirmDelete` handler. This in turn calls the hook's `removeXFromState(id)` for optimistic UI updates.

| Dialog | ID Field Used | Hook Function |
|--------|---------------|---------------|
| `DeleteRoadDialog` | `road.RoadId` | `removeRoadFromState` |
| `DeleteRoadSectionDialog` | `roadSection.RoadSectionId` | `removeRoadSectionFromState` |
| `DeleteBridgeDialog` | `bridge.BridgeId` | `removeBridgeFromState` |
