import React, { useState, useEffect } from "react";
import { useAtom } from "jotai";
import { 
  PlusIcon,
  PencilIcon,
  TrashIcon,
  AdjustmentsVerticalIcon,
  MagnifyingGlassIcon
} from '@heroicons/react/16/solid';
import { roadClassificationsAtom, selectedItemAtom, type Road } from "../state/rbiaAtoms";
import { isCreatedInMyps, RBIA_READ_ONLY_TITLE } from "../networkStatus";
import { useRoadData } from "../hooks/useRoadData";
import FutureRoadDialog from "../Dialogs/FutureRoadDialog";
import FutureRoadSectionDialog from "../Dialogs/FutureRoadSectionDialog";
import DeleteRoadDialog from "../Dialogs/DeleteRoadDialog";
import FilterRoadDialog from "../Dialogs/FilterRoadDialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/tailwindui/table";
import { PaginationBar } from "../../../components/tailwindui/PaginationBar";

// Simple Badge component
const Badge: React.FC<{ children: React.ReactNode; className?: string; color?: string; title?: string }> = ({
  children,
  className = "",
  color = "gray",
  title
}) => (
  <span title={title} className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-${color}-100 text-${color}-800 ${className}`}>
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

const FutureRoadList: React.FC = () => {
  const [, setSelectedItem] = useAtom(selectedItemAtom);
  const [roadClassifications] = useAtom(roadClassificationsAtom);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isSectionDialogOpen, setIsSectionDialogOpen] = useState(false);
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  const [roadToAddSection, setRoadToAddSection] = useState<Road | null>(null);
  const [roadToDelete, setRoadToDelete] = useState<Road | null>(null);

  // Use the custom hook for road data management
  const {
    roadData,
    roadFilters,
    isLoading,
    searchInput,
    hasActiveFilters,
    initializeData,
    handleSearchInputChange,
    handleSearchSubmit,
    handleClearSearch,
    handlePagination,
    handleFilterChange,
    removeRoadFromState,
    hasPrevious,
    hasNext,
    goNext,
    goPrevious,
    goFirst,
    goLast,
    refresh,
    handleSort,
  } = useRoadData();

  // Initialize data on component mount
  useEffect(() => {
    initializeData();
  }, [initializeData]);

  const handleCreate = () => {
    setSelectedItem(null);
    setIsDialogOpen(true);
  };

  const handleEdit = (road: Road) => {
    setSelectedItem(road);
    setIsDialogOpen(true);
  };

  const handleDelete = (road: Road) => {
    setRoadToDelete(road);
    setIsDeleteDialogOpen(true);
  };

  const handleAddSection = (road: Road) => {
    setRoadToAddSection(road);
    setIsSectionDialogOpen(true);
  };

  const handleConfirmDelete = (roadId: string) => {
    removeRoadFromState(roadId);
    setIsDeleteDialogOpen(false);
    setRoadToDelete(null);
  };

  // Header click: the server re-orders the whole list, not just the page shown (S06-TC001-P001).
  const handleSortWithDirection = (field: string) => (direction: 0 | 1) => {
    handleSort(field, direction);
  };

  const Paginate = async (page: number) => {
    await handlePagination(page);
  };

  // The header arrow follows the sort the list was fetched with.
  const getSortDirection = (field: string): 0 | 1 | undefined =>
    roadFilters.sortField === field ? roadFilters.sortDirection : undefined;

  return (
    <div className="overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">Roads</h3>
          <div className="flex items-center space-x-3">
            {/* Search Input */}
            <div className="flex items-center space-x-2">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search roads..."
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
                const activeFilters = Object.values(roadFilters.filters || {}).filter(Boolean).length;
                return activeFilters > 0 && (
                  <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
                    {activeFilters}
                  </span>
                );
              })()}
            </Button>
            
            <Button color="blue" className="flex items-center" onClick={handleCreate} disabled={isLoading}>
              <PlusIcon className="w-4 h-4 mr-1" />
              Add Road
            </Button>
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
                sortDirection={getSortDirection("RoadId")}
                onSort={handleSortWithDirection("RoadId")}
              >
                Road ID
              </TableHeader>
              <TableHeader 
                justify="center" 
                sortable 
                sortDirection={getSortDirection("Name")}
                onSort={handleSortWithDirection("Name")}
              >
                Road Name
              </TableHeader>
              <TableHeader 
                justify="center" 
                sortable 
                sortDirection={getSortDirection("Classification")}
                onSort={handleSortWithDirection("Classification")}
              >
                Classification
              </TableHeader>
              <TableHeader justify="center">Actions</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody className="bg-white divide-y divide-gray-200">
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="px-6 py-4 text-center text-gray-500">
                  Loading roads...
                </TableCell>
              </TableRow>
            ) : roadData.lists.length > 0 && (
              roadData.lists.map((road, index) => (
                <TableRow 
                  key={road.RoadId} 
                  className={`hover:bg-gray-50 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                >
                  <TableCell className="text-center px-6 py-4 whitespace-nowrap">
                    <Badge color="blue" className="text-xs">
                      {road.RoadId}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center px-6 py-4 whitespace-nowrap">
                    <div className="font-medium text-gray-900">
                      {road.Name}
                    </div>
                  </TableCell>
                  <TableCell className="text-center px-6 py-4 whitespace-nowrap">
                    <Badge color="green" className="text-xs">
                      {roadClassifications.find(c => c.ClassificationId === road.Classification)?.Classification ?? "Unknown"}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-6 py-4 whitespace-nowrap">
                    <div className="flex justify-center items-center space-x-2">
                      {/* RBIA rows are view-only (S06-TC008 / TC013): Edit and Delete only for MYPS roads. */}
                      {isCreatedInMyps(road) ? (
                        <>
                          <button
                            onClick={() => handleEdit(road)}
                            title="Edit"
                            className="p-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-md transition-colors duration-200"
                            disabled={isLoading}
                          >
                            <PencilIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(road)}
                            title="Delete"
                            className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-md transition-colors duration-200"
                            disabled={isLoading}
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <Badge color="gray" className="text-xs" title={RBIA_READ_ONLY_TITLE}>RBIA</Badge>
                      )}
                      <button
                        onClick={() => handleAddSection(road)}
                        className="flex items-center gap-2 p-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors duration-200"
                        disabled={isLoading}
                      >
                        <PlusIcon className="w-4 h-4" /> Add Section
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
        currentPage={roadData.page}
        totalPages={roadData.totalPages}
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
        {roadData.lists.length > 0 ? (
          <p className="text-sm text-gray-500">
            {/* Client doesn't want the "Showing X of Y" summary — commented out, not deleted.
            Showing {roadData.limit * (roadData.page - 1) + 1} to {Math.min(roadData.limit * roadData.page, roadData.total)} of {roadData.total} roads
            */}
          </p>
        ) : (
          <p className="text-sm text-gray-500">
            No roads found
          </p>
        )}
      </div>

      {isDialogOpen && (
        <FutureRoadDialog
          onClose={() => {
            setIsDialogOpen(false);
            // The selection is shared with the Add Section/Bridge dialogs, which would otherwise
            // open in Edit mode after any edit.
            setSelectedItem(null);
          }}
          onSaved={refresh}
        />
      )}
      {isSectionDialogOpen && roadToAddSection && (
        <FutureRoadSectionDialog 
          onClose={() => {
            setIsSectionDialogOpen(false);
            setRoadToAddSection(null);
          }}
          road={roadToAddSection}
        />
      )}
      {isDeleteDialogOpen && roadToDelete && (
        <DeleteRoadDialog 
          isOpen={isDeleteDialogOpen}
          onClose={() => {
            setIsDeleteDialogOpen(false);
            setRoadToDelete(null);
          }}
          onSubmit={handleConfirmDelete}
          road={roadToDelete}
        />
      )}
      {isFilterDialogOpen && (
        <FilterRoadDialog
          isOpen={isFilterDialogOpen}
          onClose={() => setIsFilterDialogOpen(false)}
          onSubmit={(filterData) => handleFilterChange({ filters: filterData })}
          onClear={() => { handleClearSearch(); setIsFilterDialogOpen(false); }}
          initialData={roadFilters.filters}
        />
      )}
    </div>
  );
};

export default FutureRoadList;
