# MYPS — LS Enhancement: New Process Flow
**Project:** MYPS | **Client:** DPWH
**Prepared by:** AI SA/PM Employee
**Date:** 2026-06-11
**Status:** Draft — pending client decisions on marked items

> Items marked **[Pending Qx]** are open questions in the Client Questions document.

---

## 1. LS Wallet Lifecycle Overview

```mermaid
flowchart TD
    A([Lumpsum Module]) --> B[View List of LS Wallets]
    B --> C{Select Action}
    C -->|Create New| D[Create LS Wallet]
    C -->|Open Existing| E[Wallet Detail View]
    D --> E
    E --> F{What would you like to do?}
    F -->|Add a Project| G[Create Itemized Project]
    F -->|Update Costs| H[Update Wallet Costs]
    F -->|Delete Wallet| I[Delete Wallet]
    G --> J[Itemized Project]
    J --> K{Project Action}
    K -->|Update Costs| L[Update Project Costs]
    K -->|Publish| M[Publish to PCMA]
    K -->|Delete| N[Delete Project]
    M --> O[Published to PCMA]
    O --> P[Create Revision]
```

---

## 2. Create LS Wallet

```mermaid
flowchart TD
    A([User opens Lumpsum Module]) --> B[Click Create Lumpsum]
    B --> C[Fill in Wallet Details\ne.g. Program, Description, Category, Region\nPending client decision - Q1]
    C --> D[Enter Component Costs per Fiscal Year\nincluding UACS Code\nPending client decision - Q3]
    D --> E{All required fields filled in?}
    E -->|No - missing fields| C
    E -->|Yes| F[Save Wallet]
    F --> G([Wallet successfully created\nReady to add itemized projects])
```

> **[Pending Q1]** Confirm required fields for Wallet Details.
> **[Pending Q3]** Confirm fields required for Component Costs.

---

## 3. Create Itemized Project

> **Important:** The project type is selected at creation and **cannot be changed** afterwards.
> Available project types: **LS** (Itemized Lumpsum), **NP** (Non Project), **Regular** (AIP Project).

### Option A — From the Project Creation Screen

```mermaid
flowchart TD
    A([User opens Project Creation Screen]) --> B[Select Project Type: LS]
    B --> C[Enter or Search for Wallet ID]
    C --> D{Wallet found?}
    D -->|No - not found| C
    D -->|Yes| E[Fill in Project Details\nPending client decision - Q2]
    E --> F[Enter Component Costs\nPending client decision - Q3]
    F --> G{All required fields filled in?}
    G -->|No - missing fields| E
    G -->|Yes| H[Save Project]
    H --> I([Itemized project created\nand linked to the LS Wallet])
```

### Option B — From the LS Wallet Page (Recommended)

```mermaid
flowchart TD
    A([User opens Wallet Detail Page]) --> B[Click Add Itemized Project]
    B --> C[Project form opens\nWallet is automatically linked\nProject type is set to LS]
    C --> D[Fill in Project Details\nPending client decision - Q2]
    D --> E[Enter Component Costs\nPending client decision - Q3]
    E --> F{All required fields filled in?}
    F -->|No - missing fields| D
    F -->|Yes| G[Save Project]
    G --> H([Itemized project created\nand linked to the LS Wallet])
```

> **[Pending Q2]** Should project fields auto-fill from the wallet when linked?
> **[Pending Q3]** Should component costs pre-fill from the wallet?
> **[Pending Q4]** Is Option A acceptable to remove since Option B covers the same workflow?

---

## 4. Update Itemized Project Costs

```mermaid
flowchart TD
    A([User opens Itemized Project]) --> B[Edit Component Costs]
    B --> C{Do updated costs exceed\nthe wallet total allocation?}
    C -->|No - within allocation| D[Save Changes]
    C -->|Yes - over allocation| E{How should the system respond?\nPending client decision - Q6}
    E -->|Block the save| F[Save is blocked\nUser must reduce costs before proceeding]
    E -->|Show a warning| G[Warning is displayed\nUser may choose to proceed]
    G --> D
    D --> H{Should the wallet total allocation\nupdate automatically?\nPending client decision - Q5}
    H -->|Yes - update automatically| I[Wallet total allocation is updated]
    H -->|No - keep wallet fixed| J[Wallet available balance is recalculated\nTotal allocation remains unchanged]
    I --> K([Changes saved successfully])
    J --> K
```

