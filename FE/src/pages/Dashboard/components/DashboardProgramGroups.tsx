import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowTopRightOnSquareIcon, ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { usePagination } from '../../../hooks/usePagination';
import { PaginationBar } from '../../../components/tailwindui/PaginationBar';
import type { WatchlistProject } from './ProjectQuickDetailModal';
import {
  fetchDashboardPrograms,
  fetchDashboardProjects,
  type DashboardFilters,
  type DashboardProgram,
  type DashboardProjectsFilter,
  type DashboardPublication,
} from '../Service';

interface Props {
  year: number;
  filters: DashboardFilters;
  dataSourceMode: 'real' | 'benchmark';
  /** An Active Portfolio tab: only its published or for-publish projects. Undefined for all. */
  publication?: DashboardPublication;
  onOpenProject: (project: WatchlistProject) => void;
  /** The page a project opens: its Project ID is a real link to it, so it opens in a new tab too. */
  projectHref: (project: WatchlistProject) => string;
  /** Called with the programs once loaded, so the modal can show exact tab counts. */
  onProgramsLoaded?: (programs: DashboardProgram[]) => void;
}

const PROGRAM_PAGE_SIZE = 10;

const money = (value: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 2 }).format(value);

/** Program Details at the stage the program is read at, as the Programs list's View opens it. */
const programDetailsPath = (program: DashboardProgram) =>
  `/programs/programdetails/${encodeURIComponent(program.ProgramPK)}:${encodeURIComponent(program.StageName)}`;

/** A program's count and amount under the current tab. */
function share(program: DashboardProgram, publication?: DashboardPublication) {
  if (publication === 'published') return { count: program.PublishedCount, budget: program.PublishedBudget };
  if (publication === 'forpublish') return { count: program.ForPublishCount, budget: program.ForPublishBudget };
  return { count: program.ProjectCount, budget: program.Budget };
}

/**
 * A KPI detail's projects, program by program, the way Program Details lists them: one row per
 * program that contributes to the figure (largest FY amount first, adding up to the card), and
 * on expanding a program its counted projects with Program Details' columns and values. Each
 * program is read at one stage (the chosen Program Stage, or its current one), named as it is
 * there, and all its projects are at that stage. There is no per-project amount: a project's FY
 * share read beside its multi-year total on the project page looked like a contradiction.
 */
