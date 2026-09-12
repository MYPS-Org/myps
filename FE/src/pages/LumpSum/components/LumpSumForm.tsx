// =============================================================================
// LumpSumForm.tsx — one form, mode-driven, used by both the Add page
// (mode="add") and the Detail page (mode="edit"), the way AddProject and
// EditProject both delegate to ProjectForm.
//
// THE TWO MODES POST TO DIFFERENT SHAPES, because the server does:
//
//   add   CreateLumpSum takes ONE Allocation with ONE funding line behind it.
//         It writes the LS component and that line in the same transaction.
//         A Lump Sum Project used to be created with a component and NO funding
//         profile — which is not merely incomplete: the project form derives
//         Component Cost's ceiling from the funding total, so the whole
//         allocation sat against a ceiling of zero ("No remaining budget") and
//         the 100%-funding rule could not be satisfied by an empty table. So
//         Allocation, Funding Source and Funding Agreement are collected here.
//
//   edit  UpdateLumpSum takes the full replacement child sets. Rows keep their
//         database Ids so the server can merge: Id 0 inserts, Id > 0 updates,
//         Id > 0 with IsDeleted soft-deletes, and a row simply left out is not
//         touched at all.
//
// CurrentStage is displayed and never submitted. A Lump Sum Project's stage
// lives in tProjectStages and follows its program; the server ignores the field
// if it is sent, so sending it would only suggest otherwise.
// =============================================================================

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../../components/toaster/ToasterContext';
import { formValidation } from '../../../utils/FormValidation';
import { lumpSumFormRules } from '../rules/lumpSumFormRules';
import { createLumpSum, updateLumpSum, fetchLumpSumBalance, isServerRefusal } from '../Service';
import { getProjectEnums, getComponentsEnums } from '../../Project/Service';
import { Button } from '../../../components/tailwindui/button';
import { useLumpSumBalance } from '../hooks/useLumpSumBalance';
import { formatDropdownOptions } from '../../../utils/GlobalFunctions';
import SearchableDropdown from '../../../components/ui/SearchableDropdown';

import CollapsibleSection from './CollapsibleSection';
import LumpSumProgramDetailsSection from './LumpSumProgramDetailsSection';
import LumpSumDetailsSection from './LumpSumDetailsSection';
import LumpSumFundingProfileForm from './LumpSumFundingProfileForm';
import LumpSumComponentCostForm from './LumpSumComponentCostForm';
import SaveLumpSumConfirmDialog from '../dialogs/SaveLumpSumConfirmDialog';
import ReplenishLumpSumDialog from '../dialogs/ReplenishLumpSumDialog';

import type {
  LumpSum,
  LumpSumLock,
  LumpSumProgramApproval,
  DtoCreateLumpSum,
  DtoUpdateLumpSum,
  LumpSumFundingProfile,
  LumpSumComponentCost,
  LumpSumComponentCostPerYear,
} from '../Model.d';
import { lockReason, approvedReason } from '../utils/lumpSumActions';
import { sameSource } from '../utils/firstFundingLine';
import type { ProjectEnums, Dropdowns } from '../../Project/Model.d';

/** What the form tells the page about its pending funding changes. */
export interface LumpSumFundingState {
  /** Local funded total − the server's Total. 0 unless something is pending. */
  pendingDelta: number;
  /** A top-up (Id 0) or a removal of a persisted line is waiting for Save. */
  isDirty: boolean;
}

/** Save's tooltip and refusal while a lost save answer is being resolved. */
const SAVE_UNVERIFIED_REASON =
  'The last save did not answer. The project is being reloaded to find out what it holds; Save returns once it has.';

