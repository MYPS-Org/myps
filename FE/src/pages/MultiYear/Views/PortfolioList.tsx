// =============================================================================
// PortfolioList.tsx — the Multi-Year > Portfolios page (/multi-year/portfolios).
//
// RDIP, UDIP and PIP over fixed six-year terms. The server lists only the
// portfolios the user's group Project visibility allows (MultiYearAccess): their
// region's RDIP, their cluster's UDIP, PIP with All projects or the Show PIP
// grant. A few dozen rows per term, so no paging. GAA Updates (Phase 2) lists the
// portfolio update's runs and repeats it for a year (Admin and AUC).
// =============================================================================

import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowPathIcon, PlusIcon } from '@heroicons/react/24/outline';
import { Button } from '../../../components/tailwindui/button';
import { useAuth } from '../../../contexts/AuthContext';
import type { MultiYearFilterOptions, Portfolio, PortfolioFilter, PortfolioKind, PortfolioStatus } from '../Model.d';
import * as Service from '../Service';
import { KIND_NAMES, formatPeso } from '../utils';
import { PortfolioStatusBadge } from '../components/Shared';
import { CreatePortfolioDialog } from '../dialogs/PortfolioDialogs';
import { GaaUpdatesDialog } from '../dialogs/GaaUpdatesDialog';

const SELECT = 'py-2 px-3 border border-gray-300 rounded-lg bg-white text-sm text-gray-900';

const PortfolioList: React.FC = () => {
  const navigate = useNavigate();
  const { can } = useAuth();
  const [options, setOptions] = useState<MultiYearFilterOptions | null>(null);
  const [filter, setFilter] = useState<PortfolioFilter>({ Status: 1 });
  const [rows, setRows] = useState<Portfolio[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [showingUpdates, setShowingUpdates] = useState(false);

  useEffect(() => {
    Service.fetchFilterOptions().then((r) => setOptions(r.Data)).catch(() => undefined);
  }, []);

  const load = useCallback((f: PortfolioFilter) => {
    Service.fetchPortfolios(f).then((r) => setRows(r.Data)).catch(() => setRows([]));
  }, []);

  useEffect(() => load(filter), [filter, load]);

  const owners = filter.Kind === 1 ? options?.Regions : filter.Kind === 2 ? options?.Clusters : undefined;

  return (
    <div className="max-w-10xl mx-auto p-6 space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium text-gray-900">Multi-Year Portfolios</h3>
              <p className="text-sm text-gray-500">RDIP per region, UDIP per UPMO cluster and the national PIP, each over a six-year term.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {can('MultiYear', 'ShowUpdateRuns') && (
                <Button outline onClick={() => setShowingUpdates(true)}>
                  <ArrowPathIcon className="w-4 h-4 mr-1" />
                  GAA Updates
                </Button>
              )}
              {can('MultiYear', 'CreatePortfolio') && options && (
                <Button color="green" onClick={() => setCreating(true)}>
                  <PlusIcon className="w-4 h-4 mr-1" />
                  Create Portfolio
                </Button>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Portfolio"
              className={SELECT}
              value={filter.Kind ?? ''}
              onChange={(e) => setFilter({ ...filter, Kind: e.target.value ? (Number(e.target.value) as PortfolioKind) : undefined, OwnerParticipantId: undefined })}
            >
              <option value="">RDIP, UDIP and PIP</option>
              <option value={1}>RDIP</option>
              <option value={2}>UDIP</option>
              {options?.CanSeePip && <option value={3}>PIP</option>}
            </select>
            {owners && (
              <select
                aria-label="Owner"
                className={SELECT}
                value={filter.OwnerParticipantId ?? ''}
                onChange={(e) => setFilter({ ...filter, OwnerParticipantId: e.target.value || undefined })}
              >
                <option value="">{filter.Kind === 1 ? 'All regions' : 'All clusters'}</option>
                {owners.map((o) => <option key={o.ParticipantId} value={o.ParticipantId}>{o.Name}</option>)}
              </select>
            )}
            <select
              aria-label="Term status"
              className={SELECT}
              value={filter.Status ?? ''}
              onChange={(e) => setFilter({ ...filter, Status: e.target.value ? (Number(e.target.value) as PortfolioStatus) : undefined })}
            >
              <option value="">Open and closed terms</option>
              <option value={1}>Open terms</option>
              <option value={2}>Closed terms</option>
            </select>
            <input
              aria-label="Year"
              type="number"
              placeholder="Year"
              min={1990}
              max={2100}
              className={`${SELECT} w-28`}
              value={filter.Year ?? ''}
              onChange={(e) => setFilter({ ...filter, Year: e.target.value ? Number(e.target.value) : undefined })}
            />
          </div>
        </div>

        {rows === null ? (
          <div className="flex justify-center py-8 text-gray-500">Loading portfolios...</div>
        ) : rows.length === 0 ? (
          <div className="flex justify-center py-8 text-gray-500">No portfolios match.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Portfolio</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Owner</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Term</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Status</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-700">Projects</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-700">Planned Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((p) => (
                  <tr key={p.Id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/multi-year/portfolios/${p.Id}`)}>
                    <td className="px-4 py-3">
                      <Link to={`/multi-year/portfolios/${p.Id}`} className="text-blue-600 hover:underline font-medium" onClick={(e) => e.stopPropagation()}>
                        {KIND_NAMES[p.Kind]}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{p.OwnerName ?? 'National'}</td>
                    <td className="px-4 py-3">{p.Term}</td>
                    <td className="px-4 py-3"><PortfolioStatusBadge status={p.Status} /></td>
                    <td className="px-4 py-3 text-right">{p.ProjectCount}</td>
                    <td className="px-4 py-3 text-right">{formatPeso(p.PlannedCost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showingUpdates && (
        <GaaUpdatesDialog open={showingUpdates} onClose={() => setShowingUpdates(false)} onRan={() => load(filter)} />
      )}
      {options && (
        <CreatePortfolioDialog
          open={creating}
          onClose={() => setCreating(false)}
          options={options}
          onCreated={(id) => {
            setCreating(false);
            navigate(`/multi-year/portfolios/${id}`);
          }}
        />
      )}
    </div>
  );
};

export default PortfolioList;
