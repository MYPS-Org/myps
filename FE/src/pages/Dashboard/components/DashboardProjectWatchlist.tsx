import React, { useMemo } from 'react';
import { ArrowRightIcon, EyeIcon, FolderOpenIcon } from '@heroicons/react/24/outline';
import type { WatchlistProject } from './ProjectQuickDetailModal';

interface Props {
  projects: WatchlistProject[];
  activeStatusFilter?: string | null;
  onSelectProject: (project: WatchlistProject) => void;
  onViewAll: () => void;
}

const money = (value: number) => new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  notation: 'compact',
  maximumFractionDigits: 2,
}).format(value);

const DashboardProjectWatchlist: React.FC<Props> = ({ projects, activeStatusFilter, onSelectProject, onViewAll }) => {
  const shown = useMemo(
    () => projects.filter((project) => !activeStatusFilter || project.stageName === activeStatusFilter).slice(0, 10),
    [activeStatusFilter, projects],
  );

  return (
    <section className="bg-white shadow-sm ring-1 ring-gray-900/5 rounded-xl">
      <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5">
        <div>
          <h3 className="flex items-center gap-2 text-base font-semibold text-gray-900">
            <FolderOpenIcon className="h-5 w-5 text-gray-400" />
            FY project watchlist
          </h3>
          <p className="mt-1 text-xs text-gray-500">
            {activeStatusFilter ? `Showing ${activeStatusFilter} projects` : 'Highest-budget persisted projects for the selected year'}
          </p>
        </div>
        <button onClick={onViewAll} className="flex items-center gap-1 text-xs font-semibold text-gray-600 hover:text-gray-900">
          View repository <ArrowRightIcon className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-100 text-left text-xs">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="px-6 py-3 font-semibold">Project</th>
              <th className="px-4 py-3 font-semibold">Stage</th>
              <th className="px-4 py-3 font-semibold">Region</th>
              <th className="px-4 py-3 text-right font-semibold">FY budget</th>
              <th className="px-6 py-3 text-right font-semibold">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {shown.map((project) => (
              <tr key={project.id} className="hover:bg-gray-50">
                <td className="max-w-sm px-6 py-4">
                  <div className="font-bold text-gray-900">{project.projectId}</div>
                  <div className="mt-0.5 truncate text-gray-500" title={project.description}>{project.description}</div>
                </td>
                <td className="px-4 py-4">
                  <span className="inline-flex rounded-full bg-gray-100 px-2 py-1 font-semibold text-gray-700">{project.stageName}</span>
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-gray-600">{project.region || 'Not recorded'}</td>
                <td className="whitespace-nowrap px-4 py-4 text-right font-semibold text-gray-900">{money(project.allocatedBudget)}</td>
                <td className="px-6 py-4 text-right">
                  <button onClick={() => onSelectProject(project)} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 font-semibold text-gray-600 hover:bg-gray-100" aria-label={`Quick view ${project.projectId}`}>
                    <EyeIcon className="h-4 w-4" /> Quick view
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {shown.length === 0 && (
          <div className="px-6 py-12 text-center text-sm text-gray-400">No projects match this fiscal year and stage.</div>
        )}
      </div>
    </section>
  );
};

export default DashboardProjectWatchlist;
