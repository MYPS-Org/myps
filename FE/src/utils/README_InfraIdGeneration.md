# Infrastructure ID Auto-Generation

This feature automatically generates Infrastructure IDs for infrastructure types that don't have predefined selectable options.

## How it works:

### For Infrastructure Types that can be selected (Roads, Bridges):
- Users can select from predefined infrastructure using the dialog
- Infrastructure ID is populated from the selected item

### For Infrastructure Types that need auto-generation (e.g., Flood Control System):
- Infrastructure ID is automatically generated when adding a new work location
- Format: `[PREFIX][5 random numbers]`
- Example: `FCS12345` for "Flood Control System"
- Users can also click "Generate ID" button to create a new ID

## Supported Infrastructure Type Mappings:

| Infrastructure Type | Prefix | Example Generated ID |
|-------------------|--------|---------------------|
| Flood Control System/Structures | FCS | FCS12345 |
| Flood Mitigation Structure | FMS | FMS67890 |
| School Buildings | SCH | SCH11111 |
| Multi Purpose Buildings | MPB | MPB22222 |
| Water Supply Systems | WSS | WSS33333 |
| Hospital/Hospitals | HSP | HSP44444 |
| Airport Infrastructure | AI | AI55555 |
| Port Infrastructure | PI | PI66666 |
| Accessibility Facility | AF | AF77777 |
| Consultancy | CON | CON88888 |
| Non-Infra | NI | NI99999 |
| Other Buildings | OTB | OTB00000 |
| Waterway/Waterways | WW | WW11111 |

## Usage:

1. When adding a work location for infrastructure types like "Flood Control System"
2. The Infrastructure ID field will be automatically populated with a generated ID
3. Users can manually edit the ID if needed
4. Users can click "Generate ID" button to create a new random ID
5. The system shows the expected format below the input field

## Example Usage:

```typescript
import { generateInfraId, shouldAutoGenerateInfraId } from '../../../utils/infraIdGenerator';

// Check if infrastructure type should auto-generate ID
const shouldAutoGen = shouldAutoGenerateInfraId("Flood Control System"); // true
const shouldSelect = shouldAutoGenerateInfraId("Roads"); // false

// Generate ID for Flood Control System
const infraId = generateInfraId("Flood Control System"); // "FCS12345"
```
