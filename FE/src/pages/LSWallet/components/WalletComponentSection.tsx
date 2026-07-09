import React, { useEffect } from 'react';
import type { LSWallet } from '../Model.d';
import {
  getDisabledClass,
  handleCurrencyBlur,
  handleCurrencyChange,
  handleCurrencyFocus,
} from '../../../utils/GlobalFunctions';
import { DateInput } from '../../../components/tailwindui/date-input';

interface WalletComponentSectionProps {
  wallet: Partial<LSWallet>;
  onChange: (field: keyof LSWallet, value: LSWallet[keyof LSWallet]) => void;
  errors?: Partial<Record<keyof LSWallet, string>>;
  disabled?: boolean;
}

const WalletComponentSection: React.FC<WalletComponentSectionProps> = ({
  wallet,
  onChange,
  errors = {},
  disabled = false,
}) => {
  const [displayAmount, setDisplayAmount] = React.useState<string>('');

  useEffect(() => {
    onChange('ComponentTotal', wallet.Amount);
    onChange('ComponentAmount', wallet.Amount);
  }, [wallet.Amount, onChange]);

  useEffect(() => {
    if (wallet.ComponentAmount != null && wallet.ComponentAmount > 0) {
      setDisplayAmount(wallet.ComponentAmount.FormatToCurrency());
    } else {
      setDisplayAmount('');
    }
  }, [wallet.ComponentAmount]);

  const handleAmountChange = (value: string) => {
    const updateAmount = (_field: string, numValue: number) => {
      onChange('ComponentAmount', numValue);
    };
    handleCurrencyChange(value, setDisplayAmount, updateAmount, 'ComponentAmount');
  };

  const formatDateForDisplay = (dateStr?: string | null): string => {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toISOString().split('T')[0];
    } catch {
      return '';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="space-y-6 text-sm">
        <h3 className="text-lg text-left font-semibold text-gray-800 pb-2">
          Component Details
        </h3>

        <div className="grid grid-cols-2 gap-5">
          <div className="w-full flex flex-col text-left gap-2">
            <div className="flex flex-row gap-5 items-center">
              <label className="w-1/3 text-gray-600">Component Type:</label>
              <input
                type="text"
                value="Lump Sum (LS)"
                className="w-2/3 mt-1 px-3 py-2 border border-gray-300 bg-gray-100 rounded-md"
                readOnly
                disabled
              />
            </div>
          </div>

          <div className="w-full flex flex-col text-left gap-2">
            <div className="flex flex-row gap-5 items-center">
              <label className="w-1/3 text-gray-600">Component Total:</label>
              <input
                type="text"
                value={wallet.ComponentTotal ? wallet.ComponentTotal.FormatToCurrency() : ''}
                className="w-2/3 mt-1 px-3 py-2 border border-gray-300 bg-gray-100 rounded-md text-right"
                readOnly
                title="Automatically mirrors the wallet's funding Amount"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-5">
          <div className="w-full flex flex-col text-left gap-2">
            <div className="flex flex-row gap-5 items-center">
              <label
                className={`w-1/3 ${
                  errors.ComponentYear ? 'text-red-500' : 'text-gray-600'
                }`}
              >
                <span className="text-red-500 text-lg">*</span>Year:
              </label>
              <input
                type="number"
                value={wallet.ComponentYear ?? ''}
                onChange={(e) =>
                  onChange(
                    'ComponentYear',
                    e.target.value ? parseInt(e.target.value) : undefined
                  )
                }
                className={`w-2/3 mt-1 px-3 py-2 border ${
                  errors.ComponentYear ? 'border-red-500' : 'border-gray-300'
                } ${getDisabledClass(disabled)} rounded-md`}
                placeholder="2025"
                min="2020"
                max="2035"
                disabled={disabled}
              />
            </div>
          </div>

          <div className="w-full flex flex-col text-left gap-2">
            <div className="flex flex-row gap-5 items-center">
              <label
                className={`w-1/3 ${
                  errors.ComponentAmount ? 'text-red-500' : 'text-gray-600'
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
                  handleCurrencyBlur(e, (value) =>
                    onChange('ComponentAmount', value)
                  )
                }
                className={`w-2/3 mt-1 px-3 py-2 border ${
                  errors.ComponentAmount ? 'border-red-500' : 'border-gray-300'
                } ${getDisabledClass(disabled)} rounded-md text-right`}
                placeholder="₱0.00"
                disabled={disabled}
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5">
          <div className="w-full flex flex-col text-left gap-2">
            <div className="flex flex-row gap-5 items-center">
              <label className="w-1/9 text-gray-600">UACS:</label>
              <input
                type="text"
                value={wallet.ComponentUACS || ''}
                onChange={(e) => onChange('ComponentUACS', e.target.value)}
                className={`w-8/9 mt-1 px-3 py-2 border border-gray-300 ${getDisabledClass(disabled)} rounded-md`}
                placeholder="Enter UACS code"
                disabled={disabled}
                maxLength={50}
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-5">
          <div className="w-full flex flex-col text-left gap-2">
            <div className="flex flex-row gap-5 items-center">
              <label className="w-1/3 text-gray-600">Start Date:</label>
              <DateInput
                value={formatDateForDisplay(wallet.ComponentStartDate)}
                onChange={(e) =>
                  onChange(
                    'ComponentStartDate',
                    e.target.value
                      ? new Date(e.target.value).toISOString()
                      : null
                  )
                }
                className={`w-2/3 mt-1 px-3 py-2 border border-gray-300 ${getDisabledClass(disabled)} rounded-md`}
                disabled={disabled}
              />
            </div>
          </div>

          <div className="w-full flex flex-col text-left gap-2">
            <div className="flex flex-row gap-5 items-center">
              <label className="w-1/3 text-gray-600">End Date:</label>
              <DateInput
                value={formatDateForDisplay(wallet.ComponentEndDate)}
                onChange={(e) =>
                  onChange(
                    'ComponentEndDate',
                    e.target.value
                      ? new Date(e.target.value).toISOString()
                      : null
                  )
                }
                className={`w-2/3 mt-1 px-3 py-2 border border-gray-300 ${getDisabledClass(disabled)} rounded-md`}
                disabled={disabled}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WalletComponentSection;
