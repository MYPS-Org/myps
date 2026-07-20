import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../components/toaster/ToasterContext';
import { formValidation } from '../../../utils/FormValidation';
import { walletFormRules } from '../rules/walletFormRules';
import { createWallet, updateWallet } from '../Service';
import { getProjectEnums } from '../../Project/Service';
import { Button } from '../../../components/tailwindui/button';
import { useWalletBalance } from '../hooks/useWalletBalance';

import CollapsibleSection from './CollapsibleSection';
import WalletProgramDetailsSection from './WalletProgramDetailsSection';
import WalletDetailsSection from './WalletDetailsSection';
import WalletFundingProfileForm from './WalletFundingProfileForm';
import WalletComponentCostForm from './WalletComponentCostForm';
// SaveWalletConfirmDialog: { isOpen, onClose, onConfirm, programName?, title?, confirmLabel? }
import SaveWalletConfirmDialog from '../dialogs/SaveWalletConfirmDialog';

import type {
  LSWallet,
  DtoCreateWallet,
  DtoUpdateWallet,
  WalletFundingProfile,
  WalletComponentCost,
  WalletComponentCostPerYear,
} from '../Model.d';
import type { ProjectEnums } from '../../Project/Model.d';
import { MOCK_WALLET_COMPONENT_TYPES } from '../utils/constants';

interface WalletFormProps {
  initialData?: LSWallet;
  mode?: 'add' | 'edit';
}

