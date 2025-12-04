# Excess Component Automation - Quick Reference

## 🎯 Purpose
Automatically detect and handle situations where Project Cost > Total Component Cost for specific modification categories.

## 📋 Applicable Categories
✅ Adjustment  
✅ Change in Authority to Implement  
✅ For Savings - Partial Unutilized Balance  
✅ Non Implementable (all types)  
✅ Termination  

## 🔄 User Flow

```
┌─────────────────────────────────────┐
│ User adds Component Cost            │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ Check applicable category?          │
└──────────────┬──────────────────────┘
               │
         ┌─────┴─────┐
         │           │
        YES         NO
         │           │
         │           └──────────► Continue normally
         │
         ▼
┌─────────────────────────────────────┐
│ Project Cost > Total Component Cost?│
└──────────────┬──────────────────────┘
               │
         ┌─────┴─────┐
         │           │
        YES         NO
         │           │
         │           └──────────► Continue normally
         │
         ▼
┌─────────────────────────────────────┐
│ Show ExcessPrompt Dialog            │
│                                     │
│ The Project Cost (₱1,000,000.00)   │
│ is greater than the Total Project  │
│ Component Cost (₱800,000.00).      │
│                                     │
│ Is this an intentional reduction?  │
│                                     │
│ [Cancel]            [OK - Create]   │
└──────────────┬──────────────────────┘
               │
         ┌─────┴─────┐
         │           │
      CANCEL        OK
         │           │
         │           └──────────► Create EXC Component
         │                       • Type: EXC
         │                       • Amount: ₱200,000.00
         │                       • Description: "Excess - Intentional..."
         │
         └──────────────────────► Exit (no action)
```

## 📁 File Structure

```
FE/src/pages/Modification/
├── conditions/
│   ├── ExcessComponentAutomation.ts     ← Utility functions
│   ├── ExcessComponentAutomation.examples.ts
│   └── README.md
├── dialogs/
│   └── ExcessPrompt.tsx                 ← Warning dialog
└── projectmodification/
    └── components/
        └── ProjectForm.tsx              ← Integration point
```

## 🔧 Key Functions

### ExcessComponentAutomation.ts

```typescript
// Check if category requires validation
shouldCheckExcessComponent(category: string): boolean

// Calculate difference
calculateExcessAmount(projectCost: number, totalComponentCost: number): number

// Main validation function
checkExcessComponent(
  category: string,
  projectCost: number,
  totalComponentCost: number
): { shouldPrompt: boolean; excessAmount: number; message: string } | null
```

## 💡 Usage in Code

```typescript
import { checkExcessComponent } from '../../conditions/ExcessComponentAutomation';

const handleAddComponent = (newCost) => {
  const newTotal = currentTotal + newCost.Total;
  const check = checkExcessComponent(category, projectCost, newTotal);
  
  if (check?.shouldPrompt) {
    // Show ExcessPrompt dialog
    setExcessComponentData(check);
    setIsExcessPromptOpen(true);
  } else {
    // Add component normally
    addComponent(newCost);
  }
};
```

## 🎨 ExcessPrompt Dialog Props

```typescript
<ExcessPrompt
  isOpen={boolean}
  onClose={() => void}
  onConfirm={() => void}      // Creates EXC component
  onCancel={() => void}        // Exits without creating
  projectCost={number}
  totalComponentCost={number}
  excessAmount={number}
/>
```

## ✨ EXC Component Properties

When created, the EXC component has:

| Property | Value |
|----------|-------|
| ComponentType | `"EXC"` |
| ComponentId | `"EXC-{timestamp}"` |
| Description | `"Excess - Intentional Project Cost Reduction"` |
| Total | Excess amount (difference) |
| CreatedBy | Current user |
| CreatedDate | Current timestamp |

## 🧪 Test Scenarios

| # | Category | Project Cost | Component Cost | Result |
|---|----------|--------------|----------------|--------|
| 1 | Adjustment | ₱1,000,000 | ₱800,000 | ✅ Show prompt |
| 2 | Adjustment | ₱1,000,000 | ₱1,200,000 | ❌ No prompt |
| 3 | Regular | ₱1,000,000 | ₱800,000 | ❌ No prompt |
| 4 | Termination | ₱1,000,000 | ₱1,000,000 | ❌ No prompt |
| 5 | Adjustment | ₱500,000 | ₱300,000 | ✅ Show prompt |

## 📝 Configuration

To add/remove categories, edit `ExcessComponentAutomation.ts`:

```typescript
const APPLICABLE_CATEGORIES = [
  'adjustment',
  'changeinauthoritytoimplement',
  'forsavingspartialunutilizedbalance',
  'nonimplementable',
  'termination'
  // Add more here...
];
```

## 🐛 Troubleshooting

**Q: Dialog doesn't appear**
- Check if category is in APPLICABLE_CATEGORIES
- Verify project cost > component cost
- Check console for validation logs

**Q: EXC component not created**
- Check if user clicked OK (not Cancel)
- Verify handleExcessPromptConfirm is called
- Check component costs state

**Q: Wrong excess amount**
- Verify projectCost is from programDetails.Cost
- Check totalComponentCost calculation includes all components
- Ensure calculation happens AFTER new component is added

## 📞 Support

For issues or questions:
1. Check console logs for validation steps
2. Review EXCESS_COMPONENT_IMPLEMENTATION.md
3. Run examples from ExcessComponentAutomation.examples.ts
4. Check integration in ProjectForm.tsx

---

**Last Updated:** December 4, 2025  
**Version:** 1.0.0
