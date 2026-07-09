import React, { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogPanel } from '@headlessui/react';
import { ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { Button } from '../../../components/tailwindui/button';
import { useToast } from '../../../components/toaster/ToasterContext';
import { formValidation } from '../../../utils/FormValidation';
import { getProjectEnums } from '../../Project/Service';
import { walletFormRules } from '../rules/walletFormRules';
import { createWallet } from '../Service';
import { useAuth } from '../../../contexts/AuthContext';
import WalletDetailsSection from '../components/WalletDetailsSection';
import FundingProfileSection from '../components/FundingProfileSection';
import WalletComponentSection from '../components/WalletComponentSection';
import type { LSWallet, DtoCreateWallet } from '../Model.d';
import type { ProjectEnums } from '../../Project/Model.d';

interface CreateWalletDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (wallet: LSWallet) => void;
}

const CreateWalletDialog: React.FC<CreateWalletDialogProps> = ({
  open,
  onClose,
  onSuccess,
}) => {
  const { showToast } = useToast();
  const { user } = useAuth();

  const [wallet, setWallet] = useState<Partial<LSWallet>>({});
  const [errors, setErrors] = useState<Partial<Record<keyof LSWallet, string>>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [projectEnums, setProjectEnums] = useState<ProjectEnums | null>(null);

  // Collapsible card states
  const [isDetailsOpen, setIsDetailsOpen] = useState(true);
  const [isFundingOpen, setIsFundingOpen] = useState(true);
  const [isComponentOpen, setIsComponentOpen] = useState(true);

  // Load project enums on dialog open
  useEffect(() => {
    if (open) {
      const loadEnums = async () => {
        try {
          const response = await getProjectEnums();
          setProjectEnums(response.Data);
        } catch {
          showToast({
            type: 'error',
            message: 'Failed to load dropdown data.',
          });
        }
      };
      loadEnums();
    }
  }, [open, showToast]);

  const handleChange = (field: keyof LSWallet, value: LSWallet[keyof LSWallet]) => {
    setWallet((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleSubmit = async () => {
    try {
      setIsLoading(true);

      const validationErrors = formValidation(wallet, walletFormRules);
      if (Object.keys(validationErrors).length > 0) {
        Object.entries(validationErrors).forEach(([, message]) => {
          showToast({ type: 'error', message });
        });
        setErrors(validationErrors);
        return;
      }

      const selectedProgram = projectEnums?.Programs.find(
        (p) => p.ProgramId === wallet.ProgramId
      );

      if (!selectedProgram) {
        showToast({
          type: 'error',
          message: 'Selected program not found.',
        });
        return;
      }

      const payload: DtoCreateWallet = {
        programId: wallet.ProgramId!,
        categoryId: wallet.CategoryId!,
        subCategoryId: wallet.SubCategoryId || 0,
        operatingUnit: wallet.OperatingUnit || '',
        fundingSource: wallet.FundingSource!,
        fundingAgreement: wallet.FundingAgreement || '',
        amount: wallet.Amount!,
        fundingPercentage: wallet.FundingPercentage!,
        componentYear: wallet.ComponentYear!,
        componentUACS: wallet.ComponentUACS || null,
        componentStartDate: wallet.ComponentStartDate || null,
        componentEndDate: wallet.ComponentEndDate || null,
        createdBy: user?.UserId || '',
      };

      const result = await createWallet(payload, selectedProgram.Name);

      showToast({
        type: 'success',
        message: 'Wallet created successfully.',
      });

      onSuccess(result.Data);
      onClose();
      setWallet({});
      setErrors({});
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'An unexpected error occurred.';
      showToast({ type: 'error', message: errorMessage });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setWallet({});
    setErrors({});
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />

      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="mx-auto w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl">
          <DialogTitle className="text-xl font-semibold text-gray-900 mb-6">
            Create New Wallet
          </DialogTitle>

          <div className="space-y-4 max-h-96 overflow-y-auto mb-6">
            {/* Wallet Details Section */}
            <div className="bg-white rounded-lg border border-gray-200">
              <div
                className="flex justify-between items-center px-6 py-4 cursor-pointer border-b"
                onClick={() => setIsDetailsOpen(!isDetailsOpen)}
              >
                <h3 className="text-lg font-semibold text-gray-800">
                  Wallet Details
                </h3>
                {isDetailsOpen ? (
                  <ChevronDownIcon className="h-5 w-5 text-gray-500" />
                ) : (
                  <ChevronRightIcon className="h-5 w-5 text-gray-500" />
                )}
              </div>
              {isDetailsOpen && (
                <div className="px-6 py-4">
                  <WalletDetailsSection
                    wallet={wallet}
                    onChange={handleChange}
                    errors={errors}
                    programs={projectEnums?.Programs.map((p) => ({
                      ProgramId: p.ProgramId,
                      ProgramName: p.Name,
                    })) || []}
                    categories={projectEnums?.Categories.map((c) => ({
                      Id: c.Id,
                      CategoryName: c.CategoryName || '',
                    })) || []}
                    subCategories={projectEnums?.Thrusts.map((t) => ({
                      Id: t.Id,
                      SubCategoryName: t.SubProgramName,
                    })) || []}
                    operatingUnits={projectEnums?.OperatingUnits.map((ou) => ({
                      ParticipantId: ou.ParticipantId,
                      Name: ou.Name || '',
                    })) || []}
                  />
                </div>
              )}
            </div>

            {/* Funding Profile Section */}
            <div className="bg-white rounded-lg border border-gray-200">
              <div
                className="flex justify-between items-center px-6 py-4 cursor-pointer border-b"
                onClick={() => setIsFundingOpen(!isFundingOpen)}
              >
                <h3 className="text-lg font-semibold text-gray-800">
                  Funding Profile
                </h3>
                {isFundingOpen ? (
                  <ChevronDownIcon className="h-5 w-5 text-gray-500" />
                ) : (
                  <ChevronRightIcon className="h-5 w-5 text-gray-500" />
                )}
              </div>
              {isFundingOpen && (
                <div className="px-6 py-4">
                  <FundingProfileSection
                    wallet={wallet}
                    onChange={handleChange}
                    errors={errors}
                    fundingSources={[]}
                    fundingAgreements={[]}
                  />
                </div>
              )}
            </div>

            {/* Wallet Component Section */}
            <div className="bg-white rounded-lg border border-gray-200">
              <div
                className="flex justify-between items-center px-6 py-4 cursor-pointer border-b"
                onClick={() => setIsComponentOpen(!isComponentOpen)}
              >
                <h3 className="text-lg font-semibold text-gray-800">
                  Component Details
                </h3>
                {isComponentOpen ? (
                  <ChevronDownIcon className="h-5 w-5 text-gray-500" />
                ) : (
                  <ChevronRightIcon className="h-5 w-5 text-gray-500" />
                )}
              </div>
              {isComponentOpen && (
                <div className="px-6 py-4">
                  <WalletComponentSection
                    wallet={wallet}
                    onChange={handleChange}
                    errors={errors}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t pt-6">
            <Button color="zinc" onClick={handleClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button
              color="green"
              onClick={handleSubmit}
              disabled={isLoading}
            >
              {isLoading ? 'Creating...' : 'Create Wallet'}
            </Button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
};

export default CreateWalletDialog;
