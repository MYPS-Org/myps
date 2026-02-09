import React, { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/tailwindui/table';
import { Button } from '../../../components/tailwindui/button';
import { TrashIcon } from '@heroicons/react/24/outline';

interface MajorWorkCategoryData {
  infraType: string;
  category: string;
}

const MajorWorkCategoryTable: React.FC = () => {
  const [sortDirection, setSortDirection] = useState<0 | 1 | null>(null);
  const [sortColumn, setSortColumn] = useState<number | null>(null);

  // Sample data - replace with actual API call
  const [workCategories] = useState<MajorWorkCategoryData[]>([
    { infraType: 'Accessibility Facility', category: 'Construction' },
    { infraType: 'Accessibility Facility', category: 'Rehabilitation/Major Repair' },
    { infraType: 'Bridges', category: 'Construction' },
    { infraType: 'Bridges', category: 'Rehabilitation/Major Repair' },
    { infraType: 'Bridges', category: 'Replacement' },
    { infraType: 'Bridges', category: 'Retrofitting/Strengthening' },
    { infraType: 'Bridges', category: 'Widening' },
    { infraType: 'Drainage Protection Works', category: 'Rehabilitation/Major Repair' },
    { infraType: 'Drainage Structures along Roads', category: 'Construction' },
    { infraType: 'Drainage Structures along Roads', category: 'Rehabilitation/Major Repair' },
    { infraType: 'Drainage Structures along Roads', category: 'Upgrading' },
    { infraType: 'Flood Control Structures', category: 'Construction' },
    { infraType: 'Flood Control Structures', category: 'Rehabilitation/Major Repair' },
    { infraType: 'Flood Control Structures', category: 'Repair/Maintenance' },
    { infraType: 'Flood Control Structures', category: 'Replacement' },
    { infraType: 'Hospitals', category: 'Construction' },
    { infraType: 'Hospitals', category: 'Rehabilitation/Major Repair' },
    { infraType: 'Multi Purpose Buildings', category: 'Construction' },
    { infraType: 'Multi Purpose Buildings', category: 'Rehabilitation/Major Repair' },
    { infraType: 'Multi Purpose Buildings', category: 'Repair/Maintenance' },
    { infraType: 'Multi Purpose Buildings', category: 'Retrofitting/Strengthening' },
    { infraType: 'Other Buildings', category: 'Construction' },
    { infraType: 'Other Buildings', category: 'Rehabilitation/Major Repair' },
    { infraType: 'Other Buildings', category: 'Retrofitting/Strengthening' },
    { infraType: 'Rain Water Collector', category: 'Construction' },
    { infraType: 'Rehabilitation/Major Repair', category: 'Rehabilitation' },
    { infraType: 'Road Slope Protection Strucutures', category: 'Construction' },
    { infraType: 'Road Slope Protection Strucutures', category: 'Rehabilitation/Major Repair' },
    { infraType: 'Roads', category: 'Construction' },
    { infraType: 'Roads', category: 'Off Carriageway Improvement' },
    { infraType: 'Roads', category: 'Off-Carriageway Improvement' },
    { infraType: 'Roads', category: 'Preventive Maintenance' },
    { infraType: 'Roads', category: 'ROW Acquisition' },
    { infraType: 'Roads', category: 'Reconstruction' },
    { infraType: 'Roads', category: 'Rehabilitation' },
    { infraType: 'Roads', category: 'Rehabilitation/Major Repair' },
    { infraType: 'Roads', category: 'Road Safety' },
    { infraType: 'Roads', category: 'Upgrading' },
    { infraType: 'Roads', category: 'Widening' },
    { infraType: 'School Buildings', category: 'Construction' },
    { infraType: 'School Buildings', category: 'Rehabilitation/Major Repair' },
    { infraType: 'Septage and Sewerage Plants', category: 'Construction' },
    { infraType: 'Septage and Sewerage Plants', category: 'Rehabilitation/Major Repair' },
    { infraType: 'Water Supply Systems', category: 'Construction' },
    { infraType: 'Water Supply Systems', category: 'Rehabilitation' },
    { infraType: 'Waterway', category: 'Channelization' },
    { infraType: 'Waterway', category: 'Dredging / Desilting' },
  ]);

  const handleSort = (columnIndex: number, direction: 0 | 1) => {
    setSortColumn(columnIndex);
    setSortDirection(direction);
    console.log(`Sorting column ${columnIndex} in direction ${direction}`);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Major Work Category Management</h2>
        <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
          Add New Work Category
        </button>
      </div>

      <Table className="w-full">
        <TableHead>
          <TableRow>
            <TableHeader 
              sortable 
              sortDirection={sortColumn === 0 ? sortDirection : null} 
              onSort={(direction) => handleSort(0, direction)}
              className="text-gray-500"
            >
              Infra Type
            </TableHeader>
            <TableHeader 
              sortable 
              sortDirection={sortColumn === 1 ? sortDirection : null} 
              onSort={(direction) => handleSort(1, direction)}
              className="text-gray-500"
            >
              Category
            </TableHeader>
            <TableHeader className="text-gray-500">Actions</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {workCategories.map((category, index) => (
            <TableRow className={`hover:bg-gray-50 ${
              index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
            }`}>
              <TableCell className="font-medium text-gray-900">
                {category.infraType}
              </TableCell>
              <TableCell className="text-gray-900">
                {category.category}
              </TableCell>
              <TableCell>
                <div className="flex space-x-2">
                  <Button 
                      color="orange"
                      // onClick={() => handleViewDetails(program.ProgramId)}
                      className="text-xs px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded"
                  >
                      View
                  </Button>
                  <Button color="red" 
                      // onClick={() => {setIsDeleteProgramOpen(true); setSelectedProgram(program.ProgramId);}} 
                      className="text-xs px-3 py-1.5 bg-red-500 hover:bg-red-600 rounded">
                      <TrashIcon stroke='white' className="h-5 w-5 text-gray-900" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default MajorWorkCategoryTable;
