# 🚀 Quick Start Guide - Test Jotai Implementation Now!

## ⏱️ 5-Minute Quick Test

### Step 1: Add Debug Panel (2 minutes)

Open `ProjectForm.tsx` and add the debug panel:

```typescript
// At the top, add import
import FieldPermissionDebugPanel from '../../components/FieldPermissionDebugPanel';

// At the bottom of the return statement, before the closing tag
return (
  <div>
    {/* ...existing code... */}
    
    {/* Add this line: */}
    <FieldPermissionDebugPanel />
  </div>
);
```

### Step 2: Start Development Server (1 minute)

```powershell
cd c:\Users\yabut\source\repos\myps_backend\FE
npm run dev
```

Wait for "ready" message, then open: http://localhost:5173

### Step 3: Navigate to Modification Page (30 seconds)

- Click on "Modifications" in the menu
- Open any project for modification
- You should see the debug panel in the bottom-right corner

### Step 4: Test Field Permissions (1.5 minutes)

1. **Click "Set Case A"** in debug panel
   - Note which fields are editable (should be more permissive)

2. **Open ComponentCost dialog**
   - Leave StartDate empty → Should be EDITABLE
   - Enter a date → Close and reopen → Should be DISABLED

3. **Click "Set Case C"** in debug panel
   - Most fields should become disabled
   - Check ComponentCost dialog again

4. **Click "Randomize"**
   - Status changes randomly
   - Fields update accordingly

✅ **If all above works → Implementation successful!**

---

## 🧪 Complete Testing Guide (30 minutes)

### Test 1: Value-Based Validation (10 min)

#### Setup
1. Click "Set Case A" in debug panel
2. In the form, select reason: "Input of missing Planned Start/End Date"

#### Test Scenarios

**Scenario A: Empty StartDate**
```
1. Open ComponentCost dialog
2. Check StartDate field → Should be ENABLED
3. Check EndDate field → Should be ENABLED
4. Try typing in both → Should accept input
✅ PASS if fields are editable
```

**Scenario B: Fill StartDate**
```
1. Enter a date in StartDate (e.g., 2024-01-15)
2. Click Save
3. Reopen the same ComponentCost
4. Check StartDate → Should be DISABLED
5. Hover or click → Should show reason "Field has value"
✅ PASS if field becomes disabled after having a value
```

**Scenario C: Fill EndDate**
```
1. Same as Scenario B but for EndDate
✅ PASS if same behavior
```

### Test 2: Case Switching (5 min)

**Case A → Case B → Case C**
```
1. Click "Set Case A"
   - Count editable fields (should be most)
   - Open ComponentCost dialog → Check date fields

2. Click "Set Case B"
   - Count editable fields (should be fewer)
   - Same fields in dialog should be more restricted

3. Click "Set Case C"
   - Count editable fields (should be least)
   - Most fields should be disabled

✅ PASS if fields progressively become more restricted
```

### Test 3: Persistence (5 min)

**localStorage Test**
```
1. Click "Set Case A"
2. Check debug panel shows:
   - PCMA Status: "Not yet started"
   - Package Status: "not packaged"
   - Current Case: "A"

3. Open browser DevTools (F12)
4. Go to Application → Local Storage → localhost:5173
5. Check for keys:
   - modification-pcma-status = "Not yet started"
   - modification-package-status = "not packaged"

6. Refresh the page (F5)
7. Debug panel should still show Case A

✅ PASS if status persists across refresh
```

### Test 4: Context Initialization (5 min)

**Automatic Permission Calculation**
```
1. In ProjectForm props, verify:
   - category="Adjustment"
   - reason="Input of missing Planned Start/End Date"
   - reasonId=123

2. Check debug panel "Context" section:
   - Category: Should match
   - Reason: Should match
   - ReasonId: Should match

3. Check editable fields list:
   - Should show only relevant fields for this reason

4. Change reason to something else
5. Editable fields should update

✅ PASS if permissions auto-update with context
```

### Test 5: Error-Free Operation (5 min)

**Console Check**
```
1. Open browser DevTools (F12) → Console tab

2. Perform all above tests again

3. Check for errors:
   ❌ No red errors
   ⚠️ Warnings are OK (but note them)

4. Check for Jotai-related messages:
   - Should be minimal or none

5. Check for React errors:
   - Should be zero

✅ PASS if no console errors during testing
```

---

## 🔧 Troubleshooting

### Issue: Debug Panel Not Showing

**Check:**
1. Did you add `<FieldPermissionDebugPanel />` to ProjectForm?
2. Is the import correct?
3. Check browser console for errors

**Solution:**
```typescript
// In ProjectForm.tsx, at the bottom of return:
<FieldPermissionDebugPanel />
```

### Issue: Fields Not Editable

**Check:**
1. What case are you in? (Check debug panel)
2. What reason is selected?
3. Does the field have a value?

**Debug Steps:**
1. Click "Set Case A" (most permissive)
2. Select a reason that allows your field
3. For value-based fields, ensure they're empty

