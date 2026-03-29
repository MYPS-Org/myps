import React, { useState, useEffect } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { Button } from '../../../components/tailwindui/button';
import type {
  AIPReportParams,
  AIPReportType,
  AIPReportDropdowns,
  AIPDropdownOperatingUnit,
  AIPDropdownDEO,
  AIPDropdownImplementingOffice,
} from '../../Program/Model';
import { fetchAIPReportDropdownData } from '../../Program/Service';

interface AIPReportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (params: AIPReportParams) => void;
  programId?: string;
  programName?: string;
  stageName?: string;
  stageId?: number;
}

type ReportTypeOption = { value: AIPReportType; label: string };

const AIP_REPORT_TYPES: ReportTypeOption[] = [
  { value: 'AIP', label: 'AIP (Annual Investment Plan)' },
  { value: 'AIP02', label: 'AIP-02 (Annual Investment Plan 02)' },
];

const RBP_REPORT_TYPES: ReportTypeOption[] = [
  { value: 'RBP', label: 'RBP (Regional Budget Proposal)' },
  { value: 'RBPComponents', label: 'RBP Components' },
  { value: 'RBPTier', label: 'RBP Tier' },
];

const RDIP_REPORT_TYPES: ReportTypeOption[] = [
  { value: 'RDIP', label: 'RDIP (Regional Development Investment Program)' },
];

/**
 * Returns available report types based on the program's current stage ID.
 *  - AIP / AIP02:                    stageId <= 4 OR stageId >= 10
 *  - RBP / RBPComponents / RBPTier:  stageId === 4
 *  - RDIP:                           stageId >= 2
 */
function getAvailableReportTypes(stageId: number): ReportTypeOption[] {
  const types: ReportTypeOption[] = [];
  if (stageId <= 4 || stageId >= 10) types.push(...AIP_REPORT_TYPES);
  if (stageId === 3) types.push(...RBP_REPORT_TYPES);
  if (stageId <= 2) types.push(...RDIP_REPORT_TYPES);
  return types;
}

