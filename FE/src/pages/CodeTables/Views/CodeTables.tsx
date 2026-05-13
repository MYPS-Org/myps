import React, { useState } from 'react';
import ProjectDetailsDropdowns from '../tables/projectDetails/ProjectDetailsDropdowns';
import CostTypeTable from '../tables/componentCost/CostTypeTable';
import ScopeOfWorkTable from '../tables/majorItemOfWorks/ScopeOfWorkTable';
import InfraTypeTable from '../tables/majorItemLocation/InfraTypeTable';
import FundingAgreementTable from '../tables/fundingProfile/FundingAgreementTable';
import FundingSourceTable from '../tables/fundingProfile/FundingSourceTable';
import RevisionCategoryTable from '../tables/revisions/RevisionCategoryTable';
import RevisionHeaderTable from '../tables/revisions/RevisionHeaderTable';
import RevisionDocumentTable from '../tables/revisions/RevisionDocumentTable';
import ModificationReasonTable from '../tables/revisions/ModificationReasonTable';
import RevisionStatusTable from '../tables/revisions/RevisionStatusTable';
import RevisionFieldPermissionTable from '../tables/revisions/RevisionFieldPermissionTable';
import ValidationDatesTable from '../tables/revisions/ValidationDatesTable';
import ProgramStageTable from '../tables/program/ProgramStageTable';
import ProgramTypeTable from '../tables/program/ProgramTypeTable';
import ProgramStatusTable from '../tables/program/ProgramStatusTable';
import RegionTable from '../tables/adminArea/RegionTable';
import ProvinceTable from '../tables/adminArea/ProvinceTable';
import CityTable from '../tables/adminArea/CityTable';
import LegislativeDistrictTable from '../tables/adminArea/LegislativeDistrictTable';
import DEOTable from '../tables/adminArea/DEOTable';
import { CodeTableProvider } from '../CodeTableContext';
import { AdminAreaProvider } from '../AdminAreaContext';
import {
  ClipboardDocumentListIcon,
  CubeIcon,
  WrenchScrewdriverIcon,
  BanknotesIcon,
  ArrowPathIcon,
  PresentationChartBarIcon,
  MapPinIcon,
} from '@heroicons/react/24/outline';

interface TableTab {
  id: string;
  label: string;
  component: React.FC;
}

interface GroupTab {
  id: string;
  label: string;
  icon: React.FC<{ className?: string }>;
  tables: TableTab[];
}

const GROUPS: GroupTab[] = [
  {
    id: 'project-details',
    label: 'Project Details',
    icon: ClipboardDocumentListIcon,
    tables: [
      { id: 'form-dropdowns', label: 'Form Dropdowns', component: ProjectDetailsDropdowns },
    ],
  },
  {
    id: 'component-cost',
    label: 'Component Cost',
    icon: CubeIcon,
    tables: [
      { id: 'cost-type', label: 'Cost Type', component: CostTypeTable },
    ],
  },
  {
    id: 'major-item',
    label: 'Major Item',
    icon: WrenchScrewdriverIcon,
    tables: [
      { id: 'scope-of-work', label: 'Scope of Work',        component: ScopeOfWorkTable },
      { id: 'infra-type',    label: 'Infrastructure Types',  component: InfraTypeTable },
    ],
  },
  {
    id: 'funding-profile',
    label: 'Funding Profile',
    icon: BanknotesIcon,
    tables: [
      { id: 'funding-agreement', label: 'Funding Agreement', component: FundingAgreementTable },
      { id: 'funding-source',    label: 'Funding Source',    component: FundingSourceTable },
    ],
  },
  {
    id: 'revisions',
    label: 'Revisions',
    icon: ArrowPathIcon,
    tables: [
      { id: 'rev-category',     label: 'Categories',      component: RevisionCategoryTable },
      { id: 'rev-header',       label: 'Headers',         component: RevisionHeaderTable },
      { id: 'rev-document',     label: 'Documents',       component: RevisionDocumentTable },
      { id: 'rev-reason',       label: 'Reasons',         component: ModificationReasonTable },
      { id: 'rev-status',       label: 'Statuses',        component: RevisionStatusTable },
      { id: 'rev-rules',        label: 'Rules',           component: RevisionFieldPermissionTable },
      { id: 'validation-dates', label: 'Validation Dates',component: ValidationDatesTable },
    ],
  },
  {
    id: 'programs',
    label: 'Programs',
    icon: PresentationChartBarIcon,
    tables: [
      { id: 'program-stage',  label: 'Program Stage',  component: ProgramStageTable },
      { id: 'program-type',   label: 'Program Type',   component: ProgramTypeTable },
      { id: 'program-status', label: 'Program Status', component: ProgramStatusTable },
    ],
  },
  {
    id: 'admin-areas',
    label: 'Admin Areas',
    icon: MapPinIcon,
    tables: [
      { id: 'region',        label: 'Regions',               component: RegionTable },
      { id: 'province',      label: 'Provinces',             component: ProvinceTable },
      { id: 'city',          label: 'Cities/Municipalities', component: CityTable },
      { id: 'leg-district',  label: 'Legislative Districts', component: LegislativeDistrictTable },
      { id: 'deo',           label: 'DEOs',                  component: DEOTable },
    ],
  },
];


