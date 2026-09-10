# Unmapped, Non-Expired Thrust PAPKeys — 1062, 1065, 1140

**Status:** Informational finding, no live impact today. **Live-verified:** `myps_db_dev`, 2026-09-10.

## Context

While investigating the 556 Category/Thrust mismatch issue (see
`MYPS_PROJECT_THRUST_CATEGORY_VALIDATION_RCA_AND_DECISION.md` §7-8), 71 of 164 active Thrust rows were
found to have zero mapping rows in `tOptionProjectCategoryToPAPMap` (i.e. no category would ever offer
them once/if category-restricted Thrust selection is enforced). 68 of those 71 are already expired
(`ValidToDate` in the past). These 3 are the exception — active, unmapped, **and not date-expired** —
so they're the ones that could actually be selected by a user today with no category able to offer them
under a mapping-restricted design.

## The 3 rows (live, `tOptionProjectThrustList`)

| PAPKey | ProgramName | SubProgramName | ThrustDescription | ValidFromDate | ValidToDate | IsActive | Live projects using it |
|---|---|---|---|---|---|---|---|
| 1062 | Flood Control and Drainage | Drainage / Protection Works | Flood Control and Drainage - Drainage / Protection Works | 2016 | 0 (no expiry) | 1 | 0 |
| 1065 | Flood Control and Drainage | Flood Control Structures / Facilities | Flood Control and Drainage - Flood Control Structures / Facilities | 2016 | 0 (no expiry) | 1 | 0 |
| 1140 | Pasig River Ferry Convergence Program | *(none)* | Pasig River Ferry Convergence Program | 0 (no start restriction) | 0 (no expiry) | 1 | 0 |

**None of the three are currently used by any live project's latest revision** — this is a latent gap,
not an active incident.

## Notes per row

- **1062 / 1065** — both under the "Flood Control and Drainage" program. Neither this program nor any of
  its activities appear anywhere in `tOptionProjectCategoryToPAPMap` — the entire program looks like it
  was never mapped to a category, not a one-off gap.
- **1140** — a likely near-duplicate. A separate, already-mapped row exists: **PAPKey 1058**
  ("Convergence and Special Support Program > Pasig River Ferry Convergence Program", mapped to
  Category 29). 1140 carries the same `ThrustDescription` text ("Pasig River Ferry Convergence Program")
  but with no parent `ProgramName`/`SubProgramName` structure — it reads like a flattened duplicate entry
  for the same real-world program rather than a genuinely distinct thrust. **Unconfirmed** — flagging for
  the operator/data owner to verify against the authoritative source, not asserting it as fact.

## Recommendation (not yet actioned — no data change made)

- **1062 / 1065:** if the "Flood Control and Drainage" program should be selectable, it needs mapping
  rows added to `tOptionProjectCategoryToPAPMap` for the relevant Category(ies). Zero live projects use
  either value today, so this is a data/process question for the option-table owner, not a code fix.
- **1140:** confirm with the data owner whether it's a genuine duplicate of 1058 before deciding
  whether to deactivate it, map it separately, or leave both live.

This finding is independent of tonight's shipped fixes (dropdown permissiveness, save-time
date/active-window validation, FE selected-value fallback, `ResubmitRevision` validation) — those all
already treat these 3 rows correctly (visible if ever selected, validated on save); this document is
about whether they *should* be selectable under a category-mapping-restricted design, which remains a
data decision for the operator.
