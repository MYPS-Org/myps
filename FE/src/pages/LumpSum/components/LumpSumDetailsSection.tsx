// =============================================================================
// LumpSumDetailsSection.tsx — full project-details form for an LumpSum.
//
// This is a manually-maintained adaptation of:
//   FE/src/pages/Project/components/ProjectDetailsForm.tsx
//
// DIFFERENCES from ProjectDetailsForm:
//   - No "Lump Sum / Non Project" IslandCode toggle (that toggle belongs to the
//     Project module's IslandCode === 'LS' concept, which must NOT collide with
//     this module — see LumpSum.md naming guardrail).
//   - No edit-mode "Administrative Information" block (there is no "edit lumpSum
//     details" workflow; LumpSumForm mode="edit" renders everything disabled).
//   - Project ID is read-only: the server mints it, and a parent's ends in "LS".
//   - All geo/org/source/readiness fields are OPTIONAL (no required asterisk)
//     because a Lump Sum Project is program-wide, not site-specific. If the team later
//     needs some required, add rules to lumpSumFormRules.ts.
//   - isLumpSum is always true (for useLocationFilters cascade logic) since
//     a Lump Sum Project is always program-wide in the LS sense.
//   - Absorbs and replaces the wallet-era WalletProgramSection.tsx.
//
// CROSS-MODULE IMPORT: useLocationFilters is imported from Project/filteringLocations.
// This is an intentional, scoped exception — the hook is pure (no side effects,
// no store access) and avoids duplicating the province/city/LD cascade logic.
// =============================================================================

import React from 'react';
import type { LumpSum } from '../Model.d';
import type { ProjectEnums } from '../../Project/Model.d';
import { useLocationFilters } from '../../Project/filteringLocations';
import { getDisabledClass, formatDropdownOptions, filterKeepingSelected } from '../../../utils/GlobalFunctions';
import SearchableDropdown from '../../../components/ui/SearchableDropdown';

// Region Wide options — hardcoded same as ProjectDetailsForm to avoid an enum lookup
const REGION_WIDE_OPTIONS = [
  { id: 1, value: 1, name: 'Region Wide' },
  { id: 2, value: 2, name: 'Non-Region Wide' },
  { id: 3, value: 3, name: 'Region Wide AIP ignores DEO' },
];

interface LumpSumDetailsSectionProps {
  lumpSum: Partial<LumpSum>;
  onChange: (field: keyof LumpSum, value: LumpSum[keyof LumpSum]) => void;
  errors?: Partial<Record<keyof LumpSum, string>>;
  disabled?: boolean;
  projectEnums: ProjectEnums | null;
  mode?: 'add' | 'edit';
  /** Itemized children already carrying a copy of the UACS — drives the amber note. */
  itemizedCount?: number;
}

