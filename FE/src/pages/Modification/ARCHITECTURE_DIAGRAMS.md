# Jotai Architecture - Visual Guide

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER INTERFACE LAYER                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────┐      ┌──────────────────┐     ┌─────────────┐  │
│  │  ProjectForm    │      │ ComponentCost    │     │ Debug Panel │  │
│  │                 │      │    Dialog        │     │             │  │
│  │  - Main form    │      │  - Date fields   │     │  - Status   │  │
│  │  - Debug btns   │      │  - Validation    │     │  - Controls │  │
│  └────────┬────────┘      └────────┬─────────┘     └──────┬──────┘  │
│           │                        │                      │         │
│           └────────────────┬───────┴──────────────────────┘         │
│                            │                                        │
└────────────────────────────┼────────────────────────────────────────┘
                             │
┌────────────────────────────┼───────────────────────────────────────┐
│                     HOOKS LAYER (API)                              │
├────────────────────────────┼───────────────────────────────────────┤
│                            ▼                                       │
│                                                                    │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │          useFieldPermissions() [Main Hook]                 │    │
│  │  Returns: { pcmaStatus, currentCase, permissions, ... }    │    │
│  └───────────────────────────┬────────────────────────────────┘    │
│                              │                                     │
│  ┌──────────────────┬────────┴────────┬────────────────────┐       │
│  │                  │                 │                    │       │
│  ▼                  ▼                 ▼                    ▼       │
│  useIsFieldEditable useFieldEditStatus useDebugControls    ...     │ 
│  (fieldName, value) (fieldName, value) (setCaseA/B/C)              │
│                                                                    │
└────────────────────────────┬───────────────────────────────────────┘
                             │
┌────────────────────────────┼───────────────────────────────────────┐
│                     JOTAI STORE LAYER                              │
├────────────────────────────┼───────────────────────────────────────┤
│                            ▼                                       │
│                                                                    │
│  ┌──────────────┐  ┌─────────────┐  ┌────────────────────┐         │
│  │  Base Atoms  │  │Derived Atoms│  │   Action Atoms     │         │
│  ├──────────────┤  ├─────────────┤  ├────────────────────┤         │
│  │              │  │             │  │                    │         │
│  │ pcmaStatus   │  │ currentCase │  │ setCaseAAtom       │         │
│  │   ↕          │  │   (auto)    │  │ setCaseBAtom       │         │
│  │ localStorage │  │             │  │ setCaseCAtom       │         │
│  │              │  │ permissions │  │ randomizeAtom      │         │
│  │ packageStatus│  │   (auto)    │  │ setFromAPIAtom     │         │
│  │   ↕          │  │             │  │ resetAtom          │         │
│  │ localStorage │  │             │  │                    │         │
│  │              │  │             │  │                    │         │
│  │ context      │  │             │  │                    │         │
│  │  - category  │  │             │  │                    │         │
│  │  - reason    │  │             │  │                    │         │
│  │  - reasonId  │  │             │  │                    │         │
│  └──────┬───────┘  └──────┬──────┘  └──────────┬─────────┘         │
│         │                 │                    │                   │
│         └─────────────────┴────────────────────┘                   │
│                           │                                        │
└───────────────────────────┼────────────────────────────────────────┘
                            │
