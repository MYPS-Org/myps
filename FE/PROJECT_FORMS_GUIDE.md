# Project Form System - Complete Guide

## Overview
The Project Form System is a React-based form management solution for creating and editing projects with multiple sections. This guide explains how each component works, the data flow, and how the add/edit functionality operates.

## 🏗️ Architecture Overview

### Main Components
1. **ProjectForm** - Main container that orchestrates all form sections
2. **Individual Form Components** - Specialized forms for each data type
3. **Modal Components** - Pop-up forms for complex data entry
4. **View Components** - AddProject and EditProject wrappers

### Data Flow Pattern
```
User Action → Form Component → Handler in ProjectForm → State Update → UI Refresh
```

## 📋 Form Components Breakdown

### 1. ProjectForm (Main Container)

**Location**: `components/ProjectForm.tsx`

**Purpose**: Central hub that manages all form data and coordinates between different sections.

**Key Features**:
- **State Management**: Maintains state for all form sections using React hooks
- **Data Coordination**: Passes data between components (e.g., component costs to major items)
- **Individual Section Saves**: Each section can be saved independently
- **Final Submission**: Combines all data for project creation/update

**State Structure**:
```typescript
// Main form data
const [projectDetails, setProjectDetails] = useState<ProjectDetails>({...});
const [componentCosts, setComponentCosts] = useState<ComponentCost[]>([]);
const [majorItems, setMajorItems] = useState<MajorItemOfWork[]>([]);
const [notes, setNotes] = useState<ProjectNote[]>([]);
const [fundingProfiles, setFundingProfiles] = useState<FundingProfile[]>([]);
const [activities, setActivities] = useState<Activity[]>([]);

// UI state
const [savingSection, setSavingSection] = useState<string | null>(null);
```

**Handler Pattern Example**:
```typescript
// Add handler - receives new item and adds to array
const handleAddComponentCost = (newCost: ComponentCost) => {
  setComponentCosts(prev => [...prev, newCost]);
};

// Edit handler - updates item at specific index
const handleEditComponentCost = (index: number, updatedCost: ComponentCost) => {
  setComponentCosts(prev => prev.map((cost, i) => i === index ? updatedCost : cost));
};

// Delete handler - removes item at specific index
const handleDeleteComponentCost = (index: number) => {
  setComponentCosts(prev => prev.filter((_, i) => i !== index));
};
```

### 2. ComponentCostForm (Modal-Based)

**Location**: `components/ComponentCostForm.tsx`

**Purpose**: Manages component costs which are required for major items of work.

**How onAdd Works**:
1. User clicks "Add Cost" button
2. `handleOpenAddModal()` is called, which:
   - Sets modal mode to 'add'
   - Clears editing index
   - Opens the modal
3. User fills out the ComponentCostModal form
4. When submitted, `handleSaveCost()` is called, which:
   - Calls the parent's `onAdd(newCost)` function
   - Passes the complete ComponentCost object
   - ProjectForm receives this and adds it to the componentCosts array

**Modal Flow**:
```
Click "Add Cost" → Open Modal → Fill Form → Submit → Add to List → Close Modal
```

**Key Features**:
- **Modal-based editing**: Clean, focused interface for data entry
- **Automatic ID generation**: Creates unique IDs for new components
- **Cost calculations**: Real-time total calculation
- **Validation**: Required fields and data validation
- **Display table**: Shows all costs in a read-only table with edit/delete actions

### 3. MajorItemOfWorksForm

**Purpose**: Manages work items that reference component costs.

**Component Cost Dependency**:
- Dropdown populated from `componentCosts` prop
- Shows Component ID and Description for selection
- Requires component costs to be added first

**How it connects to Component Costs**:
```typescript
// In ProjectForm.tsx - Major Items receives component costs
<MajorItemOfWorksForm
  majorItems={majorItems}
  componentCosts={componentCosts} // ← This populates the dropdown
  onAdd={handleAddMajorItem}
  onEdit={handleEditMajorItem}
  onDelete={handleDeleteMajorItem}
/>
```

### 4. Other Form Components

