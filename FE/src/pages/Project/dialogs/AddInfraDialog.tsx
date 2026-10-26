import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { Button } from '../../../components/tailwindui/button';
import { XMarkIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { Table, TableHead, TableBody, TableRow, TableCell, TableHeader } from '../../../components/tailwindui/table';
import { PaginationBar } from '../../../components/tailwindui/PaginationBar';
import { usePagination } from '../../../hooks/usePagination';
import type { InfraData } from '../Model.d';
import { fetchInfraRoadSections, fetchInfraBridges } from '../../Rbia/Service';
import type { InfraRoadSectionOption, InfraBridgeOption, InfraRoadSectionFilter, InfraBridgeFilter, InfraRoadSectionPagination, InfraBridgePagination } from '../../Rbia/Model.d';
import { isRoadInfraType, isBridgeInfraType } from '../../../utils/infraIdGenerator';

interface AddInfraDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (infraId: string, infraName: string, infraType: string, length?: number) => void;
  initialData?: InfraData;
  mode?: 'add' | 'edit';
  infraType?: string;
  deo?: string;
}

// The BE's ShowInfraRoadSections/ShowInfraBridges endpoints use keyset pagination
// (Helpers.QueryPaginationExtensions.FilterDataCursor) — a request must carry Navigation
// (+ the matching cursor) or the BE silently forces page 1 (its DTO default is Navigation.First).
// These adapters translate usePagination's PaginatedRequest<TFilter> shape into the
// lowercase-`filters` request shape fetchInfraRoadSections/fetchInfraBridges already expect,
// forwarding the keyset fields through untouched.
const fetchRoadSectionsForDialog = (params: PaginatedRequest<InfraRoadSectionFilter>) =>
  fetchInfraRoadSections({
    filters: params.Filters,
    sortField: params.SortField ?? '',
    sortDirection: params.sortDirection ?? 1,
    page: params.page,
    limit: params.limit,
    Navigation: params.Navigation,
    PreviousFilteredId: params.PreviousFilteredId,
    NextFilteredId: params.NextFilteredId,
    PageCursorId: params.PageCursorId,
  } as InfraRoadSectionPagination);

const fetchBridgesForDialog = (params: PaginatedRequest<InfraBridgeFilter>) =>
  fetchInfraBridges({
    filters: params.Filters,
    sortField: params.SortField ?? '',
    sortDirection: params.sortDirection ?? 1,
    page: params.page,
    limit: params.limit,
    Navigation: params.Navigation,
    PreviousFilteredId: params.PreviousFilteredId,
    NextFilteredId: params.NextFilteredId,
    PageCursorId: params.PageCursorId,
  } as InfraBridgePagination);

interface RoadSectionsPaneProps {
  deo?: string;
  search: string;
  pageSize: number;
  selectedInfraId?: string;
  onSelect: (id: string, name: string, type: string, length?: number) => void;
  onPageSizeChange: (size: number) => void;
}

