# LS Wallet — User Manual

> **This is a demo and preview feature.** Everything you see here runs against sample data built for testing purposes. It is not connected to real DPWH records, live programs, or any official budget figures. No actions you take here affect any actual data.

---

## What is an LS Wallet?

An **LS Wallet** (Lump Sum Wallet) is a budget container tied to a Program. Instead of distributing a lump sum budget directly to individual projects, you first place the budget in the wallet, then create **itemized projects** that each draw a specific amount from it.

Think of it like a dedicated envelope for a program's lump sum funds: you load money into the envelope, then allocate pieces of it to specific projects. The wallet shows you at all times how much has been allocated (Used), how much is still free (Available), and what the original total was (Total).

---

## Navigating to LS Wallets

Click **LS Wallet** in the left navigation menu. The LS Wallet list page opens.

---

## LS Wallet List Page

The list shows all wallets you have access to. Each row shows:

| Column | What it means |
|---|---|
| Wallet ID | A unique number identifying the wallet |
| Program Name | The program this wallet belongs to |
| Category | The project category associated with the wallet |
| Stage | The program stage the wallet is currently at (e.g., GAA, GAA-R) |
| Total / Available | The wallet's total budget, and how much is still available to allocate |
| Created | The date the wallet was created |
| Actions | View (opens wallet detail) and a developer stage tool |

### Searching

Type in the search box and press **Enter** or click the blue search button to filter by Operating Unit. Click the clear button (appears when a search is active) to reset.

---

## Creating a New Wallet

1. Click the green **Add Wallet** button at the top right of the list.
2. The **Create Wallet** dialog opens with three sections.

### Section 1 — Project Details

Fill in the basic information about the wallet:

| Field | Description |
|---|---|
| Program | The program this wallet will belong to (required) |
| Category | Project category (required) |
| Sub-Category (Thrust) | The thrust or sub-category within the category |
| Operating Unit | The responsible operating unit |

### Section 2 — Funding Profile

| Field | Description |
|---|---|
| Funding Source | Where the funds come from (e.g., General Appropriations Act) |
| Funding Agreement | The specific agreement reference |
| Amount | The total budget amount for this wallet |
| Funding Percentage | Percentage allocation (typically 100%) |

### Section 3 — Component

The component type is automatically set to **LS** (Lump Sum) and cannot be changed. The amount, start date, end date, and UACS code are filled in here.

> The **LS** component type is reserved exclusively for wallets. It will not appear as an option when you are working with regular or itemized AIP projects.

3. Click **Submit**. The new wallet appears in the list immediately, and you can view its detail page.

---

## Wallet Stage — How It Follows the Program

A wallet does not have its own independent stage. Its stage is inherited from and driven by its parent Program. When the Program advances through its budget cycle (BP → NEP → HGAB → GAA → GAA-R), all wallets for that program advance with it.

You cannot advance a wallet's stage on its own. In this demo, you can simulate a stage advance using the **[Dev] Advance Program Stage** button (visible on the list and on the detail page) — this is a testing tool that would not exist in the production system.

**Stage controls what you can do:**

| Action | Required Stage |
|---|---|
| Replenish the wallet | GAA or later |
| Create an itemized project | GAA-R only |
| Publish an itemized project | GAA-R only |

---

## Wallet Detail Page

Click **View** on any wallet row to open its detail page.

The detail page is divided into:

1. **Balance Widget** — shows Total, Used, and Available at a glance.
2. **Wallet Information** — read-only sections showing the wallet's details, funding profile, and component.
3. **Action Buttons** — Replenish, Add Itemized Project, Delete Wallet, and (in demo mode) Advance Stage.
4. **Itemized Projects** — a table of all projects that draw from this wallet, with per-row actions.
5. **Revision History** — an expandable section under each published project showing its revision records.

---

## Understanding the Balance

The balance widget always shows three numbers:

| Label | What it means |
|---|---|
| **Total** | The wallet's full budget — set when the wallet is created and raised on replenishment |
| **Used** | The sum of all amounts currently drawn by active itemized projects |
| **Available** | Total minus Used — the budget still free to allocate |

**When does each number change?**

- **Total** increases when you replenish the wallet. It never decreases.
- **Used** increases immediately when you create a new itemized project or increase its draw amount. It decreases when you delete an unpublished itemized project.
- **Available** is always Total minus Used, so it changes whenever either of those change.

**Published projects and the frozen draw:**
Once an itemized project is published, its contribution to the Used total is frozen at the amount it had at the moment of publishing. If someone later submits a revision requesting a different cost, the Used figure does not change while the revision is under review. It only changes when the revision is fully approved. This protects the integrity of the official balance throughout the review process.

---

## Replenishing a Wallet

Replenishment increases the wallet's Total budget. You can replenish once the wallet is at the GAA stage or later.

1. On the wallet detail page, click **Replenish**.
2. The **Replenish Wallet** dialog opens showing the current amount.
3. Enter the **new total amount**. This must be higher than the current amount.
4. Click **Confirm**.

