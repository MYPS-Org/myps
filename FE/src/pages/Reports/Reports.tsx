import React, { useEffect, useState } from 'react';
import { HubConnectionBuilder } from '@microsoft/signalr';
import {
  DocumentChartBarIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { Button } from '../../components/tailwindui/button';
import { Input } from '../../components/tailwindui/input';
import CheckboxList from '../../components/ui/CheckboxList';
import { useToast } from '../../components/toaster/ToasterContext';
import {
  fetchReportOptions,
  fetchFilterPrograms,
  queueReportGeneration,
  fetchReportFile,
  fetchReportJobStatus,
  fetchAIPReportDropdownData,
} from './Service';
import type {
  ReportOptions,
  FilterProgramItem,
  GenerateReportRequest,
  ReportFamily,
  ReportJobStatus,
  ReportStatusEvent,
} from './Model';
import type { AIPReportDropdowns } from '../Program/Model';
import ExtractPcmiowFields from './components/ExtractPcmiowFields';

// Report keys are grouped into families because each backing SQL object wants a
// different request shape (see WebAPI.Controllers.CrystalReport.ReportRequestMapper) --
// mirrors ReportCatalog.TryGetFamily on the backend so client-side validation and
// field visibility agree with what the server will actually accept.
const AIP_REPORT_KEYS = new Set(['aip-official', 'aip-executive', 'aip-official-without-ld', 'aip-executive-2']);
const RBP_SUMMARY_REPORT_KEYS = new Set(['rbp-summary-report', 'rbp-summary-report-with-tier']);

function getReportFamily(reportKey: string): ReportFamily | null {
  if (!reportKey) return null;
  const key = reportKey.toLowerCase();
  if (key === 'rbp') return 'rbp';
  // extract-pc reuses the extract-pcmiow family: same (programid, categoryid,
  // rocode, deocode, io_code) request shape, same ReportRequestMapper.MapExtract
  // on the backend (see ReportRequestMapper.cs), just a different report key.
  if (key === 'extract-pcmiow' || key === 'extract-pc') return 'extract-pcmiow';
  if (AIP_REPORT_KEYS.has(key)) return 'aip';
  if (RBP_SUMMARY_REPORT_KEYS.has(key)) return 'rbp-summary';
  return null;
}

interface CurrentJob {
  jobId: string;
  status: ReportJobStatus;
  message: string;
}

const statusStyles: Record<ReportJobStatus, string> = {
  Queued: 'bg-blue-50 border-blue-200 text-blue-700',
  Processing: 'bg-amber-50 border-amber-200 text-amber-700',
  Completed: 'bg-green-50 border-green-200 text-green-700',
  Failed: 'bg-red-50 border-red-200 text-red-700',
  Cancelled: 'bg-gray-50 border-gray-200 text-gray-700',
};

const selectClass =
  'w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed';

const Reports: React.FC = () => {
  const { showToast } = useToast();

  const [options, setOptions] = useState<ReportOptions | null>(null);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);

  // Report Type options are split into PDF (Crystal Reports) vs Excel
  // (direct-to-xlsx) tabs, kept as a dropdown per tab rather than a single
  // fixed field since more Excel report types (beyond Extract PCMIOW) are
  // expected to be added to ReportCatalog later.
  const [activeFormatTab, setActiveFormatTab] = useState<'pdf' | 'xlsx'>('pdf');
  const [reportType, setReportType] = useState('');
  const [yearStart, setYearStart] = useState<number | ''>('');
  const [programStage, setProgramStage] = useState('');
  const [regionCode, setRegionCode] = useState('');
  const [planningEngineer, setPlanningEngineer] = useState('');
  const [approvedBy, setApprovedBy] = useState('');
  const [reviewedBy, setReviewedBy] = useState('');

  const [programs, setPrograms] = useState<FilterProgramItem[]>([]);
  const [isLoadingPrograms, setIsLoadingPrograms] = useState(false);
  const [selectedProgramIds, setSelectedProgramIds] = useState<string[]>([]);

  // AIP family only — Crystal report-level letterhead fields, not SQL filters.
  const [aipReportType, setAipReportType] = useState('');
  const [aipReportTypeTitle, setAipReportTypeTitle] = useState('');

  // Extract PCMIOW / Extract PC families only — both reuse the same dropdown
  // data source and Region→DEO→Implementing Office cascade AIPReportDialog.tsx
  // already uses.
  const [categoryId, setCategoryId] = useState('');
  const [deoCode, setDeoCode] = useState('');
  const [ioCode, setIoCode] = useState('');
  const [dropdowns, setDropdowns] = useState<AIPReportDropdowns | null>(null);
  const [isLoadingDropdowns, setIsLoadingDropdowns] = useState(false);

  const [isGenerating, setIsGenerating] = useState(false);
  const [currentJob, setCurrentJob] = useState<CurrentJob | null>(null);

  const reportFamily = getReportFamily(reportType);

  useEffect(() => {
    setIsLoadingOptions(true);
    fetchReportOptions()
      .then(setOptions)
      .catch(() => setOptions(null))
      .finally(() => setIsLoadingOptions(false));
  }, []);

  useEffect(() => {
    setSelectedProgramIds([]);

    if (!yearStart || !programStage) {
      setPrograms([]);
      return;
    }

    let cancelled = false;
    setIsLoadingPrograms(true);
    fetchFilterPrograms({ YearStart: yearStart, ProgramStage: programStage })
      .then((result) => {
        if (!cancelled) setPrograms(result);
      })
      .catch(() => {
        if (!cancelled) setPrograms([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingPrograms(false);
      });

    return () => {
      cancelled = true;
    };
  }, [yearStart, programStage]);

  useEffect(() => {
    if (reportFamily !== 'extract-pcmiow' || dropdowns || isLoadingDropdowns) return;

    setIsLoadingDropdowns(true);
    fetchAIPReportDropdownData()
      .then(setDropdowns)
      .catch(() => setDropdowns(null))
      .finally(() => setIsLoadingDropdowns(false));
  }, [reportFamily, dropdowns, isLoadingDropdowns]);

  const pdfReportTypes = options?.ReportTypes.filter((rt) => rt.OutputFormat.toLowerCase() === 'pdf') ?? [];
  const xlsxReportTypes = options?.ReportTypes.filter((rt) => rt.OutputFormat.toLowerCase() === 'xlsx') ?? [];
  const visibleReportTypes = activeFormatTab === 'pdf' ? pdfReportTypes : xlsxReportTypes;

  const handleFormatTabChange = (tab: 'pdf' | 'xlsx') => {
    if (tab === activeFormatTab) return;
    setActiveFormatTab(tab);
    setReportType('');
    setAipReportType('');
    setAipReportTypeTitle('');
    setCategoryId('');
    setDeoCode('');
    setIoCode('');
  };

  const handleReportTypeChange = (value: string) => {
    setReportType(value);
    const family = getReportFamily(value);

    if (family === 'aip') {
      const label = options?.ReportTypes.find((rt) => rt.Id === value)?.Label ?? '';
      setAipReportType(label);
      setAipReportTypeTitle(label);
    }

    if (family !== 'extract-pcmiow') {
      setCategoryId('');
      setDeoCode('');
      setIoCode('');
    }
  };

  const handleRegionChange = (value: string) => {
    setRegionCode(value);
    setDeoCode('');
    setIoCode('');
  };

  const handleDeoChange = (value: string) => {
    setDeoCode(value);
    setIoCode('');
  };

  const downloadReportFile = async (fileName: string) => {
    try {
      const { blob, filename } = await fetchReportFile(fileName);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      showToast({ type: 'success', message: 'Report downloaded successfully.' });
    } catch {
      // httpClient interceptor already showed the API error toast
    }
  };

  useEffect(() => {
    if (!currentJob) return;

    const { jobId } = currentJob;
    let settled = false;

    const applyStatus = (event: ReportStatusEvent) => {
      if (event.JobId !== jobId || settled) return;

      setCurrentJob({ jobId, status: event.Status, message: event.Message });

      if (event.Status === 'Completed' && event.DownloadUrl) {
        const fileName = new URL(event.DownloadUrl, window.location.origin).searchParams.get('fileName');
        if (fileName) downloadReportFile(fileName);
      }

      if (event.Status === 'Completed' || event.Status === 'Failed' || event.Status === 'Cancelled') {
        settled = true;
        setIsGenerating(false);
        if (event.Status === 'Failed' || event.Status === 'Cancelled') {
          showToast({ type: 'error', message: event.Message });
        }
      }
    };

    // Best-effort catch-up check for a terminal status the SignalR group
    // broadcast may have already missed (see below) — SignalR stays the
    // primary, low-latency path, this only fills the gap.
    const checkStatus = async () => {
      try {
        const status = await fetchReportJobStatus(jobId);
        applyStatus(status);
      } catch {
        // Job may not be persisted yet, or the request failed transiently —
        // the SignalR listener is still active and will catch it normally.
      }
    };

    // Dedicated connection to the report-job hub, joined for the lifetime of
    // this job only. Kept separate from the shared notification hub
    // connection (src/services/signalrService.ts) since that hub has no
    // JoinJobGroup/LeaveJobGroup handlers of its own.
    const connection = new HubConnectionBuilder()
      .withUrl(`${import.meta.env.VITE_API_BASE_URL}/hubs/report`, { withCredentials: true })
      .withAutomaticReconnect()
      .build();

    connection.on('ReportStatusChanged', applyStatus);

    // A dropped connection loses server-side group membership — rejoin and
    // recheck in case the job finished while disconnected.
    connection.onreconnected(() => {
      connection
        .invoke('JoinJobGroup', jobId)
        .then(checkStatus)
        .catch((error) => console.error('Error rejoining report status hub:', error));
    });

    connection
      .start()
      .then(() => connection.invoke('JoinJobGroup', jobId))
      // A Hangfire worker can pick up and finish a job (especially the
      // direct-to-Excel reports) before this join completes — that broadcast
      // would land in an empty group and be lost for good, so check once for
      // a status we may have already missed.
      .then(checkStatus)
      .catch((error) => console.error('Error connecting to report status hub:', error));

    return () => {
      connection.stop().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentJob?.jobId]);

  const toggleProgramId = (id: string) => {
    setSelectedProgramIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const handleGenerate = async () => {
    if (!reportType || !reportFamily) {
      showToast({ type: 'error', message: 'Please select a report type before generating.' });
      return;
    }

    if (!regionCode) {
      showToast({ type: 'error', message: 'Please select a Regional Office before generating.' });
      return;
    }

    let request: GenerateReportRequest;

    switch (reportFamily) {
      case 'rbp': {
        request = {
          YearStart: yearStart || undefined,
          ProgramIds: selectedProgramIds.length > 0 ? selectedProgramIds : undefined,
          RegionCode: regionCode,
          PlanningEngineer: planningEngineer.trim() || undefined,
          ApprovedBy: approvedBy.trim() || undefined,
          ReviewedBy: reviewedBy.trim() || undefined,
        };
        break;
      }

      case 'aip': {
        if (!yearStart) {
          showToast({ type: 'error', message: 'Please select a year before generating.' });
          return;
        }
        if (selectedProgramIds.length === 0) {
          showToast({ type: 'error', message: 'Please select at least one program before generating.' });
          return;
        }
        if (!aipReportType.trim() || !aipReportTypeTitle.trim()) {
          showToast({ type: 'error', message: 'Report Type and Report Type Title are required.' });
          return;
        }
        request = {
          YearStart: yearStart,
          ProgramIds: selectedProgramIds,
          RegionCode: regionCode,
          ReportType: aipReportType.trim(),
          ReportTypeTitle: aipReportTypeTitle.trim(),
        };
        break;
      }

      case 'rbp-summary': {
        if (!yearStart) {
          showToast({ type: 'error', message: 'Please select a year before generating.' });
          return;
        }
        if (selectedProgramIds.length !== 1) {
          showToast({ type: 'error', message: 'This report requires exactly one selected program.' });
          return;
        }
        if (!planningEngineer.trim() || !approvedBy.trim() || !reviewedBy.trim()) {
          showToast({
            type: 'error',
            message: 'Planning Engineer, Approved By, and Reviewed By are all required for this report.',
          });
          return;
        }
        request = {
          YearStart: yearStart,
          ProgramId: selectedProgramIds[0],
          RegionCode: regionCode,
          PlanningEngr: planningEngineer.trim(),
          ReviewedBy: reviewedBy.trim(),
          ApprovedBy: approvedBy.trim(),
        };
        break;
      }

      case 'extract-pcmiow': {
        if (selectedProgramIds.length === 0) {
          showToast({ type: 'error', message: 'Please select at least one program before generating.' });
          return;
        }
        if (!categoryId) {
          showToast({ type: 'error', message: 'Please select a Category before generating.' });
          return;
        }
        if (!deoCode) {
          showToast({ type: 'error', message: 'Please select a District Engineering Office before generating.' });
          return;
        }
        if (!ioCode) {
          showToast({ type: 'error', message: 'Please select an Implementing Office before generating.' });
          return;
        }

        const selectedCategory = dropdowns?.Categories.find((c) => c.CategoryId === Number(categoryId));
        const selectedDeoOption = dropdowns?.DEOs.find((d) => d.ParticipantId === deoCode);
        const selectedIoOption = dropdowns?.ImplementingOffices.find((io) => io.ParticipantId === ioCode);
        const selectedRegionOption = options?.RegionalOffices.find((r) => r.Id === regionCode);

        request = {
          ProgramIds: selectedProgramIds,
          CategoryId: Number(categoryId),
          RegionCode: regionCode,
          DeoCode: deoCode,
          IoCode: ioCode,
          CategoryLabel: selectedCategory?.CategoryName ?? undefined,
          RegionLabel: selectedRegionOption?.Name ?? undefined,
          DeoLabel: selectedDeoOption?.Name ?? undefined,
          IoLabel: selectedIoOption?.Name ?? undefined,
        };
        break;
      }
    }

    try {
      setIsGenerating(true);
      setCurrentJob(null);

      const response = await queueReportGeneration(reportType, request);
      setCurrentJob({ jobId: response.JobId, status: 'Queued', message: response.Message });
    } catch {
      // httpClient interceptor already showed the API error toast
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="mt-1 text-sm text-gray-500">Generate and download reports</p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handleFormatTabChange('pdf')}
            disabled={isLoadingOptions}
            className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              activeFormatTab === 'pdf'
                ? 'bg-blue-600 border-blue-600 text-white'
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            PDF Reports
          </button>
          <button
            type="button"
            onClick={() => handleFormatTabChange('xlsx')}
            disabled={isLoadingOptions}
            className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              activeFormatTab === 'xlsx'
                ? 'bg-blue-600 border-blue-600 text-white'
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            Excel Reports
          </button>
        </div>
      </div>

      <div className="p-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Report Filters</h2>

          {isLoadingOptions && <p className="text-sm text-blue-600 mb-4">Loading report options…</p>}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Report Type <span className="text-red-500">*</span>
              </label>
              <select
                value={reportType}
                onChange={(e) => handleReportTypeChange(e.target.value)}
                className={selectClass}
                disabled={isLoadingOptions}
              >
                <option value="">Select a report type</option>
                {visibleReportTypes.map((rt) => (
                  <option key={rt.Id} value={rt.Id}>
                    {rt.Label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
              <select
                value={yearStart}
                onChange={(e) => setYearStart(e.target.value ? Number(e.target.value) : '')}
                className={selectClass}
                disabled={isLoadingOptions}
              >
                <option value="">All years</option>
                {options?.ProgramYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Program Stage</label>
              <select
                value={programStage}
                onChange={(e) => setProgramStage(e.target.value)}
                className={selectClass}
                disabled={isLoadingOptions}
              >
                <option value="">All stages</option>
                {options?.ProgramStages.map((stage) => (
                  <option key={stage.Id} value={stage.Name}>
                    {stage.DisplayName ?? stage.Name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Regional Office <span className="text-red-500">*</span>
              </label>
              <select
                value={regionCode}
                onChange={(e) => handleRegionChange(e.target.value)}
                className={selectClass}
                disabled={isLoadingOptions}
              >
                <option value="">Select a regional office</option>
                {options?.RegionalOffices.map((region) => (
                  <option key={region.Id} value={region.Id}>
                    {region.Name}
                  </option>
                ))}
              </select>
            </div>

            {(reportFamily === 'rbp' || reportFamily === 'rbp-summary') && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Planning Engineer
                    {reportFamily === 'rbp-summary' && <span className="text-red-500"> *</span>}
                  </label>
                  <Input
                    type="text"
                    value={planningEngineer}
                    onChange={(e) => setPlanningEngineer(e.target.value)}
                    placeholder={reportFamily === 'rbp-summary' ? undefined : 'Optional'}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Approved By
                    {reportFamily === 'rbp-summary' && <span className="text-red-500"> *</span>}
                  </label>
                  <Input
                    type="text"
                    value={approvedBy}
                    onChange={(e) => setApprovedBy(e.target.value)}
                    placeholder={reportFamily === 'rbp-summary' ? undefined : 'Optional'}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reviewed By
                    {reportFamily === 'rbp-summary' && <span className="text-red-500"> *</span>}
                  </label>
                  <Input
                    type="text"
                    value={reviewedBy}
                    onChange={(e) => setReviewedBy(e.target.value)}
                    placeholder={reportFamily === 'rbp-summary' ? undefined : 'Optional'}
                  />
                </div>
              </>
            )}

            {reportFamily === 'aip' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Report Type <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="text"
                    value={aipReportType}
                    onChange={(e) => setAipReportType(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Report Type Title <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="text"
                    value={aipReportTypeTitle}
                    onChange={(e) => setAipReportTypeTitle(e.target.value)}
                  />
                </div>
              </>
            )}

            {reportFamily === 'extract-pcmiow' && (
              <ExtractPcmiowFields
                dropdowns={dropdowns}
                isLoadingDropdowns={isLoadingDropdowns}
                regionCode={regionCode}
                categoryId={categoryId}
                onCategoryChange={setCategoryId}
                deoCode={deoCode}
                onDeoChange={handleDeoChange}
                ioCode={ioCode}
                onIoChange={setIoCode}
              />
            )}
          </div>

          <div className="mt-4">
            {!yearStart || !programStage ? (
              <>
                <label className="block text-sm font-medium text-gray-700 mb-1">Programs</label>
                <p className="text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded-md px-3 py-2">
                  Select a year and program stage to load matching programs.
                </p>
              </>
            ) : isLoadingPrograms ? (
              <>
                <label className="block text-sm font-medium text-gray-700 mb-1">Programs</label>
                <p className="text-sm text-blue-600">Loading programs…</p>
              </>
            ) : (
              <>
                {reportFamily === 'rbp-summary' && (
                  <p className="text-sm text-amber-600 mb-2">
                    This report requires exactly one selected program.
                  </p>
                )}
                <CheckboxList
                  title="Programs"
                  items={programs.map((program) => ({ id: program.Id, name: program.Name }))}
                  selectedIds={selectedProgramIds}
                  onToggle={toggleProgramId}
                  onSelectAll={() => setSelectedProgramIds(programs.map((program) => program.Id))}
                  onClearAll={() => setSelectedProgramIds([])}
                  idKey="id"
                  nameKey="name"
                  searchPlaceholder="Search programs..."
                  emptyMessage="No programs found for the selected year and stage."
                  defaultExpanded
                />
              </>
            )}
          </div>

          <div className="mt-6">
            <Button color="blue" onClick={handleGenerate} disabled={isGenerating || isLoadingOptions}>
              {isGenerating ? (
                <>
                  <ArrowPathIcon className="w-4 h-4 animate-spin" />
                  Generating…
                </>
              ) : (
                <>
                  <DocumentChartBarIcon className="w-4 h-4" />
                  Generate Report
                </>
              )}
            </Button>
          </div>
        </div>

        {currentJob && (
          <div className={`rounded-lg border p-4 ${statusStyles[currentJob.status]}`}>
            <p className="font-semibold">{currentJob.status}</p>
            <p className="text-sm">{currentJob.message}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Reports;
