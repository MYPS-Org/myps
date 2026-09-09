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
import type { DashboardRevisionItem, DashboardRevisionSummary } from '../Service';

export type DashboardKpiType = 'budget' | 'projects' | 'lswallet' | 'publication' | 'revisions';

/** Status labels emitted verbatim by dbo.fRevisionQueue. */
const FOR_REVIEW = 'For Endorsement';
const FOR_APPROVAL = 'For Approval of Central Office';

/**
 * Pending buckets for the Active Portfolio modal.
 *  - forpublish: projects cleared by the GAA-R publish rules but not yet published.
 *  - review/approval: the two pending tiers of the revision queue.
 */
type ProjectsTab = 'all' | 'forpublish' | 'published' | 'review' | 'approval';

const PROJECT_TABS: Array<{ key: ProjectsTab; label: string }> = [
  { key: 'all', label: 'All Projects' },
  { key: 'forpublish', label: 'For Publish' },
  { key: 'published', label: 'Published' },
  { key: 'review', label: 'For Review' },
  { key: 'approval', label: 'For Approval' },
];

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
  revisions?: DashboardRevisionSummary;
  onClose: () => void;
  onOpenProject: (project: WatchlistProject) => void;
  onOpenLsProject: (project: DashboardLsProject) => void;
}

