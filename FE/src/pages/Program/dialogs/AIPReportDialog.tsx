import React, { useState, useEffect } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { Button } from '../../../components/tailwindui/button';
import type { AIPReportParams } from '../../Program/Model';

interface AIPReportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (params: AIPReportParams) => void;
  programId?: string;
  programName?: string;
  stageName?: string;
  regions?: string[];
}

const AIPReportDialog: React.FC<AIPReportDialogProps> = ({
  isOpen,
  onClose,
  onGenerate,
  programId = '',
  programName = '',
  stageName = '',
  regions = []
}) => {
  const [formData, setFormData] = useState<AIPReportParams>({
    ProgramId: programId,
    ProgramName: programName,
    StageName: stageName,
    Region: ''
  });

  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    if (isOpen) {
      setFormData({
        ProgramId: programId,
        ProgramName: programName,
        StageName: stageName,
        Region: ''
      });
      setErrors({});
    }
  }, [isOpen, programId, programName, stageName]);

  const handleChange = (field: keyof AIPReportParams, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const validate = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.ProgramId.trim()) {
      newErrors.ProgramId = 'Program ID is required';
    }

    if (!formData.StageName.trim()) {
      newErrors.StageName = 'Stage Name is required';
    }

    if (!formData.Region.trim()) {
      newErrors.Region = 'Region is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validate()) {
      onGenerate(formData);
    }
  };

  const handleCancel = () => {
    setFormData({
      ProgramId: programId,
      StageName: stageName,
      Region: ''
    });
    setErrors({});
    onClose();
  };

  // Default regions if none provided
  const defaultRegions = [
    'NCR',
    'CAR',
    'Region I',
    'Region II',
    'Region III',
    'Region IV-A',
    'Region IV-B',
    'Region V',
    'Region VI',
    'Region VII',
    'Region VIII',
    'Region IX',
    'Region X',
    'Region XI',
    'Region XII',
    'Region XIII',
    'BARMM'
  ];

  const regionOptions = regions.length > 0 ? regions : defaultRegions;

  return (
    <Dialog open={isOpen} onClose={handleCancel} className="relative z-50">

      <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
        <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
          <DialogPanel
            transition
            className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all data-[closed]:translate-y-4 data-[closed]:opacity-0 data-[enter]:duration-300 data-[leave]:duration-200 data-[enter]:ease-out data-[leave]:ease-in sm:my-8 sm:w-full sm:max-w-lg sm:p-6 data-[closed]:sm:translate-y-0 data-[closed]:sm:scale-95"
          >
            <div className="absolute right-0 top-0 pr-4 pt-4">
              <button
                type="button"
                onClick={handleCancel}
                className="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                <span className="sr-only">Close</span>
                <XMarkIcon className="h-6 w-6" aria-hidden="true" />
              </button>
            </div>

            <div className="sm:flex sm:items-start">
              <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                <DialogTitle as="h3" className="text-lg font-semibold leading-6 text-gray-900 mb-4">
                  Generate AIP Report
                </DialogTitle>

                <div className="mt-4 space-y-4">
                  {/* Program Name */}
                  <div>
                    <label htmlFor="programName" className="block text-sm font-medium text-gray-700 mb-1">
                      Program Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="programName"
                      value={formData.ProgramName}
                      onChange={(e) => handleChange('ProgramName', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                        errors.ProgramName ? 'border-red-300' : 'border-gray-300'
                      }`}
                      placeholder="Enter Program Name"
                    />
                    {errors.ProgramName && (
                      <p className="mt-1 text-sm text-red-600">{errors.ProgramName}</p>
                    )}
                  </div>

                  {/* Stage Name */}
                  <div>
                    <label htmlFor="stageName" className="block text-sm font-medium text-gray-700 mb-1">
                      Stage Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="stageName"
                      value={formData.StageName}
                      onChange={(e) => handleChange('StageName', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                        errors.StageName ? 'border-red-300' : 'border-gray-300'
                      }`}
                      placeholder="Enter Stage Name"
                    />
                    {errors.StageName && (
                      <p className="mt-1 text-sm text-red-600">{errors.StageName}</p>
                    )}
                  </div>

                  {/* Region */}
                  <div>
                    <label htmlFor="region" className="block text-sm font-medium text-gray-700 mb-1">
                      Region <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="region"
                      value={formData.Region}
                      onChange={(e) => handleChange('Region', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                        errors.Region ? 'border-red-300' : 'border-gray-300'
                      }`}
                    >
                      <option value="">Select a region</option>
                      {regionOptions.map((region) => (
                        <option key={region} value={region}>
                          {region}
                        </option>
                      ))}
                    </select>
                    {errors.Region && (
                      <p className="mt-1 text-sm text-red-600">{errors.Region}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 sm:flex sm:flex-row-reverse gap-3">
              <Button
                color="blue"
                onClick={handleSubmit}
              >
                Generate Report
              </Button>
              <Button
                color="white"
                onClick={handleCancel}
              >
                Cancel
              </Button>
            </div>
          </DialogPanel>
        </div>
      </div>
    </Dialog>
  );
};

export default AIPReportDialog;
