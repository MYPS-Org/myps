import React, { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../../components/tailwindui/table';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { useCodeTableContext } from '../../CodeTableContext';

const RevisionCategoryTable: React.FC = () => {
  const { data: codeTableData, loading } = useCodeTableContext();
  const [search, setSearch] = useState('');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any[] = (codeTableData?.RevisionCategories ?? []) as any[];

  // Derive table columns from first record
  const columns: string[] = data.length > 0 ? Object.keys(data[0]) : [];

  const filtered = search
    ? data.filter(r => Object.values(r).some(v => String(v).toLowerCase().includes(search.toLowerCase())))
    : data;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-lg font-semibold text-gray-900">Revision Categories</h4>
          <p className="text-sm text-gray-500 mt-0.5">Categories used to classify revision / modification transactions</p>
        </div>
        <div className="relative">
          <MagnifyingGlassIcon className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Search..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent w-52" />
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <Table>
          {columns.length > 0 && (
            <TableHead>
              <TableRow>
                {columns.map(col => (
                  <TableHeader key={col}>{col}</TableHeader>
                ))}
              </TableRow>
            </TableHead>
          )}
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={Math.max(columns.length, 1)} className="text-center py-10">
                  <div className="flex items-center justify-center gap-2 text-gray-400">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Loading...
                  </div>
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={Math.max(columns.length, 1)} className="text-center py-10 text-gray-400">
                  No records found.
                </TableCell>
              </TableRow>
            ) : filtered.map((item, idx) => (
              <TableRow key={item.Id ?? idx}>
                {columns.map(col => (
                  <TableCell key={col} className="text-sm text-gray-700">
                    {item[col] === null || item[col] === undefined || item[col] === ''
                      ? <span className="text-gray-300 italic">—</span>
                      : String(item[col])}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default RevisionCategoryTable;
