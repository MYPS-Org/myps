import React, { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/tailwindui/table';
import { Button } from '../../../components/tailwindui/button';
import { TrashIcon } from '@heroicons/react/24/outline';

interface ModificationCategoryData {
  id: number;
  codeGroupId: number;
  codeDescription: string;
  sequenceNo: number;
  obsoleteFlag: number;
}

const ModificationCategoryTable: React.FC = () => {
  const [sortDirection, setSortDirection] = useState<0 | 1 | null>(null);
  const [sortColumn, setSortColumn] = useState<number | null>(null);

  // Sample data - replace with actual API call
  const [modificationCategory] = useState<ModificationCategoryData[]>([
    { id: 1, codeGroupId: 1, codeDescription: 'Category A - Typographical Error', sequenceNo: 1, obsoleteFlag: 1 },
    { id: 2, codeGroupId: 2, codeDescription: 'Category B - Change in Station Limits, due to increase or decrease in budget', sequenceNo: 2, obsoleteFlag: 1 },
    { id: 3, codeGroupId: 3, codeDescription: 'Category C - Change in Location', sequenceNo: 3, obsoleteFlag: 1 },
    { id: 4, codeGroupId: 4, codeDescription: 'Category D - Change in Operating Unit (OU)', sequenceNo: 4, obsoleteFlag: 1 },
    { id: 5, codeGroupId: 5, codeDescription: 'Category E - Due to the Occurrence of Calamity', sequenceNo: 5, obsoleteFlag: 1 },
    { id: 6, codeGroupId: 6, codeDescription: 'Adjustment', sequenceNo: 6, obsoleteFlag: 0 },
    { id: 7, codeGroupId: 7, codeDescription: 'Change in Authority to Implement', sequenceNo: 7, obsoleteFlag: 0 },
    { id: 8, codeGroupId: 8, codeDescription: 'Non-Implementable - For Reversion', sequenceNo: 8, obsoleteFlag: 0 },
    { id: 9, codeGroupId: 8, codeDescription: 'Non-Implementable - Abandonment For Savings', sequenceNo: 12, obsoleteFlag: 0 },
    { id: 10, codeGroupId: 8, codeDescription: 'Non-Implementable - Delisted', sequenceNo: 13, obsoleteFlag: 0 },
    { id: 11, codeGroupId: 9, codeDescription: 'Termination', sequenceNo: 9, obsoleteFlag: 0 },
    { id: 12, codeGroupId: 10, codeDescription: 'Additional Funding', sequenceNo: 10, obsoleteFlag: 0 },
    { id: 13, codeGroupId: 11, codeDescription: 'For Savings - Partial Unutilized Balance', sequenceNo: 11, obsoleteFlag: 0 },
    { id: 14, codeGroupId: 12, codeDescription: 'Change in Funding', sequenceNo: 14, obsoleteFlag: 0 },
    { id: 15, codeGroupId: 13, codeDescription: 'Mode of Implementation', sequenceNo: 15, obsoleteFlag: 0 },
    { id: 16, codeGroupId: 14, codeDescription: 'Multi-Year Costing Changes', sequenceNo: 16, obsoleteFlag: 0 },
    { id: 17, codeGroupId: 15, codeDescription: 'Expired Funding', sequenceNo: 17, obsoleteFlag: 0 },
    { id: 18, codeGroupId: 16, codeDescription: 'Change of Creditor', sequenceNo: 18, obsoleteFlag: 0 },
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
        <h2 className="text-lg font-semibold text-gray-900">Modification Category Management</h2>
        <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
          Add New Category
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
              Code Group ID
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
              Sequence No
            </TableHeader>
            <TableHeader 
              sortable 
              sortDirection={sortColumn === 4 ? sortDirection : null} 
              onSort={(direction) => handleSort(4, direction)}
              className="text-gray-500"
            >
              Status
            </TableHeader>
            <TableHeader className="text-gray-500">Actions</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {modificationCategory.map((item, index) => (
            <TableRow key={item.id} className={`hover:bg-gray-50 ${
              index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
            }`}>
              <TableCell className="font-medium text-gray-900">
                {item.id}
              </TableCell>
              <TableCell className="text-gray-900">
                {item.codeGroupId}
              </TableCell>
              <TableCell className="text-gray-900">
                {item.codeDescription}
              </TableCell>
              <TableCell className="text-gray-600">
                {item.sequenceNo}
              </TableCell>
              <TableCell>
                <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                  item.obsoleteFlag === 0 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {item.obsoleteFlag === 0 ? 'Active' : 'Obsolete'}
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

export default ModificationCategoryTable;
