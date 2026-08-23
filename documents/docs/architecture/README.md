# MYPS Architecture and Visual Documentation

This directory contains the stable visual companions to the interactive MYPS brain map, plus exploratory database design samples.

## Visual catalogue

| Document | Purpose |
|---|---|
| [Program-to-Project lifecycle](01-program-to-project-lifecycle.md) | Client-readable end-to-end lifecycle and approval flow |
| [Core Program/Project ERD](02-core-program-project-erd.md) | Program/Project anchors, lifecycle states, stages, and lookup relationships |
| [Project aggregate ERD](03-project-aggregate-erd.md) | Base Project child ownership and stage-copy remapping |
| [Formal Revision ERD](04-formal-revision-erd.md) | Formal Revision transaction aggregate and approval state machine |
| [Effective data and traceability](05-effective-data-and-traceability.md) | Effective Project decision and developer traceability pattern |
| [Brain-map data model](myps-brain-map-model.json) | Structured source for an interactive or generated project knowledge map |

## Database design sample

| File | Classification |
|---|---|
| [Formal Revision V2 SQL sample](database/MYPS_FORMAL_REVISION_SCHEMA_V2_SAMPLE.sql) | Exploratory only; superseded by the approved redesign/migration plan where they differ |

## Interpretation rules

- **Lifecycle/base Project revision** means `dbo.tProjectRevisions`.
- **Formal Revision transaction** means the aggregate rooted at `dbo.tRevisionDetails`.
- A solid relationship is physically declared in the supplied SQL unless a note says live-catalog verification is required.
- A dotted relationship is logical, JSON-backed, derived, or application-enforced.
- Pending, returned, correction, and disapproved formal Revisions never replace effective Project data.
- Lookup values must be verified from deployed data; labels in these diagrams do not invent numeric identifiers.

## Sources

- `sources/context/MYPS_CODEX_MASTER_CONTEXT.md`
- `sources/database/myps_db(08-10-2026-full-schema).sql`
- `docs/process/MYPS_PROGRAM_TO_PROJECT_PROCESS_FLOW_PLAN.md`
- `docs/process/MYPS_PROGRAM_STAGE_ADVANCEMENT_SPECIFICATION.md`