> **[Pending Q5]** Should modifying project costs automatically update the wallet total allocation?
> **[Pending Q6]** Should the system block or warn when project costs exceed the wallet allocation?
> **[Pending Q8]** Can the wallet total allocation be changed after itemized projects are created?

---

## 5. Delete Itemized Project

```mermaid
flowchart TD
    A([User clicks Delete on Itemized Project]) --> B[Confirmation message displayed]
    B --> C{User confirms deletion?}
    C -->|No - cancel| D([Deletion cancelled])
    C -->|Yes - proceed| E[Project is removed from the system]
    E --> F{Should the project cost be\nreturned to the wallet balance?\nPending client decision - Q7}
    F -->|Yes| G[Wallet available balance increases\nby the deleted project cost]
    F -->|No| H[Wallet available balance\nremains unchanged]
    G --> I([Project successfully deleted])
    H --> I
```

> **[Pending Q7]** When a project is deleted, should its cost be returned to the wallet's available balance?

---

## 6. Delete LS Wallet

```mermaid
flowchart TD
    A([User clicks Delete Wallet]) --> B{Does the wallet still have\nitemized projects linked to it?}
    B -->|Yes - has projects| C[Deletion is blocked\nAll linked projects must be\nremoved before the wallet can be deleted]
    C --> D([Deletion cancelled])
    B -->|No - wallet is empty| E[Confirmation message displayed]
    E --> F{User confirms deletion?}
    F -->|No - cancel| D
    F -->|Yes - proceed| G[Wallet is removed from the system]
    G --> H([Wallet successfully deleted])
```

> **Rule:** A wallet cannot be deleted while it still has active itemized projects. This is enforced by the system.

---

## 7. Publish Itemized Project to PCMA

```mermaid
flowchart TD
    A([Itemized Project is in Scheduled status]) --> B[User initiates Program Publishing]
    B --> C{What is the project type?}
    C -->|LS - Itemized Lumpsum Project| D[Project is included in the publish batch\nand treated as a normal AIP project]
    C -->|NP - Non Project| E[Project is excluded from publishing]
    D --> F[Project is submitted to PCMA]
    F --> G([Project status updated to Published])
```

> **Note:** LS Wallets themselves are never published to PCMA. Only the itemized projects under them go through this process.

---

## 8. Create Revision for a Published Itemized Project

```mermaid
flowchart TD
    A([User opens a Published Itemized Project]) --> B[User initiates a Revision]
    B --> C[Standard revision process begins]
    C --> D[User updates project details and costs]
    D --> E{Do revised costs exceed\nthe wallet total allocation?}
    E -->|No - within allocation| F[Save revision]
    E -->|Yes - over allocation| G{How should the system respond?\nPending client decision - Q6}
    G -->|Block the save| H[Save is blocked\nUser must reduce costs before proceeding]
    G -->|Show a warning| I[Warning is displayed\nUser may choose to proceed]
    I --> F
    F --> J{Should the revised cost reflect\non the wallet allocation?\nPending client decision - Q10}
    J -->|Yes - update automatically| K[Wallet total allocation is updated]
    J -->|No - keep wallet fixed| L[Wallet available balance is recalculated\nTotal allocation remains unchanged]
    K --> M([Revision saved successfully])
    L --> M
```

> **[Pending Q6]** Block or warn when revised costs exceed wallet allocation?
> **[Pending Q10]** Should cost changes in a revision automatically update the wallet total allocation?

---

## Pending Client Decisions Summary

| Ref | Question | Affects |
|---|---|---|
| Q1 | What fields are required when creating a wallet? | Process 2 |
| Q2 | Should project fields auto-fill from the wallet? | Process 3 |
| Q3 | Should component costs pre-fill from the wallet? | Process 2, 3 |
| Q4 | Is Option A for project creation acceptable to remove? | Process 3 |
| Q5 | Should updating project costs auto-update the wallet allocation? | Process 4 |
| Q6 | Block or warn when project costs exceed wallet allocation? | Process 4, 8 |
| Q7 | Should deleted project cost return to wallet balance? | Process 5 |
| Q8 | Can wallet allocation be changed after projects are created? | Process 4 |
| Q10 | Should revised costs reflect on the wallet allocation? | Process 8 |
| Q11 | Does the wallet go through budget stages (NEP, GAA, GAAR)? | All processes |

---

*Reference: Client Questions Document | LS Enhancement Conflict Tracker*
*Last updated: 2026-06-11*