interface LumpSumFormProps {
  initialData?: LumpSum;
  mode?: 'add' | 'edit';
  /** Edit mode: how many itemized children exist — the UACS note needs it. */
  itemizedCount?: number;
  /** Edit mode: a fresh "being itemized" stamp; disables Save with the reason. */
  lock?: LumpSumLock | null;
  /**
   * Edit mode: the program is Approved at GAA-R (2026-09-09). On this form it
   * behaves exactly like being itemized — details and Component Cost read-only,
   * Save and the funding table's Delete left alone, because a top-up and a line
   * removal travel on them. The one action it refuses lives on the page's
   * action bar, not here.
   */
  programApproval?: LumpSumProgramApproval | null;
  /**
   * RESETS ARE EXPLICIT (2026-09-08). The page bumps this when the server data
   * it holds has legitimately replaced the form's — the detail fetch landing,
   * an import, a child delete. The form re-seeds every field and child set from
   * `initialData` on each bump, and NOT on `initialData` merely changing
   * identity: the lock refresh re-reads the parent on every window focus, and
   * keying on identity made that reset wipe whatever was unsaved.
   */
  dataVersion?: number;
  /** Edit mode: the page's Replenish button opens the dialog this form owns. */
  replenishOpen?: boolean;
  onReplenishClose?: () => void;
  /** Edit mode: reported whenever the pending funding state changes. */
  onFundingStateChange?: (state: LumpSumFundingState) => void;
  /**
   * Edit mode: a save's answer was lost (2026-09-10). The form cannot know
   * whether the save landed, so it locks Save and hands the question up: the
   * page does a loud re-read and bumps dataVersion, and the bump is what
   * unlocks Save again — with the persisted lines, or without the draft.
   */
  onSaveUnverified?: () => Promise<void> | void;
}

/**
 * The first failure in RULE order, which is the server's order.
 *
 * `formValidation` returns a plain object, and object key order follows
 * insertion — not the rule list — so picking `Object.values(...)[0]` would give
 * whichever field happened to be assigned first. Walking the rules instead makes
 * the choice explicit.
 */
const firstError = (errors: Partial<Record<keyof LumpSum, string>>): string => {
  for (const rule of lumpSumFormRules) {
    const message = errors[rule.field as keyof LumpSum];
    if (message) return message;
  }
  return 'Please complete the required fields.';
};

/** The detail fields both DTOs share, lifted off the form state in one place. */
const detailFields = (form: Partial<LumpSum>) => ({
  ProgramId: form.ProgramId!,
  CategoryId: form.CategoryId,
  SubCategoryId: form.SubCategoryId,
  OperatingUnit: form.OperatingUnit,

  MyId: form.MYId,
  AlternateId: form.AlternateId,
  ExternalId: form.ExternalId,
  /*  TRI-STATE ON THE SERVER, so the value must travel AS IS. undefined (a null
      fetch, box untouched) is dropped by JSON.stringify → absent → the server
      KEEPS every per-year row's UACS. '' (the user cleared the box) is sent →
      the server CLEARS every row. Text → SET. Do not "tidy" this to
      `form.UACS || undefined`: that would make UACS impossible to clear. */
  Uacs: form.UACS,
  Tier: form.Tier,
  Rank: form.Rank,
  MycaApprovalDate: form.MYCAApprovalDate || null,
  Description: form.Description,

  Province: form.Province,
  City: form.City,
  LegislativeDistrict: form.LegislativeDistrict,

  Deo: form.DEO,
  Region: form.Region,
  ImplementingOffice: form.ImplementingOffice,
  RegionWide: form.RegionWide,

  Origin: form.Origin,
  Agency: form.Agency,

  ImplementationMode: form.ImplementationMode,
  EmergencyMode: form.EmergencyMode,
  Feasibility: form.Feasibility,
  FeasibilityDate: form.FeasibilityDate || null,
  DetailedDesign: form.DetailedDesign,
  DetailedDesignDate: form.DetailedDesignDate || null,
  RowAvailable: form.RowAvailable,
});

