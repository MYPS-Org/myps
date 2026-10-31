// =============================================================================
// MultiYearProjectDetail.tsx — one multi-year project (/multi-year/projects/:id).
//
// Its one lasting record (MY-PRJ-01), the CW1 component, its yearly costs with
// each year marked Planned or Locked (MY-PRJ-12), and every portfolio it belongs
// to that the user can see, each with its own status and planning fields.
// The record is edited through its owner membership in an open term
// (CanEditProject); Category and Region are part of the MY ID and stay fixed.
// Phase 2: Propose to RBP / UBP from an RDIP / UDIP membership (MY-PFL-20), Set
// PIP Cost on a PIP membership (MY-PFL-19), each membership's full history, and
// the Annual Programs that hold the project (MY-PRJ-02, -03).
// =============================================================================

import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button } from '../../../components/tailwindui/button';
import { useToast } from '../../../components/toaster/ToasterContext';
import { useAuth } from '../../../contexts/AuthContext';
import type { MembershipFields, MultiYearProjectDetails, PlanningFormOptions, PlanningProjectFields, ProjectMembership, StatusLogEntry } from '../Model.d';
import * as Service from '../Service';
import { KIND_NAMES, STATUS_NAMES, formatPeso } from '../utils';
import { MembershipStatusBadge, PortfolioStatusBadge } from '../components/Shared';
import PlanningProjectForm from '../components/PlanningProjectForm';
import { YearlyCostTable } from '../components/YearlyCostGrid';
import { EditMembershipDialog, MembershipStatusDialog } from '../dialogs/MembershipDialogs';
import { ProposeDialog, SetPipCostDialog } from '../dialogs/LinkingDialogs';
import { planningFormRefusal } from '../rules';

const toFields = (d: MultiYearProjectDetails): PlanningProjectFields => {
  const component = d.Components.find((c) => c.ComponentId === 'CW1') ?? d.Components[0];
  return {
    Description: d.Project.Description,
    Category: d.Project.Category,
    Thrust: d.Project.Thrust,
    Region: d.Project.Region,
    Province: d.Project.Province,
    City: d.Project.City,
    LegislativeDistrict: d.Project.LegislativeDistrict,
    DEO: d.Project.DEO,
    ImplementingOffice: d.Project.ImplementingOffice,
    ReportingRegion: d.Project.ReportingRegion,
    RegionWide: d.Project.RegionWide,
    HorizonTypeId: d.Project.HorizonTypeFK,
    StartYear: d.Project.StartYear,
    EndYear: d.Project.EndYear,
    Component: {
      Description: component?.Description ?? '',
      InfraTypeFK: component?.InfraTypeFK ?? '',
      WorkTypeFK: component?.WorkTypeFK ?? 0,
      PhysicalTarget: component?.PhysicalTarget ?? null,
    },
    YearlyCosts: d.YearlyCosts.map((y) => ({ Year: y.Year, Amount: y.Amount })),
  };
};

/** One history line: the status move, and what else the change touched. */
const historyLine = (l: StatusLogEntry) => {
  const parts: string[] = [];
  if (l.FromStatus && l.FromStatus !== l.ToStatus) parts.push(`${STATUS_NAMES[l.FromStatus]} → ${STATUS_NAMES[l.ToStatus]}`);
  else if (!l.FromStatus) parts.push(STATUS_NAMES[l.ToStatus]);
  if (l.FromStartYear !== null && l.ToStartYear !== null && l.FromStartYear !== l.ToStartYear) parts.push(`start year ${l.FromStartYear} → ${l.ToStartYear}`);
  if (l.FromCost !== null && l.ToCost !== null && l.FromCost !== l.ToCost) parts.push(`cost ${formatPeso(l.FromCost)} → ${formatPeso(l.ToCost)}`);
  return parts.join(', ');
};

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <dt className="text-xs uppercase tracking-wide text-gray-500">{label}</dt>
    <dd className="text-sm text-gray-900">{children || '–'}</dd>
  </div>
);

