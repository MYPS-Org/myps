import React, { useState } from 'react';
import { Button } from '../../../components/tailwindui/button';
import FilterPermissionDialog from './FilterPermissionDialog';
import type { PermissionFilter } from '../Model';

// Demo component to show how the FilterPermissionDialog works
const FilterPermissionDialogDemo: React.FC = () => {
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  const [currentFilter, setCurrentFilter] = useState<PermissionFilter>({
    ModuleFunction: '',
    Description: ''
  });
  const [filteredResults, setFilteredResults] = useState<any[]>([]);

  // Sample permissions data for demonstration
  const samplePermissions = [
    { Id: 1, ModuleFunction: 'User Management', Description: 'Manage users in the system' },
    { Id: 2, ModuleFunction: 'Role Management', Description: 'Manage user roles and permissions' },
    { Id: 3, ModuleFunction: 'Report Generation', Description: 'Generate system reports' },
    { Id: 4, ModuleFunction: 'User Creation', Description: 'Create new users' },
    { Id: 5, ModuleFunction: 'User Deletion', Description: 'Delete existing users' },
  ];

  const handleFilterSubmit = (filterData: PermissionFilter) => {
    console.log('Filter submitted:', filterData);
    setCurrentFilter(filterData);
    
    // Apply filter to sample data
    let filtered = samplePermissions;
    
    if (filterData.ModuleFunction?.trim()) {
      filtered = filtered.filter(p => 
        p.ModuleFunction.toLowerCase().includes(filterData.ModuleFunction!.toLowerCase())
      );
    }
    
    if (filterData.Description?.trim()) {
      filtered = filtered.filter(p => 
        p.Description.toLowerCase().includes(filterData.Description!.toLowerCase())
      );
    }
    
    setFilteredResults(filtered);
    setIsFilterDialogOpen(false);
  };

  const handleClearFilter = () => {
    console.log('Filter cleared');
    setCurrentFilter({
      ModuleFunction: '',
      Description: ''
    });
    setFilteredResults(samplePermissions);
    setIsFilterDialogOpen(false);
  };

  const hasActiveFilter = currentFilter.ModuleFunction || currentFilter.Description;
  const displayData = hasActiveFilter ? filteredResults : samplePermissions;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Permission Filter Demo
        </h1>
        <p className="text-gray-600">
          This demonstrates how the FilterPermissionDialog works with your permission data.
        </p>
      </div>

      {/* Filter Controls */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button onClick={() => setIsFilterDialogOpen(true)} color="orange">
            Open Filter Dialog
          </Button>
          
          {hasActiveFilter && (
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">Active filters:</span>
              {currentFilter.ModuleFunction && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                  Module: {currentFilter.ModuleFunction}
                </span>
              )}
              {currentFilter.Description && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                  Description: {currentFilter.Description}
                </span>
              )}
            </div>
          )}
        </div>
        
        <div className="text-sm text-gray-600">
          Showing {displayData.length} of {samplePermissions.length} permissions
        </div>
      </div>

      {/* Results Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Module Function
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Description
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {displayData.map((permission) => (
              <tr key={permission.Id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {permission.Id}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {permission.ModuleFunction}
                </td>
                <td className="px-6 py-4 text-sm text-gray-900">
                  {permission.Description}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {displayData.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No permissions found matching your filter criteria.
          </div>
        )}
      </div>

      {/* Filter Dialog */}
      <FilterPermissionDialog
        isOpen={isFilterDialogOpen}
        onClose={() => setIsFilterDialogOpen(false)}
        onSubmit={handleFilterSubmit}
        onClear={handleClearFilter}
        initialData={currentFilter}
      />
    </div>
  );
};

export default FilterPermissionDialogDemo;
