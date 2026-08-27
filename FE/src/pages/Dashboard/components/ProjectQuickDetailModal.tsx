import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowTopRightOnSquareIcon, XMarkIcon } from '@heroicons/react/24/outline';

export interface WatchlistProject {
  id: string;
  projectPK: string;
  projectId: string;
  description: string;
  programName: string;
  region: string;
  island: string;
  category: string;
  stageName: string;
  implementingOffice: string;
  fundingSource: string;
  allocatedBudget: number;
  updatedAt: string;
  isPublished: boolean;
  isPublishable: boolean;
  isRevised: boolean;
}

interface Props {
  project: WatchlistProject | null;
  onClose: () => void;
}

const money = (value: number) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value);

const ProjectQuickDetailModal: React.FC<Props> = ({ project, onClose }) => {
  const navigate = useNavigate();

  useEffect(() => {
    if (!project) return undefined;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, project]);

  if (!project) return null;

  const details = [
    ['Program', project.programName || 'Not recorded'],
    ['Category', project.category || 'Not recorded'],
    ['Region / island group', `${project.region || 'Not recorded'} / ${project.island}`],
    ['Implementing office', project.implementingOffice || 'Not recorded'],
    ['Funding source', project.fundingSource || 'Not recorded'],
    ['Last record update', project.updatedAt],
  ];

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4" role="dialog" aria-modal="true" aria-labelledby="dashboard-project-title" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-gray-100 px-6 py-5">
          <div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-700">{project.stageName}</span>
              {project.isPublished && <span className="rounded-full bg-gray-900 px-2.5 py-1 text-xs font-bold text-white">Published</span>}
              {project.isRevised && <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-700">Revised</span>}
              {!project.isPublished && project.isPublishable && <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-700">Publishable</span>}
            </div>
            <h2 id="dashboard-project-title" className="mt-3 text-xl font-bold text-gray-900">{project.projectId}</h2>
            <p className="mt-1 text-sm text-gray-600">{project.description}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700" aria-label="Close project quick view"><XMarkIcon className="h-5 w-5" /></button>
        </div>

        <div className="grid grid-cols-1 gap-x-8 gap-y-4 px-6 py-5 sm:grid-cols-2">
          {details.map(([label, value]) => <div key={label}><div className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</div><div className="mt-1 text-sm font-medium text-gray-800">{value}</div></div>)}
          <div className="sm:col-span-2 rounded-xl bg-gray-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Selected FY component cost</div>
            <div className="mt-1 text-2xl font-bold text-gray-900">{money(project.allocatedBudget)}</div>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-gray-100 bg-gray-50 px-6 py-4">
          <button onClick={onClose} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100">Close</button>
          <button onClick={() => navigate(`/projects/project-details/${encodeURIComponent(project.projectPK)}:${encodeURIComponent(project.stageName)}`)} className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800">
            Open project <ArrowTopRightOnSquareIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProjectQuickDetailModal;
