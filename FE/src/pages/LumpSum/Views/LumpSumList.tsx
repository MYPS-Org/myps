// =============================================================================
// LumpSumList.tsx — the Lump Sum Project grid.
//
// NO BALANCE FETCH. Each row already carries its own allocation figures:
// vLumpSumSet computes Remaining, ItemizedTotal and OriginalAllocation per
// project, so the list needs nothing beyond ShowLumpSum. The wallet-era page
// called a balance hook that recomputed the same numbers from mock state.
//
// The filter bar is fed by InitFilterLumpSum, which only offers programs that
// actually hold a Lump Sum Project — filtering by one that holds none can never
// return a row.
//
// PAGING IS THE SHARED KEYSET HOOK (2026-09-10), not a local page number. The
// server has no OFFSET: FilterDataCursor answers a Navigation mode plus the
// cursor that mode needs, and a request carrying neither is treated as First.
// This page used to hold its own page number and send it bare, so every click
// was answered with page 1 and the grid never moved. usePagination owns the
// cursors; PaginationBar draws the same bar as Program and Project.
// =============================================================================

import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PaginationBar } from '../../../components/tailwindui/PaginationBar';
import { usePagination } from '../../../hooks/usePagination';
import { CollapsibleTable } from '../../../components/tailwindui/collapsible-table';
import { Button } from '../../../components/tailwindui/button';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import * as Service from '../Service';
import LumpSumStatusBadge from '../utils/lumpSumStatusBadge';
import type { LumpSum, LumpSumFilter, LumpSumFilterOptions } from '../Model.d';

/** Every data cell in the list: centred, and free to wrap inside the nowrap Table wrapper. */
const CELL = 'text-center whitespace-normal break-words align-middle';