const DashboardProgramGroups: React.FC<Props> = ({
  year,
  filters,
  dataSourceMode,
  publication,
  onOpenProject,
  projectHref,
  onProgramsLoaded,
}) => {
  const [programs, setPrograms] = useState<DashboardProgram[] | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    let active = true;
    setLoadState('loading');
    setExpanded(new Set());
    fetchDashboardPrograms(year, dataSourceMode === 'benchmark', filters)
      .then((loaded) => {
        if (!active) return;
        setPrograms(loaded);
        setLoadState('loaded');
        onProgramsLoaded?.(loaded);
      })
      .catch(() => {
        if (active) setLoadState('error');
      });
    return () => {
      active = false;
    };
    // onProgramsLoaded is a parent callback; reloading on its identity would refetch every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, filters, dataSourceMode]);

  // A different tab shows different projects under each program, so start collapsed.
  useEffect(() => {
    setExpanded(new Set());
  }, [publication]);

  const toggle = (programPK: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(programPK)) next.delete(programPK);
      else next.add(programPK);
      return next;
    });

  if (loadState === 'loading') {
    return (
      <div className="space-y-2" aria-busy="true">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="h-14 rounded-xl bg-slate-100 animate-pulse" />
        ))}
      </div>
    );
  }
  if (loadState === 'error') {
    return <p className="py-12 text-center text-sm text-rose-600">The programs could not be loaded. Close and reopen this card to try again.</p>;
  }

  const shown = (programs ?? []).filter((program) => share(program, publication).count > 0);
  if (shown.length === 0) {
    return <p className="py-12 text-center text-sm text-slate-400">No contributing records exist for this fiscal year.</p>;
  }

  return (
    <div className="space-y-2">
      <p className="text-[11px] text-slate-500">
        {shown.length.toLocaleString()} {shown.length === 1 ? 'program' : 'programs'}, largest FY {year} amount first.
        Their amounts add up to the total above. Expand a program to see its projects.
      </p>
      {shown.map((program) => {
        const isOpen = expanded.has(program.ProgramPK);
        const { count, budget } = share(program, publication);
        return (
          <div key={program.ProgramPK} className="rounded-xl border border-slate-200 bg-white">
            {/* The whole row expands the program: the button is stretched over it. The program
                name is a link above it (a link cannot sit inside a button), opening the
                program's Program Details, at the stage shown, in a new tab. */}
            <div className="relative flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left hover:bg-slate-50 transition-colors">
              <button
                type="button"
                onClick={() => toggle(program.ProgramPK)}
                aria-expanded={isOpen}
                aria-label={`${isOpen ? 'Hide' : 'Show'} the projects of ${program.Name}`}
                className="absolute inset-0 rounded-xl"
              />
              {isOpen ? (
                <ChevronDownIcon className="h-4 w-4 shrink-0 text-slate-500" />
              ) : (
                <ChevronRightIcon className="h-4 w-4 shrink-0 text-slate-500" />
              )}
              <span className="min-w-0 flex-1">
                {dataSourceMode === 'real' ? (
                  <Link
                    to={programDetailsPath(program)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="relative z-10 inline-flex items-center gap-1 text-sm font-bold text-slate-900 break-words hover:text-blue-700 hover:underline"
                    title="Open this program's details in a new tab"
                  >
                    {program.Name}
                    <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5 shrink-0 text-blue-600" />
                  </Link>
                ) : (
                  // Demo Data programs are samples with no program behind them.
                  <span className="block text-sm font-bold text-slate-900 break-words">{program.Name}</span>
                )}
                <span className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                  <span className="whitespace-nowrap rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-800">
                    {program.StageName}
                  </span>
                  <span>
                    {count.toLocaleString()} of {Math.max(program.ProgramProjectCount, count).toLocaleString()}{' '}
                    {program.ProgramProjectCount === 1 ? 'project' : 'projects'}
                  </span>
                </span>
              </span>
              <span className="shrink-0 text-sm font-black text-slate-900">{money(budget)}</span>
            </div>
            {isOpen && (
              <ProgramProjectList
                program={program}
                year={year}
                filters={filters}
                dataSourceMode={dataSourceMode}
                publication={publication}
                onOpenProject={onOpenProject}
                projectHref={projectHref}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};

interface ListProps {
  program: DashboardProgram;
  year: number;
  filters: DashboardFilters;
  dataSourceMode: 'real' | 'benchmark';
  publication?: DashboardPublication;
  onOpenProject: (project: WatchlistProject) => void;
  projectHref: (project: WatchlistProject) => string;
}

/** Ctrl/⌘/Shift-click: the browser opens the link in a new tab or window. */
const isModifiedClick = (event: React.MouseEvent) => event.ctrlKey || event.metaKey || event.shiftKey || event.altKey;

/** One program's counted projects, a page at a time, with Program Details' columns. */
const ProgramProjectList: React.FC<ListProps> = ({
  program,
  year,
  filters,
  dataSourceMode,
  publication,
  onOpenProject,
  projectHref,
}) => {
  const fetchFn = useCallback(
    (params: Parameters<typeof fetchDashboardProjects>[0]) =>
      fetchDashboardProjects(params, year, dataSourceMode === 'benchmark', filters),
    [year, dataSourceMode, filters]
  );
  const pagination = usePagination<DashboardProjectsFilter, WatchlistProject>(fetchFn, {
    limit: PROGRAM_PAGE_SIZE,
    initialFilters: { ProgramPK: program.ProgramPK, Publication: publication },
  });
  const projects = pagination.data.lists;
  const dash = (value?: string | null) => (value && value.trim() ? value : '—');

  // The Project ID is a real link (right-click > Open link in new tab, middle-click, Ctrl/⌘-click).
  // The rest of the row follows it: a plain click opens the project here, a Ctrl/⌘ or middle
  // click opens it in a new tab, at the URL the row's link resolves to.
  const openFromRow = (event: React.MouseEvent<HTMLTableRowElement>, project: WatchlistProject) => {
    const middle = event.type === 'auxclick' && event.button === 1;
    if (middle || isModifiedClick(event)) {
      const href = event.currentTarget.querySelector('a')?.href;
      if (href) window.open(href, '_blank', 'noopener');
      return;
    }
    if (event.type === 'click') onOpenProject(project);
  };

  return (
    <div className="border-t border-slate-100 px-4 pb-3">
      <p className="pt-2 pb-1 text-[11px] text-slate-500">Largest FY {year} cost first. Click a project to open its details.</p>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-100 text-left text-xs">
          <thead className="text-[10px] font-bold uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Project ID</th>
              <th className="px-3 py-2">Description</th>
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2">SubProgram</th>
              <th className="px-3 py-2">Implementing Office</th>
              <th className="px-3 py-2">Operating Unit</th>
              <th className="px-3 py-2">Publishable</th>
              <th className="px-3 py-2">Published</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {pagination.isLoading && projects.length === 0
              ? Array.from({ length: 3 }).map((_, index) => (
                  <tr key={index}>
                    <td className="px-3 py-3" colSpan={8}>
                      <div className="h-4 rounded bg-slate-100 animate-pulse" />
                    </td>
                  </tr>
                ))
              : projects.map((project) => (
                  <tr
                    key={project.id}
                    onClick={(event) => openFromRow(event, project)}
                    onAuxClick={(event) => openFromRow(event, project)}
                    // Chrome starts middle-button auto-scroll on mousedown over this scrollable
                    // list and then never fires auxclick; cancelling it lets the middle click
                    // through. The link is left alone: its middle click is the browser's.
                    onMouseDown={(event) => {
                      if (event.button === 1 && !(event.target as HTMLElement).closest('a')) event.preventDefault();
                    }}
                    className="cursor-pointer align-top hover:bg-slate-50 transition-colors"
                    aria-label={`Open project ${project.projectId}`}
                  >
                    <td className="px-3 py-2.5">
                      <Link
                        to={projectHref(project)}
                        onClick={(event) => {
                          // The browser's own handling of a modified click opens the new tab; keep
                          // the row from also acting on it.
                          if (isModifiedClick(event)) {
                            event.stopPropagation();
                            return;
                          }
                          // A plain click is the row's, which also closes this window.
                          event.preventDefault();
                        }}
                        // Middle-click: the browser opens the link; the row must not open it again.
                        onAuxClick={(event) => event.stopPropagation()}
                        className="flex items-center gap-1 whitespace-nowrap font-mono font-bold text-slate-900 hover:text-blue-700 hover:underline"
                        title="Open project (right-click to open in a new tab)"
                      >
                        {project.projectId}
                        <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5 text-blue-600" />
                      </Link>
                    </td>
                    <td className="min-w-[14rem] max-w-md break-words px-3 py-2.5 text-slate-700">{project.description}</td>
                    <td className="px-3 py-2.5 text-slate-700">{dash(project.category)}</td>
                    <td className="px-3 py-2.5 text-slate-700">{dash(project.subProgram)}</td>
                    <td className="px-3 py-2.5 text-slate-700">{dash(project.implementingOffice)}</td>
                    <td className="px-3 py-2.5 text-slate-700">{dash(project.operatingUnit)}</td>
                    <td className="px-3 py-2.5 text-slate-700">{project.isPublishable ? 'Yes' : 'No'}</td>
                    <td className="px-3 py-2.5 text-slate-700">{project.isPublished ? 'Yes' : 'No'}</td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
      {pagination.data.totalPages > 1 && (
        <div className="pt-2">
          <PaginationBar
            currentPage={pagination.data.page}
            totalPages={pagination.data.totalPages}
            hasPrevious={pagination.hasPrevious}
            hasNext={pagination.hasNext}
            onGoToPage={pagination.goToPage}
            onNext={pagination.goNext}
            onPrevious={pagination.goPrevious}
            onFirst={pagination.goFirst}
            onLast={pagination.goLast}
            isLoading={pagination.isLoading}
          />
        </div>
      )}
    </div>
  );
};

export default DashboardProgramGroups;
