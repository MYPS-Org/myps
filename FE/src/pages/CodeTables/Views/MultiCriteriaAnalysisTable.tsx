import React, { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/tailwindui/table';
import { Button } from '../../../components/tailwindui/button';
import { TrashIcon } from '@heroicons/react/24/outline';

interface MCAData {
  id: number;
  description: string;
  score: number;
}

const MultiCriteriaAnalysisTable: React.FC = () => {
  const [sortDirection, setSortDirection] = useState<0 | 1 | null>(null);
  const [sortColumn, setSortColumn] = useState<number | null>(null);

  // Sample data - replace with actual API call
  const [mcaData] = useState<MCAData[]>([
    { id: 1, description: 'Project Preparedness', score: 0 },
    { id: 2, description: 'Current Project Status', score: 0 },
    { id: 3, description: 'Approved by the ICC (within 18 months validity)', score: 10 },
    { id: 4, description: 'Approved by the ICC (within 18 months validity) but deferred by lending institution.', score: 8 },
    { id: 5, description: 'Approved by the ICC (after 18 months) but deferred by lending institution.', score: 4 },
    { id: 6, description: 'Not approved by the ICC. New proposal needs to be submitted to the ICC.', score: 0 },
    { id: 7, description: 'Detailed Design', score: 0 },
    { id: 8, description: 'Detailed Design carried out.', score: 5 },
    { id: 9, description: 'Detailed Design not carried out.', score: 0 },
    { id: 10, description: 'Economic Viability', score: 0 },
    { id: 11, description: 'NPV/C is greater than or equal to 25', score: 30 },
    { id: 12, description: 'NPV/C is less than 25 but greater than or equal to 15', score: 25 },
    { id: 13, description: 'NPV/C is less than 15 but greater than or equal to 10', score: 20 },
    { id: 14, description: 'NPV/C is less than 10 but greater than or equal to 5', score: 15 },
    { id: 15, description: 'NPV/C is less than 5 but greater than 0', score: 10 },
    { id: 16, description: 'Environmental Assessment (project with IEE or EIS or EIA, otherwise 0)', score: 0 },
    { id: 17, description: 'Minor or negligible negative impact and any mitigation accounted for in project costs', score: 10 },
    { id: 18, description: 'Moderate negative impact but mitigation accounted for in project costs', score: 8 },
    { id: 19, description: 'Considerable negative impact but mitigation accounted for in project costs', score: 4 },
    { id: 20, description: 'Social Impact', score: 0 },
    { id: 21, description: 'No resettlement or no LAPRAP required', score: 10 },
    { id: 22, description: 'Minor resettlement but mitigation accounted for in project costs', score: 8 },
    { id: 23, description: 'Major resettlement but mitigation accounted for in project costs', score: 4 },
    { id: 24, description: 'Road Network Importance', score: 0 },
    { id: 25, description: 'Road Category', score: 0 },
    { id: 26, description: 'North-South Backbone', score: 15 },
    { id: 27, description: 'East-West Lateral', score: 12 },
    { id: 28, description: 'Other Road of Strategic Importance', score: 8 },
    { id: 29, description: 'Secondary National Road', score: 4 },
    { id: 30, description: 'Road Strategic Network', score: 0 },
    { id: 31, description: 'Identified under major DPWH studies', score: 5 },
    { id: 32, description: 'Not identified under major DPWH studies', score: 0 },
    { id: 33, description: 'Economic and Social Development Policy', score: 0 },
    { id: 34, description: 'a)Provide access to basic services which currently are not available', score: 0 },
    { id: 35, description: 'b)Develop economically and socially underdeveloped/depressed areas (resource base must be available)', score: 0 },
    { id: 36, description: 'c)Improve law and order', score: 0 },
    { id: 37, description: 'd)Support agricultural modernization', score: 0 },
    { id: 38, description: 'e)Support traffic decongestion', score: 0 },
    { id: 39, description: 'f)Support industrial and tourism development', score: 0 },
    { id: 40, description: 'Economic and Social Development Policy', score: 0 },
    { id: 41, description: 'All points met', score: 15 },
    { id: 42, description: 'Point b) and another four out of six points met', score: 12 },
    { id: 43, description: 'Point b) and another two or three out of the six points met', score: 8 },
    { id: 44, description: 'Only point b) met', score: 4 },
    { id: 45, description: 'None of the points met', score: 0 },
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
        <h2 className="text-lg font-semibold text-gray-900">Multi Criteria Analysis Management</h2>
        <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
          Add New Criteria
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
              Description
            </TableHeader>
            <TableHeader 
              sortable 
              sortDirection={sortColumn === 2 ? sortDirection : null} 
              onSort={(direction) => handleSort(2, direction)}
              className="text-gray-500"
            >
              Score
            </TableHeader>
            <TableHeader className="text-gray-500">Actions</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {mcaData.map((item, index) => (
            <TableRow key={item.id} className={`hover:bg-gray-50 ${
              index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
            }`}>
              <TableCell className="font-medium text-gray-900">
                {item.id}
              </TableCell>
              <TableCell className="text-gray-900">
                {item.description}
              </TableCell>
              <TableCell className="text-gray-900">
                {item.score}
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

export default MultiCriteriaAnalysisTable;
