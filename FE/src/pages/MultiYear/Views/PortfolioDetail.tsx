// =============================================================================
// PortfolioDetail.tsx — one RDIP, UDIP or PIP term (/multi-year/portfolios/:id).
//
// Projects tab: the term's memberships, paged by the shared keyset hook, with the
// six term years, later years and total per project, and Set Status where the
// status diagram allows a coordinator move. Budget Ceilings tab: each term year's
// planned cost against its ceiling (MY-PFL-23). Saved Totals tab (Phase 2,
// MY-PFL-24). Phase 2 also adds Import Projects to an RDIP / UDIP (MY-PFL-17),
// and to a PIP: Add Project to PIP, each project's source and Set PIP Cost
// (MY-PFL-10, -18, -19).
// A closed term is read-only: the server refuses every write to it, and nothing
// here offers one.
// =============================================================================

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowRightIcon, ArrowUpTrayIcon, MagnifyingGlassIcon, PlusIcon } from '@heroicons/react/24/outline';
import { Button } from '../../../components/tailwindui/button';
import { PaginationBar } from '../../../components/tailwindui/PaginationBar';
import { useToast } from '../../../components/toaster/ToasterContext';
import { useAuth } from '../../../contexts/AuthContext';
import { usePagination } from '../../../hooks/usePagination';
import type { MemberFilter, MembershipStatus, PortfolioDetails, PortfolioMember } from '../Model.d';
import * as Service from '../Service';
import { KIND_DESCRIPTIONS, STATUS_NAMES, formatPeso, parseYearAmounts } from '../utils';
import { MembershipStatusBadge, PortfolioStatusBadge } from '../components/Shared';
import SavedTotalsTab from '../components/SavedTotalsTab';
import { OpenNextTermDialog } from '../dialogs/PortfolioDialogs';
import { MembershipStatusDialog } from '../dialogs/MembershipDialogs';
import { AddToPipDialog, SetPipCostDialog } from '../dialogs/LinkingDialogs';
import { ImportPlanningDialog } from '../dialogs/ImportPlanningDialog';

type Tab = 'projects' | 'ceilings' | 'totals';
const TAB_NAMES: Record<Tab, string> = { projects: 'Projects', ceilings: 'Budget Ceilings', totals: 'Saved Totals' };
/** PortfolioKind of the PIP. */
const PIP = 3;
const isLocked = (status: MembershipStatus) => status === 4 || status === 5;

/*  Keyed by the id: the Previous / Next term links land on this same route, and
    usePagination reads its filters only on mount, so each term gets a fresh page. */
const PortfolioDetail: React.FC = () => {
  const { portfolioId } = useParams();
  return <PortfolioDetailPage key={portfolioId} id={Number(portfolioId)} />;
};