const LumpSumList: React.FC = () => {
  const navigate = useNavigate();

  /*  The hook fetches page 1 itself on mount and keeps the cursors from every
      response. initialFilters is an empty OBJECT rather than undefined: the
      controller reads dto.Filters.ProgramFK with no null check, and an omitted
      key throws there. Service.fetchLumpSumList is module-level, so its
      identity is stable and the hook does not refetch on every render. */
  const pagination = usePagination<LumpSumFilter, LumpSum>(Service.fetchLumpSumList, {
    initialFilters: {},
    limit: 10,
  });
  const pageData = pagination.data;

  const [filterOptions, setFilterOptions] = useState<LumpSumFilterOptions | null>(null);

  // Draft filter state — applied on Search, not on every keystroke.
  const [draft, setDraft] = useState<LumpSumFilter>({});

  useEffect(() => {
    Service.fetchLumpSumFilterOptions()
      .then((response) => setFilterOptions(response.Data))
      .catch(() => {
        // httpClient's interceptor already surfaced the error; the bar degrades
        // to the free-text box, which is still usable.
      });
    // Mount only — the list itself is fetched by usePagination.
  }, []);

  /*  applyFilters clears the keyset cursors before refetching. Paging on with a
      cursor from the old filter set would ask the server to walk from a row
      that is no longer in the result. */
  const handleSearch = () => pagination.applyFilters(draft);

  const handleClear = () => {
    setDraft({});
    pagination.applyFilters({});
  };

  const isSet = (filter: LumpSumFilter | undefined) =>
    Object.values(filter ?? {}).some((v) => v !== undefined && v !== '');
  const hasFilters = isSet(draft);
  // The filters the grid was last drawn with, not the draft being typed.
  const filtersApplied = isSet(pagination.currentFilters);

  const formatCurrency = (amount: number) => `₱${amount.toLocaleString('en-PH')}`;

  return (
    <div className="max-w-10xl mx-auto p-6 space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="overflow-hidden">
          {/* Header strip */}
          <div className="px-6 py-4 border-b border-gray-200 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">Lump Sum Projects</h3>
              <Button color="green" onClick={() => navigate('/lumpsum/add')}>
                <PlusIcon className="w-4 h-4 mr-1" />
                Add Lump Sum Project
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Free text — matched against the project's Description. This is
                  the only LIKE filter the server offers; the box used to be
                  labelled "Operating Unit" and fed an equality comparison, so any
                  partial input silently returned an empty grid. */}
              <div className="relative">
                <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by description..."
                  value={draft.ProgramName ?? ''}
                  onChange={(e) => setDraft({ ...draft, ProgramName: e.target.value || undefined })}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <select
                value={draft.ProgramFK ?? ''}
                onChange={(e) => setDraft({ ...draft, ProgramFK: e.target.value || undefined })}
                className="py-2 px-3 border border-gray-300 rounded-lg bg-white text-sm text-gray-900"
              >
                <option value="">All programs</option>
                {filterOptions?.Programs.map((p) => (
                  <option key={p.ProgramFK} value={p.ProgramFK}>
                    {p.ProgramName}
                  </option>
                ))}
              </select>

              <select
                value={draft.CurrentStage ?? ''}
                onChange={(e) => setDraft({ ...draft, CurrentStage: e.target.value || undefined })}
                className="py-2 px-3 border border-gray-300 rounded-lg bg-white text-sm text-gray-900"
              >
                <option value="">All stages</option>
                {filterOptions?.Stages.map((s) => (
                  <option key={s.NameId} value={s.Name}>
                    {s.Name}
                  </option>
                ))}
              </select>

              <select
                value={draft.CategoryId ?? ''}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    CategoryId: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
                className="py-2 px-3 border border-gray-300 rounded-lg bg-white text-sm text-gray-900 max-w-xs"
              >
                <option value="">All categories</option>
                {filterOptions?.Categories.map((c) => (
                  <option key={c.CategoryId} value={c.CategoryId}>
                    {c.CategoryName}
                  </option>
                ))}
              </select>

              <select
                value={draft.YearStart ?? ''}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    YearStart: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
                className="py-2 px-3 border border-gray-300 rounded-lg bg-white text-sm text-gray-900"
              >
                <option value="">All years</option>
                {filterOptions?.Years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>

              <Button color="blue" onClick={handleSearch} className="text-xs px-3 py-1.5">
                <MagnifyingGlassIcon className="w-4 h-4 mr-1" />
                Search
              </Button>
              {hasFilters && (
                <Button color="zinc" onClick={handleClear} className="text-xs px-3 py-1.5">
                  <XMarkIcon className="w-4 h-4 mr-1" />
                  Clear
                </Button>
              )}
            </div>
          </div>

          {/*  No inline error banner: the hook logs the failure and httpClient's
               interceptor raises the toast, which is how every other list in the
               app reports a page that would not load. */}

          {pagination.isLoading && (
            <div className="flex justify-center py-8">
              <div className="text-gray-500">Loading Lump Sum Projects...</div>
            </div>
          )}

          {!pagination.isLoading && pageData.lists.length > 0 && (
            <>
              {/*  Every column centred and allowed to wrap (CELL). The shared <Table>
                   wrapper sets whitespace-nowrap so wide tables scroll rather than
                   fold; the cells opt back out so a long Description or Program name
                   breaks onto a second line instead of forcing a horizontal scrollbar. */}
              <CollapsibleTable
                columns={[
                  {
                    header: 'Project ID',
                    justify: 'center',
                    className: CELL,
                    /*  The ID opens the project, same destination as the View button —
                        vLumpSumSet.Id is the route key, not the Project ID string. */
                    render: (row) => (
                      <Link
                        to={`/lumpsum/${row.Id}`}
                        className="font-mono text-sm text-blue-600 hover:underline"
                        title="Open this Lump Sum Project"
                      >
                        {row.ProjectId}
                      </Link>
                    ),
                  },
                  { header: 'Description', justify: 'center', className: CELL, render: (row) => row.Description ?? '-' },
                  { header: 'Program', justify: 'center', className: CELL, render: (row) => row.ProgramName },
                  { header: 'Category', justify: 'center', className: CELL, render: (row) => row.CategoryName },
                  {
                    header: 'Stage',
                    justify: 'center',
                    className: CELL,
                    render: (row) => <LumpSumStatusBadge stage={row.CurrentStage} />,
                  },
                  {
                    header: 'Allocation / Remaining',
                    justify: 'center',
                    className: CELL,
                    render: (row) => (
                      <div className="text-sm">
                        <div>{formatCurrency(row.Allocation)}</div>
                        <div className="text-gray-500">
                          {formatCurrency(row.Remaining)} remaining
                        </div>
                      </div>
                    ),
                  },
                  {
                    header: 'Itemized',
                    justify: 'center',
                    className: CELL,
                    render: (row) => (
                      <span className="text-sm text-gray-600">{row.ItemizedCount}</span>
                    ),
                  },
                  /*  No Created and no Actions column (removed 2026-09-05): the
                      Project ID link is the way into a project, and the row is
                      about the allocation, not its audit stamp. */
                ]}
                data={pageData.lists}
                rowKey={(row) => String(row.Id)}
                isRowExpanded={() => false}
                onToggleRow={() => {}}
              />

              {/*  Previous and Next come from the server's own HasPrevious and
                   HasNext. A numbered jump to a page this session has not opened
                   is walked there hop by hop inside the hook, because the server
                   cannot seek to an arbitrary page. */}
              <div className="my-6">
                <PaginationBar
                  currentPage={pageData.page}
                  totalPages={pageData.totalPages}
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

              <div className="mb-3.5 text-center">
                {/* Client doesn't want the "Showing X of Y" summary — commented out, not deleted.
                <p className="text-sm text-gray-500">
                  Showing {pageData.lists.length} of {pageData.total} Lump Sum Projects
                </p>
                */}
              </div>
            </>
          )}

          {/*  S07-TC001-P002: an empty search said "No Lump Sum Projects found." and offered
               "Create the first one", as if the module held none. */}
          {!pagination.isLoading && pageData.lists.length === 0 && (
            filtersApplied ? (
              <div className="text-center py-8">
                <p className="text-gray-600">No Lump Sum Projects match your filters.</p>
                <Button color="zinc" onClick={handleClear} className="mt-4">
                  <XMarkIcon className="w-4 h-4 mr-1" />
                  Clear filters
                </Button>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-600">No Lump Sum Projects found.</p>
                <Button color="green" onClick={() => navigate('/lumpsum/add')} className="mt-4">
                  <PlusIcon className="w-4 h-4 mr-1" />
                  Create the first one
                </Button>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default LumpSumList;
