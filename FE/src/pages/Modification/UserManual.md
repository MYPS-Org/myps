# Project Modification — User Manual

## Overview

The **Modification** module allows you to request changes to approved projects and track those requests through a review and approval workflow. Modifications are formally documented, categorized by type (e.g., Adjustment, Termination, Additional Funding), and require a supporting approval document before submission.

The workflow follows two stages of approval:
1. **Region Office** — initial review and approval
2. **Central Office (CO)** — final approval that publishes changes to MYPS and PCMA

---

## Starting a Modification Request

Modification requests are initiated **from the Project Details page**, not from the Modification module directly.

1. Open the project you want to modify from the Projects list.
2. On the project detail page, look for a **Modify** or **Request Revision** button.
3. Select the **Modification Category** (e.g., Adjustment, Termination) and the specific **Reason** for the modification.
4. Click **Proceed** — the system opens the Modification form pre-loaded with the project's current data.

---

## Modification Form

After initiating a request, you are taken to the modification form. This form shows the project's current data and lets you edit only the fields that are allowed for your selected category and reason.

### Sections in the Form

| Section | Description |
|---|---|
| **Revision Info** | Shows the category, reason, Project ID, and any previously attached documents or correction notes |
| **Program Details** | Program information — generally read-only in modification context |
| **Project Details** | Editable project fields (which ones are active depends on your modification category and PCMA construction status) |
| **Map** | Geographic view of the project — read-only |
| **Component Costs** | List of project components with their costs — add, edit, or delete as allowed |
| **Major Items of Work** | Work items linked to components — add, edit, delete, or copy |
| **Funding Profile** | Funding sources and amounts |
| **Notes** | Free-text notes for this revision |
| **Activity Log** | History of changes and transactions on this project |

You can collapse or expand each section by clicking its header.

---

## Field Editability Rules

Not all fields can be edited for every modification. The system enforces rules based on **three factors**:

### 1. Modification Category and Reason

Each category/reason combination has a specific set of allowed fields. For example:
- **Adjustment — Correction of MYPS typographical error** → only the Description field is editable
- **Adjustment — Move funds between existing Project Components** → only component cost fields are editable
- **Termination** → component cost fields and major item fields may be edited

Fields that are not allowed for your category/reason will be **grayed out** (disabled).

### 2. PCMA Construction Status

The project's PCMA construction status (Not yet started, On-going, Completed, Terminated) further controls which fields are editable:

| Situation | What you can edit |
|---|---|
| **Not yet started** and **not packaged** | All fields allowed by your category/reason |
| **Not yet started** or **On-going** and **packaged** | Limited fields (Description, some cost fields) |
| **Completed** or **Terminated** | No fields are editable |

### 3. API-Provided Field Rules

The system receives exact field permissions from the server based on your specific category, reason, and project status. These override all defaults. If a field appears disabled without explanation, it is restricted by the server-side rule for your combination.

---

## Working with Component Costs

### Viewing Components

The Component Costs section shows all project components in a table with their descriptions, types, start/end dates, and total amounts.

### Adding a Component

1. Click **Add Component** (if your modification allows it).
2. Select a **Component Type** from the dropdown.
3. Optionally click the **Auto-Fill** button (sparkle icon) to automatically populate the description based on the component type.
4. Enter the **Description**, **Start Date**, **End Date**, and **Total Amount**.
5. Add per-year cost breakdown rows as needed in the lower table.
6. Click **Save**.

> **Note:** If the project cost is greater than the sum of all component costs, the system will prompt you about an **Excess Component**. See the section below.

### Editing a Component

Click the pencil icon on the component row. The same dialog opens pre-filled. Only the fields allowed by your modification rules will be editable.

### Deleting a Component

Click the trash icon on the component row. A confirmation dialog appears showing:
- Which component will be deleted
- How many Major Items of Work are linked to it (and will also be deleted)

Confirm to proceed. Deletions cascade automatically to per-year cost rows and linked major items.

---

## Excess Component Warning

When you add or edit component costs, if the **Project Cost is greater than the total of all component costs**, the system detects an intentional reduction and shows a warning:

> "The Project Cost (₱X) is greater than the Total Project Component Cost (₱Y). Is this an intentional reduction of Project Cost?"

- **OK** — The system automatically creates a new **EXC (Excess)** component for the difference. This component can be edited or deleted afterward.
- **Cancel** — No component is created; you return to the form.

This applies when your modification category is: Adjustment, Change in Authority to Implement, For Savings - Partial Unutilized Balance, Non Implementable, or Termination.

---

## Working with Major Items of Work

Major Items are work items nested under components. Each major item can have one or more **Work Locations**.

### Expanding a Row

Click the arrow (▶) next to a major item row to expand its work locations.

