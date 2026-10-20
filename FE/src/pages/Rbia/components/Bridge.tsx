import React, { useState, useEffect } from "react";
import { useAtom } from "jotai";
import { 
  PencilIcon,
  TrashIcon,
  AdjustmentsVerticalIcon,
  MagnifyingGlassIcon
} from '@heroicons/react/16/solid';
import { selectedItemAtom, type Bridge } from "../state/rbiaAtoms";
import { useBridgeData } from "../hooks/useBridgeData";
import FutureBridgeDialog from "../Dialogs/FutureBridgeDialog";
import DeleteBridgeDialog from "../Dialogs/DeleteBridgeDialog";
import FilterBridgeDialog from "../Dialogs/FilterBridgeDialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/tailwindui/table";
import { PaginationBar } from "../../../components/tailwindui/PaginationBar";
// Simple Badge component
const Badge: React.FC<{ children: React.ReactNode; className?: string; color?: string }> = ({ 
  children, 
  className = "", 
  color = "gray" 
}) => (
  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-${color}-100 text-${color}-800 ${className}`}>
    {children}
  </span>
);

// Simple Button component
const Button: React.FC<{ 
  children: React.ReactNode; 
  className?: string; 
  color?: string;
  onClick?: () => void;
  disabled?: boolean;
}> = ({ children, className = "", color = "gray", onClick, disabled = false }) => {
  const colorClasses = {
    blue: "bg-blue-500 hover:bg-blue-600 text-white disabled:bg-blue-300",
    red: "bg-red-500 hover:bg-red-600 text-white disabled:bg-red-300", 
    yellow: "bg-yellow-500 hover:bg-yellow-600 text-white disabled:bg-yellow-300",
    white: "bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 disabled:bg-gray-100",
    gray: "bg-gray-500 hover:bg-gray-600 text-white disabled:bg-gray-300"
  };
  
  return (
    <button 
      onClick={onClick}
      disabled={disabled}
      className={`px-3 py-2 rounded-md font-medium transition-colors duration-200 ${colorClasses[color as keyof typeof colorClasses] || colorClasses.gray} ${className} ${disabled ? 'cursor-not-allowed' : ''}`}
    >
      {children}
    </button>
  );
};

const FutureBridgeList: React.FC = () => {
  const [, setSelectedItem] = useAtom(selectedItemAtom);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [bridgeToDelete, setBridgeToDelete] = useState<Bridge | null>(null);
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  const [sortField, setSortField] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Use the custom hook for bridge data management
  const {
    bridgeData,
    bridgeFilters,
    isLoading,
    searchInput,
    hasActiveFilters,
    initializeData,
    handleSearchInputChange,
    handleSearchSubmit,
    handleClearSearch,
    handlePagination,
    handleFilterChange,
    removeBridgeFromState,
    hasPrevious,
    hasNext,
    goNext,
    goPrevious,
    goFirst,
    goLast,
    refresh,
  } = useBridgeData();

  // Initialize data on component mount
  useEffect(() => {
    initializeData();
  }, [initializeData]);

  const handleEdit = (bridge: Bridge) => {
    setSelectedItem(bridge);
    setIsDialogOpen(true);
  };

  const handleDelete = (bridge: Bridge) => {
    setBridgeToDelete(bridge);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = (bridgeId: string) => {
    removeBridgeFromState(bridgeId);
    setIsDeleteDialogOpen(false);
    setBridgeToDelete(null);
  };

  // Updated handler for onSort that accepts direction parameter
  const handleSortWithDirection = (field: string) => (direction: 0 | 1) => {
    setSortField(field);
    setSortDirection(direction === 0 ? 'asc' : 'desc');
  };

  const Paginate = async (page: number) => {
    await handlePagination(page);
  };

  // Helper function to convert sort direction to numeric value
  const getSortDirection = (field: string): 0 | 1 | undefined => {
    if (sortField !== field) return undefined;
    return sortDirection === 'asc' ? 0 : 1;
  };

  return (
    <div className="overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">Bridges</h3>
          <div className="flex items-center space-x-3">
            {/* Search Input */}
            <div className="flex items-center space-x-2">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search bridges..."
                  value={searchInput}
                  onChange={(e) => handleSearchInputChange(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearchSubmit()}
                  className="pl-8 pr-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
                <MagnifyingGlassIcon className="w-4 h-4 absolute left-2 top-3 text-gray-400" />
              </div>
              <Button color="blue" onClick={handleSearchSubmit} disabled={isLoading}>
                Search
              </Button>
            </div>
            
            {hasActiveFilters && (
              <Button color="red" onClick={handleClearSearch} disabled={isLoading}>
                Clear Filter
              </Button>
            )}
            
            <Button 
              color="white" 
              className={`flex items-center shadow-md ${hasActiveFilters ? 'ring-2 ring-orange-500 bg-orange-50' : ''}`}
              onClick={() => setIsFilterDialogOpen(true)}
            >
              <AdjustmentsVerticalIcon className="w-4 h-4 mr-1" />
              Filter
              {(() => {
                const activeFilters = Object.values(bridgeFilters.filters || {}).filter(Boolean).length;
                return activeFilters > 0 && (
                  <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
                    {activeFilters}
                  </span>
                );
              })()}
            </Button>
            
            {/* <Button color="blue" className="flex items-center" onClick={handleCreate} disabled={isLoading}>
              <PlusIcon className="w-4 h-4 mr-1" />
              Add Bridge
            </Button> */}
          </div>
        </div>
      </div>
      
      {/* Table */}
      <div className="overflow-x-auto">
        <Table className="min-w-full divide-y divide-gray-200">
          <TableHead className="bg-gray-50">
            <TableRow>
              <TableHeader 
                justify="center" 
                sortable 
                sortDirection={getSortDirection("RoadSectionId")}
                onSort={handleSortWithDirection("RoadSectionId")}
              >
                Section Road ID
              </TableHeader>
              <TableHeader 
                justify="center" 
                sortable 
                sortDirection={getSortDirection("Name")}
                onSort={handleSortWithDirection("Name")}
              >
                Bridge Name
              </TableHeader>
              <TableHeader 
                justify="center" 
                sortable 
                sortDirection={getSortDirection("BridgeId")}
                onSort={handleSortWithDirection("BridgeId")}
              >
                Bridge ID
              </TableHeader>
              <TableHeader 
                justify="center" 
                sortable 
                sortDirection={getSortDirection("From")}
                onSort={handleSortWithDirection("From")}
              >
                From (m)
              </TableHeader>
              <TableHeader 
                justify="center" 
                sortable 
                sortDirection={getSortDirection("Length")}
                onSort={handleSortWithDirection("Length")}
              >
                Length (m)
              </TableHeader>
              <TableHeader 
                justify="center" 
                sortable 
                sortDirection={getSortDirection("CarriageWay")}
                onSort={handleSortWithDirection("CarriageWay")}
              >
                Carriageway Width (m)
              </TableHeader>
              <TableHeader justify="center">Actions</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody className="bg-white divide-y divide-gray-200">
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="px-6 py-4 text-center text-gray-500">
                  Loading bridges...
                </TableCell>
              </TableRow>
            ) : bridgeData.lists.length > 0 && (
              bridgeData.lists.map((bridge, index) => (
                <TableRow 
                  key={`${bridge.RoadSectionId}-${bridge.BridgeId}`} 
                  className={`hover:bg-gray-50 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                >
                  <TableCell className="text-center text-row px-6 py-4 whitespace-nowrap">
                    <Badge color="blue" className="text-xs">
                      {bridge.RoadSectionId}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center text-row px-6 py-4 whitespace-nowrap text-gray-900 font-medium">
                    {bridge.Name}
                  </TableCell>
                  <TableCell className="text-center text-row px-6 py-4 whitespace-nowrap">
                    <Badge color="purple" className="text-xs">
                      {bridge.BridgeId}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center text-row px-6 py-4 whitespace-nowrap text-gray-900">
                    {bridge.From} m
                  </TableCell>
                  <TableCell className="text-center text-row px-6 py-4 whitespace-nowrap text-gray-900">
                    {bridge.Length} m
                  </TableCell>
                  <TableCell className="text-center text-row px-6 py-4 whitespace-nowrap">
                    <span className="text-gray-900">
                      {bridge.CarriageWay != null ? `${bridge.CarriageWay} m` : '—'}
                    </span>
                  </TableCell>
                  <TableCell className="text-row px-6 py-4 whitespace-nowrap">
                    <div className="flex justify-center space-x-2">
                      <button
                        onClick={() => handleEdit(bridge)}
                        className="p-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-md transition-colors duration-200"
                        disabled={isLoading}
                      >
                        <PencilIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(bridge)}
                        className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-md transition-colors duration-200"
                        disabled={isLoading}
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <PaginationBar
        currentPage={bridgeData.page}
        totalPages={bridgeData.totalPages}
        hasPrevious={hasPrevious}
        hasNext={hasNext}
        onGoToPage={Paginate}
        onNext={goNext}
        onPrevious={goPrevious}
        onFirst={goFirst}
        onLast={goLast}
        isLoading={isLoading}
      />

      {/* Footer info */}
      <div className='mb-3.5 px-6 py-4 border-t border-gray-200'>
        {bridgeData.lists.length > 0 ? (
          <p className="text-sm text-gray-500">
            {/* Client doesn't want the "Showing X of Y" summary — commented out, not deleted.
            Showing {bridgeData.limit * (bridgeData.page - 1) + 1} to {Math.min(bridgeData.limit * bridgeData.page, bridgeData.total)} of {bridgeData.total} bridges
            */}
          </p>
        ) : (
          <p className="text-sm text-gray-500">
            No bridges found
          </p>
        )}
      </div>

      {isDialogOpen && (
        <FutureBridgeDialog
          onClose={() => {
            setIsDialogOpen(false);
            setSelectedItem(null);
          }}
          onSaved={refresh}
        />
      )}
      {isDeleteDialogOpen && bridgeToDelete && (
        <DeleteBridgeDialog 
          isOpen={isDeleteDialogOpen}
          onClose={() => {
            setIsDeleteDialogOpen(false);
            setBridgeToDelete(null);
          }}
          onSubmit={(bridgeId: string) => handleConfirmDelete(bridgeId)}
          bridge={bridgeToDelete}
        />
      )}
      {isFilterDialogOpen && (
        <FilterBridgeDialog
          isOpen={isFilterDialogOpen}
          onClose={() => setIsFilterDialogOpen(false)}
          onSubmit={(filterData) => handleFilterChange({ filters: filterData })}
          onClear={() => { handleClearSearch(); setIsFilterDialogOpen(false); }}
          initialData={bridgeFilters.filters}
        />
      )}
    </div>
  );
};

export default FutureBridgeList;