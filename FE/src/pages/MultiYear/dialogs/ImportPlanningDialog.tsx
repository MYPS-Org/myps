// =============================================================================
// Import planning projects into an open RDIP or UDIP (MY-PFL-17): download the
// template, upload it filled in, see what was added and each refused row. Each
// row is added on its own server-side, so a refused row never stops the others.
// =============================================================================

import React, { useEffect, useState } from 'react';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { Button } from '../../../components/tailwindui/button';
import { useToast } from '../../../components/toaster/ToasterContext';
import type { PlanningImportResult } from '../Model.d';
import * as Service from '../Service';
import { Field, INPUT_CLASS, ModuleDialog } from '../components/Shared';

const saveBlob = (blob: Blob, fileName: string) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

export const ImportPlanningDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  portfolioId: number;
  portfolioName: string;
  templateName: string;
  onImported: () => void;
}> = ({ open, onClose, portfolioId, portfolioName, templateName, onImported }) => {
  const { showToast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<PlanningImportResult | null>(null);

  useEffect(() => {
    if (open) {
      setFile(null);
      setResult(null);
    }
  }, [open]);

  const download = async () => {
    try {
      saveBlob(await Service.downloadPlanningTemplate(portfolioId), templateName);
    } catch (error) {
      if (!(error as { Message?: string } | undefined)?.Message)
        showToast({ type: 'error', message: 'Failed to download the template. Please try again.' });
    }
  };

  const upload = async () => {
    if (!file) {
      showToast({ type: 'error', message: 'Choose the filled template.' });
      return;
    }
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      showToast({ type: 'error', message: 'Upload the template as an .xlsx file.' });
      return;
    }
    try {
      const response = await Service.importPlanningProjects(portfolioId, file);
      setResult(response.Data);
      showToast({ type: response.Data.Errors.length === 0 ? 'success' : 'warning', message: response.Data.Message });
      if (response.Data.Added.length > 0) onImported();
    } catch (error) {
      if (!(error as { Message?: string } | undefined)?.Message)
        showToast({ type: 'error', message: 'Failed to import the file. Please try again.' });
    }
  };

  return (
    <ModuleDialog
      open={open}
      onClose={onClose}
      title={`Import Projects — ${portfolioName}`}
      width="max-w-2xl"
      footer={
        <>
          <Button outline onClick={onClose}>Close</Button>
          <Button color="green" onClick={upload} disabled={!file}>Import</Button>
        </>
      }
    >
      <p className="text-sm text-gray-700">
        Each row becomes a New planning project with its own MY id. Amount 1 is the Start Year's planned cost, Amount 2 the next year's, and so on;
        a blank amount between two filled ones is refused. The template's Instructions sheet explains every column.
      </p>
      <Button outline onClick={download}>
        <ArrowDownTrayIcon className="h-5 w-5" />
        Download Template
      </Button>
      <Field label="Filled template (.xlsx)" required>
        <input type="file" accept=".xlsx" className={INPUT_CLASS} onChange={(e) => { setFile(e.target.files?.[0] ?? null); setResult(null); }} />
      </Field>
      {result && (
        <div className="space-y-3">
          {result.Added.length > 0 && (
            <div className="rounded-md bg-green-50 p-3 text-sm text-green-800">
              Added: {result.Added.map((a) => `${a.ProjectId} (row ${a.Row})`).join(', ')}
              {result.Added.some((a) => a.Warnings.length > 0) && (
                <ul className="mt-2 list-disc pl-5">
                  {result.Added.flatMap((a) => a.Warnings.map((w, i) => <li key={`${a.Row}-${i}`}>Row {a.Row}: {w}</li>))}
                </ul>
              )}
            </div>
          )}
          {result.Errors.length > 0 && (
            <div className="max-h-64 overflow-y-auto rounded-md bg-red-50 p-3 text-sm text-red-800">
              <p className="font-medium">Refused rows — fix them and import those rows again:</p>
              <ul className="mt-2 list-disc pl-5">
                {result.Errors.map((e) => <li key={e.Row}>Row {e.Row}: {e.Messages.join(' ')}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </ModuleDialog>
  );
};
