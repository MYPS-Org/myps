import React, { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/tailwindui/table';
import { Button } from '../../../components/tailwindui/button';
import { TrashIcon } from '@heroicons/react/24/outline';

interface FundingSourceData {
  id: number;
  organization: string;
  description: string;
  nature: string;
}

const FundingSourceTable: React.FC = () => {
  const [sortDirection, setSortDirection] = useState<0 | 1 | null>(null);
  const [sortColumn, setSortColumn] = useState<number | null>(null);

  // Sample data - replace with actual API call
  const [fundingSource] = useState<FundingSourceData[]>([
    { id: 1, organization: 'ADB', description: 'Asian Development Bank', nature: 'Foreign' },
    { id: 2, organization: 'AIIB', description: 'Asian Infrastructure Investment Bank', nature: 'Foreign' },
    { id: 3, organization: 'CIDCA', description: 'China International Development Cooperation Agency', nature: 'Foreign' },
    { id: 4, organization: 'DOSCST', description: 'Davao Oriental State College of Science and Technology', nature: 'Local' },
    { id: 5, organization: 'EIB', description: 'European Investment Bank', nature: 'Foreign' },
    { id: 6, organization: 'GOP', description: 'Government of the Philippines', nature: 'Local' },
    { id: 7, organization: 'IBRD', description: 'International Bank for Reconstruction and Development', nature: 'Foreign' },
    { id: 8, organization: 'JBIC', description: 'Japan Bank for International Cooperation', nature: 'Foreign' },
    { id: 9, organization: 'JICA', description: 'Japan International Cooperation Agency', nature: 'Foreign' },
    { id: 10, organization: 'KEDCF', description: 'Korean Economic Development Cooperation Fund', nature: 'Foreign' },
    { id: 11, organization: 'MINSAAD', description: 'Mindanao Sustainable Agrarian and Agriculture Development', nature: 'Local' },
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
        <h2 className="text-lg font-semibold text-gray-900">Funding Source Management</h2>
        <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
          Add New Funding Source
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
              Organization
            </TableHeader>
            <TableHeader 
              sortable 
              sortDirection={sortColumn === 2 ? sortDirection : null} 
              onSort={(direction) => handleSort(2, direction)}
              className="text-gray-500"
            >
              Description
            </TableHeader>
            <TableHeader 
              sortable 
              sortDirection={sortColumn === 3 ? sortDirection : null} 
              onSort={(direction) => handleSort(3, direction)}
              className="text-gray-500"
            >
              Nature
            </TableHeader>
            <TableHeader className="text-gray-500">Actions</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {fundingSource.map((item, index) => (
            <TableRow key={item.id} className={`hover:bg-gray-50 ${
              index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
            }`}>
              <TableCell className="font-medium text-gray-900">
                {item.id}
              </TableCell>
              <TableCell className="text-gray-900">
                {item.organization}
              </TableCell>
              <TableCell className="text-gray-600">
                {item.description}
              </TableCell>
              <TableCell>
                <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                  item.nature === 'Foreign' 
                    ? 'bg-blue-100 text-blue-800' 
                    : 'bg-green-100 text-green-800'
                }`}>
                  {item.nature}
                </span>
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

export default FundingSourceTable;