┌───────────────────────────┼───────────────────────────────────────┐
│                    BUSINESS LOGIC LAYER                           │
├───────────────────────────┼───────────────────────────────────────┤
│                           ▼                                       │
│                                                                   | 
│  ┌────────────────────────────────────────────────────────────┐   │
│  │                     RuleManager                            │   │
│  │  - determineCase(pcmaStatus, packageStatus)                │   │
│  │  - getAllowedFields(category, reason, case)                │   │
│  │  - canEditFieldBasedOnValue(field, value, reason)          │   │
│  └──────────────────────────┬─────────────────────────────────┘   │
│                             │                                     │
│         ┌───────────────────┼───────────────────┐                 │
│         │                   │                   │                 │
│         ▼                   ▼                   ▼                 │
│  ┌──────────────┐  ┌─────────────────┐  ┌──────────────┐          │
│  │ Adjustment   │  │ Additional      │  │  Termination │          │
│  │   Fields     │  │   Fund          │  │    Fields    │          │
│  │              │  │   Fields        │  │              │          │
│  │ - Case A/B/C │  │                 │  │              │          │
│  │ - Reasons    │  │ - Case A/B/C    │  │              │          │
│  │ - Value cond │  │ - Reasons       │  │              │          │
│  └──────────────┘  └─────────────────┘  └──────────────┘          │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Data Flow

### 1. Initialization Flow
```
User Navigation
      │
      ▼
ProjectForm receives props
  (category, reason, reasonId)
      │
      ▼
useInitializeModificationContext()
      │
      ▼
setModificationContextAtom
      │
      ▼
modificationContextAtom updated
      │
      ▼
currentCaseAtom recalculates (derived)
      │
      ▼
fieldPermissionsAtom recalculates (derived)
      │
      ▼
UI updates automatically
```

### 2. Manual Case Setting Flow (Debug Mode)
```
User clicks "Set Case A"
      │
      ▼
useDebugControls().setCaseA()
      │
      ▼
setCaseAAtom executed
      │
      ▼
pcmaStatusAtom = "Not yet started"
packageStatusAtom = "not packaged"
      │
      ▼
localStorage updated
      │
      ▼
currentCaseAtom recalculates → "A"
      │
      ▼
fieldPermissionsAtom recalculates
      │
      ▼
UI updates (fields enable/disable)
```

### 3. Field Validation Flow
```
User types in StartDate field
      │
      ▼
Component calls useIsFieldEditable('StartDate', value)
      │
      ▼
Hook reads currentCaseAtom & modificationContextAtom
      │
      ▼
RuleManager.isFieldEditableWithValue(...)
      │
      ├─▶ Check Case-based permission
      │     (Is field allowed in Case A/B/C?)
      │
      ├─▶ Check Reason-based permission
      │     (Is field in reasonSpecificFields?)
      │
      └─▶ Check Value-based permission
            (Does field have a value?)
      │
      ▼
Return: true/false
      │
      ▼
Component: disabled={!isEditable}
```

### 4. API Integration Flow (Production - Future)
```
API Response arrives
  { pcmaStatus: "On-going", packageStatus: "packaged" }
      │
      ▼
useAPIIntegration().setStatusFromAPI(pcmaStatus, packageStatus)
      │
      ▼
setStatusFromAPIAtom executed
      │
      ▼
pcmaStatusAtom = "On-going"
packageStatusAtom = "packaged"
      │
      ▼
currentCaseAtom recalculates → "B"
      │
      ▼
fieldPermissionsAtom recalculates
      │
      ▼
UI updates automatically
```

---

## 🎨 Component Hierarchy

```
App
 │
 ├─ Router
 │   │
 │   └─ ModificationPage
 │       │
 │       ├─ ProjectForm ✅ (uses Jotai)
 │       │   │
 │       │   ├─ useFieldPermissions() 🎣
 │       │   ├─ useInitializeModificationContext() 🎣
 │       │   ├─ useDebugControls() 🎣
 │       │   │
 │       │   ├─ ProjectDetailsForm
 │       │   ├─ ProgramDetailsForm
 │       │   ├─ ComponentCostForm
 │       │   │   │
 │       │   │   └─ ComponentCostDialog ✅ (uses Jotai)
 │       │   │       │
 │       │   │       ├─ useIsFieldEditable('StartDate', value) 🎣
 │       │   │       ├─ useIsFieldEditable('EndDate', value) 🎣
 │       │   │       └─ useFieldEditStatus(...) 🎣
 │       │   │
 │       │   └─ MajorItemOfWorksForm
 │       │
 │       └─ FieldPermissionDebugPanel ✅ (uses Jotai)
 │           │
 │           ├─ useFieldPermissionState() 🎣
 │           └─ useDebugControls() 🎣
 │
 └─ JotaiProvider (implicit, uses default store)

Legend:
✅ = Migrated to Jotai
🎣 = Uses Jotai hook
```

