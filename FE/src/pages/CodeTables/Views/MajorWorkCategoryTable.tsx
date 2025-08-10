import React, { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/tailwindui/table';

interface MajorWorkCategoryData {
  id: number;
  name: string;
  description: string;
  category: string;
  budget: number;
  status: 'Active' | 'Inactive';
  createdDate: string;
}

const MajorWorkCategoryTable: React.FC = () => {
  const [sortDirection, setSortDirection] = useState<0 | 1 | null>(null);
  const [sortColumn, setSortColumn] = useState<number | null>(null);

  // Sample data - replace with actual API call
  const [workCategories] = useState<MajorWorkCategoryData[]>([
    { id: 1, name: 'Infrastructure Development', description: 'Major infrastructure projects', category: 'Construction', budget: 1000000, status: 'Active', createdDate: '2024-01-15' },
    { id: 2, name: 'Software Development', description: 'Large scale software projects', category: 'Technology', budget: 500000, status: 'Active', createdDate: '2024-01-20' },
    { id: 3, name: 'Research & Development', description: 'R&D initiatives', category: 'Research', budget: 750000, status: 'Active', createdDate: '2024-02-01' },
    { id: 4, name: 'Training Programs', description: 'Large scale training initiatives', category: 'Education', budget: 250000, status: 'Inactive', createdDate: '2024-02-10' },
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
              Category
            </TableHeader>
            <TableHeader 
              sortable 
              sortDirection={sortColumn === 4 ? sortDirection : null} 
              onSort={(direction) => handleSort(4, direction)}
              className="text-gray-500"
            >
              Budget
            </TableHeader>
            <TableHeader 
              sortable 
              sortDirection={sortColumn === 5 ? sortDirection : null} 
              onSort={(direction) => handleSort(5, direction)}
              className="text-gray-500"
            >
              Status
            </TableHeader>
            <TableHeader 
              sortable 
              sortDirection={sortColumn === 6 ? sortDirection : null} 
              onSort={(direction) => handleSort(6, direction)}
              className="text-gray-500"
            >
              Created Date
            </TableHeader>
            <TableHeader className="text-gray-500">Actions</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {workCategories.map((category, index) => (
            <TableRow key={category.id} className={`hover:bg-gray-50 ${
              index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
            }`}>
              <TableCell className="font-medium text-gray-900">
                {category.id}
              </TableCell>
              <TableCell className="text-gray-900">
                {category.name}
              </TableCell>
              <TableCell className="text-gray-600">
                {category.description}
              </TableCell>
              <TableCell className="text-gray-600">
                {category.category}
              </TableCell>
              <TableCell className="text-gray-600 font-medium">
                {formatCurrency(category.budget)}
              </TableCell>
              <TableCell>
                <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                  category.status === 'Active' 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {category.status}
                </span>
              </TableCell>
              <TableCell className="text-gray-600">
                {new Date(category.createdDate).toLocaleDateString()}
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

export default MajorWorkCategoryTable;
