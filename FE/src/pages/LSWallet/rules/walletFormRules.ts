import type { ValidationRule } from '../../../utils/FormValidation';
import type { LSWallet } from '../Model.d';

// Rules that apply to the flat wallet fields validated by formValidation().
//
// Array-level validation (funding profiles, component costs) is handled
// inline in WalletForm.handleSaveWallet — those rules cannot be expressed
// as per-field ValidationRule entries because they operate on the separate
// array state rather than the wallet flat-field state.
//
// Removed rules (were in CreateWalletDialog era, no longer relevant):
//   - FundingSource  → replaced by WalletFundingProfile[].Source
//   - Amount         → derived from SUM(WalletFundingProfiles); not set directly
//   - FundingPercentage → replaced by per-row Percentage (auto-calculated)
//   - ComponentYear  → replaced by WalletComponentCostPerYear[].Year
//   - ComponentAmount → replaced by WalletComponentCostPerYear[].Amount
export const walletFormRules: ValidationRule<Partial<LSWallet>>[] = [
  {
    field: 'ProgramId',
    message: 'Program is required.',
    validate: (value) => !!value,
  },
  {
    field: 'CategoryId',
    message: 'Category is required.',
    validate: (value) => typeof value === 'number' && value > 0,
  },
  {
    // Tier is optional (1–5 when present).
    field: 'Tier',
    message: 'Tier must be between 1 and 5.',
    validate: (value) => value === undefined || value === null || (typeof value === 'number' && value >= 1 && value <= 5),
  },
];