// Same badge rules as the /revision list (ModifcationList.tsx) so a revision
// carries one colour across both screens.
const getRevisionStatusBadge = (statusName: string): string => {
  const name = (statusName || '').toLowerCase();
  if (name.includes('for correction')) return 'bg-red-100 text-red-800 border border-red-200';
  if (name.includes('disapproved')) return 'bg-red-600 text-white';
  if (name.includes('for approval') || name.includes('for endorsement')) return 'bg-yellow-100 text-yellow-800 border border-yellow-200';
  if (name.includes('approved')) return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
  return 'bg-slate-100 text-slate-700 border border-slate-200';
};

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
  revisions,
  onClose,
  onOpenProject,
  onOpenLsProject,
}) => {
  const [expandedLsIds, setExpandedLsIds] = useState<Set<number>>(new Set());
  const [projectsTab, setProjectsTab] = useState<ProjectsTab>('all');
  // Secondary drill-downs for the revision tabs. '' means "no narrowing".
  const [officeFilter, setOfficeFilter] = useState<string>('');
  const [groupFilter, setGroupFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  // Reopening the modal on a different card must not inherit a stale drill-down.
  useEffect(() => {
    setProjectsTab('all');
    setOfficeFilter('');
    setGroupFilter('');
    setStatusFilter('');
  }, [type]);

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

  const revisionItems = revisions?.Items ?? [];
  const reviewCount = revisions?.ForReview ?? 0;
  const approvalCount = revisions?.ForApproval ?? 0;
  const pendingCount = reviewCount + approvalCount;

  // "For Publish" is the publish backlog: cleared by the GAA-R rules
  // (ProgramController.BatchAllowPublish) but not yet actually published.
  const forPublishProjects = projects.filter((project) => project.isPublishable && !project.isPublished);
  const publishedProjects = projects.filter((project) => project.isPublished);

  // Revision rows shown under the Active Portfolio tabs, narrowed by the
  // optional Implementing Office / group drill-downs.
  const revisionsForTab = (tab: ProjectsTab): DashboardRevisionItem[] => {
    const byStatus = tab === 'review'
      ? revisionItems.filter((item) => item.RevisionStatus === FOR_REVIEW)
      : tab === 'approval'
        ? revisionItems.filter((item) => item.RevisionStatus === FOR_APPROVAL)
        : revisionItems;
    return byStatus
      .filter((item) => !officeFilter || item.ImplementingOffice === officeFilter)
      .filter((item) => !groupFilter || item.CurrentStage === groupFilter)
      .filter((item) => !statusFilter || item.RevisionStatus === statusFilter);
  };

  const isRevisionTab = type === 'revisions' || (type === 'projects' && (projectsTab === 'review' || projectsTab === 'approval'));
  const visibleRevisions = isRevisionTab ? revisionsForTab(type === 'revisions' ? 'all' : projectsTab) : [];

  const visibleProjects = type !== 'projects'
    ? projects
    : projectsTab === 'forpublish'
      ? forPublishProjects
      : projectsTab === 'published'
        ? publishedProjects
        : projects;

  // Options are derived from the rows actually in scope so a drill-down can
  // never offer a value that yields an empty table.
  const officeOptions = Array.from(new Set(
    (type === 'revisions' ? revisionItems : revisionsForTab(projectsTab === 'approval' ? 'approval' : 'review'))
      .map((item) => item.ImplementingOffice)
  )).sort();
  const groupOptions = Array.from(new Set(revisionItems.map((item) => item.CurrentStage))).sort();

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
      tally: projectsTab === 'forpublish'
        ? forPublishProjects.length.toLocaleString()
        : projectsTab === 'published'
          ? publishedProjects.length.toLocaleString()
          : projectsTab === 'review'
            ? reviewCount.toLocaleString()
            : projectsTab === 'approval'
              ? approvalCount.toLocaleString()
              : activeCount.toLocaleString(),
      count: projectsTab === 'forpublish'
        ? 'cleared to publish, not yet published'
        : projectsTab === 'published'
          ? 'already published'
          : projectsTab === 'review'
            ? 'awaiting Regional Office (RPC) endorsement'
            : projectsTab === 'approval'
              ? 'awaiting Central Office (AUC) approval'
              : 'costed project records',
      formula: projectsTab === 'forpublish'
        ? 'Projects flagged IsPublishable by the GAA-R publish rules but still IsPublished = false. Both flags are read from the persisted project record.'
        : projectsTab === 'published'
          ? 'Projects whose persisted record has IsPublished = true for the selected fiscal year.'
          : projectsTab === 'review' || projectsTab === 'approval'
            ? 'Rows from dbo.fRevisionQueue, the same table-valued function behind the /revision page. The queue is already scoped to your user groups: it returns revisions you created, plus the RO tier if you belong to RPC and the CO tier if you belong to AUC.'
            : 'Count of visible latest project revisions that have at least one non-deleted component-cost-per-year record in the selected fiscal year.',
    },
    revisions: {
      title: `Revision Queue for FY ${selectedYear}`,
      tally: pendingCount.toLocaleString(),
      count: `${(revisions?.Total ?? 0).toLocaleString()} revision(s) visible to you`,
      formula:
        'Rows from dbo.fRevisionQueue -- the exact source behind the /revision page -- so this box can never disagree with that list. Implementing Office is resolved through vAdminImplementingOffice, the same view that fills the Implementing Office dropdown on project details.',
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

        {/* Pending-list tabs (Active Portfolio Projects only) */}
        {type === 'projects' && (
          <div className="mx-6 mt-4 flex flex-wrap gap-1.5 border-b border-slate-200 pb-2">
            {PROJECT_TABS.map((tab) => {
              const tabCount =
                tab.key === 'all' ? projects.length
                : tab.key === 'forpublish' ? forPublishProjects.length
                : tab.key === 'published' ? publishedProjects.length
                : tab.key === 'review' ? reviewCount
                : approvalCount;
              const active = projectsTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => {
                    setProjectsTab(tab.key);
                    setOfficeFilter('');
                    setGroupFilter('');
                  }}
                  aria-pressed={active}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                    active
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {tab.label}
                  <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] ${
                    active ? 'bg-white/20 text-white' : 'bg-white text-slate-500'
                  }`}>
                    {tabCount.toLocaleString()}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Revision drill-downs: by Implementing Office and by user group */}
        {isRevisionTab && (
          <div className="mx-6 mt-3 flex flex-wrap items-center gap-2 text-xs">
            <label className="font-bold text-slate-500 uppercase tracking-wide text-[10px]">
              Implementing Office
            </label>
            <select
              value={officeFilter}
              onChange={(event) => setOfficeFilter(event.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700"
            >
              <option value="">All offices</option>
              {officeOptions.map((office) => (
                <option key={office} value={office}>{office}</option>
              ))}
            </select>

            <label className="ml-2 font-bold text-slate-500 uppercase tracking-wide text-[10px]">
              User Group
            </label>
            <select
              value={groupFilter}
              onChange={(event) => setGroupFilter(event.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700"
            >
              <option value="">All groups</option>
              {groupOptions.map((group) => (
                <option key={group} value={group}>{group}</option>
              ))}
            </select>

            {type === 'revisions' && (
              <>
                <label className="ml-2 font-bold text-slate-500 uppercase tracking-wide text-[10px]">
                  Status
                </label>
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700"
                >
                  <option value="">All statuses</option>
                  {(revisions?.ByStatus ?? []).map((status) => (
                    <option key={status.Name} value={status.Name}>
                      {status.Name} ({status.Count})
                    </option>
                  ))}
                </select>
              </>
            )}

            {(officeFilter || groupFilter || statusFilter) && (
              <button
                onClick={() => { setOfficeFilter(''); setGroupFilter(''); setStatusFilter(''); }}
                className="ml-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Clear
              </button>
            )}
            <span className="ml-auto font-semibold text-slate-500">
              {visibleRevisions.length.toLocaleString()} shown
            </span>
          </div>
        )}

        {/* Content Table */}
        <div className="min-h-0 flex-1 overflow-auto px-6 py-4">
          {isRevisionTab ? (
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="sticky top-0 z-10 bg-slate-50 text-slate-600 uppercase font-bold text-[10px]">
                <tr>
                  <th className="px-4 py-3">Transaction &amp; Project</th>
                  <th className="px-4 py-3">Revision Type</th>
                  <th className="px-4 py-3">Implementing Office</th>
                  <th className="px-4 py-3">Holding Group</th>
                  <th className="px-4 py-3 whitespace-nowrap">Status</th>
                  <th className="px-4 py-3 text-right">Age</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleRevisions.map((revision) => (
                  <tr key={revision.Id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="font-bold text-slate-900 font-mono">{revision.TransactionId}</div>
                      <div className="max-w-md truncate text-slate-600 text-[11px]" title={revision.RevisionReason}>
                        {revision.RevisionReason}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-slate-700">{revision.RevisionType}</td>
                    <td className="px-4 py-3.5 text-slate-700">{revision.ImplementingOffice}</td>
                    <td className="px-4 py-3.5">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-800 border border-slate-200">
                        {revision.CurrentStage}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-[10px] font-bold ${getRevisionStatusBadge(revision.RevisionStatus)}`}>
                        {revision.RevisionStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right font-semibold text-slate-700">
                      {revision.Age} day{revision.Age === 1 ? '' : 's'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : type === 'lswallet' ? (
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
                {visibleProjects.map((project) => (
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

          {((isRevisionTab && visibleRevisions.length === 0) ||
            (!isRevisionTab && type === 'lswallet' && lsProjects.length === 0) ||
            (!isRevisionTab && type !== 'lswallet' && visibleProjects.length === 0)) && (
            <div className="py-12 text-center text-sm text-slate-400">
              {isRevisionTab
                ? 'No revisions match this filter. The revision queue only returns rows you created, plus the RO tier if you are in RPC and the CO tier if you are in AUC.'
                : 'No contributing records exist for this fiscal year.'}
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
              onClick={() => visibleProjects[0] && onOpenProject(visibleProjects[0])}
              disabled={visibleProjects.length === 0}
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