**ProjectDetailsForm**: Basic project information with input fields and dropdowns
**NotesForm**: Simple notes management with CRUD operations
**FundingProfileForm**: Funding source management with percentage validation
**ActivitySection**: Project activities (currently display-only)

## 🔄 How Add/Edit Operations Work

### Add Operation Flow

1. **User Interaction**: User clicks "Add [Item]" button
2. **Modal/Form Opening**: Component shows add form (modal or inline)
3. **Data Entry**: User fills out the form fields
4. **Validation**: Form validates required fields and data formats
5. **Submission**: User clicks "Add" or "Save"
6. **Handler Execution**: Component calls the `onAdd` handler with new data
7. **State Update**: ProjectForm updates the relevant state array
8. **UI Refresh**: Component re-renders showing the new item

### Edit Operation Flow

1. **User Interaction**: User clicks edit icon (pencil) on existing item
2. **Form Population**: Form pre-fills with existing data
3. **Data Modification**: User modifies the fields
4. **Submission**: User clicks "Save" or "Update"
5. **Handler Execution**: Component calls `onEdit` with index and updated data
6. **State Update**: ProjectForm updates the specific item in the array
7. **UI Refresh**: Table/list shows updated information

### Delete Operation Flow

1. **User Interaction**: User clicks delete icon (trash) on existing item
2. **Handler Execution**: Component calls `onDelete` with the item index
3. **State Update**: ProjectForm removes item from array using filter
4. **UI Refresh**: Item disappears from the list

## 💾 Individual Section Saves

Each form section can be saved independently using the "Save Section" buttons.

**How it works**:
1. User clicks "Save Section" for any form section
2. `handleSaveSection()` is called with section name and data
3. The data is sent to the parent component via `onSaveSection` prop
4. In AddProject/EditProject, this could:
   - Save draft to localStorage
   - Make API call to save partial data
   - Validate specific section
   - Show success feedback

**Implementation Example**:
```typescript
// In AddProject.tsx
const handleSaveSection = async (sectionName: string, sectionData: any) => {
  try {
    console.log(`Saving section ${sectionName}:`, sectionData);
    // Could save to API, localStorage, etc.
    alert(`${sectionName} section saved successfully!`);
  } catch (error) {
    console.error(`Error saving ${sectionName}:`, error);
    throw error;
  }
};
```

## 🎯 Component Cost Priority System

**Why Component Costs Come First**:
- Major Items of Work require a Component ID
- Component IDs are created when adding Component Costs
- This creates a dependency: Component Costs → Major Items

**UI Indicators**:
- Blue warning message: "⚠️ Add component costs first - they are required for Major Items of Work"
- Component Cost section is positioned before Major Items
- Major Items dropdown is empty until components are added

## 🚀 Usage Examples

### Adding a Component Cost

1. Navigate to Project Form
2. Scroll to "Component Costs" section
3. Click "Add Cost" button
4. Fill out the modal:
   - Component ID (e.g., "CW1")
   - Description
   - Costs for 2025/2026
   - Optional: Add additional years
   - MYCA Approval date
   - UACS PAP Code
   - Planned Start Date
5. Click "Add" to save
6. Item appears in the component costs table

### Adding a Major Item of Work

1. Ensure at least one Component Cost exists
2. Navigate to "Major Items of Work" section
3. Click "Add Major Item"
4. Select Component ID from dropdown
5. Fill out work details
6. Save the item

### Editing Existing Data

1. Click the pencil icon next to any item
2. Modal/form opens with existing data
3. Modify as needed
4. Click "Save" to update

## 🐛 Troubleshooting

**"Dropdown is empty in Major Items"**: Add Component Costs first
**"Save Section not working"**: Check that onSaveSection prop is passed correctly
**"Modal not opening"**: Verify state management and modal component import
**"Data not persisting"**: Ensure handlers are properly connected to ProjectForm state

## 🔧 Technical Notes

**State Management**: Uses React hooks (useState) for local component state
**Props Pattern**: Parent → Child data flow with callback handlers
**Immutability**: State updates use spread operators and array methods
**TypeScript**: Full type safety with interfaces for all data structures
**UI Components**: Uses TailwindUI components for consistent styling

This system provides a flexible, maintainable approach to complex form management with clear separation of concerns and predictable data flow.