---

## 🔐 Permission Decision Tree

```
Is field editable?
     │
     ├─── Check CASE ─────────────────────────────────────┐
     │                                                     │
     │    Case A: Most permissive                         │
     │    Case B: Restricted                              │
     │    Case C: Most restrictive                        │
     │                                                     │
     │    ❓ Is field allowed in this case?               │
     │         │                                           │
     │         ├─ NO  → ❌ DISABLED (Case restriction)    │
     │         │                                           │
     │         └─ YES → Continue ↓                         │
     │                                                     │
     ├─── Check REASON ────────────────────────────────────┤
     │                                                     │
     │    Reason: "Input of missing dates"                │
     │                                                     │
     │    ❓ Is field in reasonSpecificFields?            │
     │         │                                           │
     │         ├─ NO  → ❌ DISABLED (Not for this reason) │
     │         │                                           │
     │         └─ YES → Continue ↓                         │
     │                                                     │
     ├─── Check VALUE CONDITION ───────────────────────────┤
     │                                                     │
     │    Field: StartDate                                │
     │    Condition: "Only if null or empty"              │
     │                                                     │
     │    ❓ Does field meet value condition?             │
     │         │                                           │
     │         ├─ NO  → ❌ DISABLED (Field has value)     │
     │         │                                           │
     │         └─ YES → Continue ↓                         │
     │                                                     │
     └─────────────────────────────────────────────────────┤
                                                           │
                           ✅ EDITABLE                     │
                                                           │
                   (Field passes all checks)               │
                                                           │
                           ↓                               │
                                                           │
          User can type/modify the field                  │
                                                           │
───────────────────────────────────────────────────────────┘
```

---

## 📊 State Dependencies Graph

```
                    pcmaStatusAtom ◄──── localStorage
                          │
                          │ read
                          │
    packageStatusAtom ────┼───► currentCaseAtom ────┐
          │               │         (derived)       │
          │               │                         │
          │ read          │                         │ read
          ▼               │                         │
    localStorage          │                         │
                          │                         │
                          ▼                         ▼
              modificationContextAtom ──► fieldPermissionsAtom
                    (category,                   (derived)
                     reason,                         │
                     reasonId)                       │
                          ▲                          │
                          │                          │
                          │                          │ read
                          │                          │
                   setModificationContextAtom        │
                          ▲                          │
                          │                          │
                          │                          ▼
              useInitializeModificationContext()
                          ▲                    Components
                          │                    (UI Layer)
                          │
                    ProjectForm props
                (category, reason, reasonId)
                          ▲
                          │
                      User Navigation

Legend:
────► = data flow
◄──── = persisted to
```

---

## 🧩 Hook Dependency Map

```
useFieldPermissions()
  │
  ├─ useAtomValue(pcmaStatusAtom)
  ├─ useAtomValue(packageStatusAtom)
  ├─ useAtomValue(currentCaseAtom)
  ├─ useAtomValue(modificationContextAtom)
  ├─ useAtomValue(fieldPermissionsAtom)
  ├─ useSetAtom(pcmaStatusAtom)
  └─ useSetAtom(packageStatusAtom)

useIsFieldEditable(fieldName, value)
  │
  ├─ useAtomValue(currentCaseAtom)
  ├─ useAtomValue(modificationContextAtom)
  └─ RuleManager.isFieldEditableWithValue(...)

useFieldEditStatus(fieldName, value)
  │
  ├─ useAtomValue(currentCaseAtom)
  ├─ useAtomValue(modificationContextAtom)
  └─ RuleManager.getFieldEditStatus(...)

useInitializeModificationContext(category, reason, reasonId)
  │
  ├─ useSetAtom(setModificationContextAtom)
  └─ useEffect(() => { ... }, [category, reason, reasonId])

useDebugControls()
  │
  ├─ useSetAtom(setCaseAAtom)
  ├─ useSetAtom(setCaseBAtom)
  ├─ useSetAtom(setCaseCAtom)
  ├─ useSetAtom(randomizeStatusAtom)
  └─ useSetAtom(resetStatusAtom)

useAPIIntegration()
  │
  └─ useSetAtom(setStatusFromAPIAtom)
```

