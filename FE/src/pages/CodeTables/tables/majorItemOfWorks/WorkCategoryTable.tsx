import React, { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../../components/tailwindui/table';
import { Button } from '../../../../components/tailwindui/button';
import { PencilIcon, TrashIcon, PlusIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';

interface WorkCategoryData {
  id: number;
  infraType: string;
  category: string;
}

// Replace with API call: GET /codetable/workcategories
const SAMPLE_DATA: WorkCategoryData[] = [
  { id: 1, infraType: 'Accessibility Facility', category: 'Construction' },
  { id: 2, infraType: 'Accessibility Facility', category: 'Rehabilitation/Major Repair' },
  { id: 3, infraType: 'Bridges', category: 'Construction' },
  { id: 4, infraType: 'Bridges', category: 'Rehabilitation/Major Repair' },
  { id: 5, infraType: 'Bridges', category: 'Replacement' },
  { id: 6, infraType: 'Bridges', category: 'Retrofitting/Strengthening' },
  { id: 7, infraType: 'Bridges', category: 'Widening' },
  { id: 8, infraType: 'Drainage Protection Works', category: 'Rehabilitation/Major Repair' },
  { id: 9, infraType: 'Drainage Structures along Roads', category: 'Construction' },
  { id: 10, infraType: 'Drainage Structures along Roads', category: 'Rehabilitation/Major Repair' },
  { id: 11, infraType: 'Drainage Structures along Roads', category: 'Upgrading' },
  { id: 12, infraType: 'Flood Control Structures', category: 'Construction' },
  { id: 13, infraType: 'Flood Control Structures', category: 'Rehabilitation/Major Repair' },
  { id: 14, infraType: 'Flood Control Structures', category: 'Repair/Maintenance' },
  { id: 15, infraType: 'Flood Control Structures', category: 'Replacement' },
  { id: 16, infraType: 'Hospitals', category: 'Construction' },
  { id: 17, infraType: 'Hospitals', category: 'Rehabilitation/Major Repair' },
  { id: 18, infraType: 'Multi Purpose Buildings', category: 'Construction' },
  { id: 19, infraType: 'Multi Purpose Buildings', category: 'Rehabilitation/Major Repair' },
  { id: 20, infraType: 'Multi Purpose Buildings', category: 'Repair/Maintenance' },
  { id: 21, infraType: 'Multi Purpose Buildings', category: 'Retrofitting/Strengthening' },
  { id: 22, infraType: 'Other Buildings', category: 'Construction' },
  { id: 23, infraType: 'Other Buildings', category: 'Rehabilitation/Major Repair' },
  { id: 24, infraType: 'Other Buildings', category: 'Retrofitting/Strengthening' },
  { id: 25, infraType: 'Rain Water Collector', category: 'Construction' },
  { id: 26, infraType: 'Road Slope Protection Strucutures', category: 'Construction' },
  { id: 27, infraType: 'Road Slope Protection Strucutures', category: 'Rehabilitation/Major Repair' },
  { id: 28, infraType: 'Roads', category: 'Construction' },
  { id: 29, infraType: 'Roads', category: 'Off Carriageway Improvement' },
  { id: 30, infraType: 'Roads', category: 'Off-Carriageway Improvement' },
  { id: 31, infraType: 'Roads', category: 'Preventive Maintenance' },
  { id: 32, infraType: 'Roads', category: 'ROW Acquisition' },
  { id: 33, infraType: 'Roads', category: 'Reconstruction' },
  { id: 34, infraType: 'Roads', category: 'Rehabilitation' },
  { id: 35, infraType: 'Roads', category: 'Rehabilitation/Major Repair' },
  { id: 36, infraType: 'Roads', category: 'Road Safety' },
  { id: 37, infraType: 'Roads', category: 'Upgrading' },
  { id: 38, infraType: 'Roads', category: 'Widening' },
  { id: 39, infraType: 'School Buildings', category: 'Construction' },
  { id: 40, infraType: 'School Buildings', category: 'Rehabilitation/Major Repair' },
  { id: 41, infraType: 'Septage and Sewerage Plants', category: 'Construction' },
  { id: 42, infraType: 'Septage and Sewerage Plants', category: 'Rehabilitation/Major Repair' },
  { id: 43, infraType: 'Water Supply Systems', category: 'Construction' },
  { id: 44, infraType: 'Water Supply Systems', category: 'Rehabilitation' },
  { id: 45, infraType: 'Waterway', category: 'Channelization' },
  { id: 46, infraType: 'Waterway', category: 'Dredging / Desilting' },
];

const UNIQUE_INFRA_TYPES = [...new Set(SAMPLE_DATA.map(d => d.infraType))].sort();

const WorkCategoryTable: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedInfraType, setSelectedInfraType] = useState('');
  const [filteredData, setFilteredData] = useState<WorkCategoryData[]>(SAMPLE_DATA);

  useEffect(() => {
    let filtered = SAMPLE_DATA;
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      filtered = filtered.filter(d =>
        d.infraType.toLowerCase().includes(lower) || d.category.toLowerCase().includes(lower)
      );
    }
    if (selectedInfraType) {
      filtered = filtered.filter(d => d.infraType === selectedInfraType);
    }
    setFilteredData(filtered);
  }, [searchTerm, selectedInfraType]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-lg font-semibold text-gray-900">Major Work Category</h4>
          <p className="text-sm text-gray-500 mt-0.5">Defines valid work categories per infrastructure type</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <MagnifyingGlassIcon className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent w-52"
            />
          </div>
          <select
            value={selectedInfraType}
            onChange={e => setSelectedInfraType(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Infra Types</option>
            {UNIQUE_INFRA_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <Button color="indigo" className="flex items-center gap-1 text-sm">
            <PlusIcon className="h-4 w-4" /> Add Category
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader className="w-12">ID</TableHeader>
              <TableHeader>Infrastructure Type</TableHeader>
              <TableHeader>Work Category</TableHeader>
              <TableHeader className="w-24">Actions</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-10 text-gray-500">No records found.</TableCell>
              </TableRow>
            ) : (
              filteredData.map(item => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono text-xs text-gray-500">{item.id}</TableCell>
                  <TableCell>
                    <span className="inline-flex px-2 py-0.5 text-xs font-medium bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200">
                      {item.infraType}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-gray-900">{item.category}</TableCell>
                  <TableCell>
                    <div className="flex gap-1.5">
                      <Button color="zinc" className="p-1.5"><PencilIcon className="h-3.5 w-3.5" /></Button>
                      <Button color="red" className="p-1.5"><TrashIcon className="h-3.5 w-3.5" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-gray-400">{filteredData.length} record(s) found</p>
    </div>
  );
};

export default WorkCategoryTable;
