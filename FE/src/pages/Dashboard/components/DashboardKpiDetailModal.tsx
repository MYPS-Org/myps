import React, { useEffect, useState } from 'react';
import { ArrowTopRightOnSquareIcon, CalculatorIcon, ChevronDownIcon, ChevronRightIcon, XMarkIcon } from '@heroicons/react/24/outline';
import type { WatchlistProject } from './ProjectQuickDetailModal';

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
  projects: WatchlistProject[];
  lsProjects: DashboardLsProject[];
  onClose: () => void;
  onOpenProject: (project: WatchlistProject) => void;
  onOpenLsProject: (project: DashboardLsProject) => void;
}

const money = (value: number) => new Intl.NumberFormat('en-PH', {
  style: 'currency', currency: 'PHP', maximumFractionDigits: 2,
}).format(value);

const DashboardKpiDetailModal: React.FC<Props> = ({ type, selectedYear, projects, lsProjects, onClose, onOpenProject, onOpenLsProject }) => {
  const [expandedLsIds, setExpandedLsIds] = useState<Set<number>>(new Set());
  useEffect(() => {
    if (!type) return undefined;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, type]);

  if (!type) return null;

  const totalBudget = projects.reduce((sum, project) => sum + project.allocatedBudget, 0);
  const published = projects.filter((project) => project.isPublished).length;
  const publicationRate = projects.length ? published / projects.length * 100 : 0;
  const lsItemized = lsProjects.reduce((sum, project) => sum + project.itemizedAmount, 0);
  const lsAllocation = lsProjects.reduce((sum, project) => sum + project.totalAllocation, 0);
  const lsUtilization = lsAllocation ? lsItemized / lsAllocation * 100 : 0;

  const config = {
    budget: {
      title: `FY ${selectedYear} Infrastructure Budget`,
      tally: money(totalBudget),
      count: `${projects.length.toLocaleString()} contributing project(s)`,
      formula: 'Sum of non-deleted component-cost-per-year amounts where the cost year equals the selected fiscal year. Amounts are grouped once per latest project revision.',
    },
    projects: {
      title: `Projects in FY ${selectedYear}`,
      tally: projects.length.toLocaleString(),
      count: 'costed project records',
      formula: 'Count of visible latest project revisions that have at least one non-deleted component-cost-per-year record in the selected fiscal year.',
    },
    lswallet: {
      title: `FY ${selectedYear} LS Itemized Amount`,
      tally: money(lsItemized),
      count: `${lsProjects.length.toLocaleString()} Lump Sum project(s) · ${lsUtilization.toFixed(1)}% of ${money(lsAllocation)}`,
      formula: 'Sum of each Lump Sum project’s persisted Itemized Total. Utilization is Itemized Amount ÷ Original Allocation × 100.',
    },
    publication: {
      title: `FY ${selectedYear} Publication Rate`,
      tally: `${publicationRate.toFixed(1)}%`,
      count: `${published.toLocaleString()} published of ${projects.length.toLocaleString()} project(s)`,
      formula: 'Published projects ÷ all visible costed projects in the selected fiscal year × 100. Publication state comes from the persisted project record.',
    },
  }[type];

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4" role="dialog" aria-modal="true" aria-labelledby="dashboard-kpi-title" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-gray-100 px-6 py-5">
          <div>
            <h2 id="dashboard-kpi-title" className="text-xl font-bold text-gray-900">{config.title}</h2>
            <div className="mt-2 flex flex-wrap items-baseline gap-3">
              <span className="text-3xl font-extrabold text-gray-900">{config.tally}</span>
              <span className="text-sm text-gray-500">{config.count}</span>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700" aria-label="Close KPI details"><XMarkIcon className="h-5 w-5" /></button>
        </div>

        <div className="mx-6 mt-5 flex gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
          <CalculatorIcon className="mt-0.5 h-5 w-5 shrink-0 text-gray-400" />
          <div><strong>How this is calculated:</strong> {config.formula}</div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-6 pb-5">
          {type === 'lswallet' ? (
            <table className="min-w-full divide-y divide-gray-100 text-left text-xs">
              <thead className="sticky top-0 z-10 bg-gray-50 text-gray-500"><tr><th className="px-4 py-3">Lump Sum project</th><th className="px-4 py-3">Stage</th><th className="px-4 py-3 text-right">Original allocation</th><th className="px-4 py-3 text-right">Itemized</th><th className="px-4 py-3 text-right">Remaining</th></tr></thead>
              <tbody className="divide-y divide-gray-100">
                {lsProjects.map((project) => {
                  const expanded = expandedLsIds.has(project.id);
                  return (
                    <React.Fragment key={project.id}>
                      <tr
                        onClick={() => onOpenLsProject(project)}
                        onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onOpenLsProject(project); }}
                        tabIndex={0}
                        className="cursor-pointer bg-white hover:bg-gray-50 focus:bg-gray-50 focus:outline-none"
                        aria-label={`Open Lump Sum project ${project.projectId}`}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-start gap-2">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                setExpandedLsIds((current) => {
                                  const next = new Set(current);
                                  if (next.has(project.id)) next.delete(project.id); else next.add(project.id);
                                  return next;
                                });
                              }}
                              onKeyDown={(event) => event.stopPropagation()}
                              className="mt-0.5 rounded p-0.5 text-gray-500 hover:bg-gray-100"
                              aria-expanded={expanded}
                              aria-label={`${expanded ? 'Collapse' : 'Expand'} itemized projects for ${project.projectId}`}
                            >
                              {expanded ? <ChevronDownIcon className="h-4 w-4" /> : <ChevronRightIcon className="h-4 w-4" />}
                            </button>
                            <div>
                              <div className="flex items-center gap-1 font-bold text-gray-900">{project.projectId}<ArrowTopRightOnSquareIcon className="h-3.5 w-3.5 text-gray-400" /></div>
                              <div className="max-w-xs truncate text-gray-500">{project.description}</div>
                              <div className="mt-1 text-[11px] text-gray-500">{project.children.length} itemized project(s) · expand to view</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">{project.stageName}</td>
                        <td className="px-4 py-3 text-right">{money(project.totalAllocation)}</td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-900">{money(project.itemizedAmount)}</td>
                        <td className="px-4 py-3 text-right">{money(project.remainingAmount)}</td>
                      </tr>
                      {expanded && (
                        <tr className="bg-gray-50">
                          <td colSpan={5} className="px-8 py-4">
                            {project.children.length === 0 ? (
                              <p className="text-sm text-gray-500">No itemized projects are recorded for this Lump Sum project.</p>
                            ) : (
                              <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
                                <table className="min-w-full divide-y divide-gray-100 text-xs">
                                  <thead className="bg-gray-100 text-gray-500"><tr><th className="px-4 py-2 text-left">Itemized project</th><th className="px-4 py-2 text-left">Stage</th><th className="px-4 py-2 text-right">Funding</th><th className="px-4 py-2 text-right">Component cost</th><th className="px-4 py-2 text-left">Publish to PCMA</th></tr></thead>
                                  <tbody className="divide-y divide-gray-100">
                                    {project.children.map((child) => (
                                      <tr key={child.id} className="cursor-default">
                                        <td className="px-4 py-2"><div className="font-semibold text-gray-900">{child.projectId}</div><div className="max-w-sm truncate text-gray-500">{child.description}</div></td>
                                        <td className="px-4 py-2">{child.stageName}</td>
                                        <td className="px-4 py-2 text-right">{money(child.fundingTotal)}</td>
                                        <td className="px-4 py-2 text-right font-semibold">{money(child.componentCostTotal)}</td>
                                        <td className="px-4 py-2">{child.isPublished ? 'Published' : 'Not published'}</td>
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
            <table className="min-w-full divide-y divide-gray-100 text-left text-xs">
              <thead className="sticky top-0 z-10 bg-gray-50 text-gray-500"><tr><th className="px-4 py-3">Project</th><th className="px-4 py-3">Stage</th><th className="px-4 py-3">Region</th>{type === 'publication' ? <th className="px-4 py-3">Publication state</th> : <th className="px-4 py-3">Funding source</th>}<th className="px-4 py-3 text-right">FY amount</th></tr></thead>
              <tbody className="divide-y divide-gray-100">
                {projects.map((project) => <tr key={project.id} onClick={() => onOpenProject(project)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onOpenProject(project); }} tabIndex={0} className="cursor-pointer hover:bg-gray-50 focus:bg-gray-50 focus:outline-none" aria-label={`Open project ${project.projectId}`}><td className="px-4 py-3"><div className="flex items-center gap-1 font-bold text-gray-900">{project.projectId}<ArrowTopRightOnSquareIcon className="h-3.5 w-3.5 text-gray-400" /></div><div className="max-w-xs truncate text-gray-500">{project.description}</div></td><td className="px-4 py-3">{project.stageName}</td><td className="px-4 py-3">{project.region}</td>{type === 'publication' ? <td className="px-4 py-3"><span className={`rounded-full px-2 py-1 font-semibold ${project.isPublished ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}>{project.isPublished ? 'Published' : 'Not published'}</span></td> : <td className="px-4 py-3">{project.fundingSource}</td>}<td className="px-4 py-3 text-right font-semibold">{money(project.allocatedBudget)}</td></tr>)}
              </tbody>
            </table>
          )}
          {((type === 'lswallet' && lsProjects.length === 0) || (type !== 'lswallet' && projects.length === 0)) && <div className="py-12 text-center text-sm text-gray-400">No contributing records exist for this fiscal year.</div>}
        </div>

        <div className="flex justify-end border-t border-gray-100 bg-gray-50 px-6 py-4"><button onClick={onClose} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100">Close</button></div>
      </div>
    </div>
  );
};

export default DashboardKpiDetailModal;