const RoadSectionsPane: React.FC<RoadSectionsPaneProps> = ({ deo, search, pageSize, selectedInfraId, onSelect, onPageSizeChange }) => {
  const pagination = usePagination<InfraRoadSectionFilter, InfraRoadSectionOption>(fetchRoadSectionsForDialog, {
    initialFilters: { DEO: deo || '', Search: search },
    limit: pageSize,
    enabled: !!deo,
  });

  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (!deo) return;
    pagination.applyFilters({ DEO: deo, Search: search });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, deo]);

  const { data, isLoading, hasPrevious, hasNext, goToPage, goNext, goPrevious, goFirst, goLast } = pagination;

  if (!deo) {
    return <div className="flex-1 px-6 py-8 text-center text-gray-500">A DEO is required to browse road sections.</div>;
  }

  return (
    <>
      <div className="flex-1 overflow-auto px-6 py-4">
        {isLoading ? (
          <div className="text-center py-8">Loading road sections...</div>
        ) : data.lists.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No road sections found</div>
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader justify="center" className="w-16">Select</TableHeader>
                <TableHeader>Section ID</TableHeader>
                <TableHeader>Road Name</TableHeader>
                <TableHeader justify="end">Length (m)</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.lists.map((road) => (
                <TableRow key={road.Id}>
                  <TableCell className="text-center">
                    <input
                      type="radio"
                      name="infraSelection"
                      value={road.RoadSectionId}
                      checked={selectedInfraId === road.RoadSectionId}
                      onChange={() => onSelect(road.RoadSectionId, road.RoadName || road.RoadId, 'Roads', road.LengthM)}
                      className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300"
                    />
                  </TableCell>
                  <TableCell className="font-medium">{road.RoadSectionId}</TableCell>
                  <TableCell>{road.RoadName || road.RoadId}</TableCell>
                  <TableCell className="text-right">{road.LengthM}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {!isLoading && data.total > 0 && (
        <div className="px-6 py-3 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-sm text-gray-600">
            {/* Client doesn't want the "Showing X of Y" summary — commented out, not deleted.
            <span>
              Showing{' '}
              <span className="font-medium">{(data.page - 1) * data.limit + 1}</span>
              {' '}–{' '}
              <span className="font-medium">{Math.min(data.page * data.limit, data.total)}</span>
              {' '}of{' '}
              <span className="font-medium">{data.total}</span>
            </span>
            */}
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="border border-gray-300 rounded px-2 py-1 text-sm focus:ring-orange-500 focus:border-orange-500"
            >
              {[5, 10, 20, 50, 1000].map((s) => (
                <option key={s} value={s}>{s} / page</option>
              ))}
            </select>
          </div>
          <PaginationBar
            currentPage={data.page}
            totalPages={data.totalPages}
            hasPrevious={hasPrevious}
            hasNext={hasNext}
            onGoToPage={goToPage}
            onNext={goNext}
            onPrevious={goPrevious}
            onFirst={goFirst}
            onLast={goLast}
            isLoading={isLoading}
          />
        </div>
      )}
    </>
  );
};

interface BridgesPaneProps {
  deo?: string;
  selectedRoadSectionId: string;
  search: string;
  pageSize: number;
  selectedInfraId?: string;
  onSelect: (id: string, name: string, type: string, length?: number) => void;
  onPageSizeChange: (size: number) => void;
}

const BridgesPane: React.FC<BridgesPaneProps> = ({ deo, selectedRoadSectionId, search, pageSize, selectedInfraId, onSelect, onPageSizeChange }) => {
  const pagination = usePagination<InfraBridgeFilter, InfraBridgeOption>(fetchBridgesForDialog, {
    initialFilters: { DEO: deo || '', RoadSectionId: selectedRoadSectionId || '', Search: search },
    limit: pageSize,
    enabled: !!deo,
  });

  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (!deo) return;
    pagination.applyFilters({ DEO: deo, RoadSectionId: selectedRoadSectionId || '', Search: search });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, selectedRoadSectionId, deo]);

  const { data, isLoading, hasPrevious, hasNext, goToPage, goNext, goPrevious, goFirst, goLast } = pagination;

  if (!deo) {
    return <div className="flex-1 px-6 py-8 text-center text-gray-500">A DEO is required to browse bridges.</div>;
  }

  return (
    <>
      <div className="flex-1 overflow-auto px-6 py-4">
        {isLoading ? (
          <div className="text-center py-8">Loading bridges...</div>
        ) : data.lists.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No bridges found</div>
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader justify="center" className="w-16">Select</TableHeader>
                <TableHeader>Bridge ID</TableHeader>
                <TableHeader>Bridge Name</TableHeader>
                <TableHeader>Road Section ID</TableHeader>
                <TableHeader justify="end">Length (m)</TableHeader>
                <TableHeader justify="end">Overall Width (m)</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.lists.map((bridge) => (
                <TableRow key={bridge.Id}>
                  <TableCell className="text-center">
                    <input
                      type="radio"
                      name="infraSelection"
                      value={bridge.BridgeId}
                      checked={selectedInfraId === bridge.BridgeId}
                      onChange={() => onSelect(bridge.BridgeId, bridge.BridgeName || bridge.BridgeId, 'Bridges', bridge.Length)}
                      className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300"
                    />
                  </TableCell>
                  <TableCell className="font-medium">{bridge.BridgeId}</TableCell>
                  <TableCell>{bridge.BridgeName}</TableCell>
                  <TableCell>{bridge.RoadSectionId}</TableCell>
                  <TableCell className="text-right">{bridge.Length}</TableCell>
                  <TableCell className="text-right">{bridge.OverallWidth}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {!isLoading && data.total > 0 && (
        <div className="px-6 py-3 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-sm text-gray-600">
            {/* Client doesn't want the "Showing X of Y" summary — commented out, not deleted.
            <span>
              Showing{' '}
              <span className="font-medium">{(data.page - 1) * data.limit + 1}</span>
              {' '}–{' '}
              <span className="font-medium">{Math.min(data.page * data.limit, data.total)}</span>
              {' '}of{' '}
              <span className="font-medium">{data.total}</span>
            </span>
            */}
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="border border-gray-300 rounded px-2 py-1 text-sm focus:ring-orange-500 focus:border-orange-500"
            >
              {[5, 10, 20, 50, 1000].map((s) => (
                <option key={s} value={s}>{s} / page</option>
              ))}
            </select>
          </div>
          <PaginationBar
            currentPage={data.page}
            totalPages={data.totalPages}
            hasPrevious={hasPrevious}
            hasNext={hasNext}
            onGoToPage={goToPage}
            onNext={goNext}
            onPrevious={goPrevious}
            onFirst={goFirst}
            onLast={goLast}
            isLoading={isLoading}
          />
        </div>
      )}
    </>
  );
};

const AddInfraDialog: React.FC<AddInfraDialogProps> = ({
  isOpen,
  onClose,
  onAdd,
  // initialData,
  mode = 'add',
  infraType,
  deo
}) => {

  // Set initial active tab based on infraType
  const getInitialTab = (): 'road' | 'bridge' => {
    if (isBridgeInfraType(infraType || '')) return 'bridge';
    return 'road';
  };

  const [activeTab, setActiveTab] = useState<'road' | 'bridge' /*| 'fcs' | 'other'*/>(getInitialTab());
  const [selectedInfra, setSelectedInfra] = useState<{
    id: string;
    name: string;
    type: string;
    length?: number;
  } | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  // Committed search value — only updated on Enter/submit, so typing doesn't refetch on every keystroke.
  const [submittedSearch, setSubmittedSearch] = useState<string>('');
  const [pageSize, setPageSize] = useState<number>(10);
  const [deoRoadSections, setDeoRoadSections] = useState<InfraRoadSectionOption[]>([]);
  const [selectedRoadSectionId, setSelectedRoadSectionId] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setSelectedInfra(null);
      setSearchTerm('');
      setSubmittedSearch('');
      setSelectedRoadSectionId('');
      setActiveTab(getInitialTab());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, infraType]);

  // Reset road section filter and search when tab changes
  useEffect(() => {
    setSelectedRoadSectionId('');
    setSearchTerm('');
    setSubmittedSearch('');
  }, [activeTab]);

  // Fetch road sections for DEO when bridge tab becomes active
  useEffect(() => {
    if (isOpen && activeTab === 'bridge' && deo) {
      fetchInfraRoadSections({
        filters: { DEO: deo, RoadName: '' },
        sortField: '',
        sortDirection: 1,
        page: 1,
        limit: 1000
      }).then(res => setDeoRoadSections(res.Data.lists || [])).catch(() => {});
    }
  }, [isOpen, activeTab, deo]);

  const handleClose = () => {
    setSelectedInfra(null);
    setSearchTerm('');
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedInfra) {
      onAdd(selectedInfra.id, selectedInfra.name, selectedInfra.type, selectedInfra.length);
      handleClose();
    } else {
      alert('Please select an infrastructure item');
    }
  };

  const handleInfraSelect = (id: string, name: string, type: string, length?: number) => {
    setSelectedInfra({ id, name, type, length });
  };

  const tabs = [
    { id: 'road', label: 'Road Sections', icon: '' },
    { id: 'bridge', label: 'Bridges', icon: '' },
    { id: 'fcs', label: 'FCS', icon: '' },
    { id: 'other', label: 'Other Infrastructure', icon: '' },
  ];

  // Filter tabs based on infraType using exact InfraCode matching
  const getAvailableTabs = () => {
    if (isRoadInfraType(infraType || '')) return tabs.filter(tab => tab.id === 'road');
    if (isBridgeInfraType(infraType || '')) return tabs.filter(tab => tab.id === 'bridge');
    // For other types or undefined infraType, show only road and bridge tabs for now
    return tabs.filter(tab => tab.id === 'road' || tab.id === 'bridge');
  };

  const availableTabs = getAvailableTabs();

  const handleSearchSubmit = () => {
    setSubmittedSearch(searchTerm);
  };

  const handleRoadSectionFilterChange = (roadSectionId: string) => {
    setSelectedRoadSectionId(roadSectionId);
    setSearchTerm('');
    setSubmittedSearch('');
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
  };

  return (
    <Dialog open={isOpen} onClose={handleClose} className="relative z-50">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />

      {/* Full-screen container */}
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="w-full max-w-7xl bg-white rounded-lg shadow-xl max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <DialogTitle className="text-lg font-semibold text-gray-900">
              {mode === 'add' ? 'Select Infrastructure' : 'Edit Infrastructure Selection'}
            </DialogTitle>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          {/* Tab Navigation */}
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6" aria-label="Tabs">
              {availableTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
                    activeTab === tab.id
                      ? 'border-orange-500 text-orange-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <span className="flex items-center space-x-2">
                    <span>{tab.icon}</span>
                    <span>{tab.label}</span>
                  </span>
                </button>
              ))}
            </nav>
          </div>

          {/* Search Bar */}
          <div className="flex flex-cols-2 gap-4 px-6 py-4 border-b border-gray-200 space-y-2">
            {/* Road Section filter — bridge tab only */}
            {activeTab === 'bridge' && deoRoadSections.length > 0 && (
              <div className="flex flex-1 items-center gap-2">
                <label className="text-sm text-gray-600 whitespace-nowrap">Road Section:</label>
                <select
                  value={selectedRoadSectionId}
                  onChange={(e) => handleRoadSectionFilterChange(e.target.value)}
                  className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-orange-500 focus:border-orange-500"
                >
                  <option value="">All Road Sections</option>
                  {deoRoadSections.map((rs) => (
                    <option key={rs.Id} value={rs.RoadSectionId}>
                      {rs.RoadSectionId}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="relative flex flex-1 items-center gap-2">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder={activeTab === 'bridge' ? 'Search by Bridge ID or Bridge Name...' : 'Search by Section ID or Road Name...'}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearchSubmit()}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
          </div>

          {/* Content + Pagination */}
          {isOpen && activeTab === 'road' && (
            <RoadSectionsPane
              key={pageSize}
              deo={deo}
              search={submittedSearch}
              pageSize={pageSize}
              selectedInfraId={selectedInfra?.id}
              onSelect={handleInfraSelect}
              onPageSizeChange={handlePageSizeChange}
            />
          )}
          {isOpen && activeTab === 'bridge' && (
            <BridgesPane
              key={pageSize}
              deo={deo}
              selectedRoadSectionId={selectedRoadSectionId}
              search={submittedSearch}
              pageSize={pageSize}
              selectedInfraId={selectedInfra?.id}
              onSelect={handleInfraSelect}
              onPageSizeChange={handlePageSizeChange}
            />
          )}

          {/* Selected Info */}
          {selectedInfra && (
            <div className="px-6 py-3 bg-orange-50 border-t border-orange-200">
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium text-orange-900">Selected:</span>
                <span className="text-sm text-orange-800">
                  {selectedInfra.type} - {selectedInfra.name} ({selectedInfra.id})
                </span>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex justify-end space-x-3 px-6 py-4 border-t border-gray-200">
            <Button type="button" color="zinc" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              type="button"
              color="orange"
              onClick={handleSubmit}
              disabled={!selectedInfra}
            >
              {mode === 'add' ? 'Add Infrastructure' : 'Update Selection'}
            </Button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
};

export default AddInfraDialog;
