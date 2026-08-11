# MYPS Program-to-Project Lifecycle

## End-to-end business flow

```mermaid
flowchart TD
    A["Configure users, permissions, offices, and lookup data"] --> B["Create Program request"]
    B --> C{"Program Type and starting Stage valid?"}
    C -- "No" --> C1["Reject without writes and return allowed values"]
    C -- "Yes" --> D["Atomically create Program anchor, Program state, and Program Stage"]
    D --> E["Create Project under the Program's current Stage"]
    E --> F["Create Project anchor, lifecycle Project revision, and Project Stage"]
    F --> G["Develop Project aggregate"]
    G --> G1["Funding"]
    G --> G2["Components and annual costs"]
    G --> G3["Major work and locations"]
    G --> G4["Supporting documents and notes"]
    G1 --> H["User requests Stage advancement"]
    G2 --> H
    G3 --> H
    G4 --> H
    H --> I["Resolve the immediate next allowed Stage for the Program Type"]
    I --> J{"Requested Stage is exactly one configured step forward?"}
    J -- "No" --> J1["Reject jump, revert, or invalid destination without writes"]
    J -- "Yes" --> K["Create destination Program state as Working and add Program Stage row"]
    K --> L["Select every active Project regardless of validity"]
    L --> M["Create destination lifecycle Project revisions and Stage rows"]
    M --> N["Copy and remap the complete Project child graph"]
    N --> O["Recompute Program cost"]
    O --> P{"Destination is GAA-R?"}
    P -- "No" --> Q["Commit complete Stage advancement"]
    P -- "Yes" --> R["Recompute publishability independently for every Project"]
    R --> Q
    Q --> Q1{"Committed Stage is GAA-R?"}
    Q1 -- "No" --> Q2["Continue lifecycle work at the destination Stage"]
    Q2 --> H
    Q1 -- "Yes" --> S{"Project is publishable?"}
    S -- "No" --> S1["Keep Project in GAA-R for correction; Program remains advanced"]
    S -- "Yes" --> T["Publish eligible Project to PCMA when publication is initiated"]
    T --> U["Generate PCMA extracts and reports"]
    T --> V{"Post-publication Project change required?"}
    V -- "No" --> W["Operate, monitor, and report"]
    V -- "Yes" --> X["Create Formal Revision transaction"]
    X --> Y["IO preparation and submission"]
    Y --> Z["RO and CO approval workflow"]
    Z --> AA{"Fully approved?"}
    AA -- "No: pending/returned" --> Y
    AA -- "No: disapproved" --> AB["Close as history; baseline remains effective"]
    AA -- "Yes" --> AC["Approved formal Revision becomes effective overlay"]
    AC --> U
```

## Normal lifecycle versus formal Revision

```mermaid
flowchart LR
    P["tProjects: stable ProjectPK"]
    P --> B["tProjectRevisions: lifecycle/base Project states"]
    B --> S["tProjectStages: Program-controlled Stage history"]
    B --> C["Base Project child aggregate"]

    P --> F["tRevisionDetails: formal Revision transaction"]
    B -. "immutable originating ProjectRevisionFK" .-> F
    F --> R["Proposed snapshot and formal child graph"]
    R --> A["IO document modal + Submit → RO → CO document modal + Approve"]
    A --> E{"RO=4 and CO=4?"}
    E -- "No" --> KEEP["Current effective source remains unchanged"]
    E -- "Yes" --> APPLY["Latest approved Revision is effective"]
```

## Governing rules

1. The Program controls the ordinary Project lifecycle.
2. Initial Program creation may use any Stage allowed for the Program Type.
3. Existing Programs advance only to the immediate next allowed Stage; jumps and reversals are prohibited.
4. Stage order is resolved from the Program Type's allowed Stage set and `StageHierarchy`, not `StageId + 1`.
5. Every active Project advances; invalid Projects do not block or remain behind.
6. Stage advancement adds Program, Project, Stage, and child rows. Source history becomes read-only.
7. The destination Program revision starts as `Working (3)` and receives a new ProgramId.
8. `ProjectPK` remains the original ProjectId; the lifecycle ProjectId changes only its Stage-prefix segment when necessary.
9. Destination child records must point only to destination parent SQL IDs.
10. At GAA-R, Project publishability is independent. The Program advances even when some Projects fail validation.
11. A Project created after advancement begins only in the Program's current Stage.
12. `IsPublishable` is derived readiness; `IsPublished` is an actual publication state.
13. A published baseline is changed through the formal Revision workflow, not ordinary direct editing.
14. Pending or disapproved formal Revisions never replace current effective data.
15. LS/wallet and special-Project advancement behavior remains pending and must be raised when encountered.

The detailed process contract is `docs/process/MYPS_PROGRAM_STAGE_ADVANCEMENT_SPECIFICATION.md`.
