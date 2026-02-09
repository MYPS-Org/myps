import React, { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/tailwindui/table';
import { Button } from '../../../components/tailwindui/button';
import { TrashIcon } from '@heroicons/react/24/outline';

interface OtherInfraData {
  id: number;
  code: string;
  description: string;
}

const OtherInfraTable: React.FC = () => {
  const [sortDirection, setSortDirection] = useState<0 | 1 | null>(null);
  const [sortColumn, setSortColumn] = useState<number | null>(null);

  // Sample data - replace with actual API call
  const [otherInfra] = useState<OtherInfraData[]>([
    { id: 1, code: 'AF', description: 'Accessibility Facility' },
    { id: 2, code: 'CS', description: 'Consultancy' },
    { id: 3, code: 'DPW', description: 'Drainage Protection Works' },
    { id: 4, code: 'DS', description: 'Drainage Structures along Roads' },
    { id: 5, code: 'FCS', description: 'Flood Control Structures' },
    { id: 6, code: 'H', description: 'Hospitals' },
    { id: 7, code: 'LB', description: 'Local Bridges' },
    { id: 8, code: 'LFCS', description: 'Local Flood Control Structures' },
    { id: 9, code: 'LR', description: 'Local Roads' },
    { id: 10, code: 'MPB', description: 'Multi Purpose Buildings' },
    { id: 11, code: 'NI', description: 'Non-Infra' },
    { id: 12, code: 'OB', description: 'Other Buildings' },
    { id: 13, code: 'RW', description: 'Rain Water Collector' },
    { id: 14, code: 'RS', description: 'Road Slope Protection Structures' },
    { id: 15, code: 'SB', description: 'School Buildings' },
    { id: 16, code: 'SS', description: 'Septage and Sewerage Plants' },
    { id: 17, code: 'WS', description: 'Water Supply Systems' },
    { id: 18, code: 'WW', description: 'Waterway' },
  ]);

  const handleSort = (columnIndex: number, direction: 0 | 1) => {
    setSortColumn(columnIndex);
    setSortDirection(direction);
    // Implement sorting logic here
    console.log(`Sorting column ${columnIndex} in direction ${direction}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Other Infrastructure Management</h2>
        <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
          Add New Infrastructure Type
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
              ID
            </TableHeader>
            <TableHeader 
              sortable 
              sortDirection={sortColumn === 1 ? sortDirection : null} 
              onSort={(direction) => handleSort(1, direction)}
              className="text-gray-500"
            >
              Code
            </TableHeader>
            <TableHeader 
              sortable 
              sortDirection={sortColumn === 2 ? sortDirection : null} 
              onSort={(direction) => handleSort(2, direction)}
              className="text-gray-500"
            >
              Description
            </TableHeader>
            <TableHeader className="text-gray-500">Actions</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {otherInfra.map((item, index) => (
            <TableRow key={item.id} className={`hover:bg-gray-50 ${
              index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
            }`}>
              <TableCell className="font-medium text-gray-900">
                {item.id}
              </TableCell>
              <TableCell className="font-medium text-gray-900">
                {item.code}
              </TableCell>
              <TableCell className="text-gray-600">
                {item.description}
              </TableCell>
              <TableCell>
                <div className="flex space-x-2">
                  <Button 
                      color="orange"
                      className="text-xs px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded"
                  >
                      View
                  </Button>
                  <Button color="red" 
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

export default OtherInfraTable;
