import React, { useState } from 'react';
import { useSetAtom } from 'jotai';
import { useNavigate } from 'react-router-dom';
import { ChevronDownIcon, Cog6ToothIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { useToast } from '../../../../components/toaster/ToasterContext';
import { pendingImportJobsAtom } from '../../../../atoms/importJobs.atom';
import { useAuth } from '../../../../contexts/AuthContext';
import { downloadImportTemplate, startExportProjectsJob } from '../../Service';
import ExportConfirmDialog from '../../dialogs/ExportConfirmDialog';
import ImportProjectsJobDialog from '../../dialogs/ImportProjectsJobDialog';

interface ActionsDropdownProps {
  programId: string;
  programName: string;
  stageName: string;
  /** The Reports page lists programs by vProgramLatest.ProgramId and start year, not by ProgramPK. */
  reportProgramId: string;
  startYear: number;
  onLoadingChange: (loading: boolean) => void;
}

const ActionsDropdown: React.FC<ActionsDropdownProps> = ({
  programId,
  programName,
  stageName,
  reportProgramId,
  startYear,
  onLoadingChange,
}) => {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const { ViewAccess, can } = useAuth();
  const setPendingJobs = useSetAtom(pendingImportJobsAtom);
  const [isOpen, setIsOpen] = useState(false);
  const [importDialogMode, setImportDialogMode] = useState<'import' | 'update' | null>(null);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);

  const handleDownloadTemplate = async () => {
    setIsOpen(false);
    try {
      onLoadingChange(true);
      const { blob, filename } = await downloadImportTemplate();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      showToast({
        type: 'success',
        message: 'Template downloaded successfully.',
      });
    } catch (error) {
      console.error('Error downloading template:', error);
    } finally {
      onLoadingChange(false);
    }
  };

  const handleImportProjects = () => {
    setImportDialogMode('import');
    setIsOpen(false);
  };

  const handleUpdateProjects = () => {
    setImportDialogMode('update');
    setIsOpen(false);
  };

  const handleExportProjects = () => {
    setIsExportDialogOpen(true);
    setIsOpen(false);
  };

  // Export now runs as a Hangfire background job (same as Import/Update) instead of streaming
  // the workbook back synchronously — this only queues the job. ImportJobNotifier (mounted
  // app-wide) picks it up from pendingImportJobsAtom via SignalR and reports the result, with a
  // download link, as a toast once it completes.
  const handleConfirmExportProjects = async () => {
    try {
      onLoadingChange(true);
      const jobResponse = await startExportProjectsJob({ ProgramId: programId, StageName: stageName });
      setPendingJobs((prev) => [...prev, { jobId: jobResponse.Data.JobId, kind: 'export' }]);
      showToast({
        type: 'info',
        message: 'Export queued — you\'ll be notified here when it finishes.',
      });
    } catch (error) {
      console.error('Error exporting projects:', error);
      // httpClient interceptor already toasted the API error
    } finally {
      onLoadingChange(false);
    }
  };

  // S01-TC015-P001: reports are generated in the Reports module only (queued, with the Reports
  // page's own report types and signatories), so this opens it for this program's year, stage and
  // program instead of the old in-page AIP/RBP/RDIP dialog. Hidden from anyone who cannot open Reports.
  const canOpenReports = ViewAccess.includes('Reports');
  // 2026-10-31: each entry only for the groups the API lets do it (access matrix: Import and Export).
  const canDownloadTemplate = can('Importing', 'DownloadTemplate');
  const canImport = can('Importing', 'ImportProject');
  const canUpdate = can('Importing', 'UpdateProject');
  const canExport = can('Importing', 'ExportProjects');
  const hasAnyAction = canDownloadTemplate || canImport || canUpdate || canExport || canOpenReports;

  const handleGenerateReports = () => {
    setIsOpen(false);
    const query = new URLSearchParams({ year: String(startYear), stage: stageName, program: reportProgramId });
    navigate(`/reports?${query}`);
  };

  if (!hasAnyAction) return null;

  return (
    <>
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="inline-flex items-center gap-x-1.5 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-100 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
        >
          <Cog6ToothIcon className="-ml-0.5 h-5 w-5 text-gray-400" aria-hidden="true" />
          Actions
          <ChevronDownIcon className="-mr-1 h-5 w-5 text-gray-400" aria-hidden="true" />
        </button>

        {isOpen && (
          <>
            {/* Backdrop */}
            <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />

            {/* Import/Export Menu */}
            <div className="absolute right-0 top-full z-20 mt-2 w-56 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
              <div className="py-1">
                {canDownloadTemplate && (
                <button
                  onClick={handleDownloadTemplate}
                  className="group flex w-full items-center px-4 py-2 text-sm text-gray-700 hover:bg-blue-500 hover:text-white"
                >
                  <svg className="mr-3 h-5 w-5 text-gray-400 group-hover:text-white" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                  Download Template
                </button>
                )}
                {canImport && (
                <button
                  onClick={handleImportProjects}
                  className="group flex w-full items-center px-4 py-2 text-sm text-gray-700 hover:bg-blue-500 hover:text-white"
                >
                  <svg className="mr-3 h-5 w-5 text-gray-400 group-hover:text-white" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                  Import Projects
                </button>
                )}
                {canUpdate && (
                <button
                  onClick={handleUpdateProjects}
                  className="group flex w-full items-center px-4 py-2 text-sm text-gray-700 hover:bg-blue-500 hover:text-white"
                >
                  <ArrowPathIcon className="mr-3 h-5 w-5 text-gray-400 group-hover:text-white" aria-hidden="true" />
                  Update Projects
                </button>
                )}
                {canExport && (
                <button
                  onClick={handleExportProjects}
                  className="group flex w-full items-center px-4 py-2 text-sm text-gray-700 hover:bg-blue-500 hover:text-white"
                >
                  <svg className="mr-3 h-5 w-5 text-gray-400 group-hover:text-white" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 8.25H7.5a2.25 2.25 0 00-2.25 2.25v9a2.25 2.25 0 002.25 2.25h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25H15M9 12l3 3m0 0l3-3m-3 3V2.25" />
                  </svg>
                  Export Projects
                </button>
                )}
                {canOpenReports && (
                <button
                  onClick={handleGenerateReports}
                  className="group flex w-full items-center px-4 py-2 text-sm text-gray-700 hover:bg-blue-500 hover:text-white"
                >
                  <svg className="mr-3 h-5 w-5 text-gray-400 group-hover:text-white" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                  Generate Reports
                </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {importDialogMode && (
        <ImportProjectsJobDialog
          isOpen={!!importDialogMode}
          onClose={() => setImportDialogMode(null)}
          programId={programId}
          programName={programName}
          stageName={stageName}
          mode={importDialogMode}
        />
      )}

      {isExportDialogOpen && (
        <ExportConfirmDialog
          isOpen={isExportDialogOpen}
          onClose={() => setIsExportDialogOpen(false)}
          onConfirm={handleConfirmExportProjects}
          programName={programName}
          stageName={stageName}
        />
      )}
    </>
  );
};

export default ActionsDropdown;

