import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowTopRightOnSquareIcon,
  FolderOpenIcon,
  XMarkIcon,
  MapPinIcon,
  BanknotesIcon,
  BuildingOffice2Icon,
} from '@heroicons/react/24/outline';

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

const money = (value: number) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 2,
  }).format(value);

const ProjectQuickDetailModal: React.FC<Props> = ({ project, onClose }) => {
  const navigate = useNavigate();

  useEffect(() => {
    if (!project) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, project]);

  if (!project) return null;

  const handleNavigateRepository = () => {
    onClose();
    navigate('/projects');
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dashboard-project-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl border border-slate-200">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5 bg-gradient-to-r from-slate-50 to-white">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="rounded-full bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-xs font-bold text-blue-700">
                {project.stageName} Stage
              </span>
              {project.isPublished && (
                <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
                  Published
                </span>
              )}
              {project.isRevised && (
                <span className="rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-xs font-bold text-amber-700">
                  Revised
                </span>
              )}
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                {project.island} Group
              </span>
            </div>
            <h2 id="dashboard-project-title" className="mt-2.5 text-xl font-black text-slate-900 font-mono tracking-tight">
              {project.projectId}
            </h2>
            <p className="mt-1 text-xs text-slate-600 font-medium leading-relaxed">
              {project.description}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            aria-label="Close project quick view"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Content Details Grid */}
        <div className="grid grid-cols-1 gap-4 px-6 py-5 sm:grid-cols-2 text-xs">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <BuildingOffice2Icon className="w-3.5 h-3.5 text-slate-500" />
              Program & Scope
            </div>
            <div className="mt-1 font-bold text-slate-800 text-xs">
              {project.programName || 'National Infrastructure Program'}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <MapPinIcon className="w-3.5 h-3.5 text-slate-500" />
              Region / Jurisdiction
            </div>
            <div className="mt-1 font-bold text-slate-800 text-xs">
              {project.region} ({project.island})
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Infrastructure Category
            </div>
            <div className="mt-1 font-semibold text-slate-800 text-xs">
              {project.category || 'Roads, Bridges & Flood Mitigations'}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Implementing Office
            </div>
            <div className="mt-1 font-semibold text-slate-800 text-xs">
              {project.implementingOffice || `${project.region} Regional Office`}
            </div>
          </div>

          {/* Allocation Box */}
          <div className="sm:col-span-2 rounded-xl bg-gradient-to-r from-blue-50 via-slate-50 to-amber-50/40 p-4 border border-blue-100 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-blue-900 flex items-center gap-1">
                <BanknotesIcon className="w-3.5 h-3.5 text-blue-600" />
                FY Regional Allocation Outlay
              </div>
              <div className="mt-1 text-2xl font-black text-slate-900 tracking-tight">
                {money(project.allocatedBudget)}
              </div>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-600 text-white shadow-xs">
              {project.stageName} Schedule
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center border-t border-slate-100 bg-slate-50 px-6 py-4">
          <span className="text-xs text-slate-500">
            Access project records in the Project Repository.
          </span>
          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors shadow-xs"
            >
              Close
            </button>
            <button
              onClick={handleNavigateRepository}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 transition-colors shadow-md"
            >
              <FolderOpenIcon className="h-4 w-4 text-amber-400" />
              <span>Project Repository</span>
              <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5 text-slate-400" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectQuickDetailModal;
