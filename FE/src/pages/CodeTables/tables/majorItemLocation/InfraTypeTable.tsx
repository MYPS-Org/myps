import React, { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../../components/tailwindui/table';
import { Button } from '../../../../components/tailwindui/button';
import { PencilIcon, TrashIcon, PlusIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import type { InfraTypeEnum } from '../../../Project/Model.d';

// Replace with API call: GET /codetable/infratypes
const SAMPLE_DATA: InfraTypeEnum[] = [
  { Id: 1, InfraId: 1, InfraCode: 'AF', InfraName: 'Accessibility Facility' },
  { Id: 2, InfraId: 2, InfraCode: 'CS', InfraName: 'Consultancy' },
  { Id: 3, InfraId: 3, InfraCode: 'DPW', InfraName: 'Drainage Protection Works' },
  { Id: 4, InfraId: 4, InfraCode: 'DS', InfraName: 'Drainage Structures along Roads' },
  { Id: 5, InfraId: 5, InfraCode: 'FCS', InfraName: 'Flood Control Structures' },
  { Id: 6, InfraId: 6, InfraCode: 'H', InfraName: 'Hospitals' },
  { Id: 7, InfraId: 7, InfraCode: 'LB', InfraName: 'Local Bridges' },
  { Id: 8, InfraId: 8, InfraCode: 'LFCS', InfraName: 'Local Flood Control Structures' },
  { Id: 9, InfraId: 9, InfraCode: 'LR', InfraName: 'Local Roads' },
  { Id: 10, InfraId: 10, InfraCode: 'MPB', InfraName: 'Multi Purpose Buildings' },
  { Id: 11, InfraId: 11, InfraCode: 'NI', InfraName: 'Non-Infra' },
  { Id: 12, InfraId: 12, InfraCode: 'OB', InfraName: 'Other Buildings' },
  { Id: 13, InfraId: 13, InfraCode: 'RW', InfraName: 'Rain Water Collector' },
  { Id: 14, InfraId: 14, InfraCode: 'RS', InfraName: 'Road Slope Protection Structures' },
  { Id: 15, InfraId: 15, InfraCode: 'SB', InfraName: 'School Buildings' },
  { Id: 16, InfraId: 16, InfraCode: 'SS', InfraName: 'Septage and Sewerage Plants' },
  { Id: 17, InfraId: 17, InfraCode: 'WS', InfraName: 'Water Supply Systems' },
  { Id: 18, InfraId: 18, InfraCode: 'WW', InfraName: 'Waterway' },
  { Id: 19, InfraId: 19, InfraCode: 'B', InfraName: 'Bridges' },
  { Id: 20, InfraId: 20, InfraCode: 'R', InfraName: 'Roads' },
];

const InfraTypeTable: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [data] = useState<InfraTypeEnum[]>(SAMPLE_DATA);

  const filtered = data.filter(item =>
    item.InfraName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.InfraCode.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-lg font-semibold text-gray-900">Infrastructure Types</h4>
          <p className="text-sm text-gray-500 mt-0.5">Master list of infrastructure type codes used for major item locations</p>
        </div>
        <div className="flex items-center gap-2">
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
          <Button color="indigo" className="flex items-center gap-1 text-sm">
            <PlusIcon className="h-4 w-4" /> Add Type
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader className="w-12">ID</TableHeader>
              <TableHeader className="w-20">Infra ID</TableHeader>
              <TableHeader className="w-24">Code</TableHeader>
              <TableHeader>Name</TableHeader>
              <TableHeader className="w-24">Actions</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-10 text-gray-500">No records found.</TableCell>
              </TableRow>
            ) : (
              filtered.map(item => (
                <TableRow key={item.Id}>
                  <TableCell className="font-mono text-xs text-gray-500">{item.Id}</TableCell>
                  <TableCell className="font-mono text-xs text-gray-500">{item.InfraId}</TableCell>
                  <TableCell>
                    <span className="font-mono text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-bold">{item.InfraCode}</span>
                  </TableCell>
                  <TableCell className="font-medium text-gray-900">{item.InfraName}</TableCell>
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
      <p className="text-xs text-gray-400">{filtered.length} record(s) found</p>
    </div>
  );
};

export default InfraTypeTable;
