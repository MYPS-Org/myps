# MYPS Effective Data and Developer Traceability

## Effective Project decision

```mermaid
flowchart TD
    A["Stable ProjectPK"] --> B["Find formal Revision transactions with nondeleted snapshots"]
    B --> C["Evaluate fRevisionApprovalStatus"]
    C --> D{"Latest fully approved formal Revision exists?"}
    D -- "Yes: RO=4 and CO=4" --> E["Source = Revision"]
    E --> F["Use approved scalar snapshot and approved formal child overlays"]
    D -- "No" --> G["Source = Base"]
    G --> H["Use latest nondeleted tProjectRevisions row and base children"]
    F --> I["Effective Project"]
    H --> I
    I --> J["vProjectLatest and stage-aware Project functions"]

    P["Pending, returned, or correction Revision"] -. "never effective" .-> G
    Q["Disapproved Revision"] -. "history only" .-> G
```

The decision function orders candidate rows by SQL identity descending. It does not independently prove Stage compatibility; current-stage consumers must retain stage-aware safeguards.

## Workflow lists versus effective lists

| Question | Canonical object |
|---|---|
| Which Revision transactions are unresolved? | `vRevisionPending` or `fOpenRevision(ProjectPK)` |
| Which transactions belong to an approval owner? | `fRevisionQueue('IO'|'RO'|'CO')` |
| Which Revision transactions are completed? | `vRevisionHistory` |
| What is the current effective Project? | `vProjectLatest` and effective Project functions |
| Which Projects currently display approved Revision data? | `vProjectLatest WHERE Source='Revision'` |

## Traceability pattern

```mermaid
flowchart LR
    P["PROC: Business process"] --> A["Actor and RACI"]
    P --> R["BR: Business rules"]
    P --> E["ENT: Entities and ownership"]
    P --> O["Views, functions, procedures, APIs"]
    P --> S["Permissions and record scope"]
    P --> K["RSK / DEC: risks and decisions"]
    P --> T["AT: Acceptance tests"]

    R --> O
    E --> O
    S --> O
    K --> T
    O --> T
```

## Minimum traceability record

| Field | Required content |
|---|---|
| Process | Stable `PROC-*` identifier, trigger, actors, outcome |
| Rules | Stable `BR-*` conditions and error/result behavior |
| Data | Stable `ENT-*` objects, keys, ownership, and soft-delete behavior |
| Implementation | Current table/view/function/procedure/API/service/UI action |
| Security | Route/action permission and record-level scope |
| Risks | Known mismatch, ambiguity, or unenforced invariant |
| Decisions | Named owner and status for unresolved policy |
| Tests | Positive, negative, authorization, concurrency, retry, and rollback cases |

