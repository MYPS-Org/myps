# RBAC Dialog System - Usage Guide

## 🎯 Overview

The RBAC system now includes fully functional modal dialogs for adding Users, Permissions, and User Groups. This guide explains how to use and extend the dialog system.

## 🏗️ Architecture

### Dialog Components Structure
```
src/pages/Rbac/dialogs/
├── AddUserDialog.tsx      - User creation dialog
├── AddPermissionDialog.tsx - Permission creation dialog  
├── AddGroupDialog.tsx     - User group creation dialog
└── index.ts              - Export barrel for clean imports
```

### Integration Points
- **Rbac.tsx**: Main page that manages all dialog states
- **dialogs/index.ts**: Clean imports using barrel exports
- **useDialog.ts**: Custom hook for dialog state management (optional)

## 🚀 How It Works

### 1. Dialog State Management
Each dialog has its own boolean state in the main RBAC component:
```tsx
const [isAddUserDialogOpen, setIsAddUserDialogOpen] = useState(false);
const [isAddPermissionDialogOpen, setIsAddPermissionDialogOpen] = useState(false);
const [isAddGroupDialogOpen, setIsAddGroupDialogOpen] = useState(false);
```

### 2. Button Integration
Add buttons trigger the dialogs:
```tsx
<Button color="blue" onClick={() => setIsAddUserDialogOpen(true)}>
  <PlusIcon className="w-4 h-4 mr-1" />
  Add User
</Button>
```

### 3. Dialog Components
Each dialog receives:
- `isOpen`: Controls visibility
- `onClose`: Handles closing
- `onSubmit`: Handles form submission

```tsx
<AddUserDialog 
  isOpen={isAddUserDialogOpen} 
  onClose={() => setIsAddUserDialogOpen(false)} 
  onSubmit={(newUser: any) => {
    setUsers([...users, { ...newUser, id: users.length + 1, lastLogin: 'Never' }]);
  }}
/>
```

## 🎨 Dialog Features

### AddUserDialog
- **Form Fields**: First Name, Last Name, Email, Role, Department, Status
- **Validation**: Required fields with proper input types
- **Auto-close**: Resets form and closes on submission

### AddPermissionDialog  
- **Form Fields**: Permission Name, Module, Type, Description
- **Dropdowns**: Pre-defined modules and permission types
- **Validation**: Required name and module selection

### AddGroupDialog
- **Form Fields**: Group Name, Description, Color, Active Status
- **Permission Selection**: Multi-select checkboxes for available permissions
- **Visual Feedback**: Shows selected permission count
- **Color Picker**: Custom group color selection

## 🛠️ Customization

### Adding New Dialog Fields
To add a field to any dialog:

1. **Update the form state**:
```tsx
const [formData, setFormData] = useState({
  // existing fields...
  newField: '',
});
```

2. **Add the input field**:
```tsx
<div>
  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
    New Field
  </label>
  <Input
    type="text"
    value={formData.newField}
    onChange={(e) => handleChange('newField', e.target.value)}
    placeholder="Enter new field"
  />
</div>
```

3. **Update the reset function**:
```tsx
setFormData({
  // existing fields...
  newField: '',
});
```

### Creating New Dialog Components
Follow this template:

```tsx
import React, { useState } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { Button } from '../tailwindui/button';

interface NewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
}

const NewDialog: React.FC<NewDialogProps> = ({ isOpen, onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    // your fields here
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
    setFormData({ /* reset fields */ });
    onClose();
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      {/* Dialog content */}
    </Dialog>
  );
};
```

## 🎯 Best Practices

### 1. **Separation of Concerns**
- Each dialog is a separate component
- Business logic stays in the parent component
- Form validation within each dialog

### 2. **Consistent Props Interface**
All dialogs follow the same prop pattern:
- `isOpen: boolean`
- `onClose: () => void` 
- `onSubmit: (data: any) => void`

### 3. **Form Reset**
Always reset form data after successful submission:
```tsx
const handleSubmit = (e: React.FormEvent) => {
  e.preventDefault();
  onSubmit(formData);
  setFormData(initialFormState); // Reset form
  onClose();
};
```

### 4. **Dark Mode Support**
All dialogs include dark mode classes:
```tsx
className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
```

### 5. **Accessibility**
- Uses Headless UI Dialog for accessibility
- Proper ARIA labels and focus management
- Keyboard navigation support

## 🔧 Optional: Using the useDialog Hook

For cleaner state management, you can use the custom hook:

```tsx
import { useDialog } from '../hooks/useDialog';

const MyComponent = () => {
  const userDialog = useDialog();
  const permissionDialog = useDialog();
  
  return (
    <>
      <Button onClick={userDialog.open}>Add User</Button>
      
      <AddUserDialog 
        isOpen={userDialog.isOpen}
        onClose={userDialog.close}
        onSubmit={handleUserSubmit}
      />
    </>
  );
};
```

## 🚀 Future Enhancements

1. **Form Validation**: Add proper validation with error messages
2. **API Integration**: Connect to real backend endpoints
3. **Edit Dialogs**: Create dialogs for editing existing records
4. **Confirmation Dialogs**: Add delete confirmation dialogs
5. **Multi-step Forms**: For complex data entry scenarios

## 📝 Summary

Your RBAC system now has:
- ✅ **3 Specialized Dialog Components** (User, Permission, Group)
- ✅ **Full Form Functionality** with validation
- ✅ **Dark Mode Support** throughout
- ✅ **Proper State Management** with clean integration
- ✅ **Accessibility Features** using Headless UI
- ✅ **Professional UI/UX** with consistent design
- ✅ **Extensible Architecture** for future enhancements

The dialogs are now fully integrated and ready to use. Users can click any "Add" button to open the appropriate dialog, fill out the form, and submit to add new records to the tables.
