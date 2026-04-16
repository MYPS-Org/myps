import React, { useState } from 'react';
import { useCodeTableContext } from '../../CodeTableContext';
import type { CodeTableData } from '../../Model.d';

import CategoryTable           from './CategoryTable';
import ThrustTable             from './ThrustTable';
import OriginTable             from './OriginTable';
import AgencyTable             from './AgencyTable';

// ── Tab configuration ────────────────────────────────────────────────────────
interface TabDef {
  id: string;
  label: string;
  dataKey: keyof CodeTableData;
  Component: React.ComponentType;
}

const TABS: TabDef[] = [
  { id: 'category', label: 'Category', dataKey: 'ProjectCategories', Component: CategoryTable },
  { id: 'thrust',   label: 'Thrust',   dataKey: 'ProjectThrusts',    Component: ThrustTable },
  { id: 'agency',   label: 'Agency',   dataKey: 'ProjectAgencies',   Component: AgencyTable },
  { id: 'origin',   label: 'Origin',   dataKey: 'ProjectOrigins',    Component: OriginTable },
];

// ── Component ────────────────────────────────────────────────────────────────
const ProjectDetailsDropdowns: React.FC = () => {
  const [activeId, setActiveId] = useState(TABS[0].id);
  const { data: codeTableData, loading, error, refetch } = useCodeTableContext();

  const activeTab  = TABS.find(t => t.id === activeId) ?? TABS[0];

  const countOf = (key: keyof CodeTableData): number =>
    codeTableData ? ((codeTableData[key] as unknown[])?.length ?? 0) : 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-gray-900">Project Details Dropdowns</h3>
          <p className="text-sm text-gray-500 mt-0.5">Manage the dropdown values used in the Project Details form</p>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <span className="font-medium">Error:</span> {error}
          <button onClick={refetch} className="ml-auto text-red-600 underline hover:text-red-800">Retry</button>
        </div>
      )}

      {/* Pill tab navigation */}
      <div className="flex flex-wrap gap-1.5">
        {TABS.map(tab => {
          const isActive = tab.id === activeId;
          const count    = countOf(tab.dataKey);
          return (
            <button
              key={tab.id}
              onClick={() => setActiveId(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-full border transition-colors ${
                isActive
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {tab.label}
              {!loading && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-mono ${
                  isActive ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-500'
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Active table component */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <activeTab.Component />
      </div>
    </div>
  );
};

export default ProjectDetailsDropdowns;
