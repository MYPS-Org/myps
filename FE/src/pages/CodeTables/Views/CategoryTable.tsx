import React, { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/tailwindui/table';

interface CategoryData {
  id: number;
  name: string;
  description: string;
  status: 'Active' | 'Inactive';
  createdDate: string;
}

const CategoryTable: React.FC = () => {
  const [sortDirection, setSortDirection] = useState<0 | 1 | null>(null);
  const [sortColumn, setSortColumn] = useState<number | null>(null);

  // Sample data - replace with actual API call
  const [categories] = useState<CategoryData[]>([
    { id: 1, name: 'Research', description: 'Research related projects', status: 'Active', createdDate: '2024-01-15' },
    { id: 2, name: 'Development', description: 'Development projects', status: 'Active', createdDate: '2024-01-20' },
    { id: 3, name: 'Infrastructure', description: 'Infrastructure improvements', status: 'Inactive', createdDate: '2024-02-01' },
    { id: 4, name: 'Training', description: 'Training and capacity building', status: 'Active', createdDate: '2024-02-10' },
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
        <h2 className="text-lg font-semibold text-gray-900">Category Management</h2>
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
              Status
            </TableHeader>
            <TableHeader 
              sortable 
              sortDirection={sortColumn === 4 ? sortDirection : null} 
              onSort={(direction) => handleSort(4, direction)}
              className="text-gray-500"
            >
              Created Date
            </TableHeader>
            <TableHeader className="text-gray-500">Actions</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {categories.map((category, index) => (
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

export default CategoryTable;