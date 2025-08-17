import React, { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/tailwindui/table';
import { Button } from '../../../components/tailwindui/button';
import { TrashIcon } from '@heroicons/react/24/outline';

interface ThrustData {
  id: number;
  name: string;
  description: string;
  priority: 'High' | 'Medium' | 'Low';
  status: 'Active' | 'Inactive';
  createdDate: string;
}

const ThrustTable: React.FC = () => {
  const [sortDirection, setSortDirection] = useState<0 | 1 | null>(null);
  const [sortColumn, setSortColumn] = useState<number | null>(null);

  // Sample data - replace with actual API call
  const [thrusts] = useState<ThrustData[]>([
    { id: 1, name: 'Digital Innovation', description: 'Focus on digital transformation initiatives', priority: 'High', status: 'Active', createdDate: '2024-01-15' },
    { id: 2, name: 'Sustainability', description: 'Environmental and sustainable development', priority: 'High', status: 'Active', createdDate: '2024-01-20' },
    { id: 3, name: 'Healthcare Innovation', description: 'Medical and healthcare improvements', priority: 'Medium', status: 'Active', createdDate: '2024-02-01' },
    { id: 4, name: 'Education Technology', description: 'Educational technology advancement', priority: 'Medium', status: 'Inactive', createdDate: '2024-02-10' },
  ]);

  const handleSort = (columnIndex: number, direction: 0 | 1) => {
    setSortColumn(columnIndex);
    setSortDirection(direction);
    console.log(`Sorting column ${columnIndex} in direction ${direction}`);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'High': return 'bg-red-100 text-red-800';
      case 'Medium': return 'bg-yellow-100 text-yellow-800';
      case 'Low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Thrust Management</h2>
        <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
          Add New Thrust
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
              Name
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
              Priority
            </TableHeader>
            <TableHeader 
              sortable 
              sortDirection={sortColumn === 4 ? sortDirection : null} 
              onSort={(direction) => handleSort(4, direction)}
              className="text-gray-500"
            >
              Status
            </TableHeader>
            <TableHeader 
              sortable 
              sortDirection={sortColumn === 5 ? sortDirection : null} 
              onSort={(direction) => handleSort(5, direction)}
              className="text-gray-500"
            >
              Created Date
            </TableHeader>
            <TableHeader className="text-gray-500">Actions</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {thrusts.map((thrust, index) => (
            <TableRow key={thrust.id} className={`hover:bg-gray-50 ${
              index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
            }`}>
              <TableCell className="font-medium text-gray-900">
                {thrust.id}
              </TableCell>
              <TableCell className="text-gray-900">
                {thrust.name}
              </TableCell>
              <TableCell className="text-gray-600">
                {thrust.description}
              </TableCell>
              <TableCell>
                <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(thrust.priority)}`}>
                  {thrust.priority}
                </span>
              </TableCell>
              <TableCell>
                <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                  thrust.status === 'Active' 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {thrust.status}
                </span>
              </TableCell>
              <TableCell className="text-gray-600">
                {new Date(thrust.createdDate).toLocaleDateString()}
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

export default ThrustTable;
