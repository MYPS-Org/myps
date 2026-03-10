import React, { useState, useEffect } from "react";
import { useAtom } from "jotai";
import { 
  PlusIcon,
  PencilIcon,
  TrashIcon,
  AdjustmentsVerticalIcon,
  MagnifyingGlassIcon
} from '@heroicons/react/16/solid';
import { selectedItemAtom, type RoadSection } from "../state/rbiaAtoms";
import { useRoadSectionData } from "../hooks/useRoadSectionData";
import FutureRoadSectionDialog from "../Dialogs/FutureRoadSectionDialog";
import DeleteRoadSectionDialog from "../Dialogs/DeleteRoadSectionDialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/tailwindui/table";
import { Pagination, PaginationList, PaginationNext, PaginationPrevious, PaginationPage, PaginationGap } from "../../../components/tailwindui/pagination";
import FutureBridgeDialog from "../Dialogs/FutureBridgeDialog";
import FilterRoadSectionDialog from "../Dialogs/FilterRoadSectionDialog";

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

const RoadSectionList: React.FC = () => {
  const [, setSelectedItem] = useAtom(selectedItemAtom);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isRoadSectionDialogOpen, setIsRoadSectionDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isBridgeDialogOpen, setIsBridgeDialogOpen] = useState(false);
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  const [sectionToAddBridge, setSectionToAddBridge] = useState<RoadSection | null>(null);
  const [roadSectionToDelete, setRoadSectionToDelete] = useState<RoadSection | null>(null);
  const [sortField, setSortField] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Use the custom hook for road section data management
  const {
    roadSectionData,
    isLoading,
    searchInput,
    hasActiveFilters,
    roadSectionFilters,
    initRoadSections,
    initializeData,
    handleSearchInputChange,
    handleSearchSubmit,
    handleClearSearch,
    handlePagination,
    handleFilterChange,
    removeRoadSectionFromState
  } = useRoadSectionData();

  // Initialize data on component mount
  useEffect(() => {
    initializeData();
  }, [initializeData]);

  // const handleCreate = () => {
  //   setSelectedItem(null);
  //   setIsDialogOpen(true);
  // };

  const handleEdit = (section: RoadSection) => {
    setSelectedItem(section);
    setIsRoadSectionDialogOpen(true);
  };

  const handleDelete = (section: RoadSection) => {
    setRoadSectionToDelete(section);
    setIsDeleteDialogOpen(true);
  };

  const handleAddBridge = (section: RoadSection) => {
    setSectionToAddBridge(section);
    setIsBridgeDialogOpen(true);
  };

  const handleConfirmDelete = (roadSectionId: string) => {
    removeRoadSectionFromState(roadSectionId);
    setIsDeleteDialogOpen(false);
    setRoadSectionToDelete(null);
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
          <h3 className="text-lg font-medium text-gray-900">Road Sections</h3>
          <div className="flex items-center space-x-3">
            {/* Search Input */}
            <div className="flex items-center space-x-2">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search road sections..."
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
                const activeFilters = Object.values(roadSectionFilters.filters || {}).filter(Boolean).length;
                return activeFilters > 0 && (
                  <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
                    {activeFilters}
                  </span>
                );
              })()}
            </Button>
            
            {/* <Button color="blue" className="flex items-center" onClick={handleCreate} disabled={isLoading}>
              <PlusIcon className="w-4 h-4 mr-1" />
              Add Road Section
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
                sortDirection={getSortDirection("RoadId")}
                onSort={handleSortWithDirection("RoadId")}
              >
                Road ID
              </TableHeader>
              <TableHeader 
                justify="center" 
                sortable 
                sortDirection={getSortDirection("RoadLength")}
                onSort={handleSortWithDirection("RoadLength")}
              >
                Length (m)
              </TableHeader>
              <TableHeader 
                justify="center" 
                sortable 
                sortDirection={getSortDirection("DEO")}
                onSort={handleSortWithDirection("DEO")}
              >
                Engineering District
              </TableHeader>
              <TableHeader justify="center">Actions</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody className="bg-white divide-y divide-gray-200">
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="px-6 py-4 text-center text-gray-500">
                  Loading road sections...
                </TableCell>
              </TableRow>
            ) : roadSectionData.lists.length > 0 && (
              roadSectionData.lists.map((section, index) => (
                <TableRow 
                  key={section.RoadSectionId} 
                  className={`hover:bg-gray-50 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                >
                  <TableCell className="text-center px-6 py-4 whitespace-nowrap">
                    <Badge color="purple" className="text-xs">
                      {section.RoadSectionId}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center px-6 py-4 whitespace-nowrap">
                    <Badge color="blue" className="text-xs">
                      {section.RoadId}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center px-6 py-4 whitespace-nowrap">
                    {section.RoadLength} m
                  </TableCell>
                  <TableCell className="text-center px-6 py-4 whitespace-nowrap">
                    <Badge color="orange" className="text-xs">
                      District {section.DEO}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center px-6 py-4 whitespace-nowrap">
                    <div className="flex justify-center space-x-2">
                      <button
                        onClick={() => handleEdit(section)}
                        className="p-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-md transition-colors duration-200"
                        disabled={isLoading}
                      >
                        <PencilIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(section)}
                        className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-md transition-colors duration-200"
                        disabled={isLoading}
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => { handleAddBridge(section) }}
                        className="p-2 flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors duration-200"
                        disabled={isLoading}
                      >
                        <PlusIcon className="w-4 h-4 text-white-500" /> Add Bridge
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
      <Pagination className="my-6">
        {roadSectionData.totalPages > 1 && (
          <>
            <PaginationPrevious 
              onClick={async () => await Paginate(1)}
              disabled={roadSectionData.page <= 1 || isLoading}
            >
              First
            </PaginationPrevious>
            <PaginationList>
              {Array.from({ length: roadSectionData.totalPages }, (_, i) => {
                const pageNum = i + 1;
                const currentPage = roadSectionData.page;
                const totalPages = roadSectionData.totalPages;
                
                // Show first page, last page, current page, and pages around current
                if (
                  pageNum === 1 ||
                  pageNum === totalPages ||
                  (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)
                ) {
                  return (
                    <PaginationPage
                      key={pageNum}
                      onClick={async () => await Paginate(pageNum)}
                      current={pageNum === currentPage}
                      // disabled={isLoading}
                    >
                      {pageNum}
                    </PaginationPage>
                  );
                } else if (
                  pageNum === currentPage - 2 ||
                  pageNum === currentPage + 2
                ) {
                  return <PaginationGap key={pageNum} />;
                }
                return null;
              })}
            </PaginationList>
            <PaginationNext 
              onClick={async () => await Paginate(roadSectionData.totalPages)}
              disabled={roadSectionData.page >= roadSectionData.totalPages || isLoading}
            >
              Last
            </PaginationNext>
          </>
        )}
      </Pagination>

      {/* Footer info */}
      <div className='mb-3.5 px-6 py-4 border-t border-gray-200'>
        {roadSectionData.lists.length > 0 ? (
          <p className="text-sm text-gray-500">
            Showing {roadSectionData.limit * (roadSectionData.page - 1) + 1} to {Math.min(roadSectionData.limit * roadSectionData.page, roadSectionData.total)} of {roadSectionData.total} road sections
          </p>
        ) : (
          <p className="text-sm text-gray-500">
            No road sections found
          </p>
        )}
      </div>

      {isDialogOpen && <FutureBridgeDialog onClose={() => setIsDialogOpen(false)} />}
      {isBridgeDialogOpen && sectionToAddBridge && (
        <FutureBridgeDialog 
          onClose={() => {
            setIsBridgeDialogOpen(false);
            setSectionToAddBridge(null);
          }}
          roadSection={sectionToAddBridge}
        />
      )}

      {isRoadSectionDialogOpen && <FutureRoadSectionDialog onClose={() => setIsRoadSectionDialogOpen(false)} />}
      {isDeleteDialogOpen && roadSectionToDelete && (
        <DeleteRoadSectionDialog 
          isOpen={isDeleteDialogOpen}
          onClose={() => {
            setIsDeleteDialogOpen(false);
            setRoadSectionToDelete(null);
          }}
          onSubmit={handleConfirmDelete}
          roadSection={roadSectionToDelete}
        />
      )}
      {isFilterDialogOpen && (
        <FilterRoadSectionDialog
          isOpen={isFilterDialogOpen}
          onClose={() => setIsFilterDialogOpen(false)}
          onSubmit={(filterData) => handleFilterChange({ filters: filterData })}
          onClear={() => { handleClearSearch(); setIsFilterDialogOpen(false); }}
          initialData={roadSectionFilters.filters}
          deoList={initRoadSections}
        />
      )}
    </div>
  );
};

export default RoadSectionList;