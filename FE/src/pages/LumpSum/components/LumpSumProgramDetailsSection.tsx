// =============================================================================
// LumpSumProgramDetailsSection.tsx — the Program Details card.
//
// THREE FIELDS, ALL OF THEM FETCHED. vLumpSumSet returns the program's name,
// its budget year and the project's stage; those are what this card shows.
//
// It used to show a fourth, Program Type, alongside a "Program Stage" that was
// a SEPARATE denormalized snapshot of the program's stage taken at creation
// time — deliberately allowed to diverge from the project's own stage, because
// a wallet advanced through a stage cascade of its own. There is no cascade any
// more: a Lump Sum Project is an ordinary project, its stage lives in
// tProjectStages and follows its program, so the two values cannot differ and
// only one is stored. Program Type has no column behind it at all, and a
// read-only input that renders blank on every saved project is worse than an
// absent one.
//
// Adapted from Project/components/ProgramDetailsForm.tsx; the card, grid and
// styling match it exactly.
// =============================================================================

import React, { useEffect, useState } from 'react';
import type { LumpSum } from '../Model.d';
import type { ProgramLatest } from '../../Program/Model';
import SearchableDropdown from '../../../components/ui/SearchableDropdown';
import { formatDropdownOptions } from '../../../utils/GlobalFunctions';
import { searchProgram } from '../../Project/Service';
import { isProgramApproved } from '../utils/constants';

interface LumpSumProgramDetailsSectionProps {
  lumpSum: Partial<LumpSum>;
  onChange: (field: keyof LumpSum, value: LumpSum[keyof LumpSum]) => void;
  errors?: Partial<Record<keyof LumpSum, string>>;
  disabled?: boolean;
  mode?: 'add' | 'edit';
}

const LumpSumProgramDetailsSection: React.FC<LumpSumProgramDetailsSectionProps> = ({
  lumpSum,
  onChange,
  errors = {},
  disabled = false,
  mode = 'add',
}) => {
  const [programs, setPrograms] = useState<ProgramLatest[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (mode !== 'add') return;
    let cancelled = false;
    setIsLoading(true);

    searchProgram('')
      .then((response) => {
        if (cancelled) return;
        /*  NOT A PROGRAM THAT HAS CLOSED (2026-09-09). This list is the program
            module's own /program/showprogram, which applies no status filter —
            so without this an Approved GAA-R program would be offered here and
            CreateLumpSum would refuse it after the whole form was filled in.
            The server is still the rule; this keeps the offer honest. */
        setPrograms(
          (response.Data.Programs ?? []).filter((p) => !isProgramApproved(p.Status, p.StageName)),
        );
      })
      .catch(() => {
        // httpClient's interceptor already raised the toast.
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [mode]);

  const handleProgramChange = (value: string) => {
    const selected = programs.find((p) => p.ProgramPK === value);

    if (!selected) {
      onChange('ProgramId', undefined);
      onChange('ProgramName', undefined);
      onChange('StartYear', undefined);
      onChange('CurrentStage', '');
      return;
    }

    /*  ProgramPK, NOT ProgramId. ProgramLatest carries both and they are
        different keys: ProgramPK is the readable "MP_P_CO-…" the server matches
        on, ProgramId is the GUID-ish "P_CO-…" underneath it. LumpSum.ProgramId
        holds the PK — the read mapper takes it from vLumpSumSet.ProgramFK, and
        CreateLumpSumDTO.ProgramId is documented as tPrograms.ProgramPK.

        Sending the wrong one is refused with "Program '…' was not found.", and
        it looked plausible enough to survive J1: only the missing "MP_" prefix
        distinguishes them. Creating from this form had never once worked. */
    onChange('ProgramId', selected.ProgramPK);
    onChange('ProgramName', selected.Name);
    onChange('StartYear', selected.StartYear);
    /*  Shown so the user can see which stage the project will land on, and
        never submitted: the server resolves the stage from tProjectStages and
        ignores whatever the client sends. */
    onChange('CurrentStage', selected.StageName);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="grid grid-cols-3 gap-4 text-sm">
        {/* Program — selectable while adding, fixed once the project exists. */}
        {mode === 'add' ? (
          <div className="w-full flex flex-row text-left gap-5 items-center">
            <label className={`w-1/3 ${errors.ProgramId ? 'text-red-500' : 'text-gray-600'}`}>
              <span className="text-red-500 text-lg">*</span>Program Name:
            </label>
            <div className="w-2/3 min-w-0">
              <SearchableDropdown
                /*  Keyed on ProgramPK so the option value, the form state and
                    what the server is sent are all the same string. */
                options={formatDropdownOptions(programs, 'ProgramPK', 'Name')}
                value={lumpSum.ProgramId ?? ''}
                onChange={(value) => handleProgramChange(value === '' ? '' : String(value))}
                placeholder={isLoading ? 'Loading programs...' : 'Select Program'}
                disabled={disabled || isLoading}
                error={!!errors.ProgramId}
                allowClear
                searchPlaceholder="Search programs..."
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-row text-left gap-5 items-center">
            <label className="flex-1/3 text-gray-600">Program Name:</label>
            <input
              type="text"
              value={lumpSum.ProgramName ?? ''}
              readOnly
              className="flex-2/3 mt-1 px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-700"
            />
          </div>
        )}

        <div className="flex flex-row text-left gap-5 items-center">
          <label className="flex-1/3 text-gray-600">Start Year:</label>
          <input
            type="number"
            value={lumpSum.StartYear ?? ''}
            readOnly
            className="flex-2/3 mt-1 px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-700"
          />
        </div>

        <div className="flex flex-row text-left gap-5 items-center">
          <label className="flex-1/3 text-gray-600">Current Stage:</label>
          <input
            type="text"
            value={lumpSum.CurrentStage ?? ''}
            readOnly
            title="A Lump Sum Project follows its program's stage; it cannot be set here."
            className="flex-2/3 mt-1 px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-700"
          />
        </div>
      </div>
    </div>
  );
};

export default LumpSumProgramDetailsSection;