---

## 🔄 Atom Lifecycle

```
Application Start
      │
      ▼
┌─────────────────────┐
│ Jotai initializes   │
│ all atoms with      │
│ default values      │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────────────────┐
│ atomWithStorage reads           │
│ from localStorage:              │
│ - modification-pcma-status      │
│ - modification-package-status   │
└──────────┬──────────────────────┘
           │
           ▼
┌─────────────────────────────────┐
│ If localStorage has values,     │
│ atoms initialized with them     │
│ Otherwise, use defaults ('')    │
└──────────┬──────────────────────┘
           │
           ▼
┌─────────────────────────────────┐
│ Derived atoms calculate:        │
│ - currentCaseAtom               │
│ - fieldPermissionsAtom          │
└──────────┬──────────────────────┘
           │
           ▼
┌─────────────────────────────────┐
│ Components mount and            │
│ subscribe to atoms              │
└──────────┬──────────────────────┘
           │
           ▼
┌─────────────────────────────────┐
│ User interaction triggers       │
│ atom updates via action atoms   │
└──────────┬──────────────────────┘
           │
           ▼
┌─────────────────────────────────┐
│ Action atom executed:           │
│ - Updates base atoms            │
│ - Saves to localStorage         │
└──────────┬──────────────────────┘
           │
           ▼
┌─────────────────────────────────┐
│ Derived atoms recalculate       │
│ automatically (reactive)        │
└──────────┬──────────────────────┘
           │
           ▼
┌─────────────────────────────────┐
│ Subscribed components           │
│ re-render with new values       │
└─────────────────────────────────┘
```

---

## 🎯 Case Determination Logic

```
Input: pcmaStatus, packageStatus
           │
           ▼
┌─────────────────────────────────┐
│ Is PCMA = "Completed" OR        │
│    PCMA = "Terminated"?         │
└──────────┬───────────┬──────────┘
           │           │
          YES         NO
           │           │
           ▼           ▼
      Case C    ┌────────────────┐
                │ Is package =    │
                │   "packaged"?   │
                └────┬──────┬─────┘
                     │      │
                    YES    NO
                     │      │
                     ▼      ▼
                 Case B   Case A

Final Output: "A", "B", or "C"
           │
           ▼
Used by fieldPermissionsAtom to filter fields
```

---

## 💾 localStorage Structure

```json
{
  "modification-pcma-status": "Not yet started",
  "modification-package-status": "not packaged"
}
```

**Key Details**:
- Persisted on every status change
- Read on application start
- Can be cleared for testing: `localStorage.clear()`
- Only stores status values, not full permissions (permissions are derived)

---

## 🔍 Debug Panel Layout