> **Decreases are not allowed.** The system will block any replenishment amount that is equal to or lower than the current total. If you entered the wrong amount and need to reduce it, contact your administrator — this will require a process outside this system.

---

## Creating an Itemized Project

An itemized project is an AIP project that draws a specific amount from this wallet as its budget.

**Before you can create one:**
- The wallet must be at the **GAA-R** stage.
- The wallet must have a positive Available balance.

If either condition is not met, the **Add Itemized Project** button will be visible but greyed out, with a tooltip explaining why.

### Steps

1. On the wallet detail page, click **Add Itemized Project**.
2. The **Create Itemized Project** dialog opens. Several fields are pre-filled from the wallet:
   - Category and Sub-Category are inherited from the wallet.
   - Program is inherited from the wallet.
   - Operating Unit is inherited from the wallet.
3. Enter the **Draw Amount** — the portion of the wallet's Available budget this project will use.
4. Click **Submit**.

The new project appears in the Itemized Projects table immediately. The wallet's Available balance decreases by the draw amount right away.

> The project's component details and funding line are created automatically. The funding source and agreement are copied from the wallet.

---

## Editing a Draw Amount (Before Publishing)

Before a project is published, you can adjust how much it draws from the wallet.

1. In the Itemized Projects table, click **Edit Draw Amount** next to the project.
2. Enter the new amount.
3. The system will check that the new amount does not push the wallet's Available balance below zero. If it would, the system blocks the change with an explanation.
4. Click **Confirm** to save. The Available balance updates immediately.

Once a project is published, this button disappears. To change a published project's cost, use **Request Revision** instead.

---

## Publishing an Itemized Project

Publishing makes an itemized project official. Once published, its draw amount is frozen in the wallet balance and it enters the revision workflow for any future cost changes.

1. In the Itemized Projects table, click **Publish** next to the project.
2. The **Publish** dialog opens and runs a compliance check across 13 rules.
3. If all rules pass, a summary is shown and you can confirm.
4. Click **Confirm** to publish.

If any rule fails, the dialog shows you the list of failing rules with the reason. You must resolve those issues before publishing.

> **After publishing, editing the draw amount directly is no longer possible.** The wallet's Used total is now frozen at the published draw amount. To request a cost change, use the **Request Revision** button.

---

## Requesting a Revision (Published Projects)

A revision is a formal request to change the cost of a published itemized project. It follows a two-stage approval process: Region review, then Central Office review.

1. In the Itemized Projects table, click **Request Revision** next to a published project.
2. The **Request Revision** dialog opens.
3. Enter the requested new cost, the reason for the change, and any notes.
4. Click **Submit**.

The revision appears in the **Revision History** section under that project. While the revision is under review:
- The wallet's Used total stays frozen at the original published draw amount.
- The revision record shows a status for each review stage: Pending, Approved, Disapproved, or For Review.

### Reviewing a Revision

Reviewers with the appropriate access see inline action buttons next to the relevant revision stage:

| Button | What it does |
|---|---|
| Approve | Advances the revision to the next stage (or marks it fully approved at CO stage) |
| Reject | Disapproves the revision at this stage |
| Return for Review | Sends the revision back to the requester for corrections |

---

## Deleting a Wallet or Itemized Project

Deletion works differently depending on the wallet or project's history. There are three possible outcomes:

### Outcome 1 — Removed immediately (hard delete)

This applies to wallets or projects that have never been touched since creation — no replenishment, no stage cascade, and never published. Because there is no history to preserve, the record is removed entirely.

### Outcome 2 — Marked as deleted (soft delete)

This applies to wallets or projects that have some history (e.g., the wallet has been replenished, or the project has stage data) but meet the conditions for deletion. The record is not removed — it is flagged as deleted and kept in the system for audit purposes.

For an unpublished itemized project, soft-deleting it immediately returns its draw amount to the wallet's Available balance.

### Outcome 3 — Blocked

This applies when deletion cannot proceed:
- A **wallet** is blocked if it still has active itemized projects. Remove or cancel all projects first.
- An **itemized project** is blocked if it is already published. Published projects cannot be deleted directly — use the Request Revision process to cancel it.

When the system determines which outcome applies, it will tell you clearly before you confirm.

---

## Tips

| Tip | Detail |
|---|---|
| Balance updates instantly | Every action that affects funds (create, edit draw, delete, publish) is reflected in the balance widget immediately, without refreshing the page |
| Stage gates are visible | Buttons that are blocked by the current stage are greyed out with a tooltip explaining the requirement |
| Revision history is expandable | Each published project in the table can be expanded to show its full revision history |
| Deleting before publishing is reversible (sort of) | If you soft-delete an unpublished project, the draw returns to Available — but the record is kept. Hard-deleted records are gone |
| The [Dev] button is a testing tool | The "[Dev] Advance Program Stage" button simulates what would normally happen automatically when the real Program advances. It will not exist in the production system |
