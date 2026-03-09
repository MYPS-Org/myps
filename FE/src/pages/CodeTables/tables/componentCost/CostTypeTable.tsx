import React, { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../../components/tailwindui/table';
import { Button } from '../../../../components/tailwindui/button';
import { PencilIcon, TrashIcon, PlusIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import type { ComponentTypeEnum } from '../../../Project/Model.d';

// Replace with API call: GET /codetable/componenttypes
const SAMPLE_DATA: ComponentTypeEnum[] = [
  { Id: 1, ComponentId: 'CONST', ComponentName: 'Construction Cost', ExportToPCMA: true, IsDeleted: false },
  { Id: 2, ComponentId: 'ROW', ComponentName: 'Right Of Way', ExportToPCMA: true, IsDeleted: false },
  { Id: 3, ComponentId: 'DD', ComponentName: 'Detailed Design', ExportToPCMA: false, IsDeleted: false },
  { Id: 4, ComponentId: 'GE', ComponentName: 'Geohazard', ExportToPCMA: false, IsDeleted: false },
  { Id: 5, ComponentId: 'PM', ComponentName: 'Project Management', ExportToPCMA: false, IsDeleted: false },
  { Id: 6, ComponentId: 'ENV', ComponentName: 'Environmental Compliance', ExportToPCMA: false, IsDeleted: false },
  { Id: 7, ComponentId: 'MISC', ComponentName: 'Miscellaneous', ExportToPCMA: false, IsDeleted: false },
  { Id: 8, ComponentId: 'SA', ComponentName: 'Social Advocacy', ExportToPCMA: false, IsDeleted: false },
];

const CostTypeTable: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [data] = useState<ComponentTypeEnum[]>(SAMPLE_DATA);

  const filtered = data.filter(item =>
    !item.IsDeleted &&
    ((item.ComponentName ?? '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.ComponentId ?? '').toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-lg font-semibold text-gray-900">Cost Type (Component Types)</h4>
          <p className="text-sm text-gray-500 mt-0.5">Defines the types of cost components used in project budgeting</p>
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
            <PlusIcon className="h-4 w-4" /> Add Cost Type
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader className="w-12">ID</TableHeader>
              <TableHeader className="w-28">Component ID</TableHeader>
              <TableHeader>Name</TableHeader>
              <TableHeader className="w-32 text-center">Export to PCMA</TableHeader>
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
                  <TableCell>
                    <span className="font-mono text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">{item.ComponentId}</span>
                  </TableCell>
                  <TableCell className="font-medium text-gray-900">{item.ComponentName}</TableCell>
                  <TableCell className="text-center">
                    {item.ExportToPCMA ? (
                      <span className="inline-flex px-2 py-0.5 text-xs font-medium bg-green-50 text-green-700 rounded-full border border-green-200">Yes</span>
                    ) : (
                      <span className="inline-flex px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-500 rounded-full">No</span>
                    )}
                  </TableCell>
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

export default CostTypeTable;
