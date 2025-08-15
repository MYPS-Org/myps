"use client";

import React, { useState } from 'react';
import CategoryTable from './CategoryTable';
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
        <div className="m-6 p-6 bg-white">
            <div className="flex items-center justify-between mb-4">
                <h1 className="text-xl font-semibold mb-4">Code Tables</h1>
            </div>
            <div>
                <label className="block text-left text-sm font-medium text-gray-700 mb-1">Select Table</label>
                <div className="flex items-center">
                    <select 
                    value={selectedTable}
                    onChange={handleTableChange}
                    className='w-1/3 px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-900'
                    >
                        <option value="">-- Select a Table --</option>
                        <option value="Category">Category</option>
                        <option value="Thrust">Thrust</option>
                        <option value="ProjectOrigin">Project Origin</option>
                        <option value="MajorWorkCategory">Major Work Category</option>
                    </select>
                </div>
            </div>
            
            <div className="mt-6 overflow-x-auto">
                {renderSelectedTable()}
            </div>
        </div>
    </div>
  );
}

export default CodeTables;