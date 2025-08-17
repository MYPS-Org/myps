"use client";

import React, { useState } from 'react';
import CategoryTable from './ProjectCategoryTable';
import ThrustTable from './ThrustTable';
import ProjectOriginTable from './ProjectOriginTable';
import MajorWorkCategoryTable from './MajorWorkCategoryTable';

type TableType = 'Category' | 'Thrust' | 'ProjectOrigin' | 'MajorWorkCategory' | '';

const CodeTables: React.FC = () => {
  const [selectedTable, setSelectedTable] = useState<TableType>('');

  const handleTableChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedTable(event.target.value as TableType);
  };

  const renderSelectedTable = () => {
    switch (selectedTable) {
      case 'Category':
        return <CategoryTable />;
      case 'Thrust':
        return <ThrustTable />;
      case 'ProjectOrigin':
        return <ProjectOriginTable />;
      case 'MajorWorkCategory':
        return <MajorWorkCategoryTable />;
      default:
        return (
          <div className="text-center py-8 text-gray-500">
            Please select a table from the dropdown above to view and manage the data.
          </div>
        );
    }
  };

  return (
    <div className="w-full text-left space-y-6">
        <div className="m-6 p-6 bg-white rounded-lg shadow">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Code Tables</h3>
            </div>
            <div className="w-full max-w-sm">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Select Table
              </label>
              <select
                value={selectedTable}
                onChange={handleTableChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
              >
                <option value="">-- Select a Table --</option>
                <option value="Category">Category</option>
                <option value="Thrust">Thrust</option>
                <option value="ProjectOrigin">Project Origin</option>
                <option value="MajorWorkCategory">Major Work Category</option>
              </select>
            </div>
        </div>

        <div className='m-6 p-6 bg-white rounded-lg shadow'>
          <div className="mt-6 overflow-x-auto">
                {renderSelectedTable()}
            </div>
        </div>
    </div>
  );
}

export default CodeTables;