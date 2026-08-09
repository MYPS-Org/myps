import React, { useState } from 'react';
import { ChevronDownIcon, Cog6ToothIcon } from '@heroicons/react/24/outline';
import { useToast } from '../../../../components/toaster/ToasterContext';
import { downloadAIPReport, exportProjects, importProjects } from '../../Service';
import type { AIPReportParams, TableEnum } from '../../Model';
import type { ImportedProject } from '../../../Project/Model.d';
import { transformImportedProjects } from '../../../Project/utils/transformImportedProjects';
import AIPReportDialog from '../../dialogs/AIPReportDialog';
import ExportConfirmDialog from '../../dialogs/ExportConfirmDialog';
import ImportProjectsDialog from '../../dialogs/ImportProjectsDialog';

interface ActionsDropdownProps {
  programId: string;
  programName: string;
  stageName: string;
  stageId: number;
  stages?: TableEnum[];
  onRefresh: () => Promise<void>;
  onLoadingChange: (loading: boolean) => void;
}

const ActionsDropdown: React.FC<ActionsDropdownProps> = ({
  programId,
  programName,
  stageName,
  stageId,
  stages = [],
  onRefresh,
  onLoadingChange,
}) => {
  const { showToast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [isAIPDialogOpen, setIsAIPDialogOpen] = useState(false);

  const handleDownloadTemplate = () => {
    const templateUrl = '/api/Resources/Templates/ImportProjectTemplate.xlsm';
    const link = document.createElement('a');
    link.href = templateUrl;
    link.download = 'ImportProjectTemplate.xlsm';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast({
      type: 'success',
      message: 'Template download initiated.',
    });
    setIsOpen(false);
  };

  const handleImportProjects = () => {
    setIsImportDialogOpen(true);
    setIsOpen(false);
  };

  const handleImportProjectsSubmit = async (projects: ImportedProject[]) => {
    try {
      onLoadingChange(true);

      const transformed = transformImportedProjects(projects, programId, stageName);

      console.group('[Import Projects — Exact API Payload → /Importing/ImportProject/]');
      console.log('programDetails:',       transformed.programDetails);
      console.log('projectDetails:',       transformed.projectDetails);
      console.log('fundingProfile:',       transformed.fundingProfile);
      console.log('componentCosts:',       transformed.componentCosts);
      console.log('componentCostPerYear:', transformed.componentCostPerYear);
      console.log('majorItemOfWorks:',     transformed.majorItemOfWorks);
      console.log('majorItemLocations:',   transformed.majorItemLocations);
      console.log('── Full JSON ──', JSON.stringify(transformed, null, 2));
      console.groupEnd();

      await importProjects(transformed);
      showToast({
        type: 'success',
        message: `Payload built for ${transformed.projectDetails.length} project${transformed.projectDetails.length !== 1 ? 's' : ''}. Check console for full JSON.`,
      });

      await onRefresh();
    } catch (error) {
      console.error('Error importing projects:', error);
      showToast({
        type: 'error',
        message: 'Failed to import projects. Please try again.',
      });
    } finally {
      onLoadingChange(false);
    }
  };

  const handleExportProjects = () => {
    setIsExportDialogOpen(true);
    setIsOpen(false);
  };

  const handleConfirmExportProjects = async () => {
    try {
      onLoadingChange(true);
      const { blob, filename } = await exportProjects(programId, stageName);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      showToast({
        type: 'success',
        message: 'Projects exported successfully.',
      });
    } catch (error) {
      console.error('Error exporting projects:', error);
      showToast({
        type: 'error',
        message: 'Failed to export projects. Please try again.',
      });
    } finally {
      onLoadingChange(false);
    }
  };

  const handleViewAIP = () => {
    setIsAIPDialogOpen(true);
    setIsOpen(false);
  };

  const handleGenerateAIPReport = async (params: AIPReportParams) => {
    try {
      onLoadingChange(true);
      const { blob, filename } = await downloadAIPReport(params);
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
        message: `${params.ReportType} Report PDF downloaded successfully.`,
      });
      setIsAIPDialogOpen(false);
    } catch (error) {
      console.error('Error downloading report:', error);
      showToast({
        type: 'error',
        message: 'Failed to download report. Please try again.',
      });
    } finally {
      onLoadingChange(false);
    }
  };

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
                <button
                  onClick={handleDownloadTemplate}
                  className="group flex w-full items-center px-4 py-2 text-sm text-gray-700 hover:bg-blue-500 hover:text-white"
                >
                  <svg className="mr-3 h-5 w-5 text-gray-400 group-hover:text-white" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                  Download Template
                </button>
                <button
                  onClick={handleImportProjects}
                  className="group flex w-full items-center px-4 py-2 text-sm text-gray-700 hover:bg-blue-500 hover:text-white"
                >
                  <svg className="mr-3 h-5 w-5 text-gray-400 group-hover:text-white" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                  Import Projects
                </button>
                <button
                  onClick={handleExportProjects}
                  className="group flex w-full items-center px-4 py-2 text-sm text-gray-700 hover:bg-blue-500 hover:text-white"
                >
                  <svg className="mr-3 h-5 w-5 text-gray-400 group-hover:text-white" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 8.25H7.5a2.25 2.25 0 00-2.25 2.25v9a2.25 2.25 0 002.25 2.25h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25H15M9 12l3 3m0 0l3-3m-3 3V2.25" />
                  </svg>
                  Export Projects
                </button>
                <button
                  onClick={handleViewAIP}
                  className="group flex w-full items-center px-4 py-2 text-sm text-gray-700 hover:bg-blue-500 hover:text-white"
                >
                  <svg className="mr-3 h-5 w-5 text-gray-400 group-hover:text-white" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                  Generate Reports
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {isImportDialogOpen && (
        <ImportProjectsDialog
          isOpen={isImportDialogOpen}
          onClose={() => setIsImportDialogOpen(false)}
          onSubmit={handleImportProjectsSubmit}
          programId={programId}
          programName={programName}
          stageName={stageName}
        />
      )}

      {isExportDialogOpen && (
        <ExportConfirmDialog
          isOpen={isExportDialogOpen}
          onClose={() => setIsExportDialogOpen(false)}
          onConfirm={handleConfirmExportProjects}
          programName={programName}
          programId={programId}
          stageName={stageName}
        />
      )}

      {isAIPDialogOpen && (
        <AIPReportDialog
          isOpen={isAIPDialogOpen}
          onClose={() => setIsAIPDialogOpen(false)}
          onGenerate={handleGenerateAIPReport}
          programId={programId}
          programName={programName}
          stageName={stageName}
          stageId={stageId}
          stages={stages}
        />
      )}
    </>
  );
};

export default ActionsDropdown;

