# Testing Checklist - Jotai Field Permission System

## ✅ Pre-Testing Setup

- [ ] **Install Dependencies**: Ensure Jotai v2.14.0 is installed
  ```powershell
  cd FE; npm install
  ```

- [ ] **Build Project**: Verify no TypeScript errors
  ```powershell
  npm run build
  ```

- [ ] **Start Dev Server**:
  ```powershell
  npm run dev
  ```

- [ ] **Open Browser**: Navigate to modification page

---

## 🧪 Test Suite 1: Debug Panel Functionality

### Test 1.1: Debug Panel Visibility
- [ ] Debug panel appears in bottom-right corner
- [ ] Panel shows current status values
- [ ] Panel is draggable/movable (if implemented)
- [ ] All buttons are visible and clickable

### Test 1.2: Case Switching
- [ ] Click "Set Case A" → Status shows "Not yet started" + "not packaged"
- [ ] Click "Set Case B" → Status shows "On-going" or "Not yet started" + "packaged"
- [ ] Click "Set Case C" → Status shows "Completed" or "Terminated" + any package status
- [ ] Click "Randomize" → Status changes randomly

### Test 1.3: Status Display
- [ ] Current Case shows correctly (A/B/C)
- [ ] Color coding works (green=A, yellow=B, red=C)
- [ ] Context shows: Category, Reason, ReasonId
- [ ] Editable fields list updates when case changes

### Test 1.4: Persistence
- [ ] Set Case A → Refresh page → Still Case A
- [ ] Check localStorage: Keys `modification-pcma-status` and `modification-package-status` exist
- [ ] Clear localStorage → Refresh → Status resets

---

## 🧪 Test Suite 2: Value-Based Field Validation

### Test 2.1: StartDate Field (Null → Value)
**Setup**: Set Case A + Select reason "Input of missing Planned Start/End Date"

- [ ] Open ComponentCost dialog with **empty** StartDate
- [ ] StartDate field is **enabled** (can type)
- [ ] Enter a date value
- [ ] Save and reopen dialog
- [ ] StartDate field is now **disabled** (cannot edit)
- [ ] Hover/click shows reason: "Field has value"

### Test 2.2: EndDate Field (Null → Value)
**Setup**: Same as 2.1

- [ ] Open ComponentCost dialog with **empty** EndDate
- [ ] EndDate field is **enabled**
- [ ] Enter a date value
- [ ] Save and reopen dialog
- [ ] EndDate field is now **disabled**
- [ ] Shows reason: "Field has value"

### Test 2.3: ComponentCost Field
**Setup**: Same as 2.1

- [ ] ComponentCost field follows same pattern as dates
- [ ] Empty = editable, filled = disabled
- [ ] Reason message displays correctly

---

## 🧪 Test Suite 3: Case-Based Permissions

### Test 3.1: Case A (Most Permissive)
**Setup**: Click "Set Case A" in debug panel

- [ ] Select reason: "Input of missing Planned Start/End Date"
- [ ] Only date-related fields are editable
- [ ] All other fields are disabled
- [ ] Reason shows: "Not allowed for this reason"

- [ ] Change reason to another option
- [ ] Verify different fields become editable
- [ ] Non-reason fields still disabled

### Test 3.2: Case B (Restricted)
**Setup**: Click "Set Case B" in debug panel

- [ ] Select any reason
- [ ] Fewer fields editable than Case A
- [ ] Check multiple reasons
- [ ] All follow Case B rules

### Test 3.3: Case C (Most Restrictive)
**Setup**: Click "Set Case C" in debug panel

- [ ] Select any reason
- [ ] Most fields are disabled
- [ ] Only critical fields editable (if any)
- [ ] Reason shows: "Not allowed in Case C"

---

## 🧪 Test Suite 4: Component Integration

### Test 4.1: ProjectForm Integration
- [ ] ProjectForm loads without errors
- [ ] Debug controls appear (Set Case A/B/C buttons)
- [ ] Clicking case buttons updates permissions
- [ ] Form fields reflect permission changes
- [ ] No console errors

### Test 4.2: ComponentCostDialog Integration
- [ ] Dialog opens successfully
- [ ] StartDate field permissions work
- [ ] EndDate field permissions work
- [ ] ComponentCost field permissions work
- [ ] Save functionality still works
- [ ] Cancel functionality still works

### Test 4.3: Prop Removal Verification
- [ ] ComponentCostDialog no longer receives `currentCase` prop
- [ ] ComponentCostDialog no longer receives `pcmaStatus` prop
- [ ] ComponentCostDialog no longer receives `packageStatus` prop
- [ ] All functionality still works (Jotai provides the data)

---

## 🧪 Test Suite 5: Automatic Context Initialization

### Test 5.1: Props to Permissions Flow
**Setup**: Navigate to modification page with URL params or props

