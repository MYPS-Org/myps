// =============================================================================
// PublishItemizedProjectDialog.tsx — WF-8: Publish Itemized Project
//
// Runs compliance check on dialog open. Displays all 13 compliance rules
// with pass/fail indicators. If all rules pass, project is atomically published
// (publishItemizedProject handles both check + publish in one call).
// If any rule fails, shows "Publish blocked" banner and no further action.
// =============================================================================

import React, { useState, useEffect } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { Button } from '../../../components/tailwindui/button';
import { useToast } from '../../../components/toaster/ToasterContext';
import * as Service from '../Service';
import type { ItemizedProject, LSWallet } from '../Model.d';
import type { PublishComplianceResult } from '../Service';

interface PublishItemizedProjectDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (project: ItemizedProject) => void;
  project: ItemizedProject;
  wallet: LSWallet; // Reserved for future stage-gated compliance display; not used yet
}

const PublishItemizedProjectDialog: React.FC<PublishItemizedProjectDialogProps> = ({
  open,
  onClose,
  onSuccess,
  project,
}) => {
  const { showToast } = useToast();
  const [complianceResult, setComplianceResult] = useState<PublishComplianceResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');

  // Run compliance check when dialog opens
  useEffect(() => {
    if (open && !complianceResult) {
      runComplianceCheck();
    }
  }, [open]);

  const runComplianceCheck = async () => {
    setIsLoading(true);
    setError('');
    try {
      const result = await Service.publishItemizedProject(project.ProjectId);
      setComplianceResult(result.Data.complianceResult);

      // If all rules passed, project was already published atomically
      if (result.Data.complianceResult.AllPassed && result.Data.project) {
        showToast({
          type: 'success',
          message: 'All 13 rules passed. Project published to PCMA.',
        });
        onSuccess(result.Data.project);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred.';
      setError(errorMessage);
      showToast({
        type: 'error',
        message: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const failedRulesCount = complianceResult?.Rules.filter(r => !r.Pass).length || 0;

  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />

      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="mx-auto w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl">
          <DialogTitle className="text-xl font-semibold text-gray-900 mb-6">
            Publish Project — Compliance Check
          </DialogTitle>

          <div className="space-y-6">
            {/* Loading State */}
            {isLoading && (
              <div className="flex items-center justify-center py-8">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-3"></div>
                  <p className="text-gray-600">Running compliance check...</p>
                </div>
              </div>
            )}

            {/* Error State */}
            {error && !isLoading && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {/* Compliance Results */}
            {complianceResult && !isLoading && (
              <>
                {/* Failure Banner */}
                {!complianceResult.AllPassed && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-sm font-semibold text-red-600">
                      Publish blocked — {failedRulesCount} rule{failedRulesCount !== 1 ? 's' : ''} failed
                    </p>
                  </div>
                )}

                {/* Success Banner */}
                {complianceResult.AllPassed && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <p className="text-sm font-semibold text-green-600">
                      All 13 rules passed. Project published to PCMA.
                    </p>
                  </div>
                )}

                {/* Rules List */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">
                    Compliance Rules
                  </h3>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {complianceResult.Rules.map((rule, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-3 p-3 border border-gray-200 rounded-md"
                      >
                        {rule.Pass ? (
                          <CheckCircleIcon className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                        ) : (
                          <XCircleIcon className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1">
                          <p
                            className={`text-sm font-medium ${
                              rule.Pass
                                ? 'text-gray-900'
                                : 'text-red-600'
                            }`}
                          >
                            {rule.RuleName}
                          </p>
                          {rule.FailReason && (
                            <p className="text-sm text-red-600 mt-1">
                              {rule.FailReason}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

          </div>

          <div className="flex justify-end gap-3 border-t pt-6">
            <Button
              type="button"
              onClick={onClose}
              color="zinc"
              disabled={isLoading}
            >
              Close
            </Button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
};

export default PublishItemizedProjectDialog;