// Mirrors ProjectForm.tsx: one Form component, mode-driven, reused by both
// the Add page (mode="add") and the Detail page (mode="edit", initialData=wallet).
//
// Two-phase creation pattern (mirroring AddProject / ProjectForm):
//   Phase 1 (add mode)  — only Program Details + Wallet Details, no funding/component sections.
//                         Creates the wallet to get a real backend-generated Id.
//   Phase 2 (edit mode) — all four sections editable; "Update Wallet" saves the full composite
//                         state (flat fields + Funding Profile + Component Cost) in one call.
const WalletForm: React.FC<WalletFormProps> = ({ initialData, mode = 'add' }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();

  // A wallet is read-only only when it has been soft-deleted.
  // No IsLocked/IsActive field exists on the current model; IsDeleted is the
  // only terminal state. This single line is the designated swap point if a
  // real "locked" field is added later.
  const isDisabled = Boolean(initialData?.IsDeleted);

  // ── Flat wallet state (details, not arrays) ──────────────────────────────
  const [wallet, setWallet] = useState<Partial<LSWallet>>(
    initialData || {}
  );
  const [errors, setErrors] = useState<Partial<Record<keyof LSWallet, string>>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [projectEnums, setProjectEnums] = useState<ProjectEnums | null>(null);

  // ── Array state — funding profiles and component costs ───────────────────
  const [fundingProfiles, setFundingProfiles] = useState<WalletFundingProfile[]>(
    initialData?.WalletFundingProfiles || []
  );
  const [componentCosts, setComponentCosts] = useState<WalletComponentCost[]>(
    initialData?.WalletComponentCosts || []
  );
  const [componentCostPerYear, setComponentCostPerYear] = useState<WalletComponentCostPerYear[]>(
    initialData?.WalletComponentCostPerYear || []
  );

  // ── Confirm-dialog state ─────────────────────────────────────────────────
  const [selectedProgramName, setSelectedProgramName] = useState<string>('');
  const [isCreateConfirmDialogOpen, setIsCreateConfirmDialogOpen] = useState(false);
  const [isUpdateConfirmDialogOpen, setIsUpdateConfirmDialogOpen] = useState(false);

  // ── Collapsible section states — all expanded by default ─────────────────
  const [isProgramDetailsOpen, setIsProgramDetailsOpen] = useState(true);
  const [isDetailsOpen, setIsDetailsOpen] = useState(true);
  const [isFundingOpen, setIsFundingOpen] = useState(true);
  const [isComponentOpen, setIsComponentOpen] = useState(true);

  // ── Live balance — used by the Used-floor guard in handleUpdateWallet ─────
  // Returns null when wallet.Id is 0 (add mode — wallet not yet persisted).
  const balance = useWalletBalance(wallet.Id ?? 0);

  // ── Sync from initialData in edit mode ───────────────────────────────────
  useEffect(() => {
    if (mode === 'edit' && initialData) {
      setWallet(initialData);
      setFundingProfiles(initialData.WalletFundingProfiles || []);
      setComponentCosts(initialData.WalletComponentCosts || []);
      setComponentCostPerYear(initialData.WalletComponentCostPerYear || []);
    }
  }, [mode, initialData]);

  // ── Amount invariant: Amount = SUM of non-deleted funding profiles ────────
  //
  // This mirrors the mock store's recomputeWalletAmount() helper but runs on
  // the client-side state so validation and the confirm dialog can read the
  // correct derived Amount without a round-trip to the store.
  useEffect(() => {
    const derivedAmount = fundingProfiles
      .filter((p) => !p.IsDeleted)
      .reduce((sum, p) => sum + (p.Amount || 0), 0);
    setWallet((prev) => ({ ...prev, Amount: derivedAmount }));
  }, [fundingProfiles]);

  // ── Load project enums on mount ───────────────────────────────────────────
  useEffect(() => {
    const loadEnums = async () => {
      try {
        const response = await getProjectEnums();
        setProjectEnums(response.Data);
      } catch {
        // httpClient interceptor shows error toasts automatically (FE/CLAUDE.md)
        console.error('Failed to load project enums.');
      }
    };
    loadEnums();
  }, []);

  // ── Generic flat-field setter ─────────────────────────────────────────────
  // Always wired to handleChange (edit mode relies on isDisabled to prevent
  // mutation when the wallet is locked, not a no-op onChange).
  const handleChange = (field: keyof LSWallet, value: LSWallet[keyof LSWallet]) => {
    setWallet((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  // ── Funding profile handlers ──────────────────────────────────────────────
  const handleAddFundingProfile = () => {
    const newProfile: WalletFundingProfile = {
      Id: 0,
      WalletId: wallet.Id || 0,
      Source: '',
      Agreement: '',
      Amount: 0,
      Percentage: 0,
      IsDeleted: false,
      CreatedBy: user?.UserId || '',
      CreatedDate: new Date().toISOString(),
    };
    setFundingProfiles((prev) => [...prev, newProfile]);
  };

  const handleEditFundingProfile = (index: number, updated: WalletFundingProfile) => {
    setFundingProfiles((prev) => prev.map((p, i) => (i === index ? updated : p)));
  };

  const handleDeleteFundingProfile = (index: number) => {
    const profile = fundingProfiles[index];
    if (profile.Id === 0) {
      // Unsaved row — remove entirely
      setFundingProfiles((prev) => prev.filter((_, i) => i !== index));
    } else {
      // Persisted row — soft-delete so the backend can reconcile
      setFundingProfiles((prev) =>
        prev.map((p, i) => (i === index ? { ...p, IsDeleted: true } : p))
      );
    }
  };

  // ── Component cost handlers ───────────────────────────────────────────────
  const handleAddComponentCost = (
    cost: WalletComponentCost,
    perYear: WalletComponentCostPerYear[]
  ) => {
    setComponentCosts((prev) => [...prev, cost]);
    setComponentCostPerYear((prev) => [...prev, ...perYear]);
  };

  const handleEditComponentCost = (
    index: number,
    cost: WalletComponentCost,
    perYear: WalletComponentCostPerYear[]
  ) => {
    const oldCostId = componentCosts[index].CostId;
    setComponentCosts((prev) => prev.map((c, i) => (i === index ? cost : c)));
    // Replace all per-year rows for this component cost with the updated set
    setComponentCostPerYear((prev) => [
      ...prev.filter((p) => p.ComponentCostId !== oldCostId),
      ...perYear,
    ]);
  };

  const handleDeleteComponentCost = (index: number) => {
    const cost = componentCosts[index];
    if (cost.Id === 0) {
      setComponentCosts((prev) => prev.filter((_, i) => i !== index));
      setComponentCostPerYear((prev) =>
        prev.filter((p) => p.ComponentCostId !== cost.CostId)
      );
    } else {
      setComponentCosts((prev) =>
        prev.map((c, i) => (i === index ? { ...c, IsDeleted: true } : c))
      );
      setComponentCostPerYear((prev) =>
        prev.map((p) =>
          p.ComponentCostId === cost.CostId ? { ...p, IsDeleted: true } : p
        )
      );
    }
  };

  // ── Add flow — Step 1: Validate → open confirm dialog ────────────────────
  const handleSaveWallet = () => {
    // Standard flat-field rules (ProgramId, CategoryId, Tier only — funding data
    // is not collected in add mode, so the former "at least one funding profile"
    // gate has been removed).
    const validationErrors = formValidation(wallet, walletFormRules);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      Object.values(validationErrors).forEach((message) =>
        showToast({ type: 'error', message })
      );
      return;
    }

    // Resolve program name for the confirm dialog
    const selectedProgram = projectEnums?.Programs.find(
      (p) => p.ProgramId === wallet.ProgramId
    );
    if (!selectedProgram) {
      showToast({ type: 'error', message: 'Selected program not found.' });
      return;
    }

    setSelectedProgramName(selectedProgram.Name);
    setIsCreateConfirmDialogOpen(true);
  };

  // ── Add flow — Step 2: API call after user confirms ───────────────────────
  const confirmSaveWallet = async () => {
    setIsSaving(true);
    try {
      const payload: DtoCreateWallet = {
        programId: wallet.ProgramId!,
        // Program metadata denormalized from the selected ProgramList entry.
        typeName: wallet.TypeName,
        yearStart: wallet.YearStart,
        programStageName: wallet.ProgramStageName,
        currentStage: wallet.CurrentStage,
        categoryId: wallet.CategoryId!,
        subCategoryId: wallet.SubCategoryId || 0,
        operatingUnit: wallet.OperatingUnit || '',
        // Phase 1 only collects Program Details + Wallet Details; arrays are empty.
        fundingProfiles: [],
        componentCosts: [],
        componentCostPerYear: [],
        // Optional flat detail fields
        myId: wallet.MYId,
        alternateId: wallet.AlternateId,
        externalId: wallet.ExternalId,
        uacs: wallet.UACS,
        tier: wallet.Tier,
        rank: wallet.Rank,
        mycaApprovalDate: wallet.MYCAApprovalDate || null,
        description: wallet.Description,
        province: wallet.Province,
        city: wallet.City,
        legislativeDistrict: wallet.LegislativeDistrict,
        deo: wallet.DEO,
        region: wallet.Region,
        implementingOffice: wallet.ImplementingOffice,
        regionWide: wallet.RegionWide,
        origin: wallet.Origin,
        agency: wallet.Agency,
        implementationMode: wallet.ImplementationMode,
        emergencyMode: wallet.EmergencyMode,
        feasibility: wallet.Feasibility,
        feasibilityDate: wallet.FeasibilityDate || null,
        detailedDesign: wallet.DetailedDesign,
        detailedDesignDate: wallet.DetailedDesignDate || null,
        rowAvailable: wallet.RowAvailable,
        createdBy: user?.UserId || '',
      };

      const result = await createWallet(payload, selectedProgramName);

      showToast({ type: 'success', message: 'Wallet created successfully.' });
      navigate(`/lumpsum/${result.Data.Id}`);
    } catch {
      // httpClient interceptor handles error toasts automatically (FE/CLAUDE.md).
      console.error('Error creating wallet.');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Edit flow — Step 1: Used-floor guard → open confirm dialog ────────────
  const handleUpdateWallet = () => {
    // Compute the derived amount from the current client-side funding profile state.
    const derivedAmount = fundingProfiles
      .filter((p) => !p.IsDeleted)
      .reduce((sum, p) => sum + (p.Amount || 0), 0);

    // Block saves that would push Available negative by checking against the
    // currently drawn amount (sum of itemized-project draws from Jotai atom).
    if (balance && derivedAmount < balance.Used) {
      showToast({
        type: 'error',
        message:
          `Cannot reduce wallet amount below current draw commitments ` +
          `(₱${balance.Used.toLocaleString('en-PH')}). ` +
          `Remove or cancel itemized projects first, then reduce funding.`,
      });
      return;
    }

    // Program name is already on the wallet record in edit mode.
    setSelectedProgramName(wallet.ProgramName || '');
    setIsUpdateConfirmDialogOpen(true);
  };

  // ── Edit flow — Step 2: API call after user confirms ──────────────────────
  const confirmUpdateWallet = async () => {
    setIsSaving(true);
    try {
      const payload: DtoUpdateWallet = {
        walletId: wallet.Id!,
        programId: wallet.ProgramId!,
        typeName: wallet.TypeName,
        yearStart: wallet.YearStart,
        programStageName: wallet.ProgramStageName,
        currentStage: wallet.CurrentStage,
        categoryId: wallet.CategoryId!,
        subCategoryId: wallet.SubCategoryId || 0,
        operatingUnit: wallet.OperatingUnit || '',
        // Full replacement arrays — include IsDeleted rows so the store/backend
        // can reconcile soft-deletes. Store filters for the Amount invariant.
        fundingProfiles,
        componentCosts,
        componentCostPerYear,
        // Optional flat detail fields
        myId: wallet.MYId,
        alternateId: wallet.AlternateId,
        externalId: wallet.ExternalId,
        uacs: wallet.UACS,
        tier: wallet.Tier,
        rank: wallet.Rank,
        mycaApprovalDate: wallet.MYCAApprovalDate || null,
        description: wallet.Description,
        province: wallet.Province,
        city: wallet.City,
        legislativeDistrict: wallet.LegislativeDistrict,
        deo: wallet.DEO,
        region: wallet.Region,
        implementingOffice: wallet.ImplementingOffice,
        regionWide: wallet.RegionWide,
        origin: wallet.Origin,
        agency: wallet.Agency,
        implementationMode: wallet.ImplementationMode,
        emergencyMode: wallet.EmergencyMode,
        feasibility: wallet.Feasibility,
        feasibilityDate: wallet.FeasibilityDate || null,
        detailedDesign: wallet.DetailedDesign,
        detailedDesignDate: wallet.DetailedDesignDate || null,
        rowAvailable: wallet.RowAvailable,
        updatedBy: user?.UserId || '',
      };

      await updateWallet(payload, selectedProgramName);

      showToast({ type: 'success', message: 'Wallet updated successfully.' });
    } catch {
      // httpClient interceptor handles error toasts automatically (FE/CLAUDE.md).
      console.error('Error updating wallet.');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Program Details — mirrors Project module's ProgramDetailsForm card, rendered first */}
      <CollapsibleSection
        title="Program Details"
        isOpen={isProgramDetailsOpen}
        onToggle={() => setIsProgramDetailsOpen(!isProgramDetailsOpen)}
      >
        <WalletProgramDetailsSection
          wallet={wallet}
          onChange={handleChange}
          errors={errors}
          disabled={isDisabled}
          projectEnums={projectEnums}
          mode={mode}
        />
      </CollapsibleSection>

      <CollapsibleSection
        title="Project Details"
        isOpen={isDetailsOpen}
        onToggle={() => setIsDetailsOpen(!isDetailsOpen)}
      >
        <WalletDetailsSection
          wallet={wallet}
          onChange={handleChange}
          errors={errors}
          disabled={isDisabled}
          projectEnums={projectEnums}
        />
      </CollapsibleSection>

      {/* Funding Profile and Component Cost are hidden in add mode.
          The wallet must be created first (Phase 1) to get a real Id before
          funding/component rows — which use that Id as a FK — can be saved. */}
      {mode === 'edit' && (
        <>
          <CollapsibleSection
            title="Funding Profile"
            isOpen={isFundingOpen}
            onToggle={() => setIsFundingOpen(!isFundingOpen)}
          >
            <WalletFundingProfileForm
              fundingProfiles={fundingProfiles}
              onAdd={handleAddFundingProfile}
              onEdit={handleEditFundingProfile}
              onDelete={handleDeleteFundingProfile}
              disabled={isDisabled}
            />
          </CollapsibleSection>

          <CollapsibleSection
            title="Component Cost"
            isOpen={isComponentOpen}
            onToggle={() => setIsComponentOpen(!isComponentOpen)}
          >
            <WalletComponentCostForm
              componentCosts={componentCosts}
              componentCostPerYear={componentCostPerYear}
              onAdd={handleAddComponentCost}
              onEdit={handleEditComponentCost}
              onDelete={handleDeleteComponentCost}
              componentTypes={MOCK_WALLET_COMPONENT_TYPES}
              maxAmountCost={wallet.Amount}
              walletId={wallet.Id}
              disabled={isDisabled}
            />
          </CollapsibleSection>
        </>
      )}

      {/* Add mode — Create Wallet button + confirm dialog */}
      {mode === 'add' && (
        <>
          <div className="flex justify-end">
            <Button color="green" onClick={handleSaveWallet} disabled={isSaving}>
              {isSaving ? 'Creating...' : 'Create Wallet'}
            </Button>
          </div>

          <SaveWalletConfirmDialog
            isOpen={isCreateConfirmDialogOpen}
            onClose={() => setIsCreateConfirmDialogOpen(false)}
            onConfirm={confirmSaveWallet}
            programName={selectedProgramName}
            // title and confirmLabel omitted — fallback to "Create New Wallet" / "Create Wallet"
          />
        </>
      )}

      {/* Edit mode — Update Wallet button + confirm dialog */}
      {mode === 'edit' && (
        <>
          <div className="flex justify-end">
            <Button color="blue" onClick={handleUpdateWallet} disabled={isSaving || isDisabled}>
              {isSaving ? 'Saving...' : 'Update Wallet'}
            </Button>
          </div>

          <SaveWalletConfirmDialog
            isOpen={isUpdateConfirmDialogOpen}
            onClose={() => setIsUpdateConfirmDialogOpen(false)}
            onConfirm={confirmUpdateWallet}
            programName={selectedProgramName}
            title="Update Wallet"
            confirmLabel="Update Wallet"
          />
        </>
      )}
    </div>
  );
};

export default WalletForm;
