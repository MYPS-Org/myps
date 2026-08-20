import { Dialog, DialogTitle, DialogPanel } from '@headlessui/react';
import {
  ArrowUpTrayIcon,
  DocumentArrowUpIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
  CheckCircleIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { Button } from '../../../components/tailwindui/button';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ImportJobStatus } from '../Model.d';
import { startImportProjectJob, getImportJobStatus } from '../Service';
import { useToast } from '../../../components/toaster/ToasterContext';

interface ImportProjectsJobDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onImported: () => void;
  programId: string;
  programName: string;
  stageName: string;
}

type Phase = 'idle' | 'submitting' | 'polling' | 'done';

const ACCEPTED_EXTENSIONS = ['xlsx', 'xlsm'];
const POLL_INTERVAL_MS = 2500;

const isTerminalStatus = (status: ImportJobStatus['Status']) =>
  status === 'Completed' || status === 'CompletedWithErrors' || status === 'Failed' || status === 'Cancelled';

const ImportProjectsJobDialog: React.FC<ImportProjectsJobDialogProps> = ({
  isOpen,
  onClose,
  onImported,
  programId,
  programName,
  stageName,
}) => {
  const { showToast } = useToast();
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [jobStatus, setJobStatus] = useState<ImportJobStatus | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const notifiedRef = useRef(false);

  const clearPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  useEffect(() => clearPolling, [clearPolling]);

  const resetState = () => {
    clearPolling();
    setDragging(false);
    setFileName(null);
    setPhase('idle');
    setJobStatus(null);
    notifiedRef.current = false;
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const pollJobStatus = useCallback((jobId: string) => {
    pollTimerRef.current = setInterval(async () => {
      try {
        const response = await getImportJobStatus(jobId);
        setJobStatus(response.Data);

        if (isTerminalStatus(response.Data.Status)) {
          clearPolling();
          setPhase('done');
          if (!notifiedRef.current && (response.Data.Status === 'Completed' || response.Data.Status === 'CompletedWithErrors')) {
            notifiedRef.current = true;
            onImported();
          }
        }
      } catch {
        clearPolling();
        setPhase('idle');
      }
    }, POLL_INTERVAL_MS);
  }, [clearPolling, onImported]);

  const processFile = useCallback(async (file: File) => {
    const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!ACCEPTED_EXTENSIONS.includes(extension)) {
      showToast({ type: 'error', message: 'Only .xlsx or .xlsm files are accepted.' });
      return;
    }

    setFileName(file.name);
    setPhase('submitting');

    try {
      const jobResponse = await startImportProjectJob({
        ProgramId: programId,
        StageName: stageName,
        File: file,
      });

      setPhase('polling');
      pollJobStatus(jobResponse.Data.JobId);
    } catch {
      // httpClient interceptor already toasted the API error (e.g. "Import In Progress")
      setPhase('idle');
    }
  }, [programId, stageName, pollJobStatus, showToast]);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragging(false);
      if (phase !== 'idle') return;
      const file = e.dataTransfer.files?.[0];
      if (file) processFile(file);
    },
    [phase, processFile],
  );

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  };

  const busy = phase === 'submitting' || phase === 'polling';
  const hasErrors = (jobStatus?.ErrorCount ?? 0) > 0;
  const isTerminal = jobStatus ? isTerminalStatus(jobStatus.Status) : false;

  return (
    <Dialog open={isOpen} onClose={handleClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />

      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="mx-auto max-w-2xl w-full rounded-lg bg-white shadow-xl flex flex-col max-h-[90vh]">

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <DialogTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <DocumentArrowUpIcon className="h-6 w-6 text-blue-600" />
              Import Projects
            </DialogTitle>
            <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">

            {/* Program info */}
            <div className="bg-blue-50 border border-blue-100 rounded-md px-4 py-2 text-sm text-blue-800">
              <span className="font-medium">Program:</span> {programName}
              {programId && <span className="ml-3 text-blue-500 text-xs">({programId})</span>}
            </div>

            {/* Drop zone */}
            {phase === 'idle' && (
              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`
                  relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
                  ${dragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'}
                `}
              >
                <input ref={fileInputRef} type="file" accept=".xlsx,.xlsm" className="hidden" onChange={handleFileInput} />
                <ArrowUpTrayIcon className="mx-auto h-10 w-10 text-gray-400 mb-2" />
                <p className="text-sm font-medium text-gray-700">Drag & drop your importation file here</p>
                <p className="text-xs text-gray-500 mt-1">Accepts .xlsx / .xlsm</p>
              </div>
            )}

            {/* Progress */}
            {busy && (
              <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
                <ArrowPathIcon className="h-8 w-8 text-blue-500 animate-spin" />
                <p className="text-sm font-medium text-gray-700">
                  {phase === 'submitting' && `Uploading ${fileName}…`}
                  {phase === 'polling' && (jobStatus?.Status === 'Processing' ? 'Processing import…' : 'Waiting in queue…')}
                </p>
                {jobStatus?.Message && <p className="text-xs text-gray-500">{jobStatus.Message}</p>}
              </div>
            )}

            {/* Terminal result */}
            {phase === 'done' && jobStatus && (
              <div className="space-y-4">
                <div className={`flex items-start gap-2 text-sm rounded px-4 py-3 border ${
                  jobStatus.Status === 'Completed'
                    ? 'text-emerald-700 bg-emerald-50 border-emerald-100'
                    : jobStatus.Status === 'CompletedWithErrors'
                      ? 'text-amber-700 bg-amber-50 border-amber-200'
                      : 'text-red-700 bg-red-50 border-red-100'
                }`}>
                  {jobStatus.Status === 'Completed'
                    ? <CheckCircleIcon className="h-5 w-5 flex-shrink-0" />
                    : <ExclamationTriangleIcon className="h-5 w-5 flex-shrink-0 mt-0.5" />}
                  <div>
                    <p className="font-medium">{jobStatus.Status}</p>
                    {jobStatus.Message && <p className="text-xs mt-0.5">{jobStatus.Message}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-emerald-50 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-emerald-600">{jobStatus.ValidCount}</p>
                    <p className="text-xs text-gray-600 mt-1">Valid</p>
                  </div>
                  <div className="bg-amber-50 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-amber-600">{jobStatus.WarningCount}</p>
                    <p className="text-xs text-gray-600 mt-1">Warnings</p>
                  </div>
                  <div className={`${hasErrors ? 'bg-red-50' : 'bg-gray-50'} rounded-lg p-4 text-center`}>
                    <p className={`text-2xl font-bold ${hasErrors ? 'text-red-600' : 'text-gray-400'}`}>{jobStatus.ErrorCount}</p>
                    <p className="text-xs text-gray-600 mt-1">Errors</p>
                  </div>
                </div>

                {(jobStatus.TextFileUrl || jobStatus.ExcelFileUrl) && (
                  <div className="flex flex-wrap gap-3">
                    {jobStatus.TextFileUrl && (
                      <a
                        href={jobStatus.TextFileUrl}
                        className="text-sm text-blue-600 underline hover:text-blue-800"
                      >
                        Download report (.txt)
                      </a>
                    )}
                    {jobStatus.ExcelFileUrl && (
                      <a
                        href={jobStatus.ExcelFileUrl}
                        className="text-sm text-blue-600 underline hover:text-blue-800"
                      >
                        Download error report (.xlsx)
                      </a>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-lg">
            {isTerminal ? (
              <>
                <Button color="zinc" onClick={resetState}>Import Another</Button>
                <Button color="blue" onClick={handleClose}>Close</Button>
              </>
            ) : (
              <Button color="zinc" onClick={handleClose} disabled={busy}>Cancel</Button>
            )}
          </div>

        </DialogPanel>
      </div>
    </Dialog>
  );
};

export default ImportProjectsJobDialog;
