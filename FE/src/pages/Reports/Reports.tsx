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
} from './Service';
import type {
  ReportOptions,
  FilterProgramItem,
  GenerateReportRequest,
  ReportJobStatus,
  ReportStatusEvent,
} from './Model';

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

  const [isGenerating, setIsGenerating] = useState(false);
  const [currentJob, setCurrentJob] = useState<CurrentJob | null>(null);

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
    if (!reportType) {
      showToast({ type: 'error', message: 'Please select a report type before generating.' });
      return;
    }

    try {
      setIsGenerating(true);
      setCurrentJob(null);

      const request: GenerateReportRequest = {
        YearStart: yearStart || undefined,
        ProgramIds: selectedProgramIds.length > 0 ? selectedProgramIds : undefined,
        RegionCode: regionCode || undefined,
        PlanningEngineer: planningEngineer.trim() || undefined,
        ApprovedBy: approvedBy.trim() || undefined,
        ReviewedBy: reviewedBy.trim() || undefined,
      };

      const response = await queueReportGeneration(reportType, request);
      setCurrentJob({ jobId: response.JobId, status: 'Queued', message: response.Message });
    } catch {
      // httpClient interceptor already showed the API error toast
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="mt-1 text-sm text-gray-500">Generate and download reports</p>
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
                onChange={(e) => setReportType(e.target.value)}
                className={selectClass}
                disabled={isLoadingOptions}
              >
                <option value="">Select a report type</option>
                {options?.ReportTypes.map((rt) => (
                  <option key={rt.Id} value={rt.Id}>
                    {rt.Label} ({rt.OutputFormat.toUpperCase()})
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Regional Office</label>
              <select
                value={regionCode}
                onChange={(e) => setRegionCode(e.target.value)}
                className={selectClass}
                disabled={isLoadingOptions}
              >
                <option value="">All regions</option>
                {options?.RegionalOffices.map((region) => (
                  <option key={region.Id} value={region.Code}>
                    {region.Name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Planning Engineer</label>
              <Input
                type="text"
                value={planningEngineer}
                onChange={(e) => setPlanningEngineer(e.target.value)}
                placeholder="Optional"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Approved By</label>
              <Input
                type="text"
                value={approvedBy}
                onChange={(e) => setApprovedBy(e.target.value)}
                placeholder="Optional"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reviewed By</label>
              <Input
                type="text"
                value={reviewedBy}
                onChange={(e) => setReviewedBy(e.target.value)}
                placeholder="Optional"
              />
            </div>
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
