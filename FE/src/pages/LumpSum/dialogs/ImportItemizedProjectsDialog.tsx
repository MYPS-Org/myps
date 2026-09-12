// =============================================================================
// ImportItemizedProjectsDialog.tsx — WF-4 bulk Excel import of itemized projects
//
// Clones the drag-drop / parse / tabbed-review UI from Program's
// ImportProjectsDialog, scoped to a Lump Sum Project:
//   • Shows the Lump Sum Project and its remaining allocation in a context banner.
//   • Adds a bulk balance guard: if SUM(all parsed projects' funding amounts)
//     exceeds lumpSum.Remaining, the Import button is disabled with an inline
//     overdraw warning.
//   • On confirm, calls onSubmit(file) with the WORKBOOK ITSELF — the caller
//     (LumpSumDetail) posts it to Service.importItemizedProjects().
//
// THE PREVIEW IS ADVISORY. The tabs show what SheetJS read out of the file so
// the user can eyeball it before committing; the server reads the same file
// with the Program importer's own readers and validators, and its verdict is
// the only one that counts. A rejection comes back as a row-by-row list plus
// an annotated workbook, rendered in the Errors tab separately from any
// parse errors the browser found.
//
// Tab layout mirrors ImportProjectsDialog exactly:
//   Summary | Projects | Funding | Components | Cost/Year | Major Items | Locations | Errors
// =============================================================================

import { Dialog, DialogTitle, DialogPanel } from '@headlessui/react';
import {
  ArrowUpTrayIcon,
  DocumentArrowUpIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
  CheckCircleIcon,
  InformationCircleIcon,
  ArrowDownTrayIcon,
} from '@heroicons/react/24/outline';
import { Button } from '../../../components/tailwindui/button';
import { useCallback, useState, useRef } from 'react';
import type { ImportParseResult } from '../../Project/Model.d';
import type { LumpSum } from '../Model.d';
import { parseImportFile } from '../../Project/utils/parseImportFile';
import {
  asImportRejection,
  downloadImportErrorWorkbook,
  downloadImportWarningReport,
  type LumpSumImportRejection,
  type LumpSumImportResult,
} from '../Service';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ImportItemizedProjectsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /**
   * Receives the workbook file. Rejects with the httpClient ErrorResponse on
   * failure — the dialog reads a validation rejection's Errors[] out of it.
   * Resolves with the import summary, which the dialog keeps open to show when
   * rows were imported WITH WARNINGS.
   */
  onSubmit: (file: File) => Promise<LumpSumImportResult | undefined>;
  lumpSum: LumpSum;
}

// ---------------------------------------------------------------------------
// Local types
// ---------------------------------------------------------------------------