- [ ] Pass `category="Adjustment"`, `reason="Some Reason"`, `reasonId=1`
- [ ] Permissions automatically calculated
- [ ] No manual initialization needed
- [ ] Debug panel shows correct context

### Test 5.2: Context Updates
- [ ] Change category → Permissions recalculate
- [ ] Change reason → Permissions recalculate
- [ ] Change reasonId → Permissions recalculate
- [ ] No manual refresh needed

---

## 🧪 Test Suite 6: Edge Cases

### Test 6.1: Null/Undefined Values
- [ ] Field with `null` value → Editable (if allowed by case/reason)
- [ ] Field with `undefined` value → Editable
- [ ] Field with empty string `""` → Editable
- [ ] Field with `0` → Editable (for numeric fields)

### Test 6.2: Invalid States
- [ ] Unknown case → Defaults to Case C (most restrictive)
- [ ] Unknown reason → No reason-specific fields
- [ ] Missing category → Still works with fallback
- [ ] Missing status → Defaults safely

### Test 6.3: Multiple Dialogs
- [ ] Open ComponentCost dialog
- [ ] Switch case while dialog is open
- [ ] Dialog fields update reactively
- [ ] Close and reopen → Correct state maintained

---

## 🧪 Test Suite 7: Performance

### Test 7.1: Reactivity Speed
- [ ] Click case button → Instant update (< 100ms)
- [ ] Type in field → Validation instant
- [ ] Open dialog → No lag
- [ ] Switch between forms → Smooth transitions

### Test 7.2: Memory Usage
- [ ] Open dev tools → Check memory
- [ ] Switch cases 20 times
- [ ] No memory leaks
- [ ] Memory stays stable

---

## 🧪 Test Suite 8: Console & Errors

### Test 8.1: No Console Errors
- [ ] No red errors in console
- [ ] No yellow warnings (except expected)
- [ ] No Jotai-related errors
- [ ] No React errors

### Test 8.2: Debug Logging
**Optional**: Add temporary console.logs

```typescript
// In useFieldPermissions.ts
console.log('Current permissions:', permissions);
console.log('Current case:', currentCase);
```

- [ ] Logs show correct values
- [ ] Updates happen when expected
- [ ] No excessive logging (performance)

---

## 🧪 Test Suite 9: TypeScript Validation

### Test 9.1: Build Validation
```powershell
npm run build
```

- [ ] Build completes successfully
- [ ] No TypeScript errors
- [ ] No type warnings
- [ ] Output bundle created

### Test 9.2: IDE Validation
- [ ] Open VS Code
- [ ] Check "Problems" tab
- [ ] 0 errors in Modification folder
- [ ] IntelliSense works for Jotai hooks
- [ ] Auto-complete shows hook options

---

## 🧪 Test Suite 10: Production Readiness

### Test 10.1: API Integration Pattern
**Note**: This is not yet implemented, just verify the pattern exists

- [ ] `useAPIIntegration` hook exists
- [ ] `setStatusFromAPI` function documented
- [ ] Pattern in JOTAI_GUIDE.md is clear
- [ ] Ready to implement when API is available

### Test 10.2: Debug Panel Removal
- [ ] Set `NODE_ENV=production`
- [ ] Debug panel does NOT appear
- [ ] App still works without debug panel
- [ ] localStorage still persists (or doesn't, based on requirements)

---

## ✅ Sign-Off

### Developer Testing
- [ ] All tests in suites 1-9 passed
- [ ] No blocking issues found
- [ ] Performance is acceptable
- [ ] Ready for QA testing

**Tested by**: _________________  
**Date**: _________________  
**Notes**: _________________

---

### QA Testing
- [ ] Regression tests passed
- [ ] New features work as expected
- [ ] Edge cases handled
- [ ] Ready for staging deployment

**Tested by**: _________________  
**Date**: _________________  
**Notes**: _________________

---

### Staging Validation
- [ ] Tested with real API (when available)
- [ ] Tested with production data
- [ ] No console errors
- [ ] Ready for production

**Validated by**: _________________  
**Date**: _________________  
**Notes**: _________________

---

## 🐛 Issues Found

| Issue # | Severity | Description | Status | Fixed By |
|---------|----------|-------------|--------|----------|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |

**Severity Levels:**
- 🔴 Critical: Blocks functionality
- 🟡 High: Major issue, workaround exists
- 🟢 Medium: Minor issue, doesn't block work
- ⚪ Low: Cosmetic or enhancement

---

## 📊 Test Results Summary

**Total Test Items**: 100+  
**Passed**: ___  
**Failed**: ___  
**Skipped**: ___  
**Pass Rate**: ___%

**Overall Status**: ⬜ Not Started | ⬜ In Progress | ⬜ Passed | ⬜ Failed

---

## 📝 Notes & Observations

_Add any additional observations, suggestions, or notes here:_