const MultiYearProjectDetail: React.FC = () => {
  const { projectId = '' } = useParams();
  const { can } = useAuth();
  const { showToast } = useToast();
  const [details, setDetails] = useState<MultiYearProjectDetails | null>(null);
  const [failed, setFailed] = useState(false);
  const [options, setOptions] = useState<PlanningFormOptions | null>(null);
  const [editing, setEditing] = useState<PlanningProjectFields | null>(null);
  const [statusFor, setStatusFor] = useState<ProjectMembership | null>(null);
  const [proposeFor, setProposeFor] = useState<ProjectMembership | null>(null);
  const [pipCostFor, setPipCostFor] = useState<ProjectMembership | null>(null);
  // The saved fields are built once, when the dialog opens: the dialog resets its form whenever
  // they change identity, so an object made on every render would wipe the user's edits.
  const [fieldsFor, setFieldsFor] = useState<{ membership: ProjectMembership; options: PlanningFormOptions; saved: MembershipFields } | null>(null);

  const load = useCallback(() => {
    Service.fetchProjectDetails(projectId)
      .then((r) => {
        setDetails(r.Data);
        if (r.Data.OwnerPortfolioId) {
          Service.fetchPlanningFormOptions(r.Data.OwnerPortfolioId).then((o) => setOptions(o.Data)).catch(() => undefined);
        }
      })
      .catch(() => setFailed(true));
  }, [projectId]);

  useEffect(() => {
    setDetails(null);
    setEditing(null);
    setFailed(false);
    load();
  }, [load]);

  if (failed) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-600">
          This multi-year project could not be opened. <Link className="text-blue-600 hover:underline" to="/multi-year/portfolios">Back to Portfolios</Link>
        </div>
      </div>
    );
  }
  if (!details) return <div className="flex justify-center py-8 text-gray-500">Loading project...</div>;

  const p = details.Project;
  const component = details.Components[0];
  const name = <T extends { Name: string }>(rows: T[] | undefined, match: (row: T) => boolean, fallback: string | null) =>
    rows?.find(match)?.Name ?? fallback;

  const openFields = async (m: ProjectMembership) => {
    try {
      const response = await Service.fetchPlanningFormOptions(m.PortfolioId);
      setFieldsFor({
        membership: m,
        options: response.Data,
        saved: {
          BasisForImplementationId: m.BasisForImplementationId,
          NedaProjectStatusId: m.NedaProjectStatusId,
          ReadinessLevelIds: m.ReadinessLevelIds,
          RdpOutcomes: m.RdpOutcomes,
          Tier: m.Tier,
          McaScore: m.McaScore,
        },
      });
    } catch {
      // The interceptor toasted the refusal.
    }
  };

  const saveProject = async () => {
    if (!editing || !options) return;
    const refusal = planningFormRefusal(editing, options);
    if (refusal) {
      showToast({ type: 'error', message: refusal });
      return;
    }
    try {
      const response = await Service.updatePlanningProject({ ...editing, MultiYearProjectId: p.Id });
      showToast({ type: 'success', message: response.Data.Message });
      response.Data.Warnings.forEach((w) => showToast({ type: 'warning', message: w }));
      setEditing(null);
      load();
    } catch (error) {
      if (!(error as { Message?: string } | undefined)?.Message) {
        showToast({ type: 'error', message: 'Failed to save the project. Please try again.' });
      }
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 px-6 py-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/multi-year/portfolios" className="text-sm text-blue-600 hover:underline">Portfolios</Link>
          <h3 className="text-lg font-medium text-gray-900">
            <span className="font-mono">{p.ProjectId}</span> — {p.Description}
          </h3>
          <p className="text-sm text-gray-500">One record for the project's whole life, in every portfolio below.</p>
          {details.OriginProgramName && (
            <p className="text-sm text-gray-500">Added to PIP from the approved {details.OriginProgramName}: its Multi Year ID matched no planning project.</p>
          )}
        </div>
        {details.CanEditProject && can('MultiYear', 'UpdatePlanningProject') && !editing && options && (
          <Button color="blue" onClick={() => setEditing(toFields(details))}>Edit Project</Button>
        )}
      </div>

      {editing && options ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-6">
          <PlanningProjectForm
            options={options}
            value={editing}
            onChange={setEditing}
            mode="edit"
            canEditStartYear={details.CanEditStartYear}
            saved={toFields(details)}
          />
          <div className="flex justify-end gap-3">
            <Button outline onClick={() => setEditing(null)}>Cancel</Button>
            <Button color="green" onClick={saveProject}>Save Project</Button>
          </div>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <dl className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Row label="Category">{details.CategoryName}</Row>
              <Row label="Sub-Category">{details.ThrustName}</Row>
              <Row label="Horizon">{details.HorizonType}{details.HorizonYears ? ` (${details.HorizonYears} years)` : ''}</Row>
              <Row label="Years">{p.StartYear}{p.EndYear ? `–${p.EndYear}` : ' onward'}</Row>
              <Row label="Region">{details.RegionName}</Row>
              <Row label="Province">{name(options?.Provinces, (x) => x.Code === p.Province, p.Province)}</Row>
              <Row label="City / Municipality">{name(options?.Cities, (x) => x.Code === p.City, p.City)}</Row>
              <Row label="District Engineering Office">{name(options?.DEOs, (x) => x.ParticipantId === p.DEO, p.DEO)}</Row>
              <Row label="Implementing Office">{name(options?.ImplementingOffices, (x) => x.ParticipantId === p.ImplementingOffice, p.ImplementingOffice)}</Row>
              <Row label="Original Cost">{formatPeso(p.OriginalCost)}</Row>
              <Row label="Current Cost">{formatPeso(p.CurrentCost)}</Row>
              <Row label="Created">{p.CreatedBy}, {new Date(p.CreatedDate).toLocaleDateString()}</Row>
            </dl>
          </div>

          {component && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-2">
              <h4 className="text-base font-semibold text-gray-900">{component.ComponentType} ({component.ComponentId})</h4>
              <dl className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Row label="Infrastructure Type">{component.InfraTypeName}</Row>
                <Row label="Dominant Type of Work">{component.WorkTypeName}</Row>
                <Row label="Physical Target">{component.PhysicalTarget !== null ? `${component.PhysicalTarget} ${component.TargetUnit ?? ''}` : null}</Row>
                <Row label="Description">{component.Description}</Row>
              </dl>
            </div>
          )}

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-2">
            <h4 className="text-base font-semibold text-gray-900">Yearly cost</h4>
            <YearlyCostTable rows={details.YearlyCosts} />
          </div>
        </>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-3">
        <h4 className="text-base font-semibold text-gray-900">Annual Programs</h4>
        <p className="text-sm text-gray-500">
          Every annual program holding a project whose Multi Year ID is {p.ProjectId}, at its latest stage there, with that program year's cost.
        </p>
        {details.AnnualPrograms.length === 0 ? (
          <p className="text-sm text-gray-500">Not in any annual program yet.</p>
        ) : (
          <table className="min-w-full divide-y divide-gray-200 text-sm border border-gray-200 rounded-lg">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-700">Year</th>
                <th className="px-4 py-2 text-left font-medium text-gray-700">Program</th>
                <th className="px-4 py-2 text-left font-medium text-gray-700">Stage</th>
                <th className="px-4 py-2 text-left font-medium text-gray-700">Project ID</th>
                <th className="px-4 py-2 text-right font-medium text-gray-700">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {details.AnnualPrograms.map((a) => (
                <tr key={`${a.ProgramFK}-${a.ProjectId}`}>
                  <td className="px-4 py-2">{a.Year}</td>
                  <td className="px-4 py-2">{a.ProgramName}</td>
                  <td className="px-4 py-2">
                    {a.StageName}
                    {a.Approved && <span className="ml-2 text-xs text-green-700">approved</span>}
                    {a.Withdrawn && <span className="ml-2 text-xs text-red-700">withdrawn</span>}
                  </td>
                  <td className="px-4 py-2 font-mono">{a.ProjectId}</td>
                  <td className="px-4 py-2 text-right">{formatPeso(a.Amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {details.Proposals.length > 0 && (
          <details className="text-sm text-gray-600">
            <summary className="cursor-pointer">Proposals to RBP / UBP</summary>
            <ul className="mt-2 space-y-1">
              {details.Proposals.map((x) => (
                <li key={x.ProjectId}>
                  {x.BudgetYear}: {x.ProjectId} in {x.ProgramName}, {formatPeso(x.Amount)} — by {x.ProposedBy}, {new Date(x.ProposedDate).toLocaleDateString()}
                  {!x.Live && <span className="ml-2 text-xs text-gray-500">(its project was deleted)</span>}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
        <h4 className="text-base font-semibold text-gray-900">Portfolios</h4>
        {details.Memberships.map((m) => (
          <div key={m.MemberId} className="border border-gray-200 rounded-lg p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <Link className="text-blue-600 hover:underline font-medium" to={`/multi-year/portfolios/${m.PortfolioId}`}>{m.PortfolioName}</Link>
                <PortfolioStatusBadge status={m.PortfolioStatus} />
                <MembershipStatusBadge status={m.Status} />
                {m.IsOwner && <span className="text-xs text-gray-500">owner ({KIND_NAMES[m.Kind]} that created it)</span>}
              </div>
              <div className="flex gap-2">
                {m.CanPropose && can('MultiYear', 'ProposeToAnnualProgram') && <Button plain onClick={() => setProposeFor(m)}>Propose to RBP / UBP</Button>}
                {m.CanSetPipCost && can('MultiYear', 'SetPipCost') && <Button plain onClick={() => setPipCostFor(m)}>Set PIP Cost</Button>}
                {m.CanEdit && can('MultiYear', 'UpdateMembership') && <Button plain onClick={() => openFields(m)}>Edit Planning Fields</Button>}
                {m.AllowedStatuses.length > 0 && can('MultiYear', 'SetMembershipStatus') && <Button plain onClick={() => setStatusFor(m)}>Set Status</Button>}
              </div>
            </div>
            <div className="flex flex-wrap gap-6 text-sm text-gray-700">
              <span>Start year: <strong>{m.StartYear}</strong></span>
              <span>Cost: <strong>{formatPeso(m.Cost)}</strong></span>
              {m.OriginalCost !== null && <span>Original cost: <strong>{formatPeso(m.OriginalCost)}</strong></span>}
              {m.Kind === 3 && <span>From: <strong>{m.SourcePortfolioName ?? 'the approved GAA'}</strong></span>}
              {m.McaScore !== null && <span>MCA score: <strong>{m.McaScore}</strong></span>}
              <span>Readiness levels: <strong>{m.ReadinessLevelIds.length}</strong></span>
              <span>RDP outcomes: <strong>{m.RdpOutcomes.length}</strong></span>
            </div>
            {m.StatusLog.length > 0 && (
              <details className="text-sm text-gray-600">
                <summary className="cursor-pointer">History</summary>
                <ul className="mt-2 space-y-1">
                  {m.StatusLog.map((l, i) => (
                    <li key={i}>
                      {new Date(l.ChangedDate).toLocaleString()} — {historyLine(l) || STATUS_NAMES[l.ToStatus]}
                      {' '}by {l.ChangedBy}{l.BySystem ? ' (GAA update)' : ''}{l.Reason ? `: ${l.Reason}` : ''}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        ))}
      </div>

      {statusFor && (
        <MembershipStatusDialog
          open={!!statusFor}
          onClose={() => setStatusFor(null)}
          memberId={statusFor.MemberId}
          projectId={p.ProjectId}
          current={statusFor.Status}
          allowed={statusFor.AllowedStatuses}
          onSaved={() => {
            setStatusFor(null);
            load();
          }}
        />
      )}
      {proposeFor && (
        <ProposeDialog
          open={!!proposeFor}
          onClose={() => setProposeFor(null)}
          memberId={proposeFor.MemberId}
          onSaved={() => {
            setProposeFor(null);
            load();
          }}
        />
      )}
      {pipCostFor && (
        <SetPipCostDialog
          open={!!pipCostFor}
          onClose={() => setPipCostFor(null)}
          memberId={pipCostFor.MemberId}
          projectId={p.ProjectId}
          cost={pipCostFor.Cost}
          originalCost={pipCostFor.OriginalCost}
          onSaved={() => {
            setPipCostFor(null);
            load();
          }}
        />
      )}
      {fieldsFor && (
        <EditMembershipDialog
          open={!!fieldsFor}
          onClose={() => setFieldsFor(null)}
          memberId={fieldsFor.membership.MemberId}
          title={`Planning fields — ${fieldsFor.membership.PortfolioName}`}
          saved={fieldsFor.saved}
          startYear={fieldsFor.membership.StartYear}
          canEditStartYear={fieldsFor.membership.CanEditStartYear}
          options={fieldsFor.options}
          onSaved={() => {
            setFieldsFor(null);
            load();
          }}
        />
      )}
    </div>
  );
};

export default MultiYearProjectDetail;
