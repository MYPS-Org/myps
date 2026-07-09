import React, { useEffect } from 'react';
import type { LSWallet } from '../Model.d';
import {
  getDisabledClass,
  formatDropdownOptions,
  handleCurrencyBlur,
  handleCurrencyChange,
  handleCurrencyFocus,
} from '../../../utils/GlobalFunctions';
import SearchableDropdown from '../../../components/ui/SearchableDropdown';

interface FundingProfileSectionProps {
  wallet: Partial<LSWallet>;
  onChange: (field: keyof LSWallet, value: LSWallet[keyof LSWallet]) => void;
  errors?: Partial<Record<keyof LSWallet, string>>;
  disabled?: boolean;
  fundingSources?: Array<{ Id: number; Name: string }>;
  fundingAgreements?: Array<{ Id: number; Name: string }>;
}

const FundingProfileSection: React.FC<FundingProfileSectionProps> = ({
  wallet,
  onChange,
  errors = {},
  disabled = false,
  fundingSources = [],
  fundingAgreements = [],
}) => {
  const [displayAmount, setDisplayAmount] = React.useState<string>('');

  useEffect(() => {
    if (wallet.Amount != null && wallet.Amount > 0) {
      setDisplayAmount(wallet.Amount.FormatToCurrency());
    } else {
      setDisplayAmount('');
    }
  }, [wallet.Amount]);

  const handleAmountChange = (value: string) => {
    const updateAmount = (_field: string, numValue: number) => {
      onChange('Amount', numValue);
    };
    handleCurrencyChange(value, setDisplayAmount, updateAmount, 'Amount');
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="space-y-6 text-sm">
        <h3 className="text-lg text-left font-semibold text-gray-800 pb-2">
          Funding Profile
        </h3>

        <div className="grid grid-cols-2 gap-5">
          <div className="w-full flex flex-col text-left gap-2">
            <div className="flex flex-row gap-5 items-center">
              <label
                className={`w-1/3 ${
                  errors.FundingSource ? 'text-red-500' : 'text-gray-600'
                }`}
              >
                <span className="text-red-500 text-lg">*</span>Funding Source:
              </label>
              <div className="w-2/3 min-w-0">
                <SearchableDropdown
                  options={formatDropdownOptions(fundingSources, 'Id', 'Name')}
                  value={wallet.FundingSource || ''}
                  onChange={(value) =>
                    onChange('FundingSource', value === '' ? undefined : value.toString())
                  }
                  placeholder="Select Funding Source"
                  disabled={disabled}
                  error={!!errors.FundingSource}
                  allowClear={true}
                  searchPlaceholder="Search funding sources..."
                />
              </div>
            </div>
          </div>

          <div className="w-full flex flex-col text-left gap-2">
            <div className="flex flex-row gap-5 items-center">
              <label className="w-1/3 text-gray-600">
                Funding Agreement:
              </label>
              <div className="w-2/3 min-w-0">
                <SearchableDropdown
                  options={formatDropdownOptions(
                    fundingAgreements,
                    'Id',
                    'Name'
                  )}
                  value={wallet.FundingAgreement || ''}
                  onChange={(value) =>
                    onChange(
                      'FundingAgreement',
                      value === '' ? undefined : value.toString()
                    )
                  }
                  placeholder="Select Funding Agreement"
                  disabled={disabled}
                  allowClear={true}
                  searchPlaceholder="Search agreements..."
                />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-5">
          <div className="w-full flex flex-col text-left gap-2">
            <div className="flex flex-row gap-5 items-center">
              <label
                className={`w-1/3 ${
                  errors.Amount ? 'text-red-500' : 'text-gray-600'
                }`}
              >
                <span className="text-red-500 text-lg">*</span>Amount:
              </label>
              <input
                type="text"
                value={displayAmount}
                onChange={(e) => handleAmountChange(e.target.value)}
                onFocus={handleCurrencyFocus}
                onBlur={(e) =>
                  handleCurrencyBlur(e, (value) => onChange('Amount', value))
                }
                className={`w-2/3 mt-1 px-3 py-2 border ${
                  errors.Amount ? 'border-red-500' : 'border-gray-300'
                } ${getDisabledClass(disabled)} rounded-md text-right`}
                placeholder="₱0.00"
                disabled={disabled}
              />
            </div>
          </div>

          <div className="w-full flex flex-col text-left gap-2">
            <div className="flex flex-row gap-5 items-center">
              <label
                className={`w-1/3 ${
                  errors.FundingPercentage ? 'text-red-500' : 'text-gray-600'
                }`}
              >
                <span className="text-red-500 text-lg">*</span>Funding
                Percentage:
              </label>
              <input
                type="number"
                value={wallet.FundingPercentage ?? ''}
                onChange={(e) =>
                  onChange(
                    'FundingPercentage',
                    e.target.value ? parseFloat(e.target.value) : undefined
                  )
                }
                className={`w-2/3 mt-1 px-3 py-2 border ${
                  errors.FundingPercentage ? 'border-red-500' : 'border-gray-300'
                } bg-gray-100 rounded-md text-right`}
                placeholder="0"
                min="1"
                max="100"
                step="0.01"
                readOnly
                title="For a single-line LS wallet, this is locked to 100%"
                disabled={disabled}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FundingProfileSection;
