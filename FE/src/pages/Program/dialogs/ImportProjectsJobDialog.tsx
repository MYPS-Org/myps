import { Dialog, DialogTitle, DialogPanel } from '@headlessui/react';
import {
  ArrowUpTrayIcon,
  DocumentArrowUpIcon,
  XMarkIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { Button } from '../../../components/tailwindui/button';
import { useCallback, useRef, useState } from 'react';
import { useSetAtom } from 'jotai';
import { pendingImportJobsAtom } from '../../../atoms/importJobs.atom';
import { startImportProjectJob, startUpdateProjectJob } from '../Service';
import { useToast } from '../../../components/toaster/ToasterContext';

type ImportJobMode = 'import' | 'update';

interface ImportProjectsJobDialogProps {
  isOpen: boolean;
  onClose: () => void;
  programId: string;
  programName: string;
  stageName: string;
  /** 'import' (default) inserts new projects only; 'update' replaces the existing
   * project set for this Program+Stage with the file's contents. */
  mode?: ImportJobMode;
}

const ACCEPTED_EXTENSIONS = ['xlsx', 'xlsm'];

// The import/update job runs entirely in the background (Hangfire job), so this
// dialog's only job is to get the file queued. It closes itself right after that
// succeeds — ImportJobNotifier (mounted app-wide) picks up the job from there via
// SignalR and reports the result as a toast, so there's nothing left here worth
// watching for.
const ImportProjectsJobDialog: React.FC<ImportProjectsJobDialogProps> = ({
  isOpen,
  onClose,
  programId,
  programName,
  stageName,
  mode = 'import',
}) => {
  const isUpdateMode = mode === 'update';
  const { showToast } = useToast();
  const setPendingJobs = useSetAtom(pendingImportJobsAtom);
  const [dragging, setDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetAndClose = () => {
    setDragging(false);
    setFileName(null);
    onClose();
  };

  const handleClose = () => {
    if (submitting) return; // avoid closing mid-request
    resetAndClose();
  };

  const processFile = useCallback(async (file: File) => {
    const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!ACCEPTED_EXTENSIONS.includes(extension)) {
      showToast({ type: 'error', message: 'Only .xlsx or .xlsm files are accepted.' });
      return;
    }

    setFileName(file.name);
    setSubmitting(true);

    try {
      const startJob = isUpdateMode ? startUpdateProjectJob : startImportProjectJob;
      const jobResponse = await startJob({
        ProgramId: programId,
        StageName: stageName,
        File: file,
      });

      setPendingJobs((prev) => [...prev, { jobId: jobResponse.Data.JobId, kind: mode }]);
      const verb = isUpdateMode ? 'Update' : 'Import';
      showToast({ type: 'info', message: `${verb} queued for ${file.name} — you'll be notified here when it finishes.` });
      setSubmitting(false);
      resetAndClose();
    } catch {
      // httpClient interceptor already toasted the API error (e.g. "Import In Progress")
      setSubmitting(false);
    }
  }, [programId, stageName, isUpdateMode, showToast, setPendingJobs]);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragging(false);
      if (submitting) return;
      const file = e.dataTransfer.files?.[0];
      if (file) processFile(file);
    },
    [submitting, processFile],
  );

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  };

  return (
    <Dialog open={isOpen} onClose={handleClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />

      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="mx-auto max-w-lg w-full rounded-lg bg-white shadow-xl flex flex-col">

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <DialogTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <DocumentArrowUpIcon className="h-6 w-6 text-blue-600" />
              {isUpdateMode ? 'Update Projects' : 'Import Projects'}
            </DialogTitle>
            <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          {/* Body */}
          <div className="px-6 py-4 space-y-4">

            {/* Program info */}
            <div className="bg-blue-50 border border-blue-100 rounded-md px-4 py-2 text-sm text-blue-800">
`              <span className="font-medium">Program:</span> {programName}`
            </div>

            {isUpdateMode && !submitting && (
              <div className="flex gap-2 bg-amber-50 border border-amber-200 rounded-md px-4 py-2 text-sm text-amber-800">
                <ExclamationTriangleIcon className="h-5 w-5 flex-shrink-0 text-amber-500" />
                <span>
                  This replaces existing projects for this program's <strong>{stageName}</strong> stage
                  with the ones in your file. Projects not included in the file are left untouched.
                </span>
              </div>
            )}

            {submitting ? (
              <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
                <ArrowPathIcon className="h-8 w-8 text-blue-500 animate-spin" />
                <p className="text-sm font-medium text-gray-700">Uploading {fileName}…</p>
              </div>
            ) : (
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
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-lg">
            <Button color="zinc" onClick={handleClose} disabled={submitting}>Cancel</Button>
          </div>

        </DialogPanel>
      </div>
    </Dialog>
  );
};

export default ImportProjectsJobDialog;
