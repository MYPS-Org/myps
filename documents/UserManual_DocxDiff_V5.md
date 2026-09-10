# Diff: Deliverable 48 User Manual V5 (docx, 27 Aug 2026) vs `FE/UserManual.md` (v3.10, 25 Aug 2026)

Source docx: `C:\Users\User\Downloads\Deliverable 48 User Manual (Web-based MYPS)_V5_27August2026.docx`
Converted via pandoc to `docx_v5.md` + 87 extracted images (not yet committed anywhere — currently in a scratch temp dir).

This is a structural + targeted content diff, not a line-by-line diff (the docx has no machine-readable "diff vs v4" — its own changelog table inside the docx should be checked for the authoritative v4→v5 delta, but section-level comparison against our md was more reliable).

## 1. Sections in docx but missing entirely from `FE/UserManual.md`

### 1a. `5.6 Reports` (docx §5.6, 2 subsections: 5.6.1 Report Filters, 5.6.2 Programs Selection Panel)
Not documented anywhere in `FE/UserManual.md`. Matches the Reports feature that was just merged into the app (git log: PR #180 "feature/reports-pdf-excel-tabs", `FE/src/pages/Reports/`). This is a straightforward **add**.

### 1b. `5.10 Lump Sum Projects` (docx §5.10, 8 subsections, §5.10.1–5.10.8)
Not documented in `FE/UserManual.md` at all. Note: a *separate* in-app doc already exists at `FE/src/pages/LSWallet/UserManual.md`, but it opens with:
> "This is a demo and preview feature... not connected to real DPWH records... No actions you take here affect any actual data."

The docx, by contrast, documents it as a full production workflow (Add Lump Sum Project, Import Itemized Projects, Delete, Edit — all under PS Admin). **Open question:** has this feature graduated from preview to production since that in-app doc was written, or is the docx ahead of where the app actually is? Worth a quick check against the live app before we write it up as shipped.

## 2. Section in `FE/UserManual.md` but missing from docx

### `5.3.6 Component Targets`
FE has this (added v3.9 Aug 23, revised v3.10 Aug 25 per our own changelog). The docx V5 (dated Aug 27, *after* those changes) jumps straight from §5.3.5 Work Locations to §5.3.6 Supporting Documents / §5.3.7 Project Location Map — no Component Targets section at all. Looks like an omission on the docx author's side rather than an intentional removal, since the feature is live and recent. **Recommend keeping it** in the md and flagging to the consultant that V5 is missing it, rather than deleting it to match docx.

## 3. Section renumbering (mechanical, follows from #1a)

| Topic | docx §  | our md § |
|---|---|---|
| Code Tables | 5.7 | 5.6 |
| User Management | 5.8 | 5.7 |
| Infra Management | 5.9 | 5.8 |
| Lump Sum Projects | 5.10 | *(new)* |

Once Reports (and Lump Sum) are inserted, every following top-level §5.x and its subsections need renumbering, plus the Table of Contents and cross-references (search hits for "Section 5.6", "Section 5.7" etc. throughout the doc).

## 4. Role terminology — systemic, cross-cutting

Docx V5 has fully standardized on **DPC / RPC / PS Admin**:
- **DPC** — District Planning Coordinator (was "DEO")
- **RPC** — Regional Planning Coordinator (was "RO"); RPC's action is called an **Endorsement**, not an Approval
- **PS Admin** — unchanged

`FE/UserManual.md` is mid-migration and inconsistent: predominantly still says **DEO / RO** (53 occurrences of "DEO", most "Who uses this:" lines), but already has scattered **RPC** and **AUC** (4 occurrences) mentions and one explainer block (around line 1592–1598) that maps old→new terms ad hoc. Section 5.4.9 itself is titled "RO Approval Actions" in our md vs "RPC Endorsement Actions" in docx — same section, both the role name and the framing (Approval → Endorsement) changed.

I checked the codebase: role names (DEO/RO/RPC/DPC/PS Admin) aren't hardcoded in `FE/src` — they're config/data-driven (RBAC groups), not enforced by code. "DEO" *is* hardcoded as a real Admin Area / Code Table concept (`DEOTable.tsx`, District Engineering Office) — that's unrelated to the role-name question and must **not** be touched. So the docx is the authoritative source for the *role* naming; nothing in code contradicts it.

**This means most of the ~53 DEO / RO "Who uses this" lines across the whole manual need updating to DPC / RPC**, not just section 5.4. This is the single biggest chunk of the consolidation work.

## 5. Anomaly in the source docx (flag back to the author, not for us to carry over)

Inside docx §6.3 (Project Revision Workflow), after the "Permissions in short" paragraph, the document contains this stray sentence, which reads like a leftover AI-assistant response rather than manual content:

> "Note that the underlying field names remain RPCStatus and PSStatus — I've left those as-is since renaming the roles doesn't change the system's database fields. If those field names should also be updated to reflect RPC, say the word and I'll adjust them throughout."

Recommend **not** copying this into our md, and flagging it to whoever produced the docx so they can clean up their source.

## 6. Workflows section restructuring

- Docx §6 has **3** workflows: 6.1 Create a Program and Encode a Project, 6.2 Advance Program Through Budget Stages, 6.3 Project Revision Workflow — Submission to Final Approval (one consolidated workflow covering submission/endorsement/approval/correction as sub-parts A–D, with a diagram image).
- Our md has **5**: Workflow 1 (Create Program+Project), 2 (Advance Stages), 3 (Submit Revision), 4 (RO Review), 5 (PS Admin Final Approval) — the same ground split into 3 separate workflows instead of 1.
- Content-wise these look equivalent (docx's single §6.3 covers what our Workflows 3–5 cover, plus a Correction/Resubmission sub-part D and a status-pair reference table our version doesn't have as clearly). **Recommend**: keep our 5-workflow split (more skimmable) but pull in the status-pair reference table and the routing table from docx §6.3, updated to DPC/RPC/PS Admin naming.

## 7. Images

Docx V5 has **87 embedded screenshots/diagrams**. `FE/UserManual.md` currently has **zero** embedded images (text/tables only) — that's the established convention for this file. Extracting and embedding all 87 would be a significant format change (need an images folder in the repo, e.g. `documents/manual-images/`, plus git-tracking ~6MB of PNGs).

## Next steps (pending your call on the open questions below)
1. Add §5.6 Reports (net-new content, low risk).
2. Investigate Lump Sum Projects production-readiness, then add §5.10 accordingly.
3. Keep §5.3.6 Component Targets (docx's omission, not ours).
4. Renumber everything after Reports/Lump Sum insertion, including ToC and cross-references.
5. Global terminology sweep: DEO→DPC, RO→RPC across the whole manual (not just §5.4), removing the ad hoc explainer note once the rename is consistent.
6. Pull status-pair/routing tables from docx §6.3 into our Workflow 3–5.
7. Skip the stray AI-note artifact from docx §6.3.