const CodeTables: React.FC = () => {
  const [activeGroupId, setActiveGroupId] = useState(GROUPS[0].id);
  const [activeTableId, setActiveTableId] = useState(GROUPS[0].tables[0].id);

  const switchGroup = (groupId: string) => {
    const group = GROUPS.find(g => g.id === groupId);
    setActiveGroupId(groupId);
    if (group) setActiveTableId(group.tables[0].id);
  };

  const activeGroup = GROUPS.find(g => g.id === activeGroupId)!;
  const activeTable = activeGroup.tables.find(t => t.id === activeTableId)!;
  const ActiveComponent = activeTable.component;

  return (
    <CodeTableProvider>
    <AdminAreaProvider>
    <div className="min-h-screen bg-gray-50">

      {/* ── Page header + primary (group) tabs ───────────────────── */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-6 pt-5 pb-5">
          <h2 className="text-xl font-semibold text-gray-900">Code Tables</h2>
          <p className="text-sm text-gray-500 mt-0.5 mb-4">Manage system reference and lookup data</p>

          {/* Group tabs — pill style */}
          <div className="flex flex-wrap gap-2">
            {GROUPS.map(group => {
              const Icon = group.icon;
              const isActive = group.id === activeGroupId;
              return (
                <button
                  key={group.id}
                  onClick={() => switchGroup(group.id)}
                  className={`
                    flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-full border transition-colors
                    ${isActive
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}
                  `}
                >
                  <Icon className="h-4 w-4" />
                  {group.label}
                  <span className={`
                    inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 text-[11px] font-semibold rounded-full
                    ${isActive ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-500'}
                  `}>
                    {group.tables.length}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Sub-tabs + content ────────────────────────────────────── */}
      <div className="pt-5 pb-8">

        {/* Secondary (table) tabs — pill style */}
        {activeGroup.tables.length > 1 && (
          <div className="flex flex-wrap gap-1.5 mb-5">
            {activeGroup.tables.map(table => {
              const isActive = table.id === activeTableId;
              return (
                <button
                  key={table.id}
                  onClick={() => setActiveTableId(table.id)}
                  className={`
                    px-3.5 py-1.5 text-sm font-medium rounded-full transition-colors
                    ${isActive
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 hover:text-gray-900'}
                  `}
                >
                  {table.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Table card */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <ActiveComponent />
        </div>
      </div>
    </div>
    </AdminAreaProvider>
    </CodeTableProvider>
  );
};

export default CodeTables;
