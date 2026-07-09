import type { ValidationRule } from '../../../utils/FormValidation';
import type { LSWallet } from '../Model.d';

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
    field: 'FundingSource',
    message: 'Funding Source is required.',
    validate: (value) => !!value,
  },
  {
    field: 'Amount',
    message: 'Amount is required.',
    validate: (value) => typeof value === 'number' && value > 0,
  },
  {
    field: 'FundingPercentage',
    message: 'Funding Percentage is required.',
    validate: (value) => typeof value === 'number' && value >= 1 && value <= 100,
  },
  {
    field: 'ComponentYear',
    message: 'Component Year is required.',
    validate: (value) =>
      typeof value === 'number' && value >= 1990 && value <= 2100,
  },
  {
    field: 'ComponentAmount',
    message: 'Component Amount is required.',
    validate: (value) => typeof value === 'number' && value > 0,
  },
];