**Console Logging:**
```typescript
// Temporary debugging in ComponentCostDialog
console.log('StartDate editable:', isStartDateEditable);
console.log('StartDate value:', formData.StartDate);
```

### Issue: Permissions Not Updating

**Check:**
1. Are you using the correct hooks?
2. Is `useInitializeModificationContext` called?

**Solution:**
```typescript
// In ProjectForm
useInitializeModificationContext(category, reason, reasonId);
```

**Verify in Console:**
```typescript
// Add to useFieldPermissions hook
console.log('Current Case:', currentCase);
console.log('Permissions:', permissions);
```

### Issue: localStorage Not Persisting

**Check:**
1. Browser storage available?
2. localStorage not disabled?

**Test:**
```javascript
// In browser console
localStorage.setItem('test', 'value');
localStorage.getItem('test'); // Should return 'value'
```

**Clear and Retry:**
```javascript
localStorage.clear();
// Then refresh and test again
```

### Issue: Case Always Shows "C"

**Check:**
1. What are the current status values?
2. Are they valid PCMA statuses?

**Valid PCMA Statuses:**
- "On-going"
- "Completed"
- "Not yet started"
- "Terminated"

**Valid Package Statuses:**
- "packaged"
- "not packaged"

**Reset:**
Click "Reset" in debug panel or:
```javascript
localStorage.clear();
// Refresh page
```

---

## 📋 Quick Reference

### Hooks Cheat Sheet

```typescript
// Get all permissions
const { permissions, currentCase } = useFieldPermissions();

// Check if field is editable
const isEditable = useIsFieldEditable('StartDate', value);

// Get detailed status
const status = useFieldEditStatus('StartDate', value);
// status = { canEdit: false, reason: "Field has value" }

// Initialize context
useInitializeModificationContext(category, reason, reasonId);

// Debug controls
const { setCaseA, setCaseB, setCaseC, randomize } = useDebugControls();
```

### Debug Panel Buttons

- **Set Case A**: Most permissive (Not yet started + not packaged)
- **Set Case B**: Restricted (On-going + packaged)
- **Set Case C**: Most restrictive (Completed/Terminated)
- **Randomize**: Random status combination
- **Reset**: Clear all status and context

### Case Indicators

- 🟢 **Green = Case A**: Most fields editable
- 🟡 **Yellow = Case B**: Some restrictions
- 🔴 **Red = Case C**: Most restrictive

---

## ✅ Success Checklist

After testing, verify:

- [ ] Debug panel appears and is functional
- [ ] Case switching works (A → B → C)
- [ ] StartDate field editable when empty
- [ ] StartDate field disabled when filled
- [ ] EndDate same behavior as StartDate
- [ ] localStorage persists across refresh
- [ ] No console errors during testing
- [ ] Context initialization works
- [ ] Editable fields list updates
- [ ] All buttons in debug panel work

**If all checked ✅ → Implementation is working correctly!**

---

## 🎯 Next Steps After Testing

### If Everything Works
1. ✅ Mark implementation as validated
2. 📝 Document any observations
3. 🚀 Prepare for API integration
4. 👥 Share with team for feedback

### If Issues Found
1. 📋 Document the issue in TESTING_CHECKLIST.md
2. 🔍 Use troubleshooting section above
3. 💬 Check JOTAI_GUIDE.md for more details
4. 🐛 Add console.logs for debugging

### Production Readiness
1. Remove debug panel from production build:
   ```typescript
   {process.env.NODE_ENV === 'development' && <FieldPermissionDebugPanel />}
   ```

2. Implement API integration:
   ```typescript
   const { setStatusFromAPI } = useAPIIntegration();
   
   useEffect(() => {
     fetchPCMAStatus(projectId).then(response => {
       setStatusFromAPI(response.pcmaStatus, response.packageStatus);
     });
   }, [projectId]);
   ```

3. Add loading states:
   ```typescript
   const [loading, setLoading] = useState(true);
   // Show spinner while fetching
   ```

4. Add error handling:
   ```typescript
   try {
     await fetchPCMAStatus();
   } catch (error) {
     showToast.error('Failed to load permissions');
     // Default to Case C (most restrictive)
   }
   ```

---

## 📞 Support

**Documentation References:**
- 📘 Full API Guide: `JOTAI_GUIDE.md`
- 📊 Architecture: `ARCHITECTURE_DIAGRAMS.md`
- 🗂️ File Reference: `FILE_REFERENCE.md`
- ✅ Testing Checklist: `TESTING_CHECKLIST.md`

**Common Questions:**
- Q: How do I add a new field?
  - A: Add to `reasonSpecificFields` in `AdjustmentFields.ts`

- Q: How do I add value validation?
  - A: Add to `fieldValueConditions` in `AdjustmentFields.ts`

- Q: How do I debug permissions?
  - A: Use debug panel + browser console logs

---

## 🎉 You're Ready!

Start testing now:
1. Add `<FieldPermissionDebugPanel />`
2. Run `npm run dev`
3. Open modification page
4. Click buttons and test!

**Good luck!** 🚀
