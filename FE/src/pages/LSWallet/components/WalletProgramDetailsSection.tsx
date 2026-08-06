// =============================================================================
// WalletProgramDetailsSection.tsx — Program Details card for an LSWallet.
//
// Adapted from FE/src/pages/Project/components/ProgramDetailsForm.tsx to fit
// the LSWallet module's data model. Key differences:
//
//   - Bound to `wallet: Partial<LSWallet>` directly (not a separate ProgramList
//     state object), because LSWallet stores ProgramId / ProgramName /
//     TypeName / YearStart / ProgramStageName as denormalized flat fields.
//   - Program Name control uses SearchableDropdown instead of a plain <select>
//     to stay consistent with the rest of the wallet module's form controls.
//   - Self-fetches its own program list via searchProgram('') on mount (add
//     mode only), mirroring ProgramDetailsForm.tsx, instead of relying on a
//     `programs` prop sourced from ShowProjectComponentDropdowns.
//   - GAA-R programs are excluded from the selectable list, matching
//     ProgramDetailsForm's filter. Wallets can reach GAA-R via WF-2 cascade
//     after creation, but should not be created against an already-archived program.
//   - On program selection, calls onChange for ProgramId, ProgramName, TypeName,
//     YearStart, ProgramStageName, AND CurrentStage. ProgramStageName is an
//     informational snapshot of the program's stage at wallet-creation time and
//     never changes. CurrentStage seeds the wallet's own lifecycle stage and is
//     advanced later by the WF-2 stage cascade — they are distinct fields.
//   - Visual card/grid/styling matches ProgramDetailsForm exactly:
//     bg-white rounded-lg shadow-sm border border-gray-200 p-6,
//     grid grid-cols-3 gap-4 text-sm.
// =============================================================================

import React, { useEffect, useState } from 'react';
import type { LSWallet, WalletStage } from '../Model.d';
import type { ProgramLatest } from '../../Program/Model';
import SearchableDropdown from '../../../components/ui/SearchableDropdown';
import { formatDropdownOptions } from '../../../utils/GlobalFunctions';
import { searchProgram } from '../../Project/Service';

interface WalletProgramDetailsSectionProps {
  wallet: Partial<LSWallet>;
  onChange: (field: keyof LSWallet, value: LSWallet[keyof LSWallet]) => void;
  errors?: Partial<Record<keyof LSWallet, string>>;
  disabled?: boolean;
  mode?: 'add' | 'edit';
}

const WalletProgramDetailsSection: React.FC<WalletProgramDetailsSectionProps> = ({
  wallet,
  onChange,
  errors = {},
  disabled = false,
  mode = 'add',
}) => {
  const [programs, setPrograms] = useState<ProgramLatest[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Load selectable programs from the search endpoint as soon as the form
  // mounts in add mode — mirrors ProgramDetailsForm.tsx's mount-time fetch.
  useEffect(() => {
    if (mode !== 'add') return;
    let cancelled = false;
    setIsLoading(true);
    searchProgram('')
      .then((response) => {
        if (cancelled) return;
        // Exclude GAA-R programs — new wallets should not be created against
        // archived/final-stage programs. Wallets already at GAA-R get there
        // via WF-2 stage cascade after creation.
        setPrograms((response.Data.Programs || []).filter((p) => p.StageName !== 'GAA-R'));
      })
      .catch((error) => {
        console.error('Error loading programs:', error);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mode]);

  const handleProgramChange = (value: string) => {
    const selected = programs.find(p => p.ProgramId === value);
    if (selected) {
      onChange('ProgramId', selected.ProgramId);
      onChange('ProgramName', selected.Name);
      // Denormalized display fields — stored on the wallet for the Detail page.
      onChange('TypeName', selected.Type);
      onChange('YearStart', selected.StartYear);
      // ProgramStageName: informational snapshot of the program's stage at selection
      // time. Stored separately from CurrentStage and never changes after creation.
      onChange('ProgramStageName', selected.StageName);
      // CurrentStage: seeds the wallet's own lifecycle stage from the program's stage.
      // Will be advanced later by the WF-2 bulk stage cascade independently of
      // ProgramStageName — these two fields can diverge over the wallet's lifetime.
      onChange('CurrentStage', selected.StageName as WalletStage);
    } else {
      // Clear all program fields when selection is cleared.
      onChange('ProgramId', undefined);
      onChange('ProgramName', undefined);
      onChange('TypeName', undefined);
      onChange('YearStart', undefined);
      onChange('ProgramStageName', undefined);
    }
  };

  // Resolve the program stage for display. In both add and edit mode, read from
  // ProgramStageName (the informational snapshot stored at wallet creation).
  // In add mode before a program is selected, ProgramStageName is undefined so
  // we fall back to deriving it live from the programs list as a convenience.
  const displayStageName =
    wallet.ProgramStageName ??
    (mode === 'add'
      ? (programs.find(p => p.ProgramId === wallet.ProgramId)?.StageName ?? '')
      : '');

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="grid grid-cols-3 gap-4 text-sm">

        {/* Program Name — searchable select in add mode, read-only text in edit mode */}
        {mode === 'add' ? (
          <div className="w-full flex flex-row text-left gap-5 items-center">
            <label className={`w-1/3 ${errors.ProgramId ? 'text-red-500' : 'text-gray-600'}`}>
              <span className="text-red-500 text-lg">*</span>Program Name:
            </label>
            <div className="w-2/3 min-w-0">
              <SearchableDropdown
                options={formatDropdownOptions(programs, 'ProgramId', 'Name')}
                value={wallet.ProgramId ?? ''}
                onChange={(value) =>
                  handleProgramChange(value === '' ? '' : value.toString())
                }
                placeholder={isLoading ? 'Loading programs...' : 'Select Program'}
                disabled={disabled || isLoading}
                error={!!errors.ProgramId}
                allowClear={true}
                searchPlaceholder="Search programs..."
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-row text-left gap-5 items-center">
            <label className="flex-1/3 text-gray-600">Program Name:</label>
            <input
              type="text"
              value={wallet.ProgramName ?? ''}
              readOnly
              className="flex-2/3 mt-1 px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-700"
            />
          </div>
        )}

        <div className="flex flex-row text-left gap-5 items-center">
          <label className="flex-1/3 text-gray-600">Program Type:</label>
          <input
            type="text"
            value={wallet.TypeName ?? ''}
            readOnly
            className="flex-2/3 mt-1 px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-700"
          />
        </div>

        <div className="flex flex-row text-left gap-5 items-center">
          <label className="flex-1/3 text-gray-600">Start Year:</label>
          <input
            type="number"
            value={wallet.YearStart ?? ''}
            readOnly
            className="flex-2/3 mt-1 px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-700"
          />
        </div>

        <div className="flex flex-row text-left gap-5 items-center">
          <label className="flex-1/3 text-gray-600">Program Stage:</label>
          <input
            type="text"
            value={displayStageName}
            readOnly
            className="flex-2/3 mt-1 px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-700"
          />
        </div>

      </div>
    </div>
  );
};

export default WalletProgramDetailsSection;