const PortfolioDetailPage: React.FC<{ id: number }> = ({ id }) => {
  const navigate = useNavigate();
  const { can } = useAuth();
  const { showToast } = useToast();
  const [details, setDetails] = useState<PortfolioDetails | null>(null);
  const [failed, setFailed] = useState(false);
  const [tab, setTab] = useState<Tab>('projects');
  const [openingNext, setOpeningNext] = useState(false);
  const [statusFor, setStatusFor] = useState<PortfolioMember | null>(null);
  const [pipCostFor, setPipCostFor] = useState<PortfolioMember | null>(null);
  const [addingToPip, setAddingToPip] = useState(false);
  const [importing, setImporting] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<MembershipStatus | ''>('');
  const [ceilings, setCeilings] = useState<Record<number, string>>({});

  const loadDetails = useCallback(() => {
    Service.fetchPortfolioDetails(id)
      .then((r) => {
        setDetails(r.Data);
        setCeilings(Object.fromEntries(r.Data.Years.map((y) => [y.Year, y.Ceiling === null ? '' : String(y.Ceiling)])));
      })
      .catch(() => setFailed(true));
  }, [id]);

  useEffect(() => {
    setDetails(null);
    setFailed(false);
    loadDetails();
  }, [loadDetails]);

  const pagination = usePagination<MemberFilter, PortfolioMember>(Service.fetchPortfolioMembers, {
    initialFilters: { PortfolioId: id },
    limit: 20,
    enabled: Number.isFinite(id) && id > 0,
  });
  const members = pagination.data;

  const termYears = useMemo(() => details?.Years.map((y) => y.Year) ?? [], [details]);

  if (failed) {
    return (
      <div className="max-w-10xl mx-auto p-6">
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-600">
          This portfolio could not be opened. <Link className="text-blue-600 hover:underline" to="/multi-year/portfolios">Back to Portfolios</Link>
        </div>
      </div>
    );
  }
  if (!details) return <div className="flex justify-center py-8 text-gray-500">Loading portfolio...</div>;

  const p = details.Portfolio;
  const isPip = p.Kind === PIP;
  const canWriteCeilings = details.IsOpen && can('MultiYear', 'SaveBudgetCeilings');
  const tabs: Tab[] = can('MultiYear', 'ShowSavedTotals') ? ['projects', 'ceilings', 'totals'] : ['projects', 'ceilings'];
  const refreshAll = () => {
    pagination.refresh();
    loadDetails();
  };

  const applyFilters = () =>
    pagination.applyFilters({ PortfolioId: id, Search: search.trim() || undefined, Status: statusFilter || undefined });

  const saveCeilings = async () => {
    const rows = Object.entries(ceilings)
      .filter(([, v]) => v !== '')
      .map(([year, v]) => ({ Year: Number(year), Amount: Number(v) }));
    if (rows.length === 0) {
      showToast({ type: 'error', message: 'Enter a budget ceiling for at least one year.' });
      return;
    }
    const bad = rows.find((r) => !Number.isFinite(r.Amount) || r.Amount < 0);
    if (bad) {
      showToast({ type: 'error', message: `The budget ceiling for ${bad.Year} must be zero or more.` });
      return;
    }
    try {
      const response = await Service.saveBudgetCeilings(id, rows);
      showToast({ type: 'success', message: response.Data.Message });
      setDetails(response.Data.Details);
    } catch (error) {
      if (!(error as { Message?: string } | undefined)?.Message) {
        showToast({ type: 'error', message: 'Failed to save the budget ceilings. Please try again.' });
      }
    }
  };

  return (
    <div className="max-w-10xl mx-auto p-6 space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 px-6 py-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link to="/multi-year/portfolios" className="text-sm text-blue-600 hover:underline">Portfolios</Link>
            <h3 className="text-lg font-medium text-gray-900 flex items-center gap-3">
              {p.Name} <PortfolioStatusBadge status={p.Status} />
            </h3>
            <p className="text-sm text-gray-500">{KIND_DESCRIPTIONS[p.Kind]}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {details.CanAddProjects && can('MultiYear', 'AddPlanningProject') && (
              <Button color="green" onClick={() => navigate(`/multi-year/portfolios/${id}/add-project`)}>
                <PlusIcon className="w-4 h-4 mr-1" />
                Add Planning Project
              </Button>
            )}
            {details.CanAddProjects && can('MultiYear', 'ImportPlanningProjects') && (
              <Button outline onClick={() => setImporting(true)}>
                <ArrowUpTrayIcon className="w-4 h-4 mr-1" />
                Import Projects
              </Button>
            )}
            {isPip && details.IsOpen && can('MultiYear', 'AddToPip') && (
              <Button color="green" onClick={() => setAddingToPip(true)}>
                <PlusIcon className="w-4 h-4 mr-1" />
                Add Project to PIP
              </Button>
            )}
            {details.IsOpen && can('MultiYear', 'OpenNextTerm') && (
              <Button outline onClick={() => setOpeningNext(true)}>
                Open Next Term
                <ArrowRightIcon className="w-4 h-4 ml-1" />
              </Button>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-6 text-sm text-gray-700">
          <span>Projects: <strong>{p.ProjectCount}</strong></span>
          <span>Planned cost (not cancelled): <strong>{formatPeso(p.PlannedCost)}</strong></span>
          {details.StatusCounts.map((s) => (
            <span key={s.Status}>{STATUS_NAMES[s.Status]}: <strong>{s.Count}</strong></span>
          ))}
          {p.PreviousPortfolioId && <Link className="text-blue-600 hover:underline" to={`/multi-year/portfolios/${p.PreviousPortfolioId}`}>Previous term</Link>}
          {p.NextPortfolioId && <Link className="text-blue-600 hover:underline" to={`/multi-year/portfolios/${p.NextPortfolioId}`}>Next term</Link>}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="flex gap-6 px-6 border-b border-gray-200">
          {tabs.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`py-3 text-sm font-medium border-b-2 ${tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              {TAB_NAMES[t]}
            </button>
          ))}
        </div>

        {tab === 'projects' && (
          <div className="p-6 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  maxLength={100}
                  placeholder="Search Project ID or description..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-500"
                />
              </div>
              <select
                aria-label="Status"
                className="py-2 px-3 border border-gray-300 rounded-lg bg-white text-sm text-gray-900"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value ? (Number(e.target.value) as MembershipStatus) : '')}
              >
                <option value="">All statuses</option>
                {([1, 2, 3, 4, 5] as MembershipStatus[]).map((s) => <option key={s} value={s}>{STATUS_NAMES[s]}</option>)}
              </select>
              <Button color="blue" onClick={applyFilters}>Search</Button>
            </div>

            {pagination.isLoading ? (
              <div className="flex justify-center py-8 text-gray-500">Loading projects...</div>
            ) : members.lists.length === 0 ? (
              <div className="flex justify-center py-8 text-gray-500">No projects in this portfolio yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-700">Project ID</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-700">Description</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-700">Category</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-700">Status</th>
                      {isPip && <th className="px-3 py-2 text-left font-medium text-gray-700">From</th>}
                      <th className="px-3 py-2 text-left font-medium text-gray-700">Start</th>
                      {termYears.map((y) => <th key={y} className="px-3 py-2 text-right font-medium text-gray-700">{y}</th>)}
                      <th className="px-3 py-2 text-right font-medium text-gray-700">Later Years</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-700">Total</th>
                      {isPip && <th className="px-3 py-2 text-right font-medium text-gray-700">PIP Cost</th>}
                      {isPip && <th className="px-3 py-2 text-right font-medium text-gray-700">Original Cost</th>}
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {members.lists.map((m) => {
                      const amounts = parseYearAmounts(m.YearAmounts);
                      const later = amounts.filter((a) => a.Year > p.TermEndYear).reduce((s, a) => s + a.Amount, 0);
                      return (
                        <tr key={m.Id}>
                          <td className="px-3 py-2 whitespace-nowrap">
                            <Link className="font-mono text-blue-600 hover:underline" to={`/multi-year/projects/${m.ProjectId}`}>{m.ProjectId}</Link>
                            {m.IsOwner && <span className="ml-2 text-xs text-gray-500">owner</span>}
                          </td>
                          <td className="px-3 py-2 min-w-64">{m.Description}</td>
                          <td className="px-3 py-2">{m.CategoryName ?? m.Category}</td>
                          <td className="px-3 py-2"><MembershipStatusBadge status={m.Status} /></td>
                          {isPip && <td className="px-3 py-2">{m.SourcePortfolioName ?? 'Added from the GAA'}</td>}
                          <td className="px-3 py-2">{m.StartYear}</td>
                          {termYears.map((y) => {
                            const a = amounts.find((x) => x.Year === y);
                            return <td key={y} className="px-3 py-2 text-right whitespace-nowrap">{a ? formatPeso(a.Amount) : '–'}</td>;
                          })}
                          <td className="px-3 py-2 text-right whitespace-nowrap">{later ? formatPeso(later) : '–'}</td>
                          <td className="px-3 py-2 text-right whitespace-nowrap font-medium">{formatPeso(m.PlannedTotal)}</td>
                          {isPip && <td className="px-3 py-2 text-right whitespace-nowrap">{formatPeso(m.Cost)}</td>}
                          {isPip && <td className="px-3 py-2 text-right whitespace-nowrap">{m.OriginalCost === null ? '–' : formatPeso(m.OriginalCost)}</td>}
                          <td className="px-3 py-2 text-right whitespace-nowrap">
                            {isPip && details.IsOpen && !isLocked(m.Status) && can('MultiYear', 'SetPipCost') && (
                              <Button plain onClick={() => setPipCostFor(m)}>Set PIP Cost</Button>
                            )}
                            {m.AllowedStatuses.length > 0 && can('MultiYear', 'SetMembershipStatus') && (
                              <Button plain onClick={() => setStatusFor(m)}>Set Status</Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <PaginationBar
              currentPage={members.page}
              totalPages={members.totalPages}
              hasPrevious={pagination.hasPrevious}
              hasNext={pagination.hasNext}
              onGoToPage={pagination.goToPage}
              onNext={pagination.goNext}
              onPrevious={pagination.goPrevious}
              onFirst={pagination.goFirst}
              onLast={pagination.goLast}
              isLoading={pagination.isLoading}
            />
          </div>
        )}

        {tab === 'totals' && (
          <div className="p-6">
            <SavedTotalsTab portfolioId={id} canSave={details.IsOpen && can('MultiYear', 'SaveTotals')} />
          </div>
        )}

        {tab === 'ceilings' && (
          <div className="p-6 space-y-4">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-gray-700">Year</th>
                  <th className="px-4 py-2 text-right font-medium text-gray-700">Planned</th>
                  <th className="px-4 py-2 text-right font-medium text-gray-700">Budget Ceiling (₱)</th>
                  <th className="px-4 py-2 text-right font-medium text-gray-700">Ceiling less Planned</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {details.Years.map((y) => {
                  const ceiling = ceilings[y.Year] === '' || ceilings[y.Year] === undefined ? null : Number(ceilings[y.Year]);
                  const room = ceiling === null ? null : ceiling - y.Planned;
                  return (
                    <tr key={y.Year}>
                      <td className="px-4 py-2">{y.Year}</td>
                      <td className="px-4 py-2 text-right">{formatPeso(y.Planned)}</td>
                      <td className="px-4 py-2 text-right">
                        {canWriteCeilings ? (
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            aria-label={`Budget ceiling for ${y.Year}`}
                            value={ceilings[y.Year] ?? ''}
                            onChange={(e) => setCeilings({ ...ceilings, [y.Year]: e.target.value })}
                            className="w-48 px-2 py-1 border border-gray-300 rounded-md text-right"
                          />
                        ) : y.Ceiling === null ? '–' : formatPeso(y.Ceiling)}
                      </td>
                      <td className={`px-4 py-2 text-right ${room !== null && room < 0 ? 'text-red-600 font-medium' : ''}`}>
                        {room === null ? '–' : formatPeso(room)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="text-sm text-gray-500">
              Planned cost of every project that is not cancelled. Before the term: {formatPeso(details.PlannedBeforeTerm)}; after it: {formatPeso(details.PlannedLaterYears)}.
            </p>
            {canWriteCeilings && (
              <div className="flex justify-end">
                <Button color="green" onClick={saveCeilings}>Save Budget Ceilings</Button>
              </div>
            )}
          </div>
        )}
      </div>

      <OpenNextTermDialog
        open={openingNext}
        onClose={() => setOpeningNext(false)}
        portfolio={p}
        termHasEnded={details.TermHasEnded}
        onOpened={(nextId) => {
          setOpeningNext(false);
          navigate(`/multi-year/portfolios/${nextId}`);
        }}
      />
      {importing && (
        <ImportPlanningDialog
          open={importing}
          onClose={() => setImporting(false)}
          portfolioId={id}
          portfolioName={p.Name}
          templateName={`PlanningProjects_${p.KindName}_${p.TermStartYear}.xlsx`}
          onImported={refreshAll}
        />
      )}
      {addingToPip && (
        <AddToPipDialog
          open={addingToPip}
          onClose={() => setAddingToPip(false)}
          portfolioId={id}
          onSaved={() => {
            setAddingToPip(false);
            refreshAll();
          }}
        />
      )}
      {pipCostFor && (
        <SetPipCostDialog
          open={!!pipCostFor}
          onClose={() => setPipCostFor(null)}
          memberId={pipCostFor.Id}
          projectId={pipCostFor.ProjectId}
          cost={pipCostFor.Cost}
          originalCost={pipCostFor.OriginalCost}
          onSaved={() => {
            setPipCostFor(null);
            refreshAll();
          }}
        />
      )}
      {statusFor && (
        <MembershipStatusDialog
          open={!!statusFor}
          onClose={() => setStatusFor(null)}
          memberId={statusFor.Id}
          projectId={statusFor.ProjectId}
          current={statusFor.Status}
          allowed={statusFor.AllowedStatuses}
          onSaved={() => {
            setStatusFor(null);
            pagination.refresh();
            loadDetails();
          }}
        />
      )}
    </div>
  );
};

export default PortfolioDetail;