const LumpSumForm: React.FC<LumpSumFormProps> = ({
  initialData,
  mode = 'add',
  itemizedCount = 0,
  lock = null,
  programApproval = null,
  dataVersion = 0,
  replenishOpen = false,
  onReplenishClose = () => {},
  onFundingStateChange,
  onSaveUnverified,
}) => {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [form, setForm] = useState<Partial<LumpSum>>(initialData ?? {});
  const [errors, setErrors] = useState<Partial<Record<keyof LumpSum, string>>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [projectEnums, setProjectEnums] = useState<ProjectEnums | null>(null);
  const [dropdowns, setDropdowns] = useState<Dropdowns | null>(null);

  // ── Add-mode allocation (CreateLumpSum's own three fields) ───────────────
  const [allocation, setAllocation] = useState<number>(0);
  const [fundingSource, setFundingSource] = useState<string>('');
  const [fundingAgreement, setFundingAgreement] = useState<string>('');

  // ── Edit-mode child sets ─────────────────────────────────────────────────
  const [fundingProfiles, setFundingProfiles] = useState<LumpSumFundingProfile[]>(
    initialData?.FundingProfiles ?? [],
  );
  const [componentCosts, setComponentCosts] = useState<LumpSumComponentCost[]>(
    initialData?.ComponentCosts ?? [],
  );
  const [componentCostPerYear, setComponentCostPerYear] = useState<LumpSumComponentCostPerYear[]>(
    initialData?.ComponentCostPerYear ?? [],
  );

  const [programName, setProgramName] = useState<string>('');
  const [isCreateConfirmOpen, setIsCreateConfirmOpen] = useState(false);
  const [isUpdateConfirmOpen, setIsUpdateConfirmOpen] = useState(false);
  /*  A save went out and no answer came back — see confirmUpdate. Cleared by the
      dataVersion reset, i.e. by the page's re-read landing, and by nothing else. */
  const [saveUnverified, setSaveUnverified] = useState(false);

  const [isProgramOpen, setIsProgramOpen] = useState(true);
  const [isDetailsOpen, setIsDetailsOpen] = useState(true);
  const [isFundingOpen, setIsFundingOpen] = useState(true);
  const [isComponentOpen, setIsComponentOpen] = useState(true);

  const balance = useLumpSumBalance(form.Id ?? 0);

  /*  ITEMIZED MEANS FROZEN (2026-09-06). Once a project has been itemized, its
      details describe money that has already been committed to children — the
      Category the child IDs were generated from, the Description every itemized
      row is read against, the funding the allocation is derived from. Editing
      them behind the children is how a parent and its children stop agreeing,
      so the whole form goes read-only until the last child is removed. Deleting
      the children unfreezes it: this is computed from the live count, not stored.

      UACS IS FROZEN FOR A STRONGER REASON (2026-09-08), and it is the one field
      here the SERVER also enforces. It is an externally assigned business key
      that the children inherit at import, and ApplyUacsToPerYearRowsAsync is
      scoped to the parent's own revision — so a later edit could not fan out to
      the children even in principle; it would only desynchronise the two.
      UpdateLumpSum therefore refuses a UACS *change* on a parent that has
      children. It allows an unchanged echo, which is what keeps the funding-line
      removal below working: that save re-sends the fetched code.

      The rest is frontend only, by decision. UpdateLumpSum still accepts those
      fields from an API caller; it is the page that stops offering them.

      NOT frozen: Replenish, Import, and the two Delete actions. Those live in the
      page's action bar rather than this form, and every one of them is a thing a
      user must still be able to do to an itemized project — including deleting
      the children that froze it. */
  const isItemized = mode === 'edit' && itemizedCount > 0;

  /*  The import's visible stamp freezes the form too, for a different reason and
      with a different message. Either one disables the same controls.

      ONE EXCEPTION, ADDED 2026-09-07: the Funding Profile's Delete. A line
      recorded against the wrong source cannot be typed over — the table is
      read-only and Replenish only appends — so removing it is the only repair,
      and a parent that has been itemized is exactly where a wrong line is most
      likely to have been noticed. Every line except the FIRST one (the line
      the project was created with, which its children were imported against;
      firstFundingLine() says which)
      stays removable while itemized, and Save stays enabled so the removal can
      be persisted. Nothing else can travel with that save: every other input on
      this form is disabled, so the payload is the fetched project plus the
      deletion. The server's "Below Committed Draw" check still refuses a removal
      that would drop the allocation below what the children draw. */

  /*  AN APPROVED PROGRAM CLOSES THE RECORD, NOT THE MONEY (rule revised
      2026-09-09). It freezes this form the way being itemized does — details and
      component read-only — and it leaves Save, the funding table's Delete and
      Replenish alone, because those are how a top-up and a funding-line removal
      reach the database and the client wants both at GAA-R. So this reads
      exactly like isItemized here, and the only action approval still refuses
      lives on the page's action bar (Delete Lump Sum Project).

      FRONTEND ONLY, like the itemized freeze: UpdateLumpSum still accepts these
      fields from an API caller. The page is what stops offering them. */
  const programApproved = !!programApproval;

  const formDisabled = isItemized || !!lock || programApproved;

  /*  The sentence that goes with formDisabled, for the controls that have
      nowhere else to show one — the Component Cost pencil's tooltip and a
      notice inside its dialog, which can be open when a focus refresh flips
      any of the three. Lock first (transient, names the holder), then the
      approval, then the itemized freeze; the banners follow the same order. */
  const formDisabledReason = lock
    ? lockReason(lock)
    : programApproval
      ? approvedReason(programApproval)
      : isItemized
        ? `Read-only while ${itemizedCount} itemized project${itemizedCount === 1 ? '' : 's'} draw on this allocation. Delete them to edit it.`
        : undefined;

  /*  Save follows the IMPORT lock alone — one reason, derived once, that the
      button's disabled state and its tooltip both read. Neither being itemized
      nor an Approved program disables it: with every other control disabled the
      only change either can carry is a funding-line removal or a Replenish,
      which is exactly what Save is left enabled for. */
  const saveReason = lock
    ? lockReason(lock)
    : saveUnverified
      ? SAVE_UNVERIFIED_REASON
      : undefined;
  const saveDisabled = !!saveReason;

  /*  Re-seeded on a different project, or when the page says the data was
      replaced (dataVersion) — never on identity alone; see the prop's note. The
      effect reads the latest initialData through a ref so the dependency list
      can say exactly what triggers it without lying to the lint rule. */
  const initialDataRef = useRef(initialData);
  initialDataRef.current = initialData;

  useEffect(() => {
    const data = initialDataRef.current;
    if (mode !== 'edit' || !data) return;
    setForm(data);
    /*  The re-read landed: what is on screen is what the server holds, so a
        save whose answer was lost is accounted for either way. */
    setSaveUnverified(false);
    /*  Only replace the child sets when the fetch actually brought them.
        A list row carries none, and overwriting an edited table with [] would
        discard the user's unsaved rows and then post an empty set. */
    if (data.FundingProfiles) setFundingProfiles(data.FundingProfiles);
    if (data.ComponentCosts) setComponentCosts(data.ComponentCosts);
    if (data.ComponentCostPerYear) setComponentCostPerYear(data.ComponentCostPerYear);
  }, [mode, initialData?.Id, dataVersion]);

  useEffect(() => {
    getProjectEnums()
      .then((response) => setProjectEnums(response.Data))
      .catch(() => {
        // httpClient's interceptor already raised the toast.
      });
    getComponentsEnums()
      .then((response) => setDropdowns(response.Data))
      .catch(() => {
        // httpClient's interceptor already raised the toast.
      });
  }, []);

  /** The funded total: SUM of the live funding lines. Component Cost's ceiling. */
  const fundedTotal = fundingProfiles
    .filter((line) => !line.IsDeleted)
    .reduce((sum, line) => sum + (line.Amount || 0), 0);

  /*  PENDING FUNDING STATE (2026-09-08). Dirty means a top-up waiting to be
      inserted (Id 0) or a persisted line waiting to be soft-deleted. The delta
      is the local funded total against the server's Total — the figure the
      balance widget shows — so the page can overlay it. Derived from the lines
      on every render, never cached: handleUpdate's pre-check re-reads the
      balance into the atom mid-flow, and a cached delta would go stale under it.
      Zero unless dirty, so a list row rendered before the detail fetch (no
      lines yet) does not read as "−everything pending". */
  const isFundingDirty = fundingProfiles.some(
    (line) => line.Id === 0 || (line.Id > 0 && line.IsDeleted),
  );
  const savedTotal = balance?.Total ?? initialData?.Allocation ?? fundedTotal;
  const pendingDelta = isFundingDirty ? fundedTotal - savedTotal : 0;

  const onFundingStateChangeRef = useRef(onFundingStateChange);
  onFundingStateChangeRef.current = onFundingStateChange;
  useEffect(() => {
    onFundingStateChangeRef.current?.({ pendingDelta, isDirty: isFundingDirty });
  }, [pendingDelta, isFundingDirty]);

  const handleChange = (field: keyof LumpSum, value: LumpSum[keyof LumpSum]) => {
    setForm((prev) => {
      const Next = { ...prev, [field]: value };
      /*  Changing Category invalidates the Sub-Category under it (2026-09-11). Most restricted
          categories permit exactly ONE of the 96 in-window Sub-Categories, so carrying the old
          one across is almost always carrying an invalid pair — the save now refuses it by name,
          and the field would still be showing a plausible-looking value while it did.
          Same shape as the Funding Source dropdown below, which clears its Agreement. */
      if (field === 'CategoryId' && prev.CategoryId !== value) Next.SubCategoryId = undefined;
      return Next;
    });
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  // ── Funding profile handlers ─────────────────────────────────────────────

  /*  NO handleAddFundingProfile (2026-09-06). A funding line is written by
      CreateLumpSum and added by Replenish — as a LOCAL draft since 2026-09-08,
      through handleReplenishFundingProfile below, saved with everything else.
      The table is read-only apart from Delete. handleEdit stays because the
      percentage each line carries is derived from the amounts and reaches state
      through it. */

  const handleEditFundingProfile = (index: number, updated: LumpSumFundingProfile) => {
    setFundingProfiles((prev) => prev.map((row, i) => (i === index ? updated : row)));
  };

  const handleDeleteFundingProfile = (index: number) => {
    setFundingProfiles((prev) =>
      // An unsaved row just goes; a persisted one is flagged so the server can
      // soft-delete it. Dropping a persisted row from the payload instead would
      // mean "not mine to touch" and leave it in place.
      prev[index].Id === 0
        ? prev.filter((_, i) => i !== index)
        : prev.map((row, i) => (i === index ? { ...row, IsDeleted: true } : row)),
    );
  };

  /** The dialog's resolved draft (Id 0). Appended; UpdateLumpSum inserts it on Save. */
  const handleReplenishFundingProfile = (draft: LumpSumFundingProfile) => {
    setFundingProfiles((prev) => [...prev, draft]);
  };

  /*  Back to the last fetched lines. Only the funding set: the pending state
      this reverts is funding-only, and the other two child sets carry nothing
      Replenish or Delete touched. */
  const handleDiscardFundingChanges = () => {
    setFundingProfiles(initialData?.FundingProfiles ?? []);
  };

  // ── Component cost handlers ──────────────────────────────────────────────

  /*  NO ADD, NO DELETE for the component cost (2026-09-06). A Lump Sum Project
      holds exactly one component — created with the project, derived from the
      funding lines on every save — and UpdateLumpSum refuses a payload that adds
      a second or deletes the only one. Edit remains, for the Description. */

  const handleEditComponentCost = (
    index: number,
    cost: LumpSumComponentCost,
    perYear: LumpSumComponentCostPerYear[],
  ) => {
    const previousCostId = componentCosts[index].CostId;
    setComponentCosts((prev) => prev.map((row, i) => (i === index ? cost : row)));
    setComponentCostPerYear((prev) => [
      ...prev.filter((row) => row.ComponentCostId !== previousCostId),
      ...perYear,
    ]);
  };

  // ── Add flow ─────────────────────────────────────────────────────────────

  const handleCreate = () => {
    const validationErrors = formValidation(form, lumpSumFormRules);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      /*  ONE toast, for the FIRST failure in rule order — not one per failure.
          formValidation returns every error, which is right for marking the
          fields red, but toasting all of them stacked eight notifications on an
          empty form and buried the one the user should act on first. Rule order
          is the server's order, so the message here is the message the request
          would have come back with. */
      showToast({ type: 'error', message: firstError(validationErrors) });
      return;
    }

    /*  The server refuses each of these by name, but a round trip to learn that
        the Allocation box is empty is a poor way to find out. */
    if (allocation <= 0) {
      showToast({
        type: 'error',
        message: 'Enter the Lump Sum allocation — it is the amount that will be itemized against.',
      });
      return;
    }
    if (!fundingSource) {
      showToast({
        type: 'error',
        message: 'Select a Funding Source — the allocation has to be funded from somewhere.',
      });
      return;
    }
    if (!fundingAgreement) {
      showToast({
        type: 'error',
        message:
          'Select a Funding Agreement — it identifies which fund the allocation is drawn from.',
      });
      return;
    }

    setProgramName(form.ProgramName ?? '');
    setIsCreateConfirmOpen(true);
  };

  const confirmCreate = async () => {
    setIsSaving(true);
    try {
      const payload: DtoCreateLumpSum = {
        ...detailFields(form),
        Allocation: allocation,
        FundingSource: fundingSource,
        FundingAgreement: fundingAgreement,
        FundingProfiles: [],
        ComponentCosts: [],
        ComponentCostPerYear: [],
      };

      const result = await createLumpSum(payload);
      showToast({ type: 'success', message: result.Message ?? 'Lump Sum Project created.' });
      navigate(`/lumpsum/${result.Data.LumpSumId}`);
    } catch {
      // httpClient's interceptor already raised the toast.
    } finally {
      setIsSaving(false);
    }
  };

  // ── Edit flow ────────────────────────────────────────────────────────────

  const handleUpdate = async () => {
    /*  The SAME required set as create. UpdateLumpSum shares
        ValidateRequiredFieldsAsync with CreateLumpSum precisely so the two
        cannot drift, and this side has to match or the form is stricter on
        create than on edit — which is how a project gets saved once and then
        refuses every subsequent save. */

    /*  The click that races a focus refresh: the button was live when pressed and
        the gate closed a moment before. Say so here rather than round-trip. */
    if (saveReason) {
      showToast({ type: 'error', message: saveReason });
      return;
    }

    const validationErrors = formValidation(form, lumpSumFormRules);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      showToast({ type: 'error', message: firstError(validationErrors) });
      return;
    }

    /*  The three child sets, which create does not carry and update must. The
        server refuses each by name; these are the same refusals, one round trip
        earlier. "Live" means not flagged IsDeleted — a set consisting only of
        deletions is empty as far as the save is concerned. */
    if (fundingProfiles.filter((row) => !row.IsDeleted).length === 0) {
      showToast({
        type: 'error',
        message: 'A Lump Sum Project needs at least one Funding Profile line.',
      });
      return;
    }
    if (componentCosts.filter((row) => !row.IsDeleted).length === 0) {
      showToast({
        type: 'error',
        message: 'A Lump Sum Project needs at least one Component Cost.',
      });
      return;
    }
    if (componentCostPerYear.filter((row) => !row.IsDeleted).length === 0) {
      showToast({
        type: 'error',
        message: 'Every Component Cost needs at least one Cost Per Year row.',
      });
      return;
    }

    /*  Refuse a save that would put the allocation below what the children have
        already drawn. The server would reject it too, but naming the figure here
        is the difference between "delete two projects first" and a constraint
        error the user cannot act on.

        The figure is re-read rather than taken from the atom: this form can sit
        open for a long time, and if someone else imported children meanwhile,
        a stale Itemized would wave through a save the server then refuses.
        LumpSumBalance exists for exactly this — the figures without the rest of
        the detail payload. A failed refresh falls back to what is in hand,
        because a check that cannot run must not block a legitimate save. */
    let itemized = balance?.Itemized;
    if (form.Id) {
      try {
        const fresh = await fetchLumpSumBalance(form.Id);
        itemized = fresh.Data.Itemized;
      } catch {
        // httpClient's interceptor already raised the toast.
      }
    }

    if (itemized !== undefined && fundedTotal < itemized) {
      showToast({
        type: 'error',
        message:
          `Cannot reduce the allocation below what has already been itemized ` +
          `(₱${itemized.toLocaleString('en-PH')}). ` +
          `Delete itemized projects first, then reduce the funding.`,
      });
      return;
    }

    setProgramName(form.ProgramName ?? '');
    setIsUpdateConfirmOpen(true);
  };

  const confirmUpdate = async () => {
    setIsSaving(true);
    try {
      const payload: DtoUpdateLumpSum = {
        ...detailFields(form),
        LumpSumId: form.Id!,
        FundingProfiles: fundingProfiles,
        ComponentCosts: componentCosts,
        ComponentCostPerYear: componentCostPerYear,
      };

      const result = await updateLumpSum(payload);

      /*  RESET FROM THE SAVE'S OWN RE-READ. updateLumpSum returns the project as
          the server now holds it, with the new database Ids on the rows this
          save inserted. The form must take that itself: the initialData effect
          no longer fires on identity, and without this the just-inserted line
          would keep Id 0 in state and be inserted AGAIN on the next Save. */
      setForm(result.Data);
      setFundingProfiles(result.Data.FundingProfiles ?? []);
      setComponentCosts(result.Data.ComponentCosts ?? []);
      setComponentCostPerYear(result.Data.ComponentCostPerYear ?? []);
      setIsUpdateConfirmOpen(false);

      showToast({ type: 'success', message: 'Lump Sum Project saved.' });
    } catch (err) {
      /*  A REFUSAL KEEPS THE EDITS; A LOST ANSWER LOCKS THE FORM (2026-09-10).
          The interceptor has toasted a refusal already and nothing was written,
          so the user's edits stay and Save stays live. Anything else — no answer,
          or a 5xx, which the save can return AFTER its commit — is an outcome
          this form does not know. It used to leave the draft in state as
          unsaved, and the next press inserted it a second time (finding 2 of the
          2026-09-10 review). Now Save is locked with the reason, and the page is
          asked to re-read; the dataVersion bump that follows is what unlocks it,
          with the persisted line in place of the draft if the save had landed. */
      if (isServerRefusal(err)) return;
      setSaveUnverified(true);
      setIsUpdateConfirmOpen(false);
      showToast({
        type: 'warning',
        message: 'The save did not answer. Reloading the project to find out whether it landed.',
      });
      try {
        await onSaveUnverified?.();
      } catch {
        // Still unverified; the Reload button beside Save tries again.
      }
    } finally {
      setIsSaving(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/*  WHY THE FORM IS GREYED. Shown only for the itemized case: the import's
           own lock already has an amber banner on the page above this one, and two
           banners saying different things about the same greyed fields would be
           worse than one. */}
      {isItemized && !lock && !programApproved && (
        <div
          role="status"
          className="rounded-md border border-blue-300 bg-blue-50 px-4 py-3 text-sm text-blue-900"
        >
          <span className="font-semibold">
            Locked by {itemizedCount} itemized project{itemizedCount === 1 ? '' : 's'}.
          </span>{' '}
          This project's details and component are read-only while anything is itemized from it.
          Replenish still adds a funding line (applied when you save), and a line added by one can
          still be removed — but not the line the project was created with. Deleting every itemized
          project makes the fields editable again.
        </div>
      )}

      <CollapsibleSection
        title="Program Details"
        isOpen={isProgramOpen}
        onToggle={() => setIsProgramOpen(!isProgramOpen)}
      >
        <LumpSumProgramDetailsSection
          lumpSum={form}
          onChange={handleChange}
          errors={errors}
          mode={mode}
        />
      </CollapsibleSection>

      <CollapsibleSection
        title="Project Details"
        isOpen={isDetailsOpen}
        onToggle={() => setIsDetailsOpen(!isDetailsOpen)}
      >
        <LumpSumDetailsSection
          lumpSum={form}
          onChange={handleChange}
          errors={errors}
          projectEnums={projectEnums}
          mode={mode}
          itemizedCount={itemizedCount}
          disabled={formDisabled}
        />
      </CollapsibleSection>

      {/* Add mode collects the allocation itself: CreateLumpSum takes one
          number and one funding line, not the child tables. */}
      {mode === 'add' && (
        <CollapsibleSection title="Allocation" isOpen onToggle={() => {}}>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="flex flex-row text-left gap-5 items-center">
                <label className="w-1/3 text-gray-600">
                  <span className="text-red-500 text-lg">*</span>Allocation:
                </label>
                <input
                  type="text"
                  value={allocation ? allocation.toLocaleString('en-PH') : ''}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^0-9.]/g, '');
                    const parsed = parseFloat(raw);
                    setAllocation(Number.isNaN(parsed) ? 0 : parsed);
                  }}
                  placeholder="0.00"
                  className="w-2/3 mt-1 px-3 py-2 border border-gray-300 rounded-md text-right"
                />
              </div>

              <div className="flex flex-row text-left gap-5 items-center">
                <label className="w-1/3 text-gray-600">
                  <span className="text-red-500 text-lg">*</span>Funding Source:
                </label>
                <div className="w-2/3 min-w-0">
                  <SearchableDropdown
                    options={formatDropdownOptions(dropdowns?.Sources ?? [], 'Organization', 'Organization')}
                    value={fundingSource}
                    /*  Clearing the agreement with the source is what keeps the
                        pair valid: the list below is filtered by this value, so a
                        leftover agreement from the previous source would be a
                        selection no longer in its own options — and, since
                        2026-09-08, one CreateLumpSum refuses outright. */
                    onChange={(value) => { setFundingSource(String(value)); setFundingAgreement(''); }}
                    placeholder="Select Funding Source"
                    allowClear
                  />
                </div>
              </div>

              <div className="flex flex-row text-left gap-5 items-center">
                <label className="w-1/3 text-gray-600">
                  <span className="text-red-500 text-lg">*</span>Funding Agreement:
                </label>
                <div className="w-2/3 min-w-0">
                  {/*  ONLY THE CHOSEN SOURCE'S AGREEMENTS (2026-09-08). An
                       agreement belongs to a source (tOptionFundingAgreement.SourceOrg)
                       and CreateLumpSum now refuses a pair that does not belong
                       together — the same rule Replenish has always applied. Offering
                       the full list would let the form build a payload the server
                       answers 400 to, with nothing on screen saying which agreements
                       are valid. Same filter and same comparator as the Replenish
                       dialog, so the two cannot disagree about "same source". */}
                  <SearchableDropdown
                    options={formatDropdownOptions(
                      (dropdowns?.Agreements ?? []).filter(
                        (a) => !fundingSource || sameSource(a.SourceOrg, fundingSource),
                      ),
                      'Code',
                      'Code',
                    )}
                    value={fundingAgreement}
                    onChange={(value) => setFundingAgreement(String(value))}
                    placeholder={fundingSource ? 'Select Funding Agreement' : 'Select a Funding Source first'}
                    allowClear
                  />
                </div>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-4">
              The allocation becomes the cost of this project&apos;s Lump Sum component and is
              what itemization draws down. It is written with one funding line for the full
              amount; further lines can be added after the project exists.
            </p>
          </div>
        </CollapsibleSection>
      )}

      {/* Funding Profile and Component Cost are edit-mode only: their rows hang
          off the project's revision, which does not exist until it is created. */}
      {mode === 'edit' && (
        <>
          <CollapsibleSection
            title="Funding Profile"
            isOpen={isFundingOpen}
            onToggle={() => setIsFundingOpen(!isFundingOpen)}
          >
            <LumpSumFundingProfileForm
              fundingProfiles={fundingProfiles}
              onEdit={handleEditFundingProfile}
              onDelete={handleDeleteFundingProfile}
              sources={dropdowns?.Sources}
              agreements={dropdowns?.Agreements}
              /*  Not formDisabled: neither an itemized parent nor an Approved
                  program closes this table — a wrong line has to stay removable
                  in both, and Save is left enabled to carry the removal. Only an
                  import in progress closes it. */
              disabled={!!lock}
              protectFirstLine={isItemized}
              isDirty={isFundingDirty}
              onDiscard={handleDiscardFundingChanges}
            />
          </CollapsibleSection>

          {/*  THE FORM OWNS THE DIALOG (2026-09-08): the lines it appends to live
               here. The page keeps the button and the lock gate, and only says
               open or closed. */}
          <ReplenishLumpSumDialog
            open={replenishOpen}
            onClose={onReplenishClose}
            onSubmit={handleReplenishFundingProfile}
            fundingProfiles={fundingProfiles}
            remaining={(balance?.Remaining ?? initialData?.Remaining ?? 0) + pendingDelta}
            savedAllocation={savedTotal}
          />

          <CollapsibleSection
            title="Component Cost"
            isOpen={isComponentOpen}
            onToggle={() => setIsComponentOpen(!isComponentOpen)}
          >
            <LumpSumComponentCostForm
              componentCosts={componentCosts}
              componentCostPerYear={componentCostPerYear}
              projectUacs={form.UACS}
              onEdit={handleEditComponentCost}
              componentTypes={dropdowns?.ComponentTypes || []}
              disabled={formDisabled}
              disabledReason={formDisabledReason}
            />
          </CollapsibleSection>
        </>
      )}

      {mode === 'add' && (
        <>
          <div className="flex justify-end">
            <Button color="green" onClick={handleCreate} disabled={isSaving}>
              {isSaving ? 'Creating...' : 'Create Lump Sum Project'}
            </Button>
          </div>

          <SaveLumpSumConfirmDialog
            isOpen={isCreateConfirmOpen}
            onClose={() => setIsCreateConfirmOpen(false)}
            onConfirm={confirmCreate}
            programName={programName}
          />
        </>
      )}

      {mode === 'edit' && (
        <>
          <div
            className="flex justify-end"
            /*  A hint only. The server still accepts a save from an API caller
                either way: it answers 409 Busy to one that races an import, and it
                does not check the itemized count at all. */
            title={saveReason}
          >
            {saveUnverified && (
              <Button
                color="amber"
                className="mr-3"
                data-reload-project
                onClick={() => void Promise.resolve(onSaveUnverified?.()).catch(() => {})}
              >
                Reload project
              </Button>
            )}
            <Button color="blue" onClick={() => void handleUpdate()} disabled={isSaving || saveDisabled}>
              {isSaving ? 'Saving...' : 'Save Lump Sum Project'}
            </Button>
          </div>

          <SaveLumpSumConfirmDialog
            isOpen={isUpdateConfirmOpen}
            onClose={() => setIsUpdateConfirmOpen(false)}
            onConfirm={confirmUpdate}
            programName={programName}
            title="Save Lump Sum Project"
            confirmLabel="Save Lump Sum Project"
          />
        </>
      )}
    </div>
  );
};

export default LumpSumForm;
