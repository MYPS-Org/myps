import React, { useState, useEffect } from "react";
import { useAtom } from "jotai";
import { 
  PlusIcon,
  PencilIcon,
  TrashIcon,
  AdjustmentsVerticalIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  MagnifyingGlassIcon
} from '@heroicons/react/16/solid';
import { selectedItemAtom, type Road } from "../state/rbiaAtoms";
import { fetchRoads, fetchRoadInitData } from "../Service";
import type { FutureRoads, RoadPagination, FutureRoadsClassification } from "../Model.d";
import FutureRoadDialog from "../Dialogs/FutureRoadDialog";
import DeleteRoadDialog from "../Dialogs/DeleteRoadDialog";

// Define local interface for pagination response
interface PaginationResponse<T> {
    lists: T[];
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

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

const FutureRoadList: React.FC = () => {
  const [, setSelectedItem] = useAtom(selectedItemAtom);
  const [isLoading, setIsLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [roadToDelete, setRoadToDelete] = useState<Road | null>(null);
  const [sortField, setSortField] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [searchInput, setSearchInput] = useState<string>('');
  const [roadClassifications, setRoadClassifications] = useState<FutureRoadsClassification[]>([]);
  
  // Pagination state similar to Program.tsx
  const [roadData, setRoadData] = useState<PaginationResponse<FutureRoads>>({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 0,
    lists: []
  });

  const [roadFilters, setRoadFilters] = useState<RoadPagination>({
    filters: {
      Name: '',
      RoadId: '',
      Classification: ''
    },
    sortField: '',
    sortDirection: 1,
    page: 1,
    limit: 20
  });

  // Initialize data on component mount
  useEffect(() => {
    const initializeData = async () => {
      setIsLoading(true);
      try {
        // Fetch initial data and classifications
        const [roadsResponse, classificationsResponse] = await Promise.all([
          fetchRoads(roadFilters),
          fetchRoadInitData()
        ]);
        
        setRoadData(roadsResponse.Data);
        setRoadClassifications(classificationsResponse.Data);
      } catch (error) {
        console.error('Error initializing road data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    initializeData();
  }, []);

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

  const handleConfirmDelete = (roadId: string) => {
    setRoadData(prev => ({
      ...prev,
      lists: prev.lists.filter((road) => road.RoadId !== roadId),
      total: prev.total - 1
    }));
    setIsDeleteDialogOpen(false);
    setRoadToDelete(null);
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
  };

  const handleSearchSubmit = async () => {
    const updatedFilters = {
      ...roadFilters,
      filters: {
        ...roadFilters.filters,
        Name: searchInput
      },
      page: 1
    };
    
    setRoadFilters(updatedFilters);

    try {
      setIsLoading(true);
      const response = await fetchRoads(updatedFilters);
      setRoadData(response.Data);
    } catch (error) {
      console.error('Error filtering roads:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearSearch = async () => {
    setSearchInput('');
    const updatedFilters = {
      ...roadFilters,
      filters: {
        Name: '',
        RoadId: '',
        Classification: ''
      },
      page: 1
    };
    
    setRoadFilters(updatedFilters);

    try {
      setIsLoading(true);
      const response = await fetchRoads(updatedFilters);
      setRoadData(response.Data);
    } catch (error) {
      console.error('Error clearing search:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const Paginate = async (page: number) => {
    try {
      setIsLoading(true);
      const response = await fetchRoads({
        ...roadFilters,
        page: page
      });
      setRoadData(response.Data);
      setRoadFilters(prev => ({ ...prev, page }));
    } catch (error) {
      console.error('Error fetching roads:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const hasActiveFilters = roadFilters.filters?.Name || roadFilters.filters?.RoadId || roadFilters.filters?.Classification;

  const SortableHeader: React.FC<{ field: string; children: React.ReactNode }> = ({ field, children }) => (
    <th 
      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center space-x-1">
        <span>{children}</span>
        {sortField === field && (
          sortDirection === 'asc' ? 
          <ChevronUpIcon className="w-4 h-4" /> : 
          <ChevronDownIcon className="w-4 h-4" />
        )}
      </div>
    </th>
  );

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
                  onChange={(e) => handleSearchChange(e.target.value)}
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
              onClick={() => { /* TODO: Open filter dialog */ }}
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
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <SortableHeader field="RoadId">Road ID</SortableHeader>
              <SortableHeader field="Name">Road Name</SortableHeader>
              <SortableHeader field="Classification">Classification</SortableHeader>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {isLoading ? (
              <tr>
                <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
                  Loading roads...
                </td>
              </tr>
            ) : roadData.lists.length > 0 ? (
              roadData.lists.map((road, index) => (
                <tr 
                  key={road.RoadId} 
                  className={`hover:bg-gray-50 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Badge color="blue" className="text-xs">
                      {road.RoadId}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium text-gray-900">
                      {road.Name}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Badge color="green" className="text-xs">
                      Class {road.Classification}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleEdit(road)}
                        className="p-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-md transition-colors duration-200"
                        disabled={isLoading}
                      >
                        <PencilIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(road)}
                        className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-md transition-colors duration-200"
                        disabled={isLoading}
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                  No roads found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {roadData.totalPages > 1 && (
        <div className="px-6 py-4 border-t border-gray-200">
          <div className="flex justify-center">
            <div className="flex space-x-1">
              <Button
                color="white"
                onClick={() => Paginate(roadData.page - 1)}
                disabled={roadData.page === 1 || isLoading}
              >
                Previous
              </Button>
              
              {Array.from({ length: roadData.totalPages }, (_, i) => i + 1).map((pageNum) => (
                <Button
                  key={pageNum}
                  color={pageNum === roadData.page ? "blue" : "white"}
                  onClick={() => Paginate(pageNum)}
                  disabled={isLoading}
                >
                  {pageNum}
                </Button>
              ))}
              
              <Button
                color="white"
                onClick={() => Paginate(roadData.page + 1)}
                disabled={roadData.page === roadData.totalPages || isLoading}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Footer info */}
      {/* <div className='mb-3.5 px-6 py-4 border-t border-gray-200'>
        {roadData.lists.length > 0 ? (
          <p className="text-sm text-gray-500">
            Showing {roadData.limit * (roadData.page - 1) + 1} to {Math.min(roadData.limit * roadData.page, roadData.total)} of {roadData.total} roads
          </p>
        ) : (
          <p className="text-sm text-gray-500">
            No roads found
          </p>
        )}
      </div> */}

      {isDialogOpen && <FutureRoadDialog onClose={() => setIsDialogOpen(false)} />}
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
    </div>
  );
};

export default FutureRoadList;
