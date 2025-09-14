import React, { useState } from "react";
import { useAtom } from "jotai";
import { 
  PlusIcon,
  PencilIcon,
  TrashIcon,
  AdjustmentsVerticalIcon,
  ChevronUpIcon,
  ChevronDownIcon
} from '@heroicons/react/16/solid';
import { bridgesAtom, selectedItemAtom, type Bridge } from "../state/rbiaAtoms";
import FutureBridgeDialog from "../Dialogs/FutureBridgeDialog";
import DeleteBridgeDialog from "../Dialogs/DeleteBridgeDialog";

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
}> = ({ children, className = "", color = "gray", onClick }) => {
  const colorClasses = {
    blue: "bg-blue-500 hover:bg-blue-600 text-white",
    red: "bg-red-500 hover:bg-red-600 text-white", 
    yellow: "bg-yellow-500 hover:bg-yellow-600 text-white",
    white: "bg-white hover:bg-gray-50 text-gray-700 border border-gray-300",
    gray: "bg-gray-500 hover:bg-gray-600 text-white"
  };
  
  return (
    <button 
      onClick={onClick}
      className={`px-3 py-2 rounded-md font-medium transition-colors duration-200 ${colorClasses[color as keyof typeof colorClasses] || colorClasses.gray} ${className}`}
    >
      {children}
    </button>
  );
};

const FutureBridgeList: React.FC = () => {
  const [bridges, setBridges] = useAtom(bridgesAtom);
  const [, setSelectedItem] = useAtom(selectedItemAtom);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [bridgeToDelete, setBridgeToDelete] = useState<Bridge | null>(null);
  const [sortField, setSortField] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  
  // Filter state (can be expanded later)
  const [filters, setFilters] = useState({
    roadId: '',
    sectionRoadId: '',
    name: ''
  });

  const handleCreate = () => {
    setSelectedItem(null);
    setIsDialogOpen(true);
  };

  const handleEdit = (bridge: Bridge) => {
    setSelectedItem(bridge);
    setIsDialogOpen(true);
  };

  const handleDelete = (bridge: Bridge) => {
    setBridgeToDelete(bridge);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = (bridgeKey: string) => {
    setBridges(bridges.filter((bridge) => `${bridge.RoadId}-${bridge.SectionRoadId}-${bridge.Name}` !== bridgeKey));
    setIsDeleteDialogOpen(false);
    setBridgeToDelete(null);
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleClear = () => {
    setFilters({
      roadId: '',
      sectionRoadId: '',
      name: ''
    });
  };

  const hasActiveFilters = filters.roadId || filters.sectionRoadId || filters.name;

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
          <h3 className="text-lg font-medium text-gray-900">Bridges</h3>
          <div className="flex items-center space-x-3">
            {hasActiveFilters && (
              <Button color="red" onClick={handleClear}>
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
                const activeFilters = Object.values(filters).filter(Boolean).length;
                return activeFilters > 0 && (
                  <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
                    {activeFilters}
                  </span>
                );
              })()}
            </Button>
            <Button color="blue" className="flex items-center" onClick={handleCreate}>
              <PlusIcon className="w-4 h-4 mr-1" />
              Add Bridge
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
              <SortableHeader field="Name">Bridge Name</SortableHeader>
              <SortableHeader field="SectionRoadId">Section Road ID</SortableHeader>
              <SortableHeader field="From">From (km)</SortableHeader>
              <SortableHeader field="Length">Length (km)</SortableHeader>
              <SortableHeader field="CarriageWay">Carriage Way</SortableHeader>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {bridges.map((bridge, index) => (
              <tr 
                key={`${bridge.RoadId}-${bridge.SectionRoadId}-${bridge.Name}`} 
                className={`hover:bg-gray-50 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <Badge color="blue" className="text-xs">
                    {bridge.RoadId}
                  </Badge>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-gray-900 font-medium">
                  {bridge.Name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <Badge color="purple" className="text-xs">
                    {bridge.SectionRoadId}
                  </Badge>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-gray-900">
                  {bridge.From} km
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-gray-900">
                  {bridge.Length} km
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <Badge 
                    color={bridge.CarriageWay === 2 ? "blue" : 
                           bridge.CarriageWay === 1 ? "yellow" : "gray"}
                    className="text-xs"
                  >
                    {bridge.CarriageWay} Way{bridge.CarriageWay > 1 ? 's' : ''}
                  </Badge>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleEdit(bridge)}
                      className="p-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-md transition-colors duration-200"
                    >
                      <PencilIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(bridge)}
                      className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-md transition-colors duration-200"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer info */}
      {bridges.length > 0 && (
        <div className='mb-3.5 px-6 py-4 border-t border-gray-200'>
          <p className="text-sm text-gray-500">
            Showing 1 to {bridges.length} of {bridges.length} bridges
          </p>
        </div>
      )}

      {bridges.length === 0 && (
        <div className="px-6 py-8">
          <p className="text-gray-500 text-center">No future bridges created yet.</p>
        </div>
      )}

      {isDialogOpen && <FutureBridgeDialog onClose={() => setIsDialogOpen(false)} />}
      {isDeleteDialogOpen && bridgeToDelete && (
        <DeleteBridgeDialog 
          isOpen={isDeleteDialogOpen}
          onClose={() => {
            setIsDeleteDialogOpen(false);
            setBridgeToDelete(null);
          }}
          onSubmit={handleConfirmDelete}
          bridge={bridgeToDelete}
        />
      )}
    </div>
  );
};

export default FutureBridgeList;