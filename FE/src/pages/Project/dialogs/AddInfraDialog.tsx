import React, { useState, useEffect } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { Button } from '../../../components/tailwindui/button';
import { XMarkIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { Table, TableHead, TableBody, TableRow, TableCell, TableHeader } from '../../../components/tailwindui/table';
import type { InfraData } from '../Model.d';
import { fetchRoadSectionData, fetchBridgeData } from '../../Rbia/Service';
import type { FutureRoadSections, FutureBridge } from '../../Rbia/Model.d';
import { isRoadInfraType, isBridgeInfraType } from '../../../utils/infraIdGenerator';

interface AddInfraDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (infraId: string, infraName: string, infraType: string) => void;
  initialData?: InfraData;
  mode?: 'add' | 'edit';
  infraType?: string;
  deo?: string;
}

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
  const [roadSections, setRoadSections] = useState<FutureRoadSections[]>([]);
  const [bridges, setBridges] = useState<FutureBridge[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [pageSize, setPageSize] = useState<number>(10);

  useEffect(() => {
    if (isOpen) {
      setSelectedInfra(null);
      setSearchTerm('');
      setCurrentPage(1);
      setTotalPages(1);
      setTotalCount(0);
      setActiveTab(getInitialTab());
    }
  }, [isOpen, infraType]);

  // Reset to page 1 when tab changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab]);

  // Fetch data when tab changes, page changes, or dialog opens
  useEffect(() => {
    if (isOpen) {
      fetchInfraData();
    }
  }, [isOpen, activeTab, currentPage, pageSize]);

  const fetchInfraData = async (page = currentPage, search = searchTerm) => {
    setLoading(true);
    try {
      if (activeTab === 'road') {
        const response = await fetchRoadSectionData({
          filters: {
            RoadId: '',
            RoadSectionId: search || '',
            DEO: deo || ''
          },
          sortField: '',
          sortDirection: 1,
          page,
          limit: pageSize
        });
        setRoadSections(response.Data.lists || []);
        setTotalPages(response.Data.totalPages ?? 1);
        setTotalCount(response.Data.total ?? 0);
      } else if (activeTab === 'bridge') {
        const response = await fetchBridgeData({
          filters: {
            RoadSectionId: '',
            BridgeId: '',
            Name: search || ''
          },
          sortField: '',
          sortDirection: 1,
          page,
          limit: pageSize
        });
        setBridges(response.Data.lists || []);
        setTotalPages(response.Data.totalPages ?? 1);
        setTotalCount(response.Data.total ?? 0);
      }
    } catch (error) {
      console.error('Error fetching infrastructure data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (page: number) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  const getPageNumbers = (): (number | '...')[] => {
    const pages: (number | '...')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('...');
      for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
        pages.push(i);
      }
      if (currentPage < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  const handleClose = () => {
    setSelectedInfra(null);
    setSearchTerm('');
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedInfra) {
      onAdd(selectedInfra.id, selectedInfra.name, selectedInfra.type);
      handleClose();
    } else {
      alert('Please select an infrastructure item');
    }
  };

  const handleInfraSelect = (id: string, name: string, type: string) => {
    setSelectedInfra({ id, name, type });
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
    setCurrentPage(1);
    fetchInfraData(1, searchTerm);
  };

  const renderRoadSections = () => {
    const filteredData = roadSections;
    
    if (loading) {
      return <div className="text-center py-8">Loading road sections...</div>;
    }

    if (filteredData.length === 0) {
      return <div className="text-center py-8 text-gray-500">No road sections found</div>;
    }
    
    return (
      <div className="space-y-4">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>Select</TableHeader>
              <TableHeader>Section ID</TableHeader>
              <TableHeader>Road ID</TableHeader>
              <TableHeader>DEO</TableHeader>
              <TableHeader>Length (m)</TableHeader>
              <TableHeader>Network Status</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredData.map((road) => (
              <TableRow key={road.Id}>
                <TableCell>
                  <input
                    type="radio"
                    name="infraSelection"
                    value={road.RoadSectionId}
                    checked={selectedInfra?.id === road.RoadSectionId}
                    onChange={() => handleInfraSelect(road.RoadSectionId, `${road.DEO} - ${road.RoadId}`, 'Roads')}
                    className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300"
                  />
                </TableCell>
                <TableCell className="font-medium">{road.RoadSectionId}</TableCell>
                <TableCell>{road.RoadId}</TableCell>
                <TableCell>{road.DEO}</TableCell>
                <TableCell>{road.RoadLength}</TableCell>
                <TableCell>
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    road.NetworkStatusId === 1 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {road.NetworkStatusId === 1 ? 'Active' : 'Inactive'}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  const renderBridges = () => {
    const filteredData = bridges;
    
    if (loading) {
      return <div className="text-center py-8">Loading bridges...</div>;
    }

    if (filteredData.length === 0) {
      return <div className="text-center py-8 text-gray-500">No bridges found</div>;
    }
    
    return (
      <div className="space-y-4">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>Select</TableHeader>
              <TableHeader>Bridge ID</TableHeader>
              <TableHeader>Bridge Name</TableHeader>
              <TableHeader>Road Section ID</TableHeader>
              <TableHeader>Length (m)</TableHeader>
              <TableHeader>Overall Width (m)</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredData.map((bridge) => (
              <TableRow key={bridge.Id}>
                <TableCell>
                  <input
                    type="radio"
                    name="infraSelection"
                    value={bridge.BridgeId}
                    checked={selectedInfra?.id === bridge.BridgeId}
                    onChange={() => handleInfraSelect(bridge.BridgeId, bridge.Name, 'Bridges')}
                    className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300"
                  />
                </TableCell>
                <TableCell className="font-medium">{bridge.BridgeId}</TableCell>
                <TableCell>{bridge.Name}</TableCell>
                <TableCell>{bridge.RoadSectionId}</TableCell>
                <TableCell>{bridge.Length}</TableCell>
                <TableCell>{bridge.OverallWidth}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  // const renderFCS = () => {
  //   const data = /*initialData?.FCS ||*/ mockInfraData.FCS;
  //   const filteredData = filterData(data, ['FCSId', 'FCSName', 'Location']);
    
  //   return (
  //     <div className="space-y-4">
  //       <Table>
  //         <TableHead>
  //           <TableRow>
  //             <TableHeader>Select</TableHeader>
  //             <TableHeader>FCS ID</TableHeader>
  //             <TableHeader>FCS Name</TableHeader>
  //             <TableHeader>Location</TableHeader>
  //             <TableHeader>Capacity</TableHeader>
  //           </TableRow>
  //         </TableHead>
  //         <TableBody>
  //           {filteredData.map((fcs) => (
  //             <TableRow key={fcs.Id}>
  //               <TableCell>
  //                 <input
  //                   type="radio"
  //                   name="infraSelection"
  //                   value={fcs.FCSId}
  //                   checked={selectedInfra?.id === fcs.FCSId}
  //                   onChange={() => handleInfraSelect(fcs.FCSId, fcs.FCSName, 'FCS')}
  //                   className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300"
  //                 />
  //               </TableCell>
  //               <TableCell className="font-medium">{fcs.FCSId}</TableCell>
  //               <TableCell>{fcs.FCSName}</TableCell>
  //               <TableCell>{fcs.Location}</TableCell>
  //               <TableCell>{fcs.Capacity}</TableCell>
  //             </TableRow>
  //           ))}
  //         </TableBody>
  //       </Table>
  //     </div>
  //   );
  // };

  // const renderOtherInfra = () => {
  //   const data = /*initialData?.OtherInfra ||*/ mockInfraData.OtherInfra;
  //   const filteredData = filterData(data, ['InfraId', 'InfraName', 'InfraType', 'Location']);
    
  //   return (
  //     <div className="space-y-4">
  //       <Table>
  //         <TableHead>
  //           <TableRow>
  //             <TableHeader>Select</TableHeader>
  //             <TableHeader>Infra ID</TableHeader>
  //             <TableHeader>Infra Name</TableHeader>
  //             <TableHeader>Type</TableHeader>
  //             <TableHeader>Location</TableHeader>
  //             <TableHeader>Description</TableHeader>
  //           </TableRow>
  //         </TableHead>
  //         <TableBody>
  //           {filteredData.map((infra) => (
  //             <TableRow key={infra.Id}>
  //               <TableCell>
  //                 <input
  //                   type="radio"
  //                   name="infraSelection"
  //                   value={infra.InfraId}
  //                   checked={selectedInfra?.id === infra.InfraId}
  //                   onChange={() => handleInfraSelect(infra.InfraId, infra.InfraName, infra.InfraType)}
  //                   className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300"
  //                 />
  //               </TableCell>
  //               <TableCell className="font-medium">{infra.InfraId}</TableCell>
  //               <TableCell>{infra.InfraName}</TableCell>
  //               <TableCell>
  //                 <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
  //                   {infra.InfraType}
  //                 </span>
  //               </TableCell>
  //               <TableCell>{infra.Location}</TableCell>
  //               <TableCell className="max-w-xs truncate">{infra.Description}</TableCell>
  //             </TableRow>
  //           ))}
  //         </TableBody>
  //       </Table>
  //     </div>
  //   );
  // };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'road':
        return renderRoadSections();
      case 'bridge':
        return renderBridges();
      // case 'fcs':
      //   return renderFCS();
      // case 'other':
      //   return renderOtherInfra();
      default:
        return null;
    }
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
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder={`Search ${availableTabs.find(t => t.id === activeTab)?.label.toLowerCase()}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearchSubmit()}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-auto px-6 py-4">
            {renderTabContent()}
          </div>

          {/* Pagination */}
          {!loading && totalCount > 0 && (
            <div className="px-6 py-3 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3">
              {/* Left: count info + page size */}
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <span>
                  Showing{' '}
                  <span className="font-medium">{(currentPage - 1) * pageSize + 1}</span>
                  {' '}–{' '}
                  <span className="font-medium">{Math.min(currentPage * pageSize, totalCount)}</span>
                  {' '}of{' '}
                  <span className="font-medium">{totalCount}</span>
                </span>
                <select
                  value={pageSize}
                  onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                  className="border border-gray-300 rounded px-2 py-1 text-sm focus:ring-orange-500 focus:border-orange-500"
                >
                  {[5, 10, 20, 50].map((s) => (
                    <option key={s} value={s}>{s} / page</option>
                  ))}
                </select>
              </div>

              {/* Right: page navigation */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-2 py-1 rounded border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ‹ Prev
                </button>

                {getPageNumbers().map((p, idx) =>
                  p === '...' ? (
                    <span key={`ellipsis-${idx}`} className="px-2 py-1 text-gray-400 text-sm">…</span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => handlePageChange(p as number)}
                      className={`px-3 py-1 rounded border text-sm ${
                        currentPage === p
                          ? 'bg-orange-500 border-orange-500 text-white font-medium'
                          : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {p}
                    </button>
                  )
                )}

                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="px-2 py-1 rounded border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next ›
                </button>
              </div>
            </div>
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