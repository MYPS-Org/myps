import React, { useState, useEffect } from 'react';
import { getProjectEnums } from '../../../Project/Service';
import type { ProjectEnums } from '../../../Project/Model.d';
import { ArrowPathIcon } from '@heroicons/react/24/outline';

import CategoryTable           from './CategoryTable';
import ThrustTable             from './ThrustTable';
import OriginTable             from './OriginTable';
import AgencyTable             from './AgencyTable';
import ImplementationModeTable from './ImplementationModeTable';
import EmergencyModeTable      from './EmergencyModeTable';
import RowAvailableTable       from './RowAvailableTable';
import FeasibilityTable        from './FeasibilityTable';
import DetailedDesignTable     from './DetailedDesignTable';
import RegionWideTable         from './RegionWideTable';

// ── Tab configuration ────────────────────────────────────────────────────────
interface TabDef {
  id: string;
  label: string;
  enumKey: keyof ProjectEnums;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Component: React.ComponentType<{ data?: any[]; loading?: boolean }>;
}

const TABS: TabDef[] = [
  { id: 'category',      label: 'Category',           enumKey: 'Categories',         Component: CategoryTable },
  { id: 'thrust',        label: 'Thrust',             enumKey: 'Thrusts',            Component: ThrustTable },
  { id: 'origin',        label: 'Origin',             enumKey: 'Origins',            Component: OriginTable },
  { id: 'agency',        label: 'Agency',             enumKey: 'Agencies',           Component: AgencyTable },
  { id: 'impl-mode',     label: 'Implementation Mode',enumKey: 'ImplementationModes',Component: ImplementationModeTable },
  { id: 'emer-mode',     label: 'Emergency Mode',     enumKey: 'EmergencyModes',     Component: EmergencyModeTable },
  { id: 'row-avail',     label: 'ROW Available',      enumKey: 'RowsAvailable',      Component: RowAvailableTable },
  { id: 'feasibility',   label: 'Feasibility Study',  enumKey: 'Feasibility',        Component: FeasibilityTable },
  { id: 'detail-design', label: 'Detailed Design',    enumKey: 'DetailedDesign',     Component: DetailedDesignTable },
  { id: 'region-wide',   label: 'Region Wide',        enumKey: 'RegionWide',         Component: RegionWideTable },
];

// ── Component ────────────────────────────────────────────────────────────────
const ProjectDetailsDropdowns: React.FC = () => {
  const [enums, setEnums]       = useState<ProjectEnums | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [activeId, setActiveId] = useState(TABS[0].id);

  const fetchEnums = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getProjectEnums();
      if (res.Status === 200 && res.Data) setEnums(res.Data);
      else setError(res.Message ?? 'Failed to load dropdown data.');
    } catch {
      setError('Network error – could not reach the server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchEnums(); }, []);

  const activeTab = TABS.find(t => t.id === activeId) ?? TABS[0];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const activeData: any[] | undefined = enums
    ? (enums[activeTab.enumKey] as any[] | undefined) ?? []
    : undefined;

  const countOf = (key: keyof ProjectEnums): number =>
    enums ? ((enums[key] as unknown[])?.length ?? 0) : 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-gray-900">Project Details Dropdowns</h3>
          <p className="text-sm text-gray-500 mt-0.5">Manage the dropdown values used in the Project Details form</p>
        </div>
        <button
          onClick={fetchEnums}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <span className="font-medium">Error:</span> {error}
          <button onClick={fetchEnums} className="ml-auto text-red-600 underline hover:text-red-800">Retry</button>
        </div>
      )}

      {/* Pill tab navigation */}
      <div className="flex flex-wrap gap-1.5">
        {TABS.map(tab => {
          const isActive = tab.id === activeId;
          const count    = countOf(tab.enumKey);
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
        <activeTab.Component data={activeData} loading={loading} />
      </div>
    </div>
  );
};

export default ProjectDetailsDropdowns;