const LumpSumDetailsSection: React.FC<LumpSumDetailsSectionProps> = ({
  lumpSum,
  onChange,
  errors = {},
  disabled = false,
  projectEnums,
  mode = 'add',
  itemizedCount = 0,
}) => {
  /*  ONLY THE REQUIRED FIELDS ARE RENDERED, plus Alternate ID and UACS (both
      editable). The sixteen optional fields (Multi Year ID, External ID, Rank, MYCA
      date, the six location/office fields, and the implementation-readiness
      set) are NOT on this form at all — decided 2026-09-06, reversing the
      2026-09-04 "visible but locked" rule. Editable: the seven the server
      requires (ValidateRequiredFieldsAsync) and Alternate ID.

      TIER IS NOT RENDERED EITHER (2026-09-06). It left the required set: a Lump
      Sum Project covers a programme, every migrated parent is Tier 1 and the
      lookup holds only 1 and 2, so the starred select was a choice with nothing
      to base it on. CreateLumpSum defaults an absent Tier to 1; UpdateLumpSum
      keeps the stored value. The form state still carries `Tier` and
      detailFields() still submits it, so an edit sends the fetched value back —
      the same rule as the hidden optional fields below. `locationAdapter.Tier`
      keeps its `?? 1` purely to satisfy useLocationFilters' shape.

      ALTERNATE ID stays editable on purpose: free text a planner uses to trace a
      project to its source. On an itemized CHILD the import writes the parent's
      Project ID into it (rule 2026-09-05); on the parent it is whatever is typed.

      UACS IS TYPED HERE, AND ONLY HERE (2026-09-06). There is still no
      project-level UACS column — it lives only on tProjectComponentCostPerYear,
      and vLumpSumSet.UACS is a SELECT TOP 1 over those rows — but the server now
      fans the value this box sends (dto.Uacs) across every per-year row of the
      project, on create and on update. The Component Cost dialog only displays
      it. Optional: an empty box clears the code (the server stores NULL, never '').

      AND ONLY UNTIL THE FIRST IMPORT (2026-09-08). The fan-out above is scoped to
      the project's OWN revision, so it can never reach children that already
      exist. UACS is an externally assigned business key the children inherit at
      import, so once one exists the code is frozen — the box is disabled (via
      formDisabled) and UpdateLumpSum refuses a change as well. The window in
      which it can be typed is therefore: on create, or on edit while the project
      has no itemized children. Deleting every child reopens it. The amber note
      below the box says so; do not "fix" that by unfreezing the input.

      THE HIDDEN VALUES ARE STILL SUBMITTED, and that is load-bearing. The form
      keeps whatever the fetch put in `form`, and `detailFields(form)` sends every
      detail field regardless of what this section renders. ApplyDetailFields
      assigns `revision.Region = dto.Region` (and Province, City, LD, DEO,
      Implementing Office, the readiness fields, Rank, MYCA date) with NO
      null-guard, so a payload that stopped carrying them would ERASE them on the
      next save. Hiding the inputs is safe only because the data path is untouched:
      do not "tidy" the model, the mappers or detailFields to match this section.
      The migrated sample P00900040LS carries a Region that has to survive an edit;
      ls-module-ui-walkthrough asserts the payload still carries Rank and MYCA. */

  // Build a ProjectDetails-shaped adapter so useLocationFilters can hand back the
  // Operating Unit list. The hook reads Province, City, LegislativeDistrict, DEO,
  // ImplementingOffice (and ProgramName/Tier for type satisfaction); those stay in
  // form state although this section no longer renders them.
  const locationAdapter = {
    ProgramName: lumpSum.ProgramName ?? '',
    Tier: lumpSum.Tier ?? 1,
    Province: lumpSum.Province,
    City: lumpSum.City,
    LegislativeDistrict: lumpSum.LegislativeDistrict,
    DEO: lumpSum.DEO,
    ImplementingOffice: lumpSum.ImplementingOffice,
  };

  // isLumpSum = true: a Lump Sum Project is always program-wide. Only the Operating
  // Unit list is used now; the location cascades went with the hidden inputs.
  const { ous: filteredOUs } = useLocationFilters(projectEnums, locationAdapter as any, true);

  /*  Sub-Categories permitted for the selected Category (2026-09-11).

      ShowProjectDropdowns sends ThrustsByCategory for RESTRICTED categories ONLY — it resolves
      the whole "is this Category restricted" rule server-side, including the PAPKey = -1
      wildcard, which means every Sub-Category qualifies for that Category. So the entire rule
      on this side is: no entry for the CategoryId means no restriction. Do not re-derive it
      here; that rule already exists twice in C# and a third copy would drift.

      Why it is worth filtering at all: measured on localhost 2026-09-10, 19 of 33 categories
      are restricted and most permit exactly ONE of the 96 in-window Sub-Categories. Unfiltered,
      1,824 pairs are selectable and 134 are legal, so the user picks blind and finds out at
      save time. filterKeepingSelected still keeps an already-stored value visible even when it
      falls outside this set, which is what an existing row needs. */
  const allowedPAPKeys = React.useMemo(() => {
    if (!lumpSum.CategoryId) return null;
    const Entry = projectEnums?.ThrustsByCategory?.find(x => x.CategoryId === lumpSum.CategoryId);
    return Entry ? new Set(Entry.PAPKeys) : null;
  }, [projectEnums, lumpSum.CategoryId]);


  // NOTE: Program selection (handleProgramChange) has moved to LumpSumProgramDetailsSection.
  // ProgramId / ProgramName / TypeName / YearStart / CurrentStage are all set there.

  return (
    <div className="space-y-8 text-sm">

      {/* ─── General Information ─── */}
      <div className="space-y-4">
        <h3 className="text-lg text-left font-semibold text-gray-800 pt-2 pb-2">
          General Information:
        </h3>

        {/* Row 1: Project ID | Alternate ID
            Program selection has moved to the dedicated "Program Details" card
            (LumpSumProgramDetailsSection) rendered before this section. */}
        <div className="grid grid-cols-3 gap-5">
          <div className="w-full flex flex-col text-left gap-2">
            <div className="flex flex-row gap-5 items-center">
              <label className="w-1/3 text-gray-600">Project ID:</label>
              <input
                type="text"
                value={lumpSum.ProjectId ?? 'Generated on save'}
                className="w-2/3 mt-1 px-3 py-2 border border-gray-300 bg-gray-100 rounded-md truncate"
                readOnly
              />
            </div>
          </div>

          <div className="w-full flex flex-col text-left gap-2">
            <div className="flex flex-row gap-5 items-center">
              <label className={`w-1/3 ${errors.AlternateId ? 'text-red-500' : 'text-gray-600'}`}>
                Alternate ID:
              </label>
              <input
                type="text"
                value={lumpSum.AlternateId || ''}
                onChange={(e) => onChange('AlternateId', e.target.value)}
                className={`w-2/3 mt-1 px-3 py-2 border ${errors.AlternateId ? 'border-red-500' : 'border-gray-300'} ${getDisabledClass(disabled)} rounded-md truncate`}
                disabled={disabled}
                maxLength={100}
              />
            </div>
          </div>
        </div>

        {/* Row 2: UACS — the single place the code is typed */}
        <div className="grid grid-cols-3 gap-5">
          <div className="w-full flex flex-col text-left gap-2">
            <div className="flex flex-row gap-5 items-center">
              <label className={`w-1/3 ${errors.UACS ? 'text-red-500' : 'text-gray-600'}`}>
                OA Project Code (UACS):
              </label>
              <input
                type="text"
                value={lumpSum.UACS || ''}
                /*  '' ON CLEAR, NEVER undefined. The server treats an absent Uacs as
                    "keep" and an empty one as "clear"; JSON.stringify drops undefined
                    keys, so storing undefined here would make the box impossible to
                    clear. See detailFields() in LumpSumForm. */
                onChange={(e) => onChange('UACS', e.target.value)}
                className={`w-2/3 mt-1 px-3 py-2 border ${errors.UACS ? 'border-red-500' : 'border-gray-300'} ${getDisabledClass(disabled)} rounded-md truncate`}
                disabled={disabled}
                maxLength={50}
                placeholder="Enter UACS code..."
              />
            </div>
            <p className="ml-[calc(33.333%+1.25rem)] text-xs text-gray-500">
              Projects itemized from this Lump Sum Project inherit this code.
            </p>
            {mode === 'edit' && itemizedCount > 0 && (
              /*  THIS NOTE STATES A LOCK, IT DOES NOT INVITE AN EDIT (2026-09-08).
                  It renders in exactly the state where the box above is disabled, so
                  the old wording ("changing it here does not update them") described a
                  change the control refuses and a fan-out that cannot be triggered —
                  and "the previous code" was simply false when the box was left empty.

                  UACS is an externally assigned business key. The children inherited it
                  at import, and ApplyUacsToPerYearRowsAsync is scoped to the PARENT'S
                  revision, so an edit here could never reach them: it would only
                  desynchronise the two. UpdateLumpSum refuses the change server-side as
                  well. Deleting every itemized project reopens the field, because
                  isItemized is computed from the live count — that is the only route. */
              <p className="ml-[calc(33.333%+1.25rem)] text-xs text-amber-700">
                {lumpSum.UACS
                  ? `Locked: ${itemizedCount} itemized ${itemizedCount === 1 ? 'project' : 'projects'} inherited this code at import.`
                  : `Locked: ${itemizedCount} itemized ${itemizedCount === 1 ? 'project was' : 'projects were'} imported without a code.`}{' '}
                It cannot change while they exist; removing them all reopens it.
              </p>
            )}
          </div>

        </div>

        {/* Row 3: Category | Sub-Category */}
        <div className="grid grid-cols-3 gap-5 border-t-2 pt-4 border-gray-200">
          <div className="w-full flex flex-col text-left gap-2">
            <div className="flex flex-row gap-5 items-center">
              <label className={`w-1/3 ${errors.CategoryId ? 'text-red-500' : 'text-gray-600'}`}>
                <span className="text-red-500 text-lg">*</span>Category:
              </label>
              <div className="w-2/3 min-w-0">
                <SearchableDropdown
                  /*  VALUE = CategoryId, THE BUSINESS KEY — never the row's surrogate Id.
                      tOptionProjectCategory carries both and they differ by one for
                      29 of 32 rows; the server stores, validates and generates the
                      Project ID from CategoryId. Keying this on Id saved OO1 (Id 15)
                      as MOOE (CategoryId 15) — the list showed MOOE while this form
                      mapped 15 back through Id and showed OO1, hiding it (found
                      2026-09-05). Same keys as ProjectDetailsForm.tsx. */
                  options={formatDropdownOptions(
                    filterKeepingSelected(
                      projectEnums?.Categories,
                      x => x.IsCurrentlyValid,
                      'CategoryId',
                      lumpSum.CategoryId
                    ),
                    'CategoryId',
                    'CategoryName'
                  )}
                  value={lumpSum.CategoryId || ''}
                  onChange={(value) => onChange('CategoryId', value === '' ? undefined : parseInt(value.toString()))}
                  placeholder="Select Category"
                  disabled={disabled}
                  error={!!errors.CategoryId}
                  allowClear={true}
                  searchPlaceholder="Search categories..."
                />
              </div>
            </div>
          </div>

          <div className="w-full flex flex-col text-left gap-2">
            <div className="flex flex-row gap-5 items-center">
              <label className={`w-1/3 ${errors.SubCategoryId ? 'text-red-500' : 'text-gray-600'}`}>
                <span className="text-red-500 text-lg">*</span>Sub-Category:
              </label>
              <div className="w-2/3 min-w-0">
                <SearchableDropdown
                  /*  VALUE = PAPKey, THE BUSINESS KEY — never the row's surrogate Id.
                      Thrust Ids run 1..164 and PAPKeys 1001..1178 with no overlap, so
                      an Id saved here matched nothing anywhere else and the
                      Sub-Category showed blank outside this form. Same keys as
                      ProjectDetailsForm.tsx; the server now refuses a value that is
                      not a PAPKey.
                      LABEL = ThrustDescription, same as ProjectDetailsForm.tsx (was
                      SubProgramName, which is shorter and far less distinct). */
                  options={formatDropdownOptions(
                    filterKeepingSelected(
                      projectEnums?.Thrusts,
                      x => x.IsCurrentlyValid && (allowedPAPKeys === null || allowedPAPKeys.has(x.PAPKey)),
                      'PAPKey',
                      lumpSum.SubCategoryId
                    ),
                    'PAPKey',
                    'ThrustDescription',
                    'Id'
                  )}
                  value={lumpSum.SubCategoryId || ''}
                  onChange={(value) => onChange('SubCategoryId', value === '' ? undefined : parseInt(value.toString()))}
                  placeholder="Select Sub-Category"
                  disabled={disabled}
                  allowClear={true}
                  searchPlaceholder="Search sub-categories..."
                />
              </div>
            </div>
          </div>

        </div>

        {/* Description */}
        <div className="grid grid-cols-1 gap-2">
          <div className="w-full flex text-left gap-2">
            <label className={`w-1/9 ${errors.Description ? 'text-red-500' : 'text-gray-600'}`}>
              <span className="text-red-500 text-lg">*</span>Description:
            </label>
            <div className="w-8/9">
              <textarea
                value={lumpSum.Description || ''}
                onChange={(e) => onChange('Description', e.target.value)}
                className={`w-full mt-1 px-3 py-2 border ${errors.Description ? 'border-red-500' : 'border-gray-300'} ${getDisabledClass(disabled)} rounded-md`}
                placeholder="Describe this Lump Sum Project"
                rows={3}
                disabled={disabled}
                maxLength={1000}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ─── Organizational Responsibilities ─── */}
      <div className="space-y-4">
        <h3 className="text-lg text-left font-semibold text-gray-800 border-t-2 py-2 border-blue-500">
          Organizational Responsibilities
        </h3>

        <div className="grid grid-cols-2 gap-5">
          <div className="w-full flex flex-col text-left gap-2">
            <div className="flex flex-row gap-5 items-center">
              <label className={`w-1/3 ${errors.OperatingUnit ? 'text-red-500' : 'text-gray-600'}`}>
                <span className="text-red-500 text-lg">*</span>Operating Unit:
              </label>
              <div className="w-2/3">
                <SearchableDropdown
                  options={formatDropdownOptions(filteredOUs || [], 'ParticipantId', 'Name')}
                  value={lumpSum.OperatingUnit || ''}
                  onChange={(value) => onChange('OperatingUnit', value === '' ? undefined : value.toString())}
                  placeholder="Select Operating Unit"
                  disabled={disabled}
                  error={!!errors.OperatingUnit}
                  allowClear={true}
                  searchPlaceholder="Search operating units..."
                />
              </div>
            </div>
          </div>
          <div className="w-full flex flex-col text-left gap-2">
            <div className="flex flex-row gap-5 items-center">
              <label className={`w-1/3 ${errors.RegionWide ? 'text-red-500' : 'text-gray-600'}`}>
                <span className="text-red-500 text-lg">*</span>Regionwide:
              </label>
              <select
                value={lumpSum.RegionWide ?? ''}
                onChange={(e) => onChange('RegionWide', e.target.value ? parseInt(e.target.value) : undefined)}
                className={`w-2/3 mt-1 px-3 py-2 border ${errors.RegionWide ? 'border-red-500' : 'border-gray-300'} ${getDisabledClass(disabled)} rounded-md truncate`}
                disabled={disabled}
              >
                <option value="">Select Regionwide</option>
                {REGION_WIDE_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.value}>{opt.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Project Source ─── */}
      <div className="space-y-4">
        <h3 className="text-lg text-left font-semibold text-gray-800 border-t-2 py-2 border-blue-500">
          Project Source
        </h3>

        <div className="grid grid-cols-2 gap-5">
          <div className="w-full flex flex-col text-left gap-2">
            <div className="flex flex-row gap-5 items-center">
              <label className={`w-1/3 ${errors.Origin ? 'text-red-500' : 'text-gray-600'}`}>
                <span className="text-red-500 text-lg">*</span>Origin:
              </label>
              <div className="w-2/3">
                <SearchableDropdown
                  options={formatDropdownOptions(
                    filterKeepingSelected(projectEnums?.Origins, x => x.IsActive !== false, 'NameId', lumpSum.Origin),
                    'NameId',
                    'Name',
                    'Id'
                  )}
                  value={lumpSum.Origin || ''}
                  onChange={(value) => onChange('Origin', value === '' ? undefined : parseInt(value.toString()))}
                  placeholder="Select Origin"
                  disabled={disabled}
                  error={!!errors.Origin}
                  allowClear={true}
                  searchPlaceholder="Search origins..."
                />
              </div>
            </div>
          </div>

          <div className="w-full flex flex-col text-left gap-2">
            <div className="flex flex-row gap-5 items-center">
              <label className={`w-1/3 ${errors.Agency ? 'text-red-500' : 'text-gray-600'}`}>
                <span className="text-red-500 text-lg">*</span>Originating Agency:
              </label>
              <div className="w-2/3">
                <SearchableDropdown
                  options={formatDropdownOptions(
                    filterKeepingSelected(projectEnums?.Agencies, x => x.IsActive !== false, 'NameId', lumpSum.Agency),
                    'NameId',
                    'Name'
                  )}
                  value={lumpSum.Agency || ''}
                  onChange={(value) => onChange('Agency', value === '' ? undefined : parseInt(value.toString()))}
                  placeholder="Select Originating Agency"
                  disabled={disabled}
                  error={!!errors.Agency}
                  allowClear={true}
                  searchPlaceholder="Search agencies..."
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LumpSumDetailsSection;
