import React, { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/tailwindui/table';

interface ProjectOriginData {
  id: number;
  name: string;
  description: string;
  department: string;
  status: 'Active' | 'Inactive';
  createdDate: string;
}

const ProjectOriginTable: React.FC = () => {
  const [sortDirection, setSortDirection] = useState<0 | 1 | null>(null);
  const [sortColumn, setSortColumn] = useState<number | null>(null);

  // Sample data - replace with actual API call
  const [projectOrigins] = useState<ProjectOriginData[]>([
    { id: 1, name: 'Internal Initiative', description: 'Projects originated internally', department: 'IT Department', status: 'Active', createdDate: '2024-01-15' },
    { id: 2, name: 'Client Request', description: 'Projects requested by clients', department: 'Sales Department', status: 'Active', createdDate: '2024-01-20' },
    { id: 3, name: 'Government Mandate', description: 'Projects mandated by government', department: 'Compliance', status: 'Active', createdDate: '2024-02-01' },
    { id: 4, name: 'Market Research', description: 'Projects based on market analysis', department: 'Marketing', status: 'Inactive', createdDate: '2024-02-10' },
  ]);

  const handleSort = (columnIndex: number, direction: 0 | 1) => {
    setSortColumn(columnIndex);
    setSortDirection(direction);
    console.log(`Sorting column ${columnIndex} in direction ${direction}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Project Origin Management</h2>
        <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
          Add New Project Origin
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
              Department
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
          {projectOrigins.map((origin, index) => (
            <TableRow key={origin.id} className={`hover:bg-gray-50 ${
              index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
            }`}>
              <TableCell className="font-medium text-gray-900">
                {origin.id}
              </TableCell>
              <TableCell className="text-gray-900">
                {origin.name}
              </TableCell>
              <TableCell className="text-gray-600">
                {origin.description}
              </TableCell>
              <TableCell className="text-gray-600">
                {origin.department}
              </TableCell>
              <TableCell>
                <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                  origin.status === 'Active' 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {origin.status}
                </span>
              </TableCell>
              <TableCell className="text-gray-600">
                {new Date(origin.createdDate).toLocaleDateString()}
              </TableCell>
              <TableCell>
                <div className="flex space-x-2">
                  <button className="text-blue-600 hover:text-blue-800 text-sm">
                    Edit
                  </button>
                  <button className="text-red-600 hover:text-red-800 text-sm">
                    Delete
                  </button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default ProjectOriginTable;
