import React from 'react';
import type { AIPReportDropdowns } from '../../Program/Model';

const selectClass =
  'w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed';

interface ExtractPcmiowFieldsProps {
  dropdowns: AIPReportDropdowns | null;
  isLoadingDropdowns: boolean;
  regionCode: string;
  categoryId: string;
  onCategoryChange: (value: string) => void;
  deoCode: string;
  onDeoChange: (value: string) => void;
  ioCode: string;
  onIoChange: (value: string) => void;
}

// Category/DEO/Implementing Office fields for the Extract PCMIOW and Extract PC
// report families — both take the identical parameter contract on the backend
// (see ReportRequestMapper.MapExtract), so they share this same fields block.
// Split out of Reports.tsx so the PDF vs Excel filter sections stay
// independently readable as more Excel reports are added to ReportCatalog.
const ExtractPcmiowFields: React.FC<ExtractPcmiowFieldsProps> = ({
  dropdowns,
  isLoadingDropdowns,
  regionCode,
  categoryId,
  onCategoryChange,
  deoCode,
  onDeoChange,
  ioCode,
  onIoChange,
}) => {
  // Region → DEO → Implementing Office cascade, same filtering rule
  // AIPReportDialog.tsx uses (ParticipantId-keyed, not name-keyed, since this
  // pipeline's SQL params want codes, not display names).
  const selectedDeo = deoCode ? dropdowns?.DEOs.find((d) => d.ParticipantId === deoCode) ?? null : null;

  const filteredDEOs = regionCode
    ? dropdowns?.DEOs.filter((d) => d.RegionParticipantId === regionCode) ?? []
    : [];

  const filteredImplementingOffices = !regionCode
    ? []
    : selectedDeo
    ? dropdowns?.ImplementingOffices.filter(
        (io) =>
          (io.RegionParticipantId === selectedDeo.RegionParticipantId && io.OrgType === 'R') ||
          io.OrgType === 'UPMO' ||
          io.ParticipantId === selectedDeo.ParticipantId
      ) ?? []
    : dropdowns?.ImplementingOffices.filter((io) => io.RegionParticipantId === regionCode) ?? [];

  return (
    <>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
        <select
          value={categoryId}
          onChange={(e) => onCategoryChange(e.target.value)}
          className={selectClass}
          disabled={isLoadingDropdowns}
        >
          <option value="">Select a category</option>
          {dropdowns?.Categories.map((cat) => (
            <option key={cat.Id} value={cat.CategoryId}>
              {cat.CategoryName}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">District Engineering Office</label>
        <select
          value={deoCode}
          onChange={(e) => onDeoChange(e.target.value)}
          className={selectClass}
          disabled={!regionCode || isLoadingDropdowns}
        >
          <option value="">{!regionCode ? 'Select a regional office first' : 'Select a DEO'}</option>
          {filteredDEOs.map((deo) => (
            <option key={deo.ParticipantId} value={deo.ParticipantId}>
              {deo.Name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Implementing Office</label>
        <select
          value={ioCode}
          onChange={(e) => onIoChange(e.target.value)}
          className={selectClass}
          disabled={!deoCode || isLoadingDropdowns}
        >
          <option value="">{!deoCode ? 'Select a DEO first' : 'Select an implementing office'}</option>
          {filteredImplementingOffices.map((io) => (
            <option key={io.ParticipantId} value={io.ParticipantId}>
              {io.Name}
            </option>
          ))}
        </select>
      </div>
    </>
  );
};

export default ExtractPcmiowFields;
