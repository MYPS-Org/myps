import { Dialog, DialogTitle, DialogPanel } from '@headlessui/react';
import {
  ArrowUpTrayIcon,
  DocumentArrowUpIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
  CheckCircleIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import { Button } from '../../../components/tailwindui/button';
import { useCallback, useState, useRef } from 'react';
import type { ImportedProject, ImportParseResult } from '../../Project/Model.d';
import { parseImportFile } from '../../Project/utils/parseImportFile';
import { transformImportedProjects } from '../../Project/utils/transformImportedProjects';

interface ImportProjectsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (projects: ImportedProject[]) => void;
  programId: string;
  programName: string;
  stageName: string;
}

type ParseState = 'idle' | 'parsing' | 'done' | 'error';
type TabKey = 'summary' | 'projects' | 'funding' | 'components' | 'costperyear' | 'majoritems' | 'majorlocations' | 'errors';

const ImportProjectsDialog: React.FC<ImportProjectsDialogProps> = ({
  isOpen,
  onClose,
  onSubmit,
  programId,
  programName,
  stageName,
}) => {
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parseState, setParseState] = useState<ParseState>('idle');
  const [result, setResult] = useState<ImportParseResult | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('summary');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // reset when dialog re-opens  
  const handleClose = () => {
    setDragging(false);
    setFileName(null);
    setParseState('idle');
    setResult(null);
    setActiveTab('summary');
    onClose();
  };

  // ile processing 
  const processFile = useCallback(async (file: File) => {
    setFileName(file.name);
    setParseState('parsing');
    setResult(null);
    try {
      const parsed = await parseImportFile(file);
      setResult(parsed);
      setParseState('done');
      setActiveTab(parsed.errors.length > 0 ? 'errors' : 'summary');

      // Console log the full JSON breakdown in server-payload shape 
      const transformed = transformImportedProjects(parsed.projects, programId, stageName);
      console.group('[Import – JSON Breakdown]');
      console.log('programDetails:',     transformed.programDetails);
      console.log('projectDetails:',     transformed.projectDetails);
      console.log('fundingProfile:',     transformed.fundingProfile);
      console.log('componentCosts:',     transformed.componentCosts);
      console.log('componentCostPerYear:', transformed.componentCostPerYear);
      console.log('majorItemOfWorks:',   transformed.majorItemOfWorks);
      console.log('majorItemLocations:', transformed.majorItemLocations);
      console.log('Full payload JSON:', JSON.stringify(transformed, null, 2));
      console.groupEnd();
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
  }, [programId]);

  // drag & drop
  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) processFile(file);
    },
    [processFile],
  );

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  };

  // submit 
  const handleImport = () => {
    if (result && result.projects.length > 0) {
      onSubmit(result.projects);
      handleClose();
    }
  };

  // derived data 
  const hasProjects = (result?.projects.length ?? 0) > 0;
  const hasErrors   = (result?.errors.length ?? 0) > 0;

  // Flatten all rows across every project for each tab
  const allFunding      = result?.projects.flatMap((p) => p.FundingProfiles) ?? [];
  const allComponents   = result?.projects.flatMap((p) => p.ComponentCosts) ?? [];
  const allMajorItems   = result?.projects.flatMap((p) => p.MajorItemsOfWork) ?? [];

  // Derive grouped components (unique ComponentId per project) for "Components" tab
  const groupedComponents = (() => {
    const map = new Map<string, { ProjectId: string; ComponentId: string; ComponentType: string; Description?: string; Total: number }>();
    allComponents.forEach((c) => {
      const key = `${c.ProjectId}|${c.ComponentId}`;
      if (!map.has(key)) map.set(key, { ProjectId: c.ProjectId, ComponentId: c.ComponentId, ComponentType: c.ComponentType, Description: c.Description, Total: 0 });
      map.get(key)!.Total += c.Total;
    });
    return Array.from(map.values());
  })();

  // render
  const tabs: { key: TabKey; label: string; count?: number; color?: string }[] = [
    { key: 'summary',       label: 'Summary' },
    { key: 'projects',      label: 'Projects',        count: result?.projects.length,    color: 'bg-blue-100 text-blue-700' },
    { key: 'funding',       label: 'Funding',          count: allFunding.length,           color: 'bg-emerald-100 text-emerald-700' },
    { key: 'components',    label: 'Components',       count: groupedComponents.length,    color: 'bg-violet-100 text-violet-700' },
    { key: 'costperyear',   label: 'Cost / Year',      count: allComponents.length,        color: 'bg-indigo-100 text-indigo-700' },
    { key: 'majoritems',    label: 'Major Items',      count: allMajorItems.length,        color: 'bg-amber-100 text-amber-700' },
    { key: 'majorlocations',label: 'Locations',        count: allMajorItems.length,        color: 'bg-orange-100 text-orange-700' },
    { key: 'errors',        label: 'Errors',           count: hasErrors ? result?.errors.length : undefined, color: 'bg-red-100 text-red-600' },
  ];

  return (
    <Dialog open={isOpen} onClose={handleClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />

      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="mx-auto max-w-6xl w-full rounded-lg bg-white shadow-xl flex flex-col max-h-[90vh]">

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
              <input ref={fileInputRef} type="file" accept=".xlsx,.xlsm,.xls" className="hidden" onChange={handleFileInput} />
              <ArrowUpTrayIcon className="mx-auto h-10 w-10 text-gray-400 mb-2" />
              {parseState === 'idle' && (
                <>
                  <p className="text-sm font-medium text-gray-700">Drag & drop your importation file here</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Accepts .xlsx / .xlsm â€” 4 required sheets:
                    <br />
                    <span className="font-mono">PROJECT DETAILS Â· FUNDING PROFILE Â· COMPONENT DETAILS Â· MAJOR ITEMS OF WORK</span>
                  </p>
                </>
              )}
              {parseState === 'parsing' && (
                <p className="text-sm text-blue-600 font-medium animate-pulse">Parsing <span className="font-mono">{fileName}</span> â€¦</p>
              )}
              {(parseState === 'done' || parseState === 'error') && (
                <p className="text-sm text-gray-700">
                  <span className="font-mono font-medium">{fileName}</span>
                  <span className="ml-2 text-xs text-blue-600 underline" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
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
                    result || key === 'summary' ? (
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
                    ) : null
                  ))}
                </div>

                {/* Summary */}
                {activeTab === 'summary' && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: 'Projects',      value: result.totalRows.details,    color: 'text-blue-600',    bg: 'bg-blue-50'    },
                      { label: 'Funding Rows',  value: allFunding.length,            color: 'text-emerald-600', bg: 'bg-emerald-50' },
                      { label: 'Components',    value: groupedComponents.length,     color: 'text-violet-600',  bg: 'bg-violet-50'  },
                      { label: 'Cost/Year Rows',value: allComponents.length,         color: 'text-indigo-600',  bg: 'bg-indigo-50'  },
                      { label: 'Major Items',   value: allMajorItems.length,         color: 'text-amber-600',   bg: 'bg-amber-50'   },
                      { label: 'Locations',     value: allMajorItems.length,         color: 'text-orange-600',  bg: 'bg-orange-50'  },
                      { label: 'Errors',        value: result.errors.length,         color: result.errors.length > 0 ? 'text-red-600' : 'text-gray-400', bg: result.errors.length > 0 ? 'bg-red-50' : 'bg-gray-50' },
                    ].map(({ label, value, color, bg }) => (
                      <div key={label} className={`${bg} rounded-lg p-4 text-center`}>
                        <p className={`text-3xl font-bold ${color}`}>{value}</p>
                        <p className="text-xs text-gray-600 mt-1">{label}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Projects */}
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
                              <td className="px-3 py-2 text-gray-600">{d.MYId || 'â€”'}</td>
                              <td className="px-3 py-2 text-gray-700">{d.TierName || 'â€”'}</td>
                              <td className="px-3 py-2 text-gray-700 max-w-[140px] truncate" title={d.CategoryName}>{d.CategoryName || 'â€”'}</td>
                              <td className="px-3 py-2 text-gray-700 max-w-[140px] truncate" title={d.ThrustName}>{d.ThrustName || 'â€”'}</td>
                              <td className="px-3 py-2 text-gray-700">{d.Province || 'â€”'}</td>
                              <td className="px-3 py-2 text-gray-700">{d.City || 'â€”'}</td>
                              <td className="px-3 py-2 text-gray-700">{d.Region || 'â€”'}</td>
                              <td className="px-3 py-2 text-gray-600">{d.DEO || 'â€”'}</td>
                              <td className="px-3 py-2 text-gray-600">{d.ImplementingOffice || 'â€”'}</td>
                              <td className="px-3 py-2 text-gray-600">{d.OperatingUnit || 'â€”'}</td>
                              <td className="px-3 py-2 text-gray-600">{d.ImplementationModeName || 'â€”'}</td>
                              <td className="px-3 py-2 text-gray-600">{d.EmergencyModeName || 'â€”'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Funding */}
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
                            <td className="px-3 py-2 text-gray-700">{f.Source || 'â€”'}</td>
                            <td className="px-3 py-2 text-gray-700 max-w-[200px] truncate" title={f.Agreement}>{f.Agreement || 'â€”'}</td>
                            <td className="px-3 py-2 text-right font-mono text-gray-900">{f.Amount.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Components (grouped by ComponentId) */}
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
                            <td className="px-3 py-2 text-gray-700 max-w-[200px] truncate" title={c.Description}>{c.Description || 'â€”'}</td>
                            <td className="px-3 py-2 text-right font-mono text-gray-900">{c.Total.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Cost Per Year */}
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
                            <td className="px-3 py-2 text-gray-600">{c.InfraTypeName || 'â€”'}</td>
                            <td className="px-3 py-2 text-gray-600 max-w-[160px] truncate" title={c.WorkTypeName}>{c.WorkTypeName || 'â€”'}</td>
                            <td className="px-3 py-2 text-center font-medium text-indigo-700">{c.ActivityYear ?? 'â€”'}</td>
                            <td className="px-3 py-2 text-right font-mono text-gray-900">{c.Total.toLocaleString()}</td>
                            <td className="px-3 py-2 text-gray-500">{c.StartDate || 'â€”'}</td>
                            <td className="px-3 py-2 text-gray-500">{c.EndDate || 'â€”'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Major Items */}
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
                            <td className="px-3 py-2 font-mono text-amber-700">{m.ReferenceId || 'â€”'}</td>
                            <td className="px-3 py-2 text-gray-600">{m.InfraId || 'â€”'}</td>
                            <td className="px-3 py-2 text-gray-600">{m.TargetUnit || 'â€”'}</td>
                            <td className="px-3 py-2 text-right text-gray-700">{m.PhysicalTarget ?? 'â€”'}</td>
                            <td className="px-3 py-2 text-center font-medium text-amber-700">{m.ActivityYear ?? 'â€”'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Major Locations */}
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
                            <td className="px-3 py-2 text-gray-600">{m.InfraId || 'â€”'}</td>
                            <td className="px-3 py-2 text-gray-700 max-w-[160px] truncate" title={m.DetailedScope}>{m.DetailedScope || 'â€”'}</td>
                            <td className="px-3 py-2 text-gray-600">{m.TargetUnit || 'â€”'}</td>
                            <td className="px-3 py-2 text-right text-gray-700">{m.PhysicalTarget ?? 'â€”'}</td>
                            <td className="px-3 py-2 text-right text-gray-700">{m.Length ?? 'â€”'}</td>
                            <td className="px-3 py-2 text-gray-500">{m.StartStation || 'â€”'}</td>
                            <td className="px-3 py-2 text-gray-500">{m.EndStation || 'â€”'}</td>
                            <td className="px-3 py-2 text-right text-gray-500">{m.StartChainage ?? 'â€”'}</td>
                            <td className="px-3 py-2 text-right text-gray-500">{m.EndChainage ?? 'â€”'}</td>
                            <td className="px-3 py-2 text-right text-gray-500">{m.StartX ?? 'â€”'}</td>
                            <td className="px-3 py-2 text-right text-gray-500">{m.StartY ?? 'â€”'}</td>
                            <td className="px-3 py-2 text-right text-gray-500">{m.EndX ?? 'â€”'}</td>
                            <td className="px-3 py-2 text-right text-gray-500">{m.EndY ?? 'â€”'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Errors */}
                {activeTab === 'errors' && (
                  <div>
                    {hasErrors ? (
                      <ul className="space-y-1.5 max-h-64 overflow-y-auto">
                        {result.errors.map((err, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-100 rounded px-3 py-2">
                            <ExclamationTriangleIcon className="h-4 w-4 mt-0.5 flex-shrink-0 text-red-500" />
                            {err}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded px-4 py-3">
                        <CheckCircleIcon className="h-5 w-5" />
                        No errors found â€” the file parsed cleanly.
                      </div>
                    )}
                  </div>
                )}

                {/* Warning banner if errors but still has projects */}
                {hasErrors && hasProjects && !['errors', 'costperyear', 'majorlocations'].includes(activeTab) && (
                  <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                    <InformationCircleIcon className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    {result.errors.length} parse warning(s). Some rows may be excluded.
                    {' '}<button className="underline font-medium" onClick={() => setActiveTab('errors')}>View errors</button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-lg">
            <p className="text-xs text-gray-500">
              {hasProjects
                ? `Ready to import ${result!.projects.length} project${result!.projects.length !== 1 ? 's' : ''}`
                : 'No projects loaded yet'}
            </p>
            <div className="flex gap-3">
              <Button color="zinc" onClick={handleClose}>Cancel</Button>
              <Button color="blue" disabled={!hasProjects} onClick={handleImport}>
                Import {hasProjects ? `(${result!.projects.length})` : ''}
              </Button>
            </div>
          </div>

        </DialogPanel>
      </div>
    </Dialog>
  );
};

export default ImportProjectsDialog;