### Adding a Major Item

1. Click **Add Major Item** (if allowed by your modification rules).
2. Select the **Component**, **Year of Work**, **Work Type**, and **Infrastructure Type**.
3. Click **Save**.

### Copying a Major Item

Click the copy icon on a major item row. A dialog opens letting you select a target component to copy the item into.

### Editing a Major Item

Click the pencil icon. In edit mode, only the fields allowed by your modification rules will be active.

### Deleting a Major Item

Click the trash icon. The confirmation dialog will warn if the item has work locations that will also be deleted. Confirm to proceed.

### Work Locations

Each major item can have work location rows. To add a location, expand the major item row and click **Add Work Location**. Fill in the infrastructure details (chainage, physical target, etc.) and save. Edit and delete icons are available per row.

---

## Specific Modification Types

### Termination

When you select a Termination category, an additional dialog appears asking:

> "Does this project have unfinished work?"

Select **Yes** or **No** and confirm. This is required before you can proceed.

Additionally, for **Termination - No Disbursement** (Reason ID 37): the system automatically finds all terminated project components, sets their amounts to zero, and creates an EXC excess component for the total terminated amount. This happens automatically — no manual action is needed.

### Non-Implementable

A dialog opens with the list of project components. Select which components to mark as non-implementable by checking the checkboxes. At least one component must be selected to proceed.

---

## Submitting the Modification Request

Once you have made all required edits:

1. Click the **Submit Revision** button in the action bar.
2. The submission dialog opens. Fill in:
   - **Date of Approval** — the date the approval document was issued
   - **Approval Document** — upload the supporting PDF file (PDF only, required)
   - **Certification checkbox** — check "I certify that the information is accurate"
3. Click **Submit**.

A Transaction ID is generated by the system for tracking. You will be navigated back to the modification list.

---

## Viewing the Modification List

Navigate to **Modification** from the main menu to see all revision requests.

### List Columns

| Column | Description |
|---|---|
| Revision Name | Type of revision |
| Reason | Reason for the modification |
| Region Status | Approval status at Region level |
| CO Status | Approval status at Central Office level |
| Created By | Who submitted the request |
| Date | Date created |

### Status Badge Colors

| Color | Meaning |
|---|---|
| Yellow | For Approval — awaiting review |
| Red (light) | For Correction — returned for changes |
| Red (dark) | Disapproved |
| Green | Approved |
| Gray | Other / Pending |

### Searching

Type a **Project ID** in the search box and press **Search** to filter the list. Click the X icon to clear the search.

### Viewing a Request

Click on any row to open the full revision detail view in read mode. If you are a reviewer, the approval action buttons will be available.

---

## Reviewing and Approving a Modification (Reviewer Role)

When viewing a revision as a reviewer, the action bar shows:

### Approve

1. Click **Approve**.
2. A confirmation dialog shows the project and modification details.
3. Click **Confirm Approve**.
4. The modification is marked as Approved and changes are published to the project.

### Disapprove

1. Click **Disapprove** (or **Reject**).
2. Enter a required **Rejection Reason** explaining why the request is being rejected.
3. Click **Confirm Disapprove**.
4. The requester is notified and the request is marked as Disapproved.

### Request Changes (For Review)

1. Click **Request Changes** (or **For Review**).
2. Enter required **Review Comments** explaining what needs to be changed.
3. Click **Submit**.
4. The request is returned to the requester with your comments visible in the Revision Info section's "For Corrections" history.

---

## Resubmitting After a Review Request

If your request was returned with comments ("For Correction" status):

1. Open the request from the Modification list.
2. Review the corrections noted in the **Revision Info** section.
3. Make the necessary changes to the project data.
4. Click **Resubmit**.
5. The resubmit dialog opens — upload the (possibly updated) approval document, set the date, check the certification, and click **Resubmit**.

---

## Quick Reference

| Action | How |
|---|---|
| Start a modification | From Project Details page → Modify / Request Revision |
| Submit a revision | Fill out changes → Submit Revision button → upload PDF → certify → Submit |
| Search modifications | Modification list → type Project ID in search box |
| View a revision | Click any row in the Modification list |
| Approve a revision | View revision → Approve button → confirm |
| Disapprove a revision | View revision → Disapprove → enter reason → confirm |
| Return for corrections | View revision → Request Changes → enter comments → submit |
| Resubmit after correction | View revision → make changes → Resubmit → upload PDF → submit |
| Add component cost | Component Costs section → Add Component → fill form → save |
| Delete component | Component Costs → trash icon → confirm (note cascade warning) |
| Add major item | Major Items of Work section → Add Major Item → fill form → save |
| Add work location | Expand major item row → Add Work Location → fill → save |