const AIPReportDialog: React.FC<AIPReportDialogProps> = ({
  isOpen,
  onClose,
  onGenerate,
  programId = '',
  programName = '',
  stageName = '',
  stageId = 0,
}) => {
  const [dropdowns, setDropdowns] = useState<AIPReportDropdowns | null>(null);
  const [isLoadingDropdowns, setIsLoadingDropdowns] = useState(false);

  const [formData, setFormData] = useState<AIPReportParams>({
    ReportType: 'AIP',
    ProgramId: programId,
    ProgramName: programName,
    StageName: stageName,
    CategoryName: '',
    RegionName: '',
    OperatingUnitName: '',
    DistrictEngineeringOffice: '',
    ImplementingOfficeName: '',
    LegislativeDistrictName: '',
  });

  const [errors, setErrors] = useState<Partial<Record<keyof AIPReportParams, string>>>({});

  const availableReportTypes = getAvailableReportTypes(stageId);
  const isAIPType = formData.ReportType === 'AIP' || formData.ReportType === 'AIP02';

  // Resolve selected Region object — used for ParticipantId-based filtering
  const selectedRegion = formData.RegionName
    ? dropdowns?.Regions.find((r) => r.Name === formData.RegionName) ?? null
    : null;

  // Step 1: Region → DEOs — match by RegionParticipantId (avoids RegionName case inconsistencies)
  const filteredDEOs: AIPDropdownDEO[] = selectedRegion
    ? dropdowns?.DEOs.filter((d) => d.RegionParticipantId === selectedRegion.ParticipantId) ?? []
    : [];

  // Step 2a: Resolve selected DEO from the already-filtered list
  const selectedDEO = formData.DistrictEngineeringOffice
    ? filteredDEOs.find((d) => d.Name === formData.DistrictEngineeringOffice) ?? null
    : null;

  // Step 2b: Region + DEO? → Implementing Offices
  // With DEO: R-type in same region + UPMO + the DEO office itself (mirrors ProjectDetailsForm)
  // With Region only: filter by RegionParticipantId
  // No Region: empty (field is disabled)
  const filteredImplementingOffices: AIPDropdownImplementingOffice[] = !selectedRegion
    ? []
    : selectedDEO
    ? dropdowns?.ImplementingOffices.filter(
        (io) =>
          (io.RegionParticipantId === selectedDEO.RegionParticipantId && io.OrgType === 'R') ||
          io.OrgType === 'UPMO' ||
          io.ParticipantId === selectedDEO.ParticipantId
      ) ?? []
    : dropdowns?.ImplementingOffices.filter(
        (io) => io.RegionParticipantId === selectedRegion.ParticipantId
      ) ?? [];

  // Step 3a: Resolve selected IO from the already-filtered list
  const selectedIO = formData.ImplementingOfficeName
    ? filteredImplementingOffices.find((io) => io.Name === formData.ImplementingOfficeName) ?? null
    : null;

  // Step 3b: IO → Operating Units (empty and disabled when no IO selected)
  const filteredOperatingUnits: AIPDropdownOperatingUnit[] = selectedIO
    ? dropdowns?.OperatingUnits.filter(
        (ou) =>
          ou.OrgType === 'CO' ||
          selectedDEO?.RegionParticipantId === ou.ParticipantId ||
          selectedIO.ParticipantId === ou.ParticipantId ||
          (selectedIO.OrgType === 'UPMO' && selectedDEO?.ParticipantId === ou.ParticipantId)
      ) ?? []
    : [];

  useEffect(() => {
    if (isOpen) {
      const types = getAvailableReportTypes(stageId);
      setFormData({
        ReportType: types[0]?.value ?? 'AIP',
        ProgramId: programId,
        ProgramName: programName,
        StageName: stageName,
        CategoryName: '',
        RegionName: '',
        OperatingUnitName: '',
        DistrictEngineeringOffice: '',
        ImplementingOfficeName: '',
        LegislativeDistrictName: '',
      });
      setErrors({});

      if (!dropdowns) {
        setIsLoadingDropdowns(true);
        fetchAIPReportDropdownData()
          .then(setDropdowns)
          .catch(console.error)
          .finally(() => setIsLoadingDropdowns(false));
      }
    }
  }, [isOpen, programId, programName, stageName, stageId]);

  const handleChange = <K extends keyof AIPReportParams>(field: K, value: AIPReportParams[K]) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };
      // Region change → clear all dependent fields
      if (field === 'RegionName') {
        updated.DistrictEngineeringOffice = '';
        updated.ImplementingOfficeName = '';
        updated.OperatingUnitName = '';
      }
      // DEO change → clear IO and OU (IO options depend on DEO)
      if (field === 'DistrictEngineeringOffice') {
        updated.ImplementingOfficeName = '';
        updated.OperatingUnitName = '';
      }
      // IO change → clear OU (OU options depend on IO + DEO)
      if (field === 'ImplementingOfficeName') {
        updated.OperatingUnitName = '';
      }
      return updated;
    });
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof AIPReportParams, string>> = {};
    if (!formData.ProgramId.trim()) newErrors.ProgramId = 'Program ID is required';
    if (!formData.ReportType) newErrors.ReportType = 'Report type is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validate()) {
      // Strip empty optional strings before sending
      const payload: AIPReportParams = {
        ReportType: formData.ReportType,
        ProgramId: formData.ProgramId,
        ProgramName: formData.ProgramName,
        StageName: formData.StageName?.trim() || undefined,
        CategoryName: formData.CategoryName?.trim() || undefined,
        RegionName: formData.RegionName?.trim() || undefined,
        OperatingUnitName: formData.OperatingUnitName?.trim() || undefined,
        DistrictEngineeringOffice: formData.DistrictEngineeringOffice?.trim() || undefined,
        ImplementingOfficeName: formData.ImplementingOfficeName?.trim() || undefined,
        LegislativeDistrictName: formData.LegislativeDistrictName?.trim() || undefined,
      };
      onGenerate(payload);
    }
  };

  const handleCancel = () => {
    setErrors({});
    onClose();
  };

  const selectClass = (hasError?: boolean, isDisabled?: boolean) =>
    `w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
      isDisabled ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white'
    } ${hasError ? 'border-red-300' : 'border-gray-300'}`;

  return (
    <Dialog open={isOpen} onClose={handleCancel} className="relative z-50">
      <div className="fixed inset-0 z-10 w-screen overflow-y-auto bg-black/30">
        <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
          <DialogPanel
            transition
            className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all data-[closed]:translate-y-4 data-[closed]:opacity-0 data-[enter]:duration-300 data-[leave]:duration-200 data-[enter]:ease-out data-[leave]:ease-in sm:my-8 sm:w-full sm:max-w-xl sm:p-6 data-[closed]:sm:translate-y-0 data-[closed]:sm:scale-95"
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
                <DialogTitle as="h3" className="text-lg font-semibold leading-6 text-gray-900 mb-1">
                  Generate Report
                </DialogTitle>
                {programName && (
                  <p className="text-sm text-gray-500 mb-4">
                    Program: <span className="font-medium text-gray-700">{programName}</span>
                  </p>
                )}

                {isLoadingDropdowns && (
                  <p className="text-sm text-indigo-600 mb-2">Loading filter options…</p>
                )}

                <div className="mt-2 space-y-4">
                  {/* Report Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Report Type <span className="text-red-500">*</span>
                    </label>
                    {availableReportTypes.length === 0 ? (
                      <p className="text-sm text-amber-600 bg-amber-50 px-3 py-2 rounded-md border border-amber-200">
                        No reports are available for the current program stage.
                      </p>
                    ) : (
                      <select
                        value={formData.ReportType}
                        onChange={(e) => handleChange('ReportType', e.target.value as AIPReportType)}
                        className={selectClass(!!errors.ReportType)}
                      >
                        {availableReportTypes.map((rt) => (
                          <option key={rt.value} value={rt.value}>
                            {rt.label}
                          </option>
                        ))}
                      </select>
                    )}
                    {errors.ReportType && (
                      <p className="mt-1 text-sm text-red-600">{errors.ReportType}</p>
                    )}
                  </div>

                  {/* Stage Name — AIP/AIP02 only */}
                  {isAIPType && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Stage Name
                        <span className="ml-1 text-gray-400 font-normal">(optional)</span>
                      </label>
                      <input
                        type="text"
                        value={formData.StageName ?? ''}
                        onChange={(e) => handleChange('StageName', e.target.value)}
                        className={selectClass()}
                        placeholder="e.g. GAA-R"
                      />
                    </div>
                  )}

                  {/* Category — AIP/AIP02 only */}
                  {isAIPType && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Category
                        <span className="ml-1 text-gray-400 font-normal">(optional)</span>
                      </label>
                      <select
                        value={formData.CategoryName ?? ''}
                        onChange={(e) => handleChange('CategoryName', e.target.value)}
                        className={selectClass()}
                        disabled={isLoadingDropdowns}
                      >
                        <option value="">All categories</option>
                        {dropdowns?.Categories.map((cat) => (
                          <option key={cat.Id} value={cat.CategoryName ?? ''}>
                            {cat.CategoryName}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Region — root filter for all report types */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Region
                      <span className="ml-1 text-gray-400 font-normal">(optional)</span>
                    </label>
                    <select
                      value={formData.RegionName ?? ''}
                      onChange={(e) => handleChange('RegionName', e.target.value)}
                      className={selectClass(false, isLoadingDropdowns)}
                      disabled={isLoadingDropdowns}
                    >
                      <option value="">All regions</option>
                      {dropdowns?.Regions.map((r) => (
                        <option key={r.Id} value={r.Name}>
                          {r.Name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* DEO, IO, OU, LD — AIP/AIP02 only */}
                  {isAIPType && (
                    <>
                      {/* District Engineering Office — requires Region */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          District Engineering Office
                          <span className="ml-1 text-gray-400 font-normal">(optional)</span>
                        </label>
                        <select
                          value={formData.DistrictEngineeringOffice ?? ''}
                          onChange={(e) => handleChange('DistrictEngineeringOffice', e.target.value)}
                          className={selectClass(false, !selectedRegion || isLoadingDropdowns)}
                          disabled={!selectedRegion || isLoadingDropdowns}
                        >
                          <option value="">
                            {!selectedRegion ? 'Select a region first' : 'All DEOs'}
                          </option>
                          {filteredDEOs.map((deo) => (
                            <option key={deo.Id} value={deo.Name}>
                              {deo.Name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Implementing Office — requires Region; further filtered by DEO */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Implementing Office
                          <span className="ml-1 text-gray-400 font-normal">(optional)</span>
                        </label>
                        <select
                          value={formData.ImplementingOfficeName ?? ''}
                          onChange={(e) => handleChange('ImplementingOfficeName', e.target.value)}
                          className={selectClass(false, !selectedRegion || isLoadingDropdowns)}
                          disabled={!selectedRegion || isLoadingDropdowns}
                        >
                          <option value="">
                            {!selectedRegion ? 'Select a region first' : 'All implementing offices'}
                          </option>
                          {filteredImplementingOffices.map((io) => (
                            <option key={io.ParticipantId} value={io.Name}>
                              {io.Name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Operating Unit — requires Implementing Office */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Operating Unit
                          <span className="ml-1 text-gray-400 font-normal">(optional)</span>
                        </label>
                        <select
                          value={formData.OperatingUnitName ?? ''}
                          onChange={(e) => handleChange('OperatingUnitName', e.target.value)}
                          className={selectClass(false, !formData.ImplementingOfficeName || isLoadingDropdowns)}
                          disabled={!formData.ImplementingOfficeName || isLoadingDropdowns}
                        >
                          <option value="">
                            {!formData.ImplementingOfficeName ? 'Select an implementing office first' : 'All operating units'}
                          </option>
                          {filteredOperatingUnits.map((ou) => (
                            <option key={ou.ParticipantId} value={ou.Name}>
                              {ou.Name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Legislative District — requires Region */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Legislative District
                          <span className="ml-1 text-gray-400 font-normal">(optional)</span>
                        </label>
                        <select
                          value={formData.LegislativeDistrictName ?? ''}
                          onChange={(e) => handleChange('LegislativeDistrictName', e.target.value)}
                          className={selectClass(false, !selectedRegion || isLoadingDropdowns)}
                          disabled={!selectedRegion || isLoadingDropdowns}
                        >
                          <option value="">
                            {!selectedRegion ? 'Select a region first' : 'All legislative districts'}
                          </option>
                          {dropdowns?.LegislativeDistricts.map((ld) => (
                            <option key={ld.Id} value={ld.Name}>
                              {ld.Name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6 sm:flex sm:flex-row-reverse gap-3">
              <Button color="blue" onClick={handleSubmit} disabled={isLoadingDropdowns || availableReportTypes.length === 0}>
                Generate Report
              </Button>
              <Button color="white" onClick={handleCancel}>
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
