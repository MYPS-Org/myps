import React, { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/tailwindui/table';
import { Button } from '../../../components/tailwindui/button';
import { TrashIcon } from '@heroicons/react/24/outline';

interface ModificationValidationDateData {
  id: number;
  fundingYear: number;
  startDate: string;
  endDate: string;
}

const ModificationValidationDatesTable: React.FC = () => {
  const [sortDirection, setSortDirection] = useState<0 | 1 | null>(null);
  const [sortColumn, setSortColumn] = useState<number | null>(null);

  // Sample data - replace with actual API call
  const [modificationValidationDates] = useState<ModificationValidationDateData[]>([
    { id: 1, fundingYear: 2016, startDate: '1/1/2016', endDate: '6/30/2016' },
    { id: 2, fundingYear: 2017, startDate: '1/1/2017', endDate: '6/30/2017' },
    { id: 3, fundingYear: 2018, startDate: '1/1/2018', endDate: '6/30/2018' },
    { id: 4, fundingYear: 2019, startDate: '1/1/2019', endDate: '12/31/2019' },
    { id: 5, fundingYear: 2020, startDate: '1/1/2020', endDate: '12/31/2021' },
    { id: 6, fundingYear: 2021, startDate: '1/1/2021', endDate: '12/31/2022' },
    { id: 7, fundingYear: 2022, startDate: '1/1/2022', endDate: '12/31/2023' },
    { id: 8, fundingYear: 2023, startDate: '1/1/2023', endDate: '12/31/2024' },
    { id: 9, fundingYear: 2024, startDate: '1/1/2024', endDate: '12/31/2025' },
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
        <h2 className="text-lg font-semibold text-gray-900">Revision Validation Dates Management</h2>
        <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
          Add New Date Range
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
              Funding Year
            </TableHeader>
            <TableHeader 
              sortable 
              sortDirection={sortColumn === 2 ? sortDirection : null} 
              onSort={(direction) => handleSort(2, direction)}
              className="text-gray-500"
            >
              Start Date
            </TableHeader>
            <TableHeader 
              sortable 
              sortDirection={sortColumn === 3 ? sortDirection : null} 
              onSort={(direction) => handleSort(3, direction)}
              className="text-gray-500"
            >
              End Date
            </TableHeader>
            <TableHeader className="text-gray-500">Actions</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {modificationValidationDates.map((item, index) => (
            <TableRow key={item.id} className={`hover:bg-gray-50 ${
              index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
            }`}>
              <TableCell className="font-medium text-gray-900">
                {item.id}
              </TableCell>
              <TableCell className="text-gray-900">
                {item.fundingYear}
              </TableCell>
              <TableCell className="text-gray-600">
                {item.startDate}
              </TableCell>
              <TableCell className="text-gray-600">
                {item.endDate}
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

export default ModificationValidationDatesTable;