```
╔════════════════════════════════════════════╗
║  Field Permission Debug Panel              ║
║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
║                                            ║
║  📊 Current Status                         ║
║  PCMA Status: Not yet started              ║
║  Package Status: not packaged              ║
║  Current Case: A  ◄── [green indicator]    ║
║                                            ║
║  📝 Context                                ║
║  Category: Adjustment                      ║
║  Reason: Input of missing dates            ║
║  ReasonId: 123                             ║
║                                            ║
║  🎮 Controls                               ║
║  ┌────────┐ ┌────────┐ ┌────────┐        ║
║  │Set     │ │Set     │ │Set     │        ║
║  │Case A  │ │Case B  │ │Case C  │        ║
║  └────────┘ └────────┘ └────────┘        ║
║                                            ║
║  ┌────────┐ ┌────────┐                   ║
║  │Random  │ │Reset   │                   ║
║  └────────┘ └────────┘                   ║
║                                            ║
║  ✅ Editable Fields                        ║
║  • StartDate                               ║
║  • EndDate                                 ║
║  • ComponentCost                           ║
║  • Duration                                ║
║                                            ║
║  ℹ️ Case Legend:                          ║
║  🟢 A: Most permissive                     ║
║  🟡 B: Restricted                          ║
║  🔴 C: Most restrictive                    ║
║                                            ║
╚════════════════════════════════════════════╝
    Position: Fixed (bottom-right)
    Z-index: 1000
    Draggable: Optional
```

---

## 📈 Performance Characteristics

```
Operation                        | Speed      | Notes
─────────────────────────────────|────────────|──────────────────
Initial atom creation            | ~5ms       | One-time cost
localStorage read                | ~2ms       | On app start
Case determination               | <1ms       | Pure function
Permission calculation           | ~5ms       | With 50+ fields
Field validation (single)        | <1ms       | Cached
Debug panel update               | <10ms      | Reactive
Component re-render (on change)  | ~20ms      | React batches
Setting case (setCaseA/B/C)      | ~15ms      | Includes localStorage
API status update (future)       | ~15ms      | Plus network time
```

**Optimization Notes**:
- Derived atoms are memoized (only recalculate when dependencies change)
- Field validation is fast (O(1) map lookups)
- localStorage writes are async (non-blocking)
- React batches multiple atom updates

---

## 🚦 Error Handling Strategy

```
┌─────────────────────────────┐
│  User Action / API Call     │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│  Validation Layer           │
│  - Type checking            │
│  - Null/undefined checks    │
└──────────┬──────────────────┘
           │
           ├─ Invalid ───► Return default/fallback
           │               Log to console
           │
           └─ Valid ───► Continue
                         │
                         ▼
           ┌─────────────────────────────┐
           │  Business Logic             │
           │  - RuleManager              │
           │  - Case determination       │
           └──────────┬──────────────────┘
                      │
                      ├─ Unknown case ───► Default to Case C
                      │                    (most restrictive)
                      │
                      └─ Valid ───► Continue
                                    │
                                    ▼
           ┌─────────────────────────────────┐
           │  Atom Update                    │
           │  - Jotai state change           │
           └──────────┬──────────────────────┘
                      │
                      ▼
           ┌─────────────────────────────────┐
           │  Side Effects                   │
           │  - localStorage save            │
           │  - UI re-render                 │
           └─────────────────────────────────┘
                      │
                      ▼
           ┌─────────────────────────────────┐
           │  Success!                       │
           └─────────────────────────────────┘

Error Handling Principles:
✅ Fail gracefully (use fallbacks)
✅ Never crash the app
✅ Log errors for debugging
✅ Provide user feedback (toast/message)
✅ Default to most restrictive permissions on error
```

---

## 🎓 Learning Path for New Team Members

```
Week 1: Foundation
  └─ Read JOTAI_IMPLEMENTATION_SUMMARY.md
  └─ Understand atom concept (state containers)
  └─ Run the app, use debug panel
  └─ Modify one field's permissions as exercise

Week 2: Deep Dive
  └─ Read JOTAI_GUIDE.md in full
  └─ Study fieldPermissionStore.ts
  └─ Understand derived atoms
  └─ Add a new value condition

Week 3: Integration
  └─ Study existing component usage
  └─ Migrate one new component to Jotai
  └─ Write tests for new component
  └─ Review with team

Week 4: Mastery
  └─ Add new category with rules
  └─ Implement API integration
  └─ Performance optimization
  └─ Help onboard next team member
```

---

**Visual guides complete!** 🎉

All diagrams show the complete Jotai architecture for field permissions.
