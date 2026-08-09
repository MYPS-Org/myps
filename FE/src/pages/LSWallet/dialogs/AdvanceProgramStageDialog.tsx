// =============================================================================
// AdvanceProgramStageDialog.tsx — DEV/DEMO simulation of stage cascade (WF-2)
//
// This dialog is explicitly a development tool for demonstrating the WF-2
// stage cascade behavior without a real Program module integration.
// It is NOT a real user-facing feature — stage advance is a side effect of
// the Program module, which is out of scope here.
//
// The UI is clearly labeled as a simulation with amber/warning styling to
// prevent any confusion with production features.
// =============================================================================

import React, { useState } from 'react';
import { Dialog } from '../../../components/tailwindui/dialog';
import { Button } from '../../../components/tailwindui/button';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import * as Service from '../Service';
import { STAGE_ORDER } from '../utils/constants';
import type { LSWallet, WalletStage } from '../Model.d';
import { useToast } from '../../../components/toaster/ToasterContext';

interface AdvanceProgramStageDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (updatedWallets: LSWallet[]) => void;
  programId: string;
  programName: string;
  currentStage: WalletStage;
}

const AdvanceProgramStageDialog: React.FC<AdvanceProgramStageDialogProps> = ({
  open,
  onClose,
  onSuccess,
  programId,
  programName,
  currentStage,
}) => {
  const [selectedStage, setSelectedStage] = useState<WalletStage>(currentStage);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  const handleClose = () => {
    setError(null);
    setSelectedStage(currentStage);
    onClose();
  };

  const handleConfirm = async () => {
    if (selectedStage === currentStage) {
      setError('Please select a different stage.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await Service.advanceProgramStage(programId, selectedStage);
      if (response.Status === 200) {
        const count = response.Data.length;
        showToast({
          type: 'success',
          message: `Advanced ${count} wallet(s) to ${selectedStage}.`,
        });
        onSuccess(response.Data);
        handleClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to advance stage.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} title="">
      <div className="space-y-4">
        {/* Warning header */}
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <ExclamationTriangleIcon className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <h2 className="font-semibold text-amber-900">
              ⚠ Simulation — Advance Program Stage
            </h2>
            <p className="text-sm text-amber-700 mt-1">
              This is a dev/demo tool only. In production, stage advancement is
              driven by the Program module. Use this to test WF-2 cascade behavior.
            </p>
          </div>
        </div>

        {/* Program info (read-only) */}
        <div className="space-y-2">
          <div>
            <label className="text-sm font-medium text-gray-700">Program Name</label>
            <div className="mt-1 px-3 py-2 bg-gray-100 rounded text-gray-700">
              {programName}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Current Stage</label>
            <div className="mt-1 px-3 py-2 bg-gray-100 rounded text-gray-700">
              {currentStage}
            </div>
          </div>
        </div>

        {/* Stage dropdown */}
        <div>
          <label className="text-sm font-medium text-gray-700">New Stage</label>
          <select
            value={selectedStage}
            onChange={(e) => setSelectedStage(e.target.value as WalletStage)}
            className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {STAGE_ORDER.map((stage) => (
              <option key={stage} value={stage}>
                {stage}
              </option>
            ))}
          </select>
        </div>

        {/* Error message */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button color="zinc" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            color="amber"
            onClick={handleConfirm}
            disabled={isSubmitting || selectedStage === currentStage}
          >
            {isSubmitting ? 'Advancing...' : 'Confirm'}
          </Button>
        </div>
      </div>
    </Dialog>
  );
};

export default AdvanceProgramStageDialog;
