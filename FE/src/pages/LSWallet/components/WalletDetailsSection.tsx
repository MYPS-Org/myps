// =============================================================================
// WalletDetailsSection.tsx — full project-details form for an LSWallet.
//
// This is a manually-maintained adaptation of:
//   FE/src/pages/Project/components/ProjectDetailsForm.tsx
//
// DIFFERENCES from ProjectDetailsForm:
//   - No "Lump Sum / Non Project" IslandCode toggle (that toggle belongs to the
//     Project module's IslandCode === 'LS' concept, which must NOT collide with
//     this module — see LSWallet.md naming guardrail).
//   - No edit-mode "Administrative Information" block (there is no "edit wallet
//     details" workflow; WalletForm mode="edit" renders everything disabled).
//   - "Wallet ID" (read-only) substituted for "Project ID" (read-only).
//   - All geo/org/source/readiness fields are OPTIONAL (no required asterisk)
//     because a wallet is program-wide, not site-specific. If the team later
//     needs some required, add rules to walletFormRules.ts.
//   - isLumpSum is always true (for useLocationFilters cascade logic) since
//     a wallet is always program-wide in the LS sense.
//   - Absorbs and replaces WalletProgramSection.tsx.
//
// CROSS-MODULE IMPORT: useLocationFilters is imported from Project/filteringLocations.
// This is an intentional, scoped exception — the hook is pure (no side effects,
// no store access) and avoids duplicating the province/city/LD cascade logic.
// =============================================================================

import React from 'react';
import type { LSWallet } from '../Model.d';
import type { ProjectEnums } from '../../Project/Model.d';
import { useLocationFilters } from '../../Project/filteringLocations';
import { getDisabledClass, formatDropdownOptions } from '../../../utils/GlobalFunctions';
import SearchableDropdown from '../../../components/ui/SearchableDropdown';
import { DateInput } from '../../../components/tailwindui/date-input';

// Region Wide options — hardcoded same as ProjectDetailsForm to avoid an enum lookup
const REGION_WIDE_OPTIONS = [
  { id: 1, value: 1, name: 'Region Wide' },
  { id: 2, value: 2, name: 'Non-Region Wide' },
  { id: 3, value: 3, name: 'Region Wide AIP ignores DEO' },
];

interface WalletDetailsSectionProps {
  wallet: Partial<LSWallet>;
  onChange: (field: keyof LSWallet, value: LSWallet[keyof LSWallet]) => void;
  errors?: Partial<Record<keyof LSWallet, string>>;
  disabled?: boolean;
  projectEnums: ProjectEnums | null;
}