type ParseState = 'idle' | 'parsing' | 'done' | 'error';
type TabKey =
  | 'summary'
  | 'projects'
  | 'funding'
  | 'components'
  | 'costperyear'
  | 'majoritems'
  | 'majorlocations'
  | 'warnings'
  | 'errors';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const ImportItemizedProjectsDialog: React.FC<ImportItemizedProjectsDialogProps> = ({
  isOpen,
  onClose,
  onSubmit,
  lumpSum,
}) => {
  const [dragging, setDragging] = useState(false);
  /*  The File object itself is what gets posted; the parse result beside it is
      only the preview. */
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parseState, setParseState] = useState<ParseState>('idle');
  const [result, setResult] = useState<ImportParseResult | null>(null);
  /*  The server's verdict on the last submit, when it was a validation
      rejection. Cleared whenever a new file is chosen. */
  const [rejection, setRejection] = useState<LumpSumImportRejection | null>(null);
  /*  A SUCCESSFUL import that carried warnings. The dialog stays open on one of
      these: the projects exist, but rows came in with a value dropped or stored
      as typed, and closing on top of that would leave a toast as the only trace. */
  const [imported, setImported] = useState<LumpSumImportResult | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('summary');
  const [isSubmitting, setIsSubmitting] = useState(false);
  /*  The act waiting on a confirmation, or null. Two things destroy a download
      the user cannot get back: closing the dialog, and choosing a second
      workbook over the first. Both ask through the same overlay. */
  const [pending, setPending] = useState<{ kind: 'close' } | { kind: 'replace'; file: File } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Reset ────────────────────────────────────────────────────────────────

  const handleClose = () => {
    setDragging(false);
    setFile(null);
    setFileName(null);
    setParseState('idle');
    setResult(null);
    setRejection(null);
    setImported(null);
    setActiveTab('summary');
    setIsSubmitting(false);
    setPending(null);
    onClose();
  };

  // ── File processing ──────────────────────────────────────────────────────

  const processFile = useCallback(async (file: File) => {
    setFile(file);
    setFileName(file.name);
    setParseState('parsing');
    setResult(null);
    setRejection(null);
    setImported(null);
    try {
      const parsed = await parseImportFile(file);
      setResult(parsed);
      setParseState('done');
      setActiveTab(parsed.errors.length > 0 ? 'errors' : 'summary');
    } catch (err) {
      console.error('Import parse error:', err);
      setResult({
        projects: [],
        errors: [`Failed to read file: ${err instanceof Error ? err.message : String(err)}`],
        totalRows: { details: 0, components: 0, funding: 0, majorItems: 0 },
      });
      setParseState('error');
      setActiveTab('errors');
    }
  }, []);

  /*  THE TWO FILES THIS DIALOG IS THE ONLY ROUTE TO (2026-09-10). Both are
      fetched by name from the server, and the name lives in this component's
      state alone — nothing on the page behind it holds either one, and neither
      is re-derivable once the dialog is gone. So the run must be imported again
      to get back a report the user could have downloaded a moment earlier. */
  const canDownloadReport = !!imported?.ReportFileName;
  const canDownloadErrorWorkbook = !!rejection?.ErrorFileName;
  const hasStrandedDownload = canDownloadReport || canDownloadErrorWorkbook;

  /*  The ONLY close path from the X and the footer button. Closing with a
      download still on offer asks first; with nothing to strand it closes
      straight away, so an untouched dialog and a clean import stay one click.

      The backdrop and Escape do not come through here at all — the Dialog's
      onClose is a no-op (see the render) — because a stray click outside a
      full-width modal is exactly how these files were being lost. */
  const requestClose = () => {
    if (hasStrandedDownload) {
      setPending({ kind: 'close' });
      return;
    }
    handleClose();
  };

  /*  THE OTHER DOOR ONTO THE SAME LOSS. processFile clears `imported` and
      `rejection`, so choosing a second workbook discards the first run's report
      as surely as closing does — and the drop zone stays live behind a result on
      purpose: a rejected workbook is meant to be corrected and chosen again
      ("choose it here again", in the Errors tab). So the file is held and asked
      about rather than the zone being taken away. */
  const requestFile = (file: File) => {
    if (hasStrandedDownload) {
      setPending({ kind: 'replace', file });
      return;
    }
    void processFile(file);
  };

  // ── Drag & drop ──────────────────────────────────────────────────────────

  /*  Both entry points go through requestFile, never processFile: a second
      workbook discards the first run's downloads. */
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) requestFile(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) requestFile(file);
    e.target.value = '';
  };

  // ── Balance guard ────────────────────────────────────────────────────────
  // Sum every parsed project's Funding Profile Amount rows.
  // If it would exceed the project's Remaining allocation, the import is blocked.

  const totalImportAmount =
    result?.projects.reduce(
      (sum, p) => sum + p.FundingProfiles.reduce((s, f) => s + f.Amount, 0),
      0,
    ) ?? 0;

  const wouldOverdraw = totalImportAmount > lumpSum.Remaining;

  // ── Submit ───────────────────────────────────────────────────────────────

  const handleImport = async () => {
    if (!file || !result || result.projects.length === 0 || wouldOverdraw) return;

    try {
      setIsSubmitting(true);
      setRejection(null);
      const summary = await onSubmit(file);

      /*  WARNINGS AND REFUSALS KEEP THE DIALOG OPEN. The import succeeded — the
          accepted projects are created and the parent is drawn down — but a
          refused project was left out and a warned row carries a value the
          validator could not accept; the user has to see both before the only
          record is a file on the server. A refusal reuses the Errors tab: same
          list, same download, the heading says these were left out. */
      const refused = summary?.Errors?.length ? summary : null;
      if (refused) {
        setRejection({
          Title: `${refused.RefusedCount ?? 1} project${(refused.RefusedCount ?? 1) !== 1 ? 's' : ''} refused and left out`,
          Message: 'The other projects in the workbook were imported. Correct the marked cells in the error workbook and import just those again.',
          Errors: refused.Errors,
          ErrorFileName: refused.ErrorFileName ?? undefined,
        });
      }
      if (summary?.Warnings?.length || refused) {
        setImported(summary!);
        setActiveTab(refused ? 'errors' : 'warnings');
        setIsSubmitting(false);
        return;
      }
      handleClose();
    } catch (error) {
      /*  httpClient's interceptor has already toasted the Message. What it cannot
          show is a validation rejection's row-by-row list and its annotated
          workbook — those go to the Errors tab. A batch-level refusal (wrong
          stage, insufficient balance) carries neither, and the toast is all
          there is to say. */
      const rejected = asImportRejection(error);
      if (rejected) {
        setRejection(rejected);
        setActiveTab('errors');
      }
      setIsSubmitting(false);
    }
  };


  /** Hand a fetched blob to the browser as a download. */
  const saveBlob = (blob: Blob, filename: string) => {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const handleDownloadErrorWorkbook = async () => {
    if (!rejection?.ErrorFileName) return;
    try {
      const { blob, filename } = await downloadImportErrorWorkbook(rejection.ErrorFileName);
      saveBlob(blob, filename);
    } catch {
      // httpClient interceptor already showed the error toast.
    }
  };

  const handleDownloadWarningReport = async () => {
    if (!imported?.ReportFileName) return;
    try {
      const { blob, filename } = await downloadImportWarningReport(imported.ReportFileName);
      saveBlob(blob, filename);
    } catch {
      // httpClient interceptor already showed the error toast.
    }
  };

  // ── Derived data ─────────────────────────────────────────────────────────

  const hasProjects = (result?.projects.length ?? 0) > 0;
  const hasErrors   = (result?.errors.length ?? 0) > 0;
  const serverErrors = rejection?.Errors ?? [];
  const hasServerErrors = serverErrors.length > 0;
  const importWarnings = imported?.Warnings ?? [];
  /*  "Imported, with something to show" — warnings, refusals, or both. Drives the
      Warnings tab, the footer line and the Done button. */
  const hasImportWarnings = importWarnings.length > 0 || (imported?.Errors?.length ?? 0) > 0;

  const allFunding    = result?.projects.flatMap((p) => p.FundingProfiles) ?? [];
  const allComponents = result?.projects.flatMap((p) => p.ComponentCosts) ?? [];
  const allMajorItems = result?.projects.flatMap((p) => p.MajorItemsOfWork) ?? [];

  // Group components by ComponentId per project (for the Components tab)
  const groupedComponents = (() => {
    const map = new Map<string, {
      ProjectId: string;
      ComponentId: string;
      ComponentType: string;
      Description?: string;
      Total: number;
    }>();
    allComponents.forEach((c) => {
      const key = `${c.ProjectId}|${c.ComponentId}`;
      if (!map.has(key)) {
        map.set(key, {
          ProjectId: c.ProjectId,
          ComponentId: c.ComponentId,
          ComponentType: c.ComponentType,
          Description: c.Description,
          Total: 0,
        });
      }
      map.get(key)!.Total += c.Total;
    });
    return Array.from(map.values());
  })();

  // ── Currency format helper ────────────────────────────────────────────────
  const formatAmount = (n: number) =>
    n.toLocaleString('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 2 });

  // ── Tabs ─────────────────────────────────────────────────────────────────

  const tabs: { key: TabKey; label: string; count?: number; color?: string }[] = [
    { key: 'summary',        label: 'Summary' },
    { key: 'projects',       label: 'Projects',    count: result?.projects.length,   color: 'bg-blue-100 text-blue-700' },
    { key: 'funding',        label: 'Funding',     count: allFunding.length,          color: 'bg-emerald-100 text-emerald-700' },
    { key: 'components',     label: 'Components',  count: groupedComponents.length,   color: 'bg-violet-100 text-violet-700' },
    { key: 'costperyear',    label: 'Cost / Year', count: allComponents.length,       color: 'bg-indigo-100 text-indigo-700' },
    { key: 'majoritems',     label: 'Major Items', count: allMajorItems.length,       color: 'bg-amber-100 text-amber-700' },
    { key: 'majorlocations', label: 'Locations',   count: allMajorItems.length,       color: 'bg-orange-100 text-orange-700' },
    // Only after a successful import that warned — there is nothing to show before then.
    ...(importWarnings.length > 0
      ? [{ key: 'warnings' as TabKey, label: 'Warnings', count: importWarnings.length, color: 'bg-amber-100 text-amber-700' }]
      : []),
    { key: 'errors',         label: 'Errors',      count: hasErrors || hasServerErrors ? (result?.errors.length ?? 0) + serverErrors.length : undefined, color: 'bg-red-100 text-red-600' },
  ];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    /*  onClose IS A NO-OP, DELIBERATELY (2026-09-10). Headless UI routes both the
        backdrop click and Escape through it, and this dialog is the only place
        the warning report and the error workbook can be downloaded from — a
        click landing just outside a modal this wide threw both away with no
        warning and no way back. The X and the footer button are the two ways
        out, and both go through requestClose. */
    <Dialog open={isOpen} onClose={() => {}} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />

      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="relative mx-auto max-w-6xl w-full rounded-lg bg-white shadow-xl flex flex-col max-h-[90vh]">

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <DialogTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <DocumentArrowUpIcon className="h-6 w-6 text-blue-600" />
              Import Itemized Projects
            </DialogTitle>
            <button
              onClick={requestClose}
              /*  Dead mid-import, like the footer's Cancel: handleImport resolves
                  into this component's state, and this dialog is mounted for the
                  page's lifetime — closing underneath it wrote the finished run
                  back into a dialog that had already reset, so reopening showed
                  the previous run's warnings with no file loaded. */
              disabled={isSubmitting}
              title={isSubmitting ? 'Importing…' : 'Close'}
              aria-label="Close"
              className={`text-gray-400 hover:text-gray-600 ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">

            {/* Lump Sum Project context banner */}
            <div className="bg-blue-50 border border-blue-100 rounded-md px-4 py-3 text-sm">
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <span className="text-blue-800">
                  <span className="font-medium">Lump Sum Project:</span>{' '}
                  {lumpSum.Description || lumpSum.ProjectId}
                  <span className="ml-2 text-blue-500 text-xs">({lumpSum.ProjectId})</span>
                </span>
                <span className="text-blue-700">
                  <span className="font-medium">Remaining:</span>{' '}
                  {formatAmount(lumpSum.Remaining)}
                </span>
              </div>
            </div>

            {/* Drop zone */}
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
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xlsm,.xls"
                className="hidden"
                onChange={handleFileInput}
              />
              <ArrowUpTrayIcon className="mx-auto h-10 w-10 text-gray-400 mb-2" />
              {parseState === 'idle' && (
                <>
                  <p className="text-sm font-medium text-gray-700">Drag & drop your importation file here</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Accepts .xlsx / .xlsm — 4 required sheets:
                    <br />
                    <span className="font-mono">PROJECT DETAILS · FUNDING PROFILE · COMPONENT DETAILS · MAJOR ITEMS OF WORK</span>
                  </p>
                </>
              )}
              {parseState === 'parsing' && (
                <p className="text-sm text-blue-600 font-medium animate-pulse">
                  Parsing <span className="font-mono">{fileName}</span> …
                </p>
              )}
              {(parseState === 'done' || parseState === 'error') && (
                <p className="text-sm text-gray-700">
                  <span className="font-mono font-medium">{fileName}</span>
                  <span
                    className="ml-2 text-xs text-blue-600 underline"
                    onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                  >
                    Change file
                  </span>
                </p>
              )}
            </div>

            {/* Results area */}
            {result && (
              <>
                {/* Tabs */}
                <div className="flex border-b border-gray-200 mt-2 overflow-x-auto">
                  {tabs.map(({ key, label, count, color }) => (
                    <button
                      key={key}
                      onClick={() => setActiveTab(key)}
                      className={`
                        flex-shrink-0 px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap
                        ${activeTab === key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}
                      `}
                    >
                      {label}
                      {count != null && (
                        <span className={`ml-1.5 inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-xs font-bold ${color}`}>
                          {count}
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                {/* ── Summary ── */}
                {activeTab === 'summary' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { label: 'Projects',       value: result.totalRows.details,   color: 'text-blue-600',    bg: 'bg-blue-50'    },
                        { label: 'Funding Rows',   value: allFunding.length,           color: 'text-emerald-600', bg: 'bg-emerald-50' },
                        { label: 'Components',     value: groupedComponents.length,    color: 'text-violet-600',  bg: 'bg-violet-50'  },
                        { label: 'Cost/Year Rows', value: allComponents.length,        color: 'text-indigo-600',  bg: 'bg-indigo-50'  },
                        { label: 'Major Items',    value: allMajorItems.length,        color: 'text-amber-600',   bg: 'bg-amber-50'   },
                        { label: 'Locations',      value: allMajorItems.length,        color: 'text-orange-600',  bg: 'bg-orange-50'  },
                        { label: 'Errors',         value: result.errors.length + serverErrors.length,
                          color: result.errors.length + serverErrors.length > 0 ? 'text-red-600' : 'text-gray-400',
                          bg:    result.errors.length + serverErrors.length > 0 ? 'bg-red-50'    : 'bg-gray-50'    },
                      ].map(({ label, value, color, bg }) => (
                        <div key={label} className={`${bg} rounded-lg p-4 text-center`}>
                          <p className={`text-3xl font-bold ${color}`}>{value}</p>
                          <p className="text-xs text-gray-600 mt-1">{label}</p>
                        </div>
                      ))}
                    </div>

                    {/* Balance impact summary */}
                    {hasProjects && (
                      <div className={`rounded-lg border px-4 py-3 text-sm ${
                        wouldOverdraw
                          ? 'bg-red-50 border-red-200 text-red-800'
                          : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      }`}>
                        <div className="flex items-start gap-2">
                          {wouldOverdraw
                            ? <ExclamationTriangleIcon className="h-4 w-4 mt-0.5 flex-shrink-0 text-red-500" />
                            : <CheckCircleIcon className="h-4 w-4 mt-0.5 flex-shrink-0 text-emerald-500" />
                          }
                          <div className="space-y-1">
                            <p className="font-medium">
                              {wouldOverdraw ? 'Overdraw Warning' : 'Balance Check Passed'}
                            </p>
                            <p>
                              Total import amount:{' '}
                              <span className="font-mono font-semibold">{formatAmount(totalImportAmount)}</span>
                            </p>
                            <p>
                              Remaining allocation:{' '}
                              <span className="font-mono font-semibold">{formatAmount(lumpSum.Remaining)}</span>
                            </p>
                            {wouldOverdraw && (
                              <p className="font-medium">
                                Import would overdraw by{' '}
                                <span className="font-mono">{formatAmount(totalImportAmount - lumpSum.Remaining)}</span>.
                                Reduce project amounts or replenish the Lump Sum Project before importing.
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ── Projects ── */}
                {activeTab === 'projects' && (
                  <div className="overflow-x-auto rounded-md border border-gray-200">
                    <table className="min-w-full divide-y divide-gray-200 text-xs">
                      <thead className="bg-gray-50">
                        <tr>
                          {['#','Project ID','MY ID','Tier','Category','Sub-Category','Province','City','Region','DEO','IO','OU','Impl. Mode','Emergency'].map((h) => (
                            <th key={h} className="px-3 py-2 text-left font-medium text-gray-500 whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {result.projects.map((p, idx) => {
                          const d = p.ProjectDetails;
                          return (
                            <tr key={d.ProjectId} className="hover:bg-gray-50">
                              <td className="px-3 py-2 text-gray-400">{idx + 1}</td>
                              <td className="px-3 py-2 font-mono font-medium text-gray-900">{d.ProjectId}</td>
                              <td className="px-3 py-2 text-gray-600">{d.MYId || '—'}</td>
                              <td className="px-3 py-2 text-gray-700">{d.TierName || '—'}</td>
                              <td className="px-3 py-2 text-gray-700 max-w-[140px] truncate" title={d.CategoryName}>{d.CategoryName || '—'}</td>
                              <td className="px-3 py-2 text-gray-700 max-w-[140px] truncate" title={d.ThrustName}>{d.ThrustName || '—'}</td>
                              <td className="px-3 py-2 text-gray-700">{d.Province || '—'}</td>
                              <td className="px-3 py-2 text-gray-700">{d.City || '—'}</td>
                              <td className="px-3 py-2 text-gray-700">{d.Region || '—'}</td>
                              <td className="px-3 py-2 text-gray-600">{d.DEO || '—'}</td>
                              <td className="px-3 py-2 text-gray-600">{d.ImplementingOffice || '—'}</td>
                              <td className="px-3 py-2 text-gray-600">{d.OperatingUnit || '—'}</td>
                              <td className="px-3 py-2 text-gray-600">{d.ImplementationModeName || '—'}</td>
                              <td className="px-3 py-2 text-gray-600">{d.EmergencyModeName || '—'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* ── Funding ── */}
                {activeTab === 'funding' && (
                  <div className="overflow-x-auto rounded-md border border-gray-200">
                    <table className="min-w-full divide-y divide-gray-200 text-xs">
                      <thead className="bg-gray-50">
                        <tr>
                          {['#','Project ID','Source','Agreement','Amount'].map((h) => (
                            <th key={h} className="px-3 py-2 text-left font-medium text-gray-500 whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {allFunding.map((f, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-3 py-2 text-gray-400">{idx + 1}</td>
                            <td className="px-3 py-2 font-mono text-gray-700">{f.ProjectId}</td>
                            <td className="px-3 py-2 text-gray-700">{f.Source || '—'}</td>
                            <td className="px-3 py-2 text-gray-700 max-w-[200px] truncate" title={f.Agreement}>{f.Agreement || '—'}</td>
                            <td className="px-3 py-2 text-right font-mono text-gray-900">{f.Amount.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                      {allFunding.length > 0 && (
                        <tfoot className="bg-emerald-50">
                          <tr>
                            <td colSpan={4} className="px-3 py-2 text-xs font-semibold text-emerald-800 text-right">
                              Total Import Amount
                            </td>
                            <td className="px-3 py-2 text-right font-mono font-bold text-emerald-800">
                              {totalImportAmount.toLocaleString()}
                            </td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                )}

                {/* ── Components ── */}
                {activeTab === 'components' && (
                  <div className="overflow-x-auto rounded-md border border-gray-200">
                    <table className="min-w-full divide-y divide-gray-200 text-xs">
                      <thead className="bg-gray-50">
                        <tr>
                          {['#','Project ID','Component ID','Component Type','Description','Total'].map((h) => (
                            <th key={h} className="px-3 py-2 text-left font-medium text-gray-500 whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {groupedComponents.map((c, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-3 py-2 text-gray-400">{idx + 1}</td>
                            <td className="px-3 py-2 font-mono text-gray-700">{c.ProjectId}</td>
                            <td className="px-3 py-2 font-mono font-medium text-violet-700">{c.ComponentId}</td>
                            <td className="px-3 py-2 text-gray-600">{c.ComponentType}</td>
                            <td className="px-3 py-2 text-gray-700 max-w-[200px] truncate" title={c.Description}>{c.Description || '—'}</td>
                            <td className="px-3 py-2 text-right font-mono text-gray-900">{c.Total.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* ── Cost Per Year ── */}
                {activeTab === 'costperyear' && (
                  <div className="overflow-x-auto rounded-md border border-gray-200">
                    <table className="min-w-full divide-y divide-gray-200 text-xs">
                      <thead className="bg-gray-50">
                        <tr>
                          {['#','Project ID','Component ID','Component Type','Infra Type','Work Type','Year','Amount','Start Date','End Date'].map((h) => (
                            <th key={h} className="px-3 py-2 text-left font-medium text-gray-500 whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {allComponents.map((c, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-3 py-2 text-gray-400">{idx + 1}</td>
                            <td className="px-3 py-2 font-mono text-gray-700">{c.ProjectId}</td>
                            <td className="px-3 py-2 font-mono font-medium text-violet-700">{c.ComponentId}</td>
                            <td className="px-3 py-2 text-gray-600">{c.ComponentType}</td>
                            <td className="px-3 py-2 text-gray-600">{c.InfraTypeName || '—'}</td>
                            <td className="px-3 py-2 text-gray-600 max-w-[160px] truncate" title={c.WorkTypeName}>{c.WorkTypeName || '—'}</td>
                            <td className="px-3 py-2 text-center font-medium text-indigo-700">{c.ActivityYear ?? '—'}</td>
                            <td className="px-3 py-2 text-right font-mono text-gray-900">{c.Total.toLocaleString()}</td>
                            <td className="px-3 py-2 text-gray-500">{c.StartDate || '—'}</td>
                            <td className="px-3 py-2 text-gray-500">{c.EndDate || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* ── Major Items ── */}
                {activeTab === 'majoritems' && (
                  <div className="overflow-x-auto rounded-md border border-gray-200">
                    <table className="min-w-full divide-y divide-gray-200 text-xs">
                      <thead className="bg-gray-50">
                        <tr>
                          {['#','Project ID','Component ID','Reference ID','Infra ID','Target Unit','Phys. Target','Year'].map((h) => (
                            <th key={h} className="px-3 py-2 text-left font-medium text-gray-500 whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {allMajorItems.map((m, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-3 py-2 text-gray-400">{idx + 1}</td>
                            <td className="px-3 py-2 font-mono text-gray-700">{m.ProjectId}</td>
                            <td className="px-3 py-2 font-mono text-violet-700">{m.ComponentId}</td>
                            <td className="px-3 py-2 font-mono text-amber-700">{m.ReferenceId || '—'}</td>
                            <td className="px-3 py-2 text-gray-600">{m.InfraId || '—'}</td>
                            <td className="px-3 py-2 text-gray-600">{m.TargetUnit || '—'}</td>
                            <td className="px-3 py-2 text-right text-gray-700">{m.PhysicalTarget ?? '—'}</td>
                            <td className="px-3 py-2 text-center font-medium text-amber-700">{m.ActivityYear ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* ── Major Locations ── */}
                {activeTab === 'majorlocations' && (
                  <div className="overflow-x-auto rounded-md border border-gray-200">
                    <table className="min-w-full divide-y divide-gray-200 text-xs">
                      <thead className="bg-gray-50">
                        <tr>
                          {['#','Project ID','Component ID','Infra ID','Detailed Scope','Target Unit','Phys. Target','Length (m)','Start Station','End Station','Start Chainage','End Chainage','Start X','Start Y','End X','End Y'].map((h) => (
                            <th key={h} className="px-3 py-2 text-left font-medium text-gray-500 whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {allMajorItems.map((m, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-3 py-2 text-gray-400">{idx + 1}</td>
                            <td className="px-3 py-2 font-mono text-gray-700">{m.ProjectId}</td>
                            <td className="px-3 py-2 font-mono text-violet-700">{m.ComponentId}</td>
                            <td className="px-3 py-2 text-gray-600">{m.InfraId || '—'}</td>
                            <td className="px-3 py-2 text-gray-700 max-w-[160px] truncate" title={m.DetailedScope}>{m.DetailedScope || '—'}</td>
                            <td className="px-3 py-2 text-gray-600">{m.TargetUnit || '—'}</td>
                            <td className="px-3 py-2 text-right text-gray-700">{m.PhysicalTarget ?? '—'}</td>
                            <td className="px-3 py-2 text-right text-gray-700">{m.Length ?? '—'}</td>
                            <td className="px-3 py-2 text-gray-500">{m.StartStation || '—'}</td>
                            <td className="px-3 py-2 text-gray-500">{m.EndStation || '—'}</td>
                            <td className="px-3 py-2 text-right text-gray-500">{m.StartChainage ?? '—'}</td>
                            <td className="px-3 py-2 text-right text-gray-500">{m.EndChainage ?? '—'}</td>
                            <td className="px-3 py-2 text-right text-gray-500">{m.StartX ?? '—'}</td>
                            <td className="px-3 py-2 text-right text-gray-500">{m.StartY ?? '—'}</td>
                            <td className="px-3 py-2 text-right text-gray-500">{m.EndX ?? '—'}</td>
                            <td className="px-3 py-2 text-right text-gray-500">{m.EndY ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* ── Errors ── */}
                {activeTab === 'warnings' && (
                  <div className="space-y-2">
                    {/*  THE IMPORT SUCCEEDED. This tab exists so that is not the whole story:
                         each row below carries a value the validator could not accept — an
                         unreadable one was stored blank, a wrong-but-readable one as typed. */}
                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded px-4 py-3">
                      <div>
                        <p className="font-medium">
                          {imported?.Count ?? 0} project{(imported?.Count ?? 0) !== 1 ? 's' : ''} imported,
                          {' '}{imported?.WarningCount ?? importWarnings.length} row
                          {(imported?.WarningCount ?? importWarnings.length) !== 1 ? 's' : ''} with warnings
                        </p>
                        <p className="text-amber-800">
                          These projects were created. A value that could not be read is blank on the
                          project; one that could be read but is out of range was kept as typed.
                        </p>
                      </div>
                      {imported?.ReportFileName && (
                        <Button color="amber" onClick={handleDownloadWarningReport}>
                          <ArrowDownTrayIcon className="h-4 w-4" />
                          Download warning report
                        </Button>
                      )}
                    </div>
                    <ul className="space-y-1.5 max-h-64 overflow-y-auto">
                      {importWarnings.map((warning, i) => (
                        <li key={`warning-${i}`} className="flex items-start gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded px-3 py-2">
                          <ExclamationTriangleIcon className="h-4 w-4 mt-0.5 flex-shrink-0 text-amber-500" />
                          {warning}
                        </li>
                      ))}
                    </ul>
                    <p className="text-xs text-gray-500">
                      Correct these on the project itself, in the Projects module — the workbook has
                      already been imported. The report keeps the same list after this dialog closes.
                    </p>
                  </div>
                )}

                {activeTab === 'errors' && (
                  <div className="space-y-4">
                    {/* The server's verdict, when it rejected the workbook */}
                    {hasServerErrors && (
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-red-800 bg-red-50 border border-red-200 rounded px-4 py-3">
                          <div>
                            <p className="font-medium">{rejection?.Title ?? 'Import Rejected'}</p>
                            <p className="text-red-700">{rejection?.Message}</p>
                          </div>
                          {rejection?.ErrorFileName && (
                            <Button color="red" onClick={handleDownloadErrorWorkbook}>
                              <ArrowDownTrayIcon className="h-4 w-4" />
                              Download error workbook
                            </Button>
                          )}
                        </div>
                        <ul className="space-y-1.5 max-h-64 overflow-y-auto">
                          {serverErrors.map((err, i) => (
                            <li key={`server-${i}`} className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-100 rounded px-3 py-2">
                              <ExclamationTriangleIcon className="h-4 w-4 mt-0.5 flex-shrink-0 text-red-500" />
                              {err}
                            </li>
                          ))}
                        </ul>
                        <p className="text-xs text-gray-500">
                          The error workbook carries the same rows with the problem cells annotated and the
                          dropdowns in place. Correct it, then choose it here again.
                        </p>
                      </div>
                    )}

                    {/* What the browser could not read — preview problems, not the server's verdict */}
                    {hasErrors ? (
                      <div className="space-y-2">
                        {hasServerErrors && <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">Preview warnings</p>}
                        <ul className="space-y-1.5 max-h-64 overflow-y-auto">
                          {result.errors.map((err, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded px-3 py-2">
                              <ExclamationTriangleIcon className="h-4 w-4 mt-0.5 flex-shrink-0 text-amber-500" />
                              {err}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : !hasServerErrors && (
                      <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded px-4 py-3">
                        <CheckCircleIcon className="h-5 w-5" />
                        No problems found in the preview. The server checks the workbook itself on import.
                      </div>
                    )}
                  </div>
                )}

                {/* Parse warning banner (shown on non-error tabs) */}
                {hasErrors && hasProjects && !['errors', 'costperyear', 'majorlocations'].includes(activeTab) && (
                  <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                    <InformationCircleIcon className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    {result.errors.length} parse warning(s). Some rows may be excluded.{' '}
                    <button className="underline font-medium" onClick={() => setActiveTab('errors')}>View errors</button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-lg">
            <div className="text-xs text-gray-500 space-y-0.5">
              {hasImportWarnings && (
                <p className="text-amber-700 font-medium flex items-center gap-1">
                  <ExclamationTriangleIcon className="h-3.5 w-3.5" />
                  {imported?.Count ?? 0} imported.
                  {(imported?.RefusedCount ?? 0) > 0 && ` ${imported!.RefusedCount} refused and left out.`}
                  {importWarnings.length > 0 &&
                    ` ${imported?.WarningCount ?? importWarnings.length} row${(imported?.WarningCount ?? importWarnings.length) !== 1 ? 's' : ''} came in with warnings.`}
                </p>
              )}
              {!hasImportWarnings && hasProjects && !wouldOverdraw && (
                <p>Ready to import {result!.projects.length} project{result!.projects.length !== 1 ? 's' : ''}</p>
              )}
              {!hasImportWarnings && hasProjects && wouldOverdraw && (
                <p className="text-red-600 font-medium flex items-center gap-1">
                  <ExclamationTriangleIcon className="h-3.5 w-3.5" />
                  Import blocked — would overdraw the remaining allocation by {formatAmount(totalImportAmount - lumpSum.Remaining)}
                </p>
              )}
              {!hasImportWarnings && !hasProjects && <p>No projects loaded yet</p>}
            </div>
            <div className="flex gap-3">
              {/*  Once the workbook is in, there is nothing left to cancel — the one
                   button closes the dialog and the caller refreshes behind it. */}
              {!hasImportWarnings && (
                <Button color="zinc" onClick={requestClose} disabled={isSubmitting}>
                  Cancel
                </Button>
              )}
              {hasImportWarnings ? (
                <Button color="blue" onClick={requestClose}>
                  Done
                </Button>
              ) : (
                <Button
                  color="blue"
                  disabled={!hasProjects || wouldOverdraw || isSubmitting}
                  onClick={handleImport}
                >
                  {isSubmitting ? 'Importing…' : `Import${hasProjects ? ` (${result!.projects.length})` : ''}`}
                </Button>
              )}
            </div>
          </div>

          {/*  THE LAST WARNING BEFORE THE LINKS GO (2026-09-10). Drawn inside the
               panel rather than as a second Dialog: nesting two modals nests two
               focus traps, and this only has to cover the one it belongs to.
               Cancel returns to the dialog with both downloads still on offer;
               Close anyway is the only path from here to handleClose. */}
          {pending && (
            <div
              role="alertdialog"
              aria-labelledby="import-close-warning"
              data-close-warning
              /*  Escape cancels HERE, and only here. The dialog itself ignores it
                  by decision; inside a confirmation the key means "go back", which
                  is the safe direction and the one thing a keyboard user has no
                  other quick route to. Focus starts on Cancel (autoFocus below),
                  so this receives the key. */
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.stopPropagation();
                  setPending(null);
                }
              }}
              className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-black/40 px-6"
            >
              <div className="max-w-lg w-full rounded-lg bg-white shadow-xl border border-amber-200">
                <div className="flex items-start gap-3 px-6 py-5">
                  <ExclamationTriangleIcon className="h-6 w-6 flex-shrink-0 text-amber-500" />
                  <div className="space-y-2">
                    <p id="import-close-warning" className="text-sm font-medium text-gray-900">
                      {pending.kind === 'close'
                        ? 'You are closing the import dialog. Download the warning report and error Excel workbook files before closing.'
                        : 'You are replacing the workbook. Download the warning report and error Excel workbook files before choosing another.'}
                    </p>
                    {/*  Which of the two is actually on offer — the sentence above
                         names both, and only one exists on most runs. */}
                    <p className="text-sm text-gray-600">
                      {canDownloadReport && canDownloadErrorWorkbook
                        ? 'The warning report and the error workbook are both still available behind this message.'
                        : canDownloadReport
                          ? 'The warning report is still available behind this message.'
                          : 'The error workbook is still available behind this message.'}{' '}
                      {pending.kind === 'close'
                        ? 'Once this dialog closes they cannot be downloaded again without importing the workbook a second time.'
                        : 'Loading another workbook replaces them, and they cannot be downloaded again without importing this one a second time.'}
                    </p>
                  </div>
                </div>
                <div className="flex justify-end gap-3 border-t border-gray-200 bg-gray-50 px-6 py-4 rounded-b-lg">
                  <Button autoFocus color="zinc" onClick={() => setPending(null)}>
                    Cancel
                  </Button>
                  {pending.kind === 'close' ? (
                    <Button color="red" onClick={handleClose}>
                      Close anyway
                    </Button>
                  ) : (
                    <Button
                      color="red"
                      onClick={() => {
                        const next = pending.file;
                        setPending(null);
                        void processFile(next);
                      }}
                    >
                      Replace anyway
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}

        </DialogPanel>
      </div>
    </Dialog>
  );
};

export default ImportItemizedProjectsDialog;
