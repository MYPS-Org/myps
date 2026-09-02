import React, { useEffect, useState } from 'react';
import {
  ArrowTopRightOnSquareIcon,
  CalculatorIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import type { WatchlistProject } from './ProjectQuickDetailModal';
import type { KpiData } from './DashboardKpiCards';

export type DashboardKpiType = 'budget' | 'projects' | 'lswallet' | 'publication';

export interface DashboardLsProject {
  id: number;
  projectPK: string;
  projectId: string;
  description: string;
  programName: string;
  stageName: string;
  totalAllocation: number;
  itemizedAmount: number;
  remainingAmount: number;
  itemizedCount: number;
  children: Array<{
    id: number;
    projectPK: string;
    projectId: string;
    description: string;
    stageName: string;
    fundingTotal: number;
    componentCostTotal: number;
    isPublished: boolean;
  }>;
}

interface Props {
  type: DashboardKpiType | null;
  selectedYear: number;
  kpiData?: KpiData;
  projects: WatchlistProject[];
  lsProjects: DashboardLsProject[];
  onClose: () => void;
  onOpenProject: (project: WatchlistProject) => void;
  onOpenLsProject: (project: DashboardLsProject) => void;
}

const money = (value: number) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 2,
  }).format(value);

const DashboardKpiDetailModal: React.FC<Props> = ({
  type,
  selectedYear,
  kpiData,
  projects,
  lsProjects,
  onClose,
  onOpenProject,
  onOpenLsProject,
}) => {
  const [expandedLsIds, setExpandedLsIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!type) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, type]);

  if (!type) return null;

  const totalBudget = kpiData?.totalBudget ?? projects.reduce((sum, p) => sum + p.allocatedBudget, 0);
  const activeCount = kpiData?.activeProjects ?? projects.length;
  const publishedCount = kpiData?.publishedProjects ?? projects.filter((p) => p.isPublished).length;
  const publicationRate = kpiData?.publicationRate ?? (activeCount ? (publishedCount / activeCount) * 100 : 0);

  const lsItemized = kpiData?.lsWalletReleased ?? lsProjects.reduce((sum, p) => sum + p.itemizedAmount, 0);
  const lsAllocation = kpiData?.lsWalletTotal ?? lsProjects.reduce((sum, p) => sum + p.totalAllocation, 0);
  const lsUtilization = lsAllocation ? (lsItemized / lsAllocation) * 100 : 0;

  const config = {
    budget: {
      title: `FY ${selectedYear} Infrastructure Budget`,
      tally: money(totalBudget),
      count: `${activeCount.toLocaleString()} contributing project(s)`,
      formula:
        'Sum of non-deleted component-cost-per-year amounts where the cost year equals the selected fiscal year. Amounts are grouped once per latest project revision.',
    },
    projects: {
      title: `Active Projects in FY ${selectedYear}`,
      tally: activeCount.toLocaleString(),
      count: 'costed project records',
      formula:
        'Count of visible latest project revisions that have at least one non-deleted component-cost-per-year record in the selected fiscal year.',
    },
    lswallet: {
      title: `FY ${selectedYear} LS Itemized Amount`,
      tally: money(lsItemized),
      count: `${lsProjects.length.toLocaleString()} Lump Sum program(s) · ${lsUtilization.toFixed(1)}% of ${money(lsAllocation)}`,
      formula:
        'Sum of each Lump Sum project’s persisted Itemized Total. Utilization is Itemized Amount ÷ Original Allocation × 100.',
    },
    publication: {
      title: `FY ${selectedYear} Publication Compliance`,
      tally: `${publicationRate.toFixed(1)}%`,
      count: `${publishedCount.toLocaleString()} published of ${activeCount.toLocaleString()} project(s)`,
      formula:
        'Published projects ÷ all visible costed projects in the selected fiscal year × 100. Publication state comes from the persisted project record.',
    },
  }[type];

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dashboard-kpi-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl border border-slate-200">
        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5 bg-gradient-to-r from-slate-50 to-white">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Executive KPI Inspection
            </span>
            <h2 id="dashboard-kpi-title" className="text-xl font-bold text-slate-900 mt-0.5">
              {config.title}
            </h2>
            <div className="mt-2 flex flex-wrap items-baseline gap-3">
              <span className="text-3xl font-black text-slate-900 tracking-tight">
                {config.tally}
              </span>
              <span className="text-sm font-semibold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                {config.count}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            aria-label="Close KPI details"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Formula Explainer */}
        <div className="mx-6 mt-4 flex gap-3 rounded-xl border border-blue-100 bg-blue-50/60 p-3.5 text-xs text-slate-700">
          <CalculatorIcon className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
          <div>
            <strong className="text-blue-950">Calculation Methodology:</strong> {config.formula}
          </div>
        </div>

        {/* Content Table */}
        <div className="min-h-0 flex-1 overflow-auto px-6 py-4">
          {type === 'lswallet' ? (
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="sticky top-0 z-10 bg-slate-50 text-slate-600 uppercase font-bold text-[10px]">
                <tr>
                  <th className="px-4 py-3">Lump Sum Project & Scope</th>
                  <th className="px-4 py-3">Stage</th>
                  <th className="px-4 py-3 text-right">Original Allocation</th>
                  <th className="px-4 py-3 text-right">Itemized Released</th>
                  <th className="px-4 py-3 text-right">Remaining Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lsProjects.map((project) => {
                  const expanded = expandedLsIds.has(project.id);
                  return (
                    <React.Fragment key={project.id}>
                      <tr
                        onClick={() => onOpenLsProject(project)}
                        className="cursor-pointer bg-white hover:bg-slate-50 transition-colors"
                        aria-label={`Open Lump Sum project ${project.projectId}`}
                      >
                        <td className="px-4 py-3.5">
                          <div className="flex items-start gap-2">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                setExpandedLsIds((current) => {
                                  const next = new Set(current);
                                  if (next.has(project.id)) next.delete(project.id);
                                  else next.add(project.id);
                                  return next;
                                });
                              }}
                              className="mt-0.5 rounded p-1 text-slate-500 hover:bg-slate-200 transition-colors"
                              aria-expanded={expanded}
                              aria-label={`${expanded ? 'Collapse' : 'Expand'} itemized projects for ${project.projectId}`}
                            >
                              {expanded ? (
                                <ChevronDownIcon className="h-4 w-4" />
                              ) : (
                                <ChevronRightIcon className="h-4 w-4" />
                              )}
                            </button>
                            <div>
                              <div className="flex items-center gap-1 font-bold text-slate-900 font-mono">
                                {project.projectId}
                                <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5 text-blue-600" />
                              </div>
                              <div className="max-w-md truncate text-slate-600 mt-0.5" title={project.description}>
                                {project.description}
                              </div>
                              <div className="mt-1 text-[11px] font-semibold text-blue-700">
                                {project.children.length} itemized sub-project(s) · {expanded ? 'Click arrow to collapse' : 'Click arrow to expand'}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
                            {project.stageName}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right font-medium text-slate-600">
                          {money(project.totalAllocation)}
                        </td>
                        <td className="px-4 py-3.5 text-right font-bold text-emerald-700">
                          {money(project.itemizedAmount)}
                        </td>
                        <td className="px-4 py-3.5 text-right font-medium text-slate-600">
                          {money(project.remainingAmount)}
                        </td>
                      </tr>
                      {expanded && (
                        <tr className="bg-slate-50/80">
                          <td colSpan={5} className="px-6 py-3">
                            {project.children.length === 0 ? (
                              <p className="text-xs text-slate-500 py-2">
                                No itemized sub-projects recorded for this Lump Sum project.
                              </p>
                            ) : (
                              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
                                <table className="min-w-full divide-y divide-slate-100 text-xs">
                                  <thead className="bg-slate-100/80 text-slate-600 font-bold text-[10px] uppercase">
                                    <tr>
                                      <th className="px-4 py-2 text-left">Itemized Sub-Project</th>
                                      <th className="px-4 py-2 text-left">Stage</th>
                                      <th className="px-4 py-2 text-right">Funding Allocation</th>
                                      <th className="px-4 py-2 text-right">Component Cost Total</th>
                                      <th className="px-4 py-2 text-left">Publish State</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {project.children.map((child) => (
                                      <tr key={child.id} className="hover:bg-slate-50/60">
                                        <td className="px-4 py-2.5">
                                          <div className="font-bold text-slate-900 font-mono">
                                            {child.projectId}
                                          </div>
                                          <div className="max-w-md truncate text-slate-600 text-[11px]" title={child.description}>
                                            {child.description}
                                          </div>
                                        </td>
                                        <td className="px-4 py-2.5">
                                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                                            {child.stageName}
                                          </span>
                                        </td>
                                        <td className="px-4 py-2.5 text-right font-medium text-slate-600">
                                          {money(child.fundingTotal)}
                                        </td>
                                        <td className="px-4 py-2.5 text-right font-bold text-blue-700">
                                          {money(child.componentCostTotal)}
                                        </td>
                                        <td className="px-4 py-2.5">
                                          <span
                                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                              child.isPublished
                                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                : 'bg-slate-100 text-slate-600'
                                            }`}
                                          >
                                            {child.isPublished ? 'Published' : 'Draft / Unpub'}
                                          </span>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="sticky top-0 z-10 bg-slate-50 text-slate-600 uppercase font-bold text-[10px]">
                <tr>
                  <th className="px-4 py-3">Project Title & ID</th>
                  <th className="px-4 py-3">Stage</th>
                  <th className="px-4 py-3">Region</th>
                  {type === 'publication' ? (
                    <th className="px-4 py-3">Publication State</th>
                  ) : (
                    <th className="px-4 py-3">Funding Source</th>
                  )}
                  <th className="px-4 py-3 text-right">Allocated FY Budget</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {projects.map((project) => (
                  <tr
                    key={project.id}
                    onClick={() => onOpenProject(project)}
                    className="cursor-pointer hover:bg-slate-50 transition-colors"
                    aria-label={`Open project ${project.projectId}`}
                  >
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1 font-bold text-slate-900 font-mono">
                        {project.projectId}
                        <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5 text-blue-600" />
                      </div>
                      <div className="max-w-md truncate text-slate-600 text-[11px]" title={project.description}>
                        {project.description}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
                        {project.stageName}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-slate-700">{project.region}</td>
                    {type === 'publication' ? (
                      <td className="px-4 py-3.5">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                            project.isPublished
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {project.isPublished ? 'Published' : 'Not published'}
                        </span>
                      </td>
                    ) : (
                      <td className="px-4 py-3.5 text-slate-600">{project.fundingSource}</td>
                    )}
                    <td className="px-4 py-3.5 text-right font-black text-slate-900">
                      {money(project.allocatedBudget)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {((type === 'lswallet' && lsProjects.length === 0) ||
            (type !== 'lswallet' && projects.length === 0)) && (
            <div className="py-12 text-center text-sm text-slate-400">
              No contributing records exist for this fiscal year.
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex justify-between items-center border-t border-slate-100 bg-slate-50 px-6 py-4">
          <span className="text-xs text-slate-500">
            Click any row to browse and inspect active records in the Project Repository.
          </span>
          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors shadow-xs"
            >
              Close
            </button>
            <button
              onClick={() => onOpenProject(projects[0])}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 transition-colors shadow-md"
            >
              <span>Project Repository</span>
              <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5 text-slate-400" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardKpiDetailModal;
