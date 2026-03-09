import React, { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../../components/tailwindui/table';
import { Button } from '../../../../components/tailwindui/button';
import { PencilIcon, TrashIcon, PlusIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';

interface FundingSourceData {
  id: number;
  organization: string;
  description: string;
  nature: 'Local' | 'Foreign';
}

// Replace with API call: GET /codetable/fundingsources
const SAMPLE_DATA: FundingSourceData[] = [
  { id: 1, organization: 'ADB', description: 'Asian Development Bank', nature: 'Foreign' },
  { id: 2, organization: 'AIIB', description: 'Asian Infrastructure Investment Bank', nature: 'Foreign' },
  { id: 3, organization: 'CIDCA', description: 'China International Development Cooperation Agency', nature: 'Foreign' },
  { id: 4, organization: 'DOSCST', description: 'Davao Oriental State College of Science and Technology', nature: 'Local' },
  { id: 5, organization: 'EIB', description: 'European Investment Bank', nature: 'Foreign' },
  { id: 6, organization: 'GOP', description: 'Government of the Philippines', nature: 'Local' },
  { id: 7, organization: 'IBRD', description: 'International Bank for Reconstruction and Development', nature: 'Foreign' },
  { id: 8, organization: 'JBIC', description: 'Japan Bank for International Cooperation', nature: 'Foreign' },
  { id: 9, organization: 'JICA', description: 'Japan International Cooperation Agency', nature: 'Foreign' },
  { id: 10, organization: 'KEDCF', description: 'Korean Economic Development Cooperation Fund', nature: 'Foreign' },
  { id: 11, organization: 'MINSAAD', description: 'Mindanao Sustainable Agrarian and Agriculture Development', nature: 'Local' },
];

type NatureFilter = 'All' | 'Local' | 'Foreign';

const FundingSourceTable: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [natureFilter, setNatureFilter] = useState<NatureFilter>('All');
  const [data] = useState<FundingSourceData[]>(SAMPLE_DATA);

  const filtered = data.filter(item => {
    const matchSearch =
      item.organization.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchNature = natureFilter === 'All' || item.nature === natureFilter;
    return matchSearch && matchNature;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-lg font-semibold text-gray-900">Funding Source</h4>
          <p className="text-sm text-gray-500 mt-0.5">Organizations and institutions that fund project activities</p>
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
          <div className="flex rounded-lg border border-gray-300 overflow-hidden text-sm">
            {(['All', 'Local', 'Foreign'] as NatureFilter[]).map(n => (
              <button
                key={n}
                onClick={() => setNatureFilter(n)}
                className={`px-3 py-2 transition-colors ${natureFilter === n ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                {n}
              </button>
            ))}
          </div>
          <Button color="indigo" className="flex items-center gap-1 text-sm">
            <PlusIcon className="h-4 w-4" /> Add Source
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader className="w-12">ID</TableHeader>
              <TableHeader className="w-28">Organization</TableHeader>
              <TableHeader>Description</TableHeader>
              <TableHeader className="w-24 text-center">Nature</TableHeader>
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
                <TableRow key={item.id}>
                  <TableCell className="font-mono text-xs text-gray-500">{item.id}</TableCell>
                  <TableCell>
                    <span className="font-mono text-sm font-bold text-indigo-700">{item.organization}</span>
                  </TableCell>
                  <TableCell className="text-sm text-gray-900">{item.description}</TableCell>
                  <TableCell className="text-center">
                    <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full border ${
                      item.nature === 'Foreign'
                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}>
                      {item.nature}
                    </span>
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
      <p className="text-xs text-gray-400">
        {filtered.length} record(s) · {filtered.filter(d => d.nature === 'Local').length} local · {filtered.filter(d => d.nature === 'Foreign').length} foreign
      </p>
    </div>
  );
};

export default FundingSourceTable;