const WalletDetailsSection: React.FC<WalletDetailsSectionProps> = ({
  wallet,
  onChange,
  errors = {},
  disabled = false,
  projectEnums,
}) => {
  // Build a ProjectDetails-shaped adapter so useLocationFilters can do its cascade logic.
  // The hook only reads Province, City, LegislativeDistrict, DEO, ImplementingOffice
  // (and ProgramName/Tier for type satisfaction) — so we map only those from wallet.
  const locationAdapter = {
    ProgramName: wallet.ProgramName ?? '',
    Tier: wallet.Tier ?? 1,
    Province: wallet.Province,
    City: wallet.City,
    LegislativeDistrict: wallet.LegislativeDistrict,
    DEO: wallet.DEO,
    ImplementingOffice: wallet.ImplementingOffice,
  };

  // isLumpSum = true: wallet is always program-wide (no geographic scoping required).
  // This means filteredCities, filteredLDs, filteredDEOs return the full unfiltered list.
  const {
    cities: filteredCities,
    legislativeDistricts: filteredLegislativeDistricts,
    deos: filteredDEOs,
    ios: filteredIOs,
    ous: filteredOUs,
    regions: filteredRegions,
  } = useLocationFilters(projectEnums, locationAdapter as any, true);

  // ── Location cascade handlers (mirrors ProjectDetailsForm logic, wallet fields) ──

  const handleProvinceChange = (value: string | undefined) => {
    onChange('Province', value);
    // Clear City if it no longer belongs to the new province
    if (wallet.City && value) {
      const city = projectEnums?.Cities?.find(c => c.GdbId === wallet.City);
      if (city && city.ProvinceGdbId !== value) onChange('City', undefined);
    }
    // Clear LD if it no longer belongs to the new province
    if (wallet.LegislativeDistrict && value) {
      const ld = projectEnums?.LegislativeDistricts?.find(l => l.GdbId === wallet.LegislativeDistrict);
      if (ld && ld.ProvinceGdbId !== value) onChange('LegislativeDistrict', undefined);
    }
  };

  const handleCityChange = (value: string | undefined) => {
    if (value) {
      const city = projectEnums?.Cities?.find(c => c.GdbId === value);
      if (city) {
        // Auto-set Province from City if not already matching
        const province = projectEnums?.Provinces?.find(p => p.GdbId === city.ProvinceGdbId);
        if (province && province.GdbId !== wallet.Province) {
          onChange('Province', province.GdbId);
        }
        // Clear LD if it doesn't share the same province
        if (wallet.LegislativeDistrict) {
          const ld = projectEnums?.LegislativeDistricts?.find(l => l.GdbId === wallet.LegislativeDistrict);
          if (ld && ld.ProvinceGdbId !== city.ProvinceGdbId) {
            onChange('LegislativeDistrict', undefined);
          }
        }
      }
    }
    onChange('City', value);
  };

  const handleLDChange = (value: string | undefined) => {
    if (value) {
      const ld = projectEnums?.LegislativeDistricts?.find(l => l.GdbId === value);
      if (ld) {
        // Auto-set Province from LD if not already matching
        const province = projectEnums?.Provinces?.find(p => p.GdbId === ld.ProvinceGdbId);
        if (province && province.GdbId !== wallet.Province) {
          onChange('Province', province.GdbId);
        }
        // Clear City if it doesn't share the same province
        if (wallet.City) {
          const city = projectEnums?.Cities?.find(c => c.GdbId === wallet.City);
          if (city && city.ProvinceGdbId !== ld.ProvinceGdbId) {
            onChange('City', undefined);
          }
        }
      }
    }
    onChange('LegislativeDistrict', value);
  };

  // ── Utility ──

  const formatDateValue = (dateStr?: string | null): string => {
    if (!dateStr) return '';
    try { return new Date(dateStr).toISOString().split('T')[0]; } catch { return ''; }
  };

  // NOTE: Program selection (handleProgramChange) has moved to WalletProgramDetailsSection.
  // ProgramId / ProgramName / TypeName / YearStart / CurrentStage are all set there.

  return (
    <div className="space-y-8 text-sm">

      {/* ─── General Information ─── */}
      <div className="space-y-4">
        <h3 className="text-lg text-left font-semibold text-gray-800 pt-2 pb-2">
          General Information:
        </h3>

        {/* Row 1: Wallet ID | MYId | AlternateId
            Program selection has moved to the dedicated "Program Details" card
            (WalletProgramDetailsSection) rendered before this section. */}
        <div className="grid grid-cols-3 gap-5">
          <div className="w-full flex flex-col text-left gap-2">
            <div className="flex flex-row gap-5 items-center">
              <label className="w-1/3 text-gray-600">Wallet ID:</label>
              <input
                type="text"
                value={wallet.Id ?? 'Auto-generated'}
                className="w-2/3 mt-1 px-3 py-2 border border-gray-300 bg-gray-100 rounded-md truncate"
                readOnly
              />
            </div>
          </div>

          <div className="w-full flex flex-col text-left gap-2">
            <div className="flex flex-row gap-5 items-center">
              <label className={`w-1/3 ${errors.MYId ? 'text-red-500' : 'text-gray-600'}`}>
                Multi Year ID:
              </label>
              <input
                type="text"
                value={wallet.MYId || ''}
                onChange={(e) => onChange('MYId', e.target.value)}
                className={`w-2/3 mt-1 px-3 py-2 border ${errors.MYId ? 'border-red-500' : 'border-gray-300'} ${getDisabledClass(disabled)} rounded-md truncate`}
                disabled={disabled}
                maxLength={100}
              />
            </div>
          </div>

          <div className="w-full flex flex-col text-left gap-2">
            <div className="flex flex-row gap-5 items-center">
              <label className={`w-1/3 ${errors.AlternateId ? 'text-red-500' : 'text-gray-600'}`}>
                Alternate ID:
              </label>
              <input
                type="text"
                value={wallet.AlternateId || ''}
                onChange={(e) => onChange('AlternateId', e.target.value)}
                className={`w-2/3 mt-1 px-3 py-2 border ${errors.AlternateId ? 'border-red-500' : 'border-gray-300'} ${getDisabledClass(disabled)} rounded-md truncate`}
                disabled={disabled}
                maxLength={100}
              />
            </div>
          </div>
        </div>

        {/* Row 2: ExternalId | UACS | Tier + Rank (mirrors ProjectDetailsForm's Tier/Rank pairing) */}
        <div className="grid grid-cols-3 gap-5">
          <div className="w-full flex flex-col text-left gap-2">
            <div className="flex flex-row gap-5 items-center">
              <label className={`w-1/3 ${errors.ExternalId ? 'text-red-500' : 'text-gray-600'}`}>
                External ID:
              </label>
              <input
                type="text"
                value={wallet.ExternalId || ''}
                onChange={(e) => onChange('ExternalId', e.target.value)}
                className={`w-2/3 mt-1 px-3 py-2 border ${errors.ExternalId ? 'border-red-500' : 'border-gray-300'} ${getDisabledClass(disabled)} rounded-md truncate`}
                disabled={disabled}
                maxLength={100}
              />
            </div>
          </div>

          <div className="w-full flex flex-col text-left gap-2">
            <div className="flex flex-row gap-5 items-center">
              <label className={`w-1/3 ${errors.UACS ? 'text-red-500' : 'text-gray-600'}`}>
                OA Project Code (UACS):
              </label>
              <input
                type="text"
                value={wallet.UACS || ''}
                onChange={(e) => onChange('UACS', e.target.value)}
                className={`w-2/3 mt-1 px-3 py-2 border ${errors.UACS ? 'border-red-500' : 'border-gray-300'} ${getDisabledClass(disabled)} rounded-md truncate`}
                disabled={disabled}
                maxLength={50}
              />
            </div>
          </div>

          <div className="w-full flex flex-row gap-5 items-center">
            <label className={`w-1/3 text-sm font-medium ${errors.Tier ? 'text-red-500' : 'text-gray-700'}`}>
              Tier
            </label>
            <select
              value={wallet.Tier ?? ''}
              onChange={(e) => onChange('Tier', e.target.value ? parseInt(e.target.value) : undefined)}
              className={`w-2/3 mt-1 px-3 py-2 border ${errors.Tier ? 'border-red-500' : 'border-gray-300'} ${getDisabledClass(disabled)} rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none`}
              disabled={disabled}
            >
              <option value="">Select Tier</option>
              <option value={1}>Tier I</option>
              <option value={2}>Tier II</option>
            </select>
          </div>

          <div className="flex flex-row gap-5 items-center">
            <label className={`w-1/3 text-sm font-medium ${errors.Rank ? 'text-red-500' : 'text-gray-700'}`}>
              Rank
            </label>
            <input
              type="number"
              value={wallet.Rank || ''}
              onChange={(e) => onChange('Rank', e.target.value ? parseInt(e.target.value) : undefined)}
              className={`w-2/3 mt-1 px-3 py-2 border ${errors.Rank ? 'border-red-500' : 'border-gray-300'} ${getDisabledClass(disabled)} rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none`}
              disabled={disabled}
              min={1}
            />
          </div>
        </div>

        {/* Row 3: Category | Sub-Category | MYCA Approval Date */}
        <div className="grid grid-cols-3 gap-5 border-t-2 pt-4 border-gray-200">
          <div className="w-full flex flex-col text-left gap-2">
            <div className="flex flex-row gap-5 items-center">
              <label className={`w-1/3 ${errors.CategoryId ? 'text-red-500' : 'text-gray-600'}`}>
                <span className="text-red-500 text-lg">*</span>Category:
              </label>
              <div className="w-2/3 min-w-0">
                <SearchableDropdown
                  options={formatDropdownOptions(
                    projectEnums?.Categories?.filter(x => x.ValidUntil === 0 || x.ValidUntil >= new Date().getFullYear()) || [],
                    'Id',
                    'CategoryName'
                  )}
                  value={wallet.CategoryId || ''}
                  onChange={(value) => onChange('CategoryId', value === '' ? undefined : parseInt(value.toString()))}
                  placeholder="Select Category"
                  disabled={disabled}
                  error={!!errors.CategoryId}
                  allowClear={true}
                  searchPlaceholder="Search categories..."
                />
              </div>
            </div>
          </div>

          <div className="w-full flex flex-col text-left gap-2">
            <div className="flex flex-row gap-5 items-center">
              <label className={`w-1/3 ${errors.SubCategoryId ? 'text-red-500' : 'text-gray-600'}`}>
                Sub-Category:
              </label>
              <div className="w-2/3 min-w-0">
                <SearchableDropdown
                  options={formatDropdownOptions(
                    projectEnums?.Thrusts?.filter(x =>
                      (x.ValidFromDate < new Date().getFullYear() && x.ValidToDate > new Date().getFullYear()) ||
                      x.ValidToDate === 0
                    ) || [],
                    'Id',
                    'SubProgramName'
                  )}
                  value={wallet.SubCategoryId || ''}
                  onChange={(value) => onChange('SubCategoryId', value === '' ? undefined : parseInt(value.toString()))}
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
              <label className={`w-1/3 ${errors.MYCAApprovalDate ? 'text-red-500' : 'text-gray-600'}`}>
                MYCA Approval Date:
              </label>
              <DateInput
                value={formatDateValue(wallet.MYCAApprovalDate)}
                onChange={(e) => onChange('MYCAApprovalDate', e.target.value ? new Date(e.target.value).toISOString() : null)}
                className={`w-2/3 mt-1 px-3 py-2 border ${errors.MYCAApprovalDate ? 'border-red-500' : 'border-gray-300'} ${getDisabledClass(disabled)} rounded-md truncate`}
                disabled={disabled}
              />
            </div>
          </div>
        </div>

        {/* Description */}
        <div className="grid grid-cols-1 gap-2">
          <div className="w-full flex text-left gap-2">
            <label className={`w-1/9 ${errors.Description ? 'text-red-500' : 'text-gray-600'}`}>
              Description:
            </label>
            <div className="w-8/9">
              <textarea
                value={wallet.Description || ''}
                onChange={(e) => onChange('Description', e.target.value)}
                className={`w-full mt-1 px-3 py-2 border ${errors.Description ? 'border-red-500' : 'border-gray-300'} ${getDisabledClass(disabled)} rounded-md`}
                placeholder="Enter wallet description"
                rows={3}
                disabled={disabled}
                maxLength={1000}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ─── Location Details ─── */}
      <div className="space-y-4">
        <h3 className="text-lg text-left font-semibold text-gray-800 border-t-2 pt-2 border-blue-500 pb-2">
          Location Details:
        </h3>

        <div className="grid grid-cols-3 gap-5">
          <div className="w-full flex flex-col text-left gap-2">
            <div className="flex flex-row gap-5 items-center">
              <label className={`w-1/3 ${errors.Province ? 'text-red-500' : 'text-gray-600'}`}>
                Province:
              </label>
              <div className="w-2/3">
                <SearchableDropdown
                  options={formatDropdownOptions(projectEnums?.Provinces || [], 'GdbId', 'Name', 'Id')}
                  value={wallet.Province}
                  onChange={(value) => handleProvinceChange(value === '' ? undefined : value.toString())}
                  placeholder="Select Province"
                  disabled={disabled}
                  error={!!errors.Province}
                  allowClear={true}
                  searchPlaceholder="Search provinces..."
                />
              </div>
            </div>
          </div>

          <div className="w-full flex flex-col text-left gap-2">
            <div className="flex flex-row gap-5 items-center">
              <label className={`w-1/3 ${errors.City ? 'text-red-500' : 'text-gray-600'}`}>
                City/Municipality:
              </label>
              <div className="w-2/3">
                <SearchableDropdown
                  options={formatDropdownOptions(filteredCities || [], 'GdbId', 'Name', 'Id')}
                  value={wallet.City}
                  onChange={(value) => handleCityChange(value === '' ? undefined : value.toString())}
                  placeholder="Select City/Municipality"
                  disabled={disabled}
                  error={!!errors.City}
                  allowClear={true}
                  searchPlaceholder="Search cities/municipalities..."
                />
              </div>
            </div>
          </div>

          <div className="w-full flex flex-col text-left gap-2">
            <div className="flex flex-row gap-5 items-center">
              <label className={`w-1/3 ${errors.LegislativeDistrict ? 'text-red-500' : 'text-gray-600'}`}>
                Legislative District:
              </label>
              <div className="w-2/3">
                <SearchableDropdown
                  options={formatDropdownOptions(filteredLegislativeDistricts || [], 'GdbId', 'Name', 'Id')}
                  value={wallet.LegislativeDistrict}
                  onChange={(value) => handleLDChange(value === '' ? undefined : value.toString())}
                  placeholder="Select Legislative District"
                  disabled={disabled}
                  error={!!errors.LegislativeDistrict}
                  allowClear={true}
                  searchPlaceholder="Search legislative districts..."
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Organizational Responsibilities ─── */}
      <div className="space-y-4">
        <h3 className="text-lg text-left font-semibold text-gray-800 border-t-2 py-2 border-blue-500">
          Organizational Responsibilities
        </h3>

        <div className="grid grid-cols-2 gap-5">
          <div className="w-full flex flex-col text-left gap-2">
            <div className="flex flex-row gap-5 items-center">
              <label className={`w-1/3 ${errors.DEO ? 'text-red-500' : 'text-gray-600'}`}>
                District Engineering Office:
              </label>
              <div className="w-2/3">
                <SearchableDropdown
                  options={formatDropdownOptions(filteredDEOs || [], 'ParticipantId', 'Name')}
                  value={wallet.DEO}
                  onChange={(value) => onChange('DEO', value === '' ? undefined : value.toString())}
                  placeholder="Select District Engineering Office"
                  disabled={disabled}
                  error={!!errors.DEO}
                  allowClear={true}
                  searchPlaceholder="Search district engineering offices..."
                />
              </div>
            </div>
          </div>

          <div className="w-full flex flex-col text-left gap-2">
            <div className="flex flex-row gap-5 items-center">
              <label className={`w-1/3 ${errors.Region ? 'text-red-500' : 'text-gray-600'}`}>
                Region:
              </label>
              <div className="w-2/3">
                <SearchableDropdown
                  options={formatDropdownOptions(filteredRegions, 'ParticipantId', 'Name')}
                  value={wallet.Region}
                  onChange={(value) => onChange('Region', value === '' ? undefined : value.toString())}
                  placeholder="Select Regional Office"
                  disabled={disabled}
                  error={!!errors.Region}
                  allowClear={true}
                  searchPlaceholder="Search regional offices..."
                />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-5">
          <div className="w-full flex flex-col text-left gap-2">
            <div className="flex flex-row gap-5 items-center">
              <label className={`w-1/3 ${errors.ImplementingOffice ? 'text-red-500' : 'text-gray-600'}`}>
                Implementing Office:
              </label>
              <div className="w-2/3">
                <SearchableDropdown
                  options={formatDropdownOptions(filteredIOs || [], 'ParticipantId', 'Name')}
                  value={wallet.ImplementingOffice || ''}
                  onChange={(value) => onChange('ImplementingOffice', value === '' ? undefined : value.toString())}
                  placeholder="Select Implementing Office"
                  disabled={disabled}
                  error={!!errors.ImplementingOffice}
                  allowClear={true}
                  searchPlaceholder="Search implementing offices..."
                />
              </div>
            </div>
          </div>

          <div className="w-full flex flex-col text-left gap-2">
            <div className="flex flex-row gap-5 items-center">
              <label className={`w-1/3 ${errors.OperatingUnit ? 'text-red-500' : 'text-gray-600'}`}>
                Operating Unit:
              </label>
              <div className="w-2/3">
                <SearchableDropdown
                  options={formatDropdownOptions(filteredOUs || [], 'ParticipantId', 'Name')}
                  value={wallet.OperatingUnit || ''}
                  onChange={(value) => onChange('OperatingUnit', value === '' ? undefined : value.toString())}
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

        <div className="grid grid-cols-2 gap-5">
          <div className="w-full flex flex-col text-left gap-2">
            <div className="flex flex-row gap-5 items-center">
              <label className={`w-1/3 ${errors.RegionWide ? 'text-red-500' : 'text-gray-600'}`}>
                Region Wide:
              </label>
              <select
                value={wallet.RegionWide ?? ''}
                onChange={(e) => onChange('RegionWide', e.target.value ? parseInt(e.target.value) : undefined)}
                className={`w-2/3 mt-1 px-3 py-2 border ${errors.RegionWide ? 'border-red-500' : 'border-gray-300'} ${getDisabledClass(disabled)} rounded-md truncate`}
                disabled={disabled}
              >
                <option value="">Select Region Wide</option>
                {REGION_WIDE_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.value}>{opt.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Project Source ─── */}
      <div className="space-y-4">
        <h3 className="text-lg text-left font-semibold text-gray-800 border-t-2 py-2 border-blue-500">
          Project Source
        </h3>

        <div className="grid grid-cols-2 gap-5">
          <div className="w-full flex flex-col text-left gap-2">
            <div className="flex flex-row gap-5 items-center">
              <label className={`w-1/3 ${errors.Origin ? 'text-red-500' : 'text-gray-600'}`}>
                Origin:
              </label>
              <div className="w-2/3">
                <SearchableDropdown
                  options={formatDropdownOptions(
                    projectEnums?.Origins || [],
                    'NameId',
                    'Name',
                    'Id'
                  )}
                  value={wallet.Origin || ''}
                  onChange={(value) => onChange('Origin', value === '' ? undefined : parseInt(value.toString()))}
                  placeholder="Select Origin"
                  disabled={disabled}
                  error={!!errors.Origin}
                  allowClear={true}
                  searchPlaceholder="Search origins..."
                />
              </div>
            </div>
          </div>

          <div className="w-full flex flex-col text-left gap-2">
            <div className="flex flex-row gap-5 items-center">
              <label className={`w-1/3 ${errors.Agency ? 'text-red-500' : 'text-gray-600'}`}>
                Originating Agency:
              </label>
              <div className="w-2/3">
                <SearchableDropdown
                  options={formatDropdownOptions(
                    projectEnums?.Agencies || [],
                    'NameId',
                    'Name'
                  )}
                  value={wallet.Agency || ''}
                  onChange={(value) => onChange('Agency', value === '' ? undefined : parseInt(value.toString()))}
                  placeholder="Select Originating Agency"
                  disabled={disabled}
                  error={!!errors.Agency}
                  allowClear={true}
                  searchPlaceholder="Search agencies..."
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Implementation Readiness and Modality ─── */}
      <div className="space-y-4">
        <h3 className="text-lg text-left font-semibold text-gray-800 border-t-2 py-2 border-blue-500">
          Implementation Readiness and Modality
        </h3>

        <div className="grid grid-cols-3 gap-5">
          <div className="w-full flex flex-col text-left gap-2">
            <div className="flex flex-row gap-5 items-center">
              <label className={`w-1/3 ${errors.ImplementationMode ? 'text-red-500' : 'text-gray-600'}`}>
                Implementation Mode:
              </label>
              <select
                value={wallet.ImplementationMode ?? ''}
                onChange={(e) => onChange('ImplementationMode', e.target.value ? parseInt(e.target.value) : undefined)}
                className={`w-2/3 mt-1 px-3 py-2 border ${errors.ImplementationMode ? 'border-red-500' : 'border-gray-300'} ${getDisabledClass(disabled)} rounded-md truncate`}
                disabled={disabled}
              >
                <option value="">Select Implementation Mode</option>
                {projectEnums?.ImplementationModes?.map((mode) => (
                  <option key={mode.Id} value={mode.NameId}>{mode.Name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="w-full flex flex-col text-left gap-2">
            <div className="flex flex-row gap-5 items-center">
              <label className={`w-1/3 ${errors.EmergencyMode ? 'text-red-500' : 'text-gray-600'}`}>
                Emergency Mode:
              </label>
              <select
                value={wallet.EmergencyMode ?? ''}
                onChange={(e) => onChange('EmergencyMode', e.target.value ? parseInt(e.target.value) : undefined)}
                className={`w-2/3 mt-1 px-3 py-2 border ${errors.EmergencyMode ? 'border-red-500' : 'border-gray-300'} ${getDisabledClass(disabled)} rounded-md truncate`}
                disabled={disabled}
              >
                <option value="">Select Emergency Mode</option>
                {projectEnums?.EmergencyModes?.map((mode) => (
                  <option key={mode.Id} value={mode.NameId}>{mode.Name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="w-full flex flex-col text-left gap-2">
            <div className="flex flex-row gap-5 items-center">
              <label className={`w-1/3 ${errors.RowAvailable ? 'text-red-500' : 'text-gray-600'}`}>
                ROW Available:
              </label>
              <select
                value={wallet.RowAvailable ?? ''}
                onChange={(e) => onChange('RowAvailable', e.target.value ? parseInt(e.target.value) : undefined)}
                className={`w-2/3 mt-1 px-3 py-2 border ${errors.RowAvailable ? 'border-red-500' : 'border-gray-300'} ${getDisabledClass(disabled)} rounded-md`}
                disabled={disabled}
              >
                <option value="">Select ROW Availability</option>
                {projectEnums?.RowAvailables?.map((row) => (
                  <option key={row.Id} value={row.NameId}>{row.Name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Feasibility row */}
        <div className="grid grid-cols-2 gap-5">
          <div className="w-full flex flex-col text-left gap-2">
            <div className="flex flex-row gap-5 items-center">
              <label className={`w-1/3 ${errors.Feasibility ? 'text-red-500' : 'text-gray-600'}`}>
                Feasibility Study:
              </label>
              <select
                value={wallet.Feasibility ?? ''}
                onChange={(e) => onChange('Feasibility', e.target.value ? parseInt(e.target.value) : undefined)}
                className={`w-2/3 mt-1 px-3 py-2 border ${errors.Feasibility ? 'border-red-500' : 'border-gray-300'} ${getDisabledClass(disabled)} rounded-md truncate`}
                disabled={disabled}
              >
                <option value="">Select Feasibility Study</option>
                {projectEnums?.Feasibilities?.map((f) => (
                  <option key={f.Id} value={f.NameId}>{f.Name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="w-full flex flex-col text-left gap-2">
            <div className="flex flex-row gap-5 items-center">
              <label className={`w-1/3 ${errors.FeasibilityDate ? 'text-red-500' : 'text-gray-600'}`}>
                Feasibility Date:
              </label>
              <DateInput
                value={formatDateValue(wallet.FeasibilityDate)}
                onChange={(e) => onChange('FeasibilityDate', e.target.value ? new Date(e.target.value).toISOString() : null)}
                className={`w-2/3 mt-1 px-3 py-2 border ${errors.FeasibilityDate ? 'border-red-500' : 'border-gray-300'} ${!(wallet.Feasibility === 1) ? 'bg-gray-100 cursor-not-allowed' : ''} ${getDisabledClass(disabled)} rounded-md truncate`}
                disabled={!(wallet.Feasibility === 1) || disabled}
              />
            </div>
          </div>
        </div>

        {/* Detailed Design row */}
        <div className="grid grid-cols-2 gap-5">
          <div className="w-full flex flex-col text-left gap-2">
            <div className="flex flex-row gap-5 items-center">
              <label className={`w-1/3 ${errors.DetailedDesign ? 'text-red-500' : 'text-gray-600'}`}>
                Detailed Design:
              </label>
              <select
                value={wallet.DetailedDesign ?? ''}
                onChange={(e) => onChange('DetailedDesign', e.target.value ? parseInt(e.target.value) : undefined)}
                className={`w-2/3 mt-1 px-3 py-2 border ${errors.DetailedDesign ? 'border-red-500' : 'border-gray-300'} ${getDisabledClass(disabled)} rounded-md truncate`}
                disabled={disabled}
              >
                <option value="">Select Detailed Design</option>
                {projectEnums?.DetailedDesigns?.map((d) => (
                  <option key={d.Id} value={d.NameId}>{d.Name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="w-full flex flex-col text-left gap-2">
            <div className="flex flex-row gap-5 items-center">
              <label className={`w-1/3 ${errors.DetailedDesignDate ? 'text-red-500' : 'text-gray-600'}`}>
                Detailed Design Date:
              </label>
              <DateInput
                value={formatDateValue(wallet.DetailedDesignDate)}
                onChange={(e) => onChange('DetailedDesignDate', e.target.value ? new Date(e.target.value).toISOString() : null)}
                className={`w-2/3 mt-1 px-3 py-2 border ${errors.DetailedDesignDate ? 'border-red-500' : 'border-gray-300'} ${!wallet.DetailedDesign ? 'bg-gray-100 cursor-not-allowed' : ''} ${getDisabledClass(disabled)} rounded-md truncate`}
                disabled={!wallet.DetailedDesign || disabled}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WalletDetailsSection;
