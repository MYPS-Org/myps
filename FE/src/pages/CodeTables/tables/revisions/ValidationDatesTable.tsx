import React, { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../../components/tailwindui/table';
import { Button } from '../../../../components/tailwindui/button';
import { PencilIcon, TrashIcon, PlusIcon } from '@heroicons/react/24/outline';

interface ValidationDateData {
  id: number;
  fundingYear: number;
  startDate: string;
  endDate: string;
}

// Replace with API call: GET /codetable/validationdates
const SAMPLE_DATA: ValidationDateData[] = [
  { id: 1, fundingYear: 2016, startDate: '1/1/2016', endDate: '6/30/2016' },
  { id: 2, fundingYear: 2017, startDate: '1/1/2017', endDate: '6/30/2017' },
  { id: 3, fundingYear: 2018, startDate: '1/1/2018', endDate: '6/30/2018' },
  { id: 4, fundingYear: 2019, startDate: '1/1/2019', endDate: '12/31/2019' },
  { id: 5, fundingYear: 2020, startDate: '1/1/2020', endDate: '12/31/2021' },
  { id: 6, fundingYear: 2021, startDate: '1/1/2021', endDate: '12/31/2022' },
  { id: 7, fundingYear: 2022, startDate: '1/1/2022', endDate: '12/31/2023' },
  { id: 8, fundingYear: 2023, startDate: '1/1/2023', endDate: '12/31/2024' },
  { id: 9, fundingYear: 2024, startDate: '1/1/2024', endDate: '12/31/2025' },
];

const ValidationDatesTable: React.FC = () => {
  const [data] = useState<ValidationDateData[]>(SAMPLE_DATA);
  const currentYear = new Date().getFullYear();

  const isCurrentYear = (year: number) => year === currentYear;
  const isPastYear = (endDate: string) => {
    const end = new Date(endDate);
    return end < new Date();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-lg font-semibold text-gray-900">Modification Validation Dates</h4>
          <p className="text-sm text-gray-500 mt-0.5">Defines the valid modification submission windows per funding year</p>
        </div>
        <Button color="indigo" className="flex items-center gap-1 text-sm">
          <PlusIcon className="h-4 w-4" /> Add Date Range
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader className="w-12">ID</TableHeader>
              <TableHeader className="w-32">Funding Year</TableHeader>
              <TableHeader>Start Date</TableHeader>
              <TableHeader>End Date</TableHeader>
              <TableHeader className="w-24 text-center">Status</TableHeader>
              <TableHeader className="w-24">Actions</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.map(item => {
              const past = isPastYear(item.endDate);
              const current = isCurrentYear(item.fundingYear);
              return (
                <TableRow key={item.id}>
                  <TableCell className="font-mono text-xs text-gray-500">{item.id}</TableCell>
                  <TableCell>
                    <span className={`font-semibold text-sm ${current ? 'text-indigo-700' : 'text-gray-700'}`}>
                      {item.fundingYear}
                      {current && <span className="ml-2 text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">Current</span>}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">{item.startDate}</TableCell>
                  <TableCell className="text-sm text-gray-600">{item.endDate}</TableCell>
                  <TableCell className="text-center">
                    <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full border ${
                      !past
                        ? 'bg-green-50 text-green-700 border-green-200'
                        : 'bg-gray-100 text-gray-500 border-gray-200'
                    }`}>
                      {!past ? 'Open' : 'Closed'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1.5">
                      <Button color="zinc" className="p-1.5"><PencilIcon className="h-3.5 w-3.5" /></Button>
                      <Button color="red" className="p-1.5"><TrashIcon className="h-3.5 w-3.5" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-gray-400">{data.length} record(s)</p>
    </div>
  );
};

export default ValidationDatesTable;
