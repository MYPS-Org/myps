import React from 'react';
import type { LSWallet } from '../Model.d';
import { formatDropdownOptions } from '../../../utils/GlobalFunctions';
import SearchableDropdown from '../../../components/ui/SearchableDropdown';

interface WalletDetailsSectionProps {
  wallet: Partial<LSWallet>;
  onChange: (field: keyof LSWallet, value: LSWallet[keyof LSWallet]) => void;
  errors?: Partial<Record<keyof LSWallet, string>>;
  disabled?: boolean;
  programs?: Array<{ ProgramId: string; ProgramName: string }>;
  categories?: Array<{ Id: number; CategoryName: string }>;
  subCategories?: Array<{ Id: number; SubCategoryName: string }>;
  operatingUnits?: Array<{ ParticipantId: string; Name: string }>;
}

const WalletDetailsSection: React.FC<WalletDetailsSectionProps> = ({
  wallet,
  onChange,
  errors = {},
  disabled = false,
  programs = [],
  categories = [],
  subCategories = [],
  operatingUnits = [],
}) => {
  const handleProgramChange = (value: string) => {
    const selectedProgram = programs.find(p => p.ProgramId === value);
    if (selectedProgram) {
      onChange('ProgramId', value);
      onChange('ProgramName', selectedProgram.ProgramName);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="space-y-6 text-sm">
        <h3 className="text-lg text-left font-semibold text-gray-800 pb-2">
          Wallet Details
        </h3>

        <div className="grid grid-cols-2 gap-5">
          <div className="w-full flex flex-col text-left gap-2">
            <div className="flex flex-row gap-5 items-center">
              <label
                className={`w-1/3 ${
                  errors.ProgramId ? 'text-red-500' : 'text-gray-600'
                }`}
              >
                <span className="text-red-500 text-lg">*</span>Program:
              </label>
              <div className="w-2/3 min-w-0">
                <SearchableDropdown
                  options={formatDropdownOptions(
                    programs,
                    'ProgramId',
                    'ProgramName'
                  )}
                  value={wallet.ProgramId || ''}
                  onChange={(value) =>
                    handleProgramChange(value === '' ? '' : value.toString())
                  }
                  placeholder="Select Program"
                  disabled={disabled}
                  error={!!errors.ProgramId}
                  allowClear={true}
                  searchPlaceholder="Search programs..."
                />
              </div>
            </div>
          </div>

          <div className="w-full flex flex-col text-left gap-2">
            <div className="flex flex-row gap-5 items-center">
              <label
                className={`w-1/3 ${
                  errors.CategoryId ? 'text-red-500' : 'text-gray-600'
                }`}
              >
                <span className="text-red-500 text-lg">*</span>Category:
              </label>
              <div className="w-2/3 min-w-0">
                <SearchableDropdown
                  options={formatDropdownOptions(
                    categories,
                    'Id',
                    'CategoryName'
                  )}
                  value={wallet.CategoryId || ''}
                  onChange={(value) =>
                    onChange(
                      'CategoryId',
                      value === '' ? undefined : parseInt(value.toString())
                    )
                  }
                  placeholder="Select Category"
                  disabled={disabled}
                  error={!!errors.CategoryId}
                  allowClear={true}
                  searchPlaceholder="Search categories..."
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
                  errors.SubCategoryId ? 'text-red-500' : 'text-gray-600'
                }`}
              >
                Sub-Category / Thrust:
              </label>
              <div className="w-2/3 min-w-0">
                <SearchableDropdown
                  options={formatDropdownOptions(
                    subCategories,
                    'Id',
                    'SubCategoryName'
                  )}
                  value={wallet.SubCategoryId || ''}
                  onChange={(value) =>
                    onChange(
                      'SubCategoryId',
                      value === '' ? undefined : parseInt(value.toString())
                    )
                  }
                  placeholder="Select Sub-Category"
                  disabled={disabled}
                  allowClear={true}
                  searchPlaceholder="Search sub-categories..."
                />
              </div>
            </div>
          </div>

          <div className="w-full flex flex-col text-left gap-2">
            <div className="flex flex-row gap-5 items-center">
              <label
                className={`w-1/3 ${
                  errors.OperatingUnit ? 'text-red-500' : 'text-gray-600'
                }`}
              >
                <span className="text-red-500 text-lg">*</span>Operating Unit:
              </label>
              <div className="w-2/3 min-w-0">
                <SearchableDropdown
                  options={formatDropdownOptions(
                    operatingUnits,
                    'ParticipantId',
                    'Name'
                  )}
                  value={wallet.OperatingUnit || ''}
                  onChange={(value) =>
                    onChange('OperatingUnit', value === '' ? undefined : value.toString())
                  }
                  placeholder="Select Operating Unit"
                  disabled={disabled}
                  error={!!errors.OperatingUnit}
                  allowClear={true}
                  searchPlaceholder="Search operating units..."
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WalletDetailsSection;
