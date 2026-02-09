import React, { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/tailwindui/table';
import { Button } from '../../../components/tailwindui/button';
import { TrashIcon } from '@heroicons/react/24/outline';

interface ModificationReasonData {
  id: number;
  codeGroupId: number;
  codeDescription: string;
  sequenceNo: number;
  obsoleteFlag: number;
}

const ModificationReasonTable: React.FC = () => {
  const [sortDirection, setSortDirection] = useState<0 | 1 | null>(null);
  const [sortColumn, setSortColumn] = useState<number | null>(null);

  // Sample data - replace with actual API call
  const [modificationReasons] = useState<ModificationReasonData[]>([
    { id: 1, codeGroupId: 1, codeDescription: 'Typographical Error on Project Description', sequenceNo: 1, obsoleteFlag: 0 },
    { id: 2, codeGroupId: 1, codeDescription: 'Project Description needs items removed due to typo error', sequenceNo: 2, obsoleteFlag: 0 },
    { id: 3, codeGroupId: 2, codeDescription: 'Overlapping Sections of Work', sequenceNo: 1, obsoleteFlag: 0 },
    { id: 4, codeGroupId: 2, codeDescription: 'Change in work station limits, due to increase or decrease of budget', sequenceNo: 2, obsoleteFlag: 0 },
    { id: 5, codeGroupId: 2, codeDescription: 'Increase in Target', sequenceNo: 3, obsoleteFlag: 0 },
    { id: 6, codeGroupId: 2, codeDescription: 'Decrease in Target due to additional scope (e.g. ROW)', sequenceNo: 4, obsoleteFlag: 0 },
    { id: 7, codeGroupId: 2, codeDescription: 'Decrease in Target with no additional scope due to increase in unit cost', sequenceNo: 5, obsoleteFlag: 0 },
    { id: 8, codeGroupId: 3, codeDescription: 'No such Barangay exists', sequenceNo: 1, obsoleteFlag: 0 },
    { id: 9, codeGroupId: 3, codeDescription: 'No such City/Municipality', sequenceNo: 2, obsoleteFlag: 0 },
    { id: 10, codeGroupId: 4, codeDescription: 'Change in Implementing Office (IO), requiring a change in OU', sequenceNo: 1, obsoleteFlag: 0 },
    { id: 11, codeGroupId: 5, codeDescription: 'Damage to Project Work Location', sequenceNo: 1, obsoleteFlag: 0 },
    { id: 12, codeGroupId: 5, codeDescription: 'Altered Site Conditions', sequenceNo: 2, obsoleteFlag: 0 },
    { id: 13, codeGroupId: 5, codeDescription: 'Partial Destruction of Accomplishments', sequenceNo: 3, obsoleteFlag: 0 },
    { id: 14, codeGroupId: 5, codeDescription: 'Change to Project Design Required', sequenceNo: 4, obsoleteFlag: 0 },
    { id: 15, codeGroupId: 6, codeDescription: 'Correction of MYPS typographical error for consistency with GAA', sequenceNo: 1, obsoleteFlag: 0 },
    { id: 16, codeGroupId: 6, codeDescription: 'Correction of MYPS for null or zero targets', sequenceNo: 2, obsoleteFlag: 0 },
    { id: 17, codeGroupId: 6, codeDescription: 'Move funds between existing Project Components', sequenceNo: 3, obsoleteFlag: 0 },
    { id: 18, codeGroupId: 6, codeDescription: 'Input of missing Location, Work Location data (if null or zero)', sequenceNo: 4, obsoleteFlag: 0 },
    { id: 19, codeGroupId: 6, codeDescription: 'Input of missing Planned Start/End Date (only if null or zero)', sequenceNo: 5, obsoleteFlag: 0 },
    { id: 20, codeGroupId: 6, codeDescription: 'Excess Amount due to Revised Estimate', sequenceNo: 6, obsoleteFlag: 0 },
    { id: 21, codeGroupId: 6, codeDescription: 'Component incorrectly set up - to be deleted', sequenceNo: 7, obsoleteFlag: 1 },
    { id: 22, codeGroupId: 6, codeDescription: 'New Component needed - movement of funds also required', sequenceNo: 8, obsoleteFlag: 0 },
    { id: 23, codeGroupId: 7, codeDescription: 'Change of Implementing Office (based on approved authority)', sequenceNo: 1, obsoleteFlag: 0 },
    { id: 24, codeGroupId: 8, codeDescription: 'Unresolved ROW', sequenceNo: 1, obsoleteFlag: 0 },
    { id: 25, codeGroupId: 8, codeDescription: 'Unresolved Utilities', sequenceNo: 2, obsoleteFlag: 0 },
    { id: 26, codeGroupId: 8, codeDescription: 'No Site', sequenceNo: 3, obsoleteFlag: 0 },
    { id: 27, codeGroupId: 8, codeDescription: 'Site Inaccessible', sequenceNo: 4, obsoleteFlag: 0 },
    { id: 28, codeGroupId: 8, codeDescription: 'Issues with other Agencies Concerned', sequenceNo: 5, obsoleteFlag: 0 },
    { id: 29, codeGroupId: 8, codeDescription: 'Late release of SARO/SAA', sequenceNo: 6, obsoleteFlag: 0 },
    { id: 30, codeGroupId: 8, codeDescription: 'Modification disapproved', sequenceNo: 7, obsoleteFlag: 0 },
    { id: 31, codeGroupId: 8, codeDescription: 'Presidential approval for by administration above PHP 50M not recieved/disapproved', sequenceNo: 8, obsoleteFlag: 0 },
    { id: 32, codeGroupId: 8, codeDescription: 'Failure of Bidding', sequenceNo: 9, obsoleteFlag: 0 },
    { id: 33, codeGroupId: 8, codeDescription: 'Insufficient Funds', sequenceNo: 10, obsoleteFlag: 0 },
    { id: 34, codeGroupId: 8, codeDescription: 'Insufficient Time to Implement', sequenceNo: 11, obsoleteFlag: 0 },
    { id: 35, codeGroupId: 8, codeDescription: 'Inadequate Resources', sequenceNo: 12, obsoleteFlag: 0 },
    { id: 36, codeGroupId: 8, codeDescription: 'Third Party Intervention', sequenceNo: 13, obsoleteFlag: 0 },
    { id: 37, codeGroupId: 9, codeDescription: 'Termination of Contract - with No Disbursements', sequenceNo: 1, obsoleteFlag: 0 },
    { id: 38, codeGroupId: 9, codeDescription: 'Termination of Contract - with Disbursements', sequenceNo: 2, obsoleteFlag: 0 },
    { id: 39, codeGroupId: 10, codeDescription: 'Additional (buffer) funds from other agencies', sequenceNo: 1, obsoleteFlag: 0 },
    { id: 40, codeGroupId: 10, codeDescription: 'Additional funds for ROW (STO)', sequenceNo: 2, obsoleteFlag: 0 },
    { id: 41, codeGroupId: 11, codeDescription: 'Unutilized Balance', sequenceNo: 1, obsoleteFlag: 0 },
    { id: 42, codeGroupId: 12, codeDescription: 'Expiry of Loan Funding', sequenceNo: 1, obsoleteFlag: 0 },
    { id: 43, codeGroupId: 13, codeDescription: 'Failure of Bidding', sequenceNo: 1, obsoleteFlag: 0 },
    { id: 44, codeGroupId: 14, codeDescription: 'Updates in Multi-Year Costing/Dates', sequenceNo: 1, obsoleteFlag: 0 },
    { id: 45, codeGroupId: 15, codeDescription: 'Project does not commence and funding has expired', sequenceNo: 1, obsoleteFlag: 0 },
    { id: 46, codeGroupId: 16, codeDescription: 'Terminated project but balance of work to be continued as another contract', sequenceNo: 1, obsoleteFlag: 0 },
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
        <h2 className="text-lg font-semibold text-gray-900">Modification Reason Management</h2>
        <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
          Add New Reason
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
          {modificationReasons.map((item, index) => (
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

export default ModificationReasonTable;
