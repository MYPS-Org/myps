import React, { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../../components/tailwindui/table';
import { Button } from '../../../../components/tailwindui/button';
import { PencilIcon, TrashIcon, PlusIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';

interface MCAData {
  id: number;
  category: string;
  description: string;
  score: number;
}

// Replace with API call: GET /codetable/multicriteria
const SAMPLE_DATA: MCAData[] = [
  { id: 1, category: 'Project Preparedness', description: 'Current Project Status', score: 0 },
  { id: 2, category: 'Project Preparedness', description: 'Approved by the ICC (within 18 months validity)', score: 10 },
  { id: 3, category: 'Project Preparedness', description: 'Approved by the ICC (within 18 months validity) but deferred by lending institution.', score: 8 },
  { id: 4, category: 'Project Preparedness', description: 'Approved by the ICC (after 18 months) but deferred by lending institution.', score: 4 },
  { id: 5, category: 'Project Preparedness', description: 'Not approved by the ICC. New proposal needs to be submitted to the ICC.', score: 0 },
  { id: 6, category: 'Detailed Design', description: 'Detailed Design carried out.', score: 5 },
  { id: 7, category: 'Detailed Design', description: 'Detailed Design not carried out.', score: 0 },
  { id: 8, category: 'Economic Viability', description: 'NPV/C is greater than or equal to 25', score: 30 },
  { id: 9, category: 'Economic Viability', description: 'NPV/C is less than 25 but greater than or equal to 15', score: 25 },
  { id: 10, category: 'Economic Viability', description: 'NPV/C is less than 15 but greater than or equal to 10', score: 20 },
  { id: 11, category: 'Economic Viability', description: 'NPV/C is less than 10 but greater than or equal to 5', score: 15 },
  { id: 12, category: 'Economic Viability', description: 'NPV/C is less than 5 but greater than 0', score: 10 },
  { id: 13, category: 'Environmental Assessment', description: 'Minor or negligible negative impact and any mitigation accounted for in project costs', score: 10 },
  { id: 14, category: 'Environmental Assessment', description: 'Moderate negative impact but mitigation accounted for in project costs', score: 8 },
  { id: 15, category: 'Environmental Assessment', description: 'Considerable negative impact but mitigation accounted for in project costs', score: 4 },
  { id: 16, category: 'Social Impact', description: 'No resettlement or no LAPRAP required', score: 10 },
  { id: 17, category: 'Social Impact', description: 'Minor resettlement but mitigation accounted for in project costs', score: 8 },
  { id: 18, category: 'Social Impact', description: 'Major resettlement but mitigation accounted for in project costs', score: 4 },
  { id: 19, category: 'Road Network Importance', description: 'North-South Backbone', score: 15 },
  { id: 20, category: 'Road Network Importance', description: 'East-West Lateral', score: 12 },
  { id: 21, category: 'Road Network Importance', description: 'Other Road of Strategic Importance', score: 8 },
  { id: 22, category: 'Road Network Importance', description: 'Secondary National Road', score: 4 },
  { id: 23, category: 'Road Strategic Network', description: 'Identified under major DPWH studies', score: 5 },
  { id: 24, category: 'Road Strategic Network', description: 'Not identified under major DPWH studies', score: 0 },
  { id: 25, category: 'Economic and Social Development Policy', description: 'All points met', score: 15 },
  { id: 26, category: 'Economic and Social Development Policy', description: 'Point b) and another four out of six points met', score: 12 },
  { id: 27, category: 'Economic and Social Development Policy', description: 'Point b) and another two or three out of the six points met', score: 8 },
  { id: 28, category: 'Economic and Social Development Policy', description: 'Only point b) met', score: 4 },
  { id: 29, category: 'Economic and Social Development Policy', description: 'None of the points met', score: 0 },
];

const UNIQUE_CATEGORIES = [...new Set(SAMPLE_DATA.map(d => d.category))];

const MultiCriteriaAnalysisTable: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [filteredData, setFilteredData] = useState<MCAData[]>(SAMPLE_DATA);

  useEffect(() => {
    let filtered = SAMPLE_DATA;
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      filtered = filtered.filter(d => d.description.toLowerCase().includes(lower) || d.category.toLowerCase().includes(lower));
    }
    if (selectedCategory) {
      filtered = filtered.filter(d => d.category === selectedCategory);
    }
    setFilteredData(filtered);
  }, [searchTerm, selectedCategory]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-lg font-semibold text-gray-900">Multi Criteria Analysis</h4>
          <p className="text-sm text-gray-500 mt-0.5">Scoring criteria used for project prioritization and evaluation</p>
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
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Categories</option>
            {UNIQUE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <Button color="indigo" className="flex items-center gap-1 text-sm">
            <PlusIcon className="h-4 w-4" /> Add Criteria
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader className="w-12">ID</TableHeader>
              <TableHeader className="w-48">Category</TableHeader>
              <TableHeader>Description</TableHeader>
              <TableHeader className="w-20 text-center">Score</TableHeader>
              <TableHeader className="w-24">Actions</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-10 text-gray-500">No records found.</TableCell>
              </TableRow>
            ) : (
              filteredData.map(item => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono text-xs text-gray-500">{item.id}</TableCell>
                  <TableCell>
                    <span className="inline-flex px-2 py-0.5 text-xs font-medium bg-purple-50 text-purple-700 rounded-full border border-purple-200">
                      {item.category}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-gray-900">{item.description}</TableCell>
                  <TableCell className="text-center">
                    {item.score > 0 ? (
                      <span className="inline-flex w-10 h-7 items-center justify-center text-sm font-bold bg-amber-50 text-amber-700 rounded border border-amber-200">
                        {item.score}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-sm">—</span>
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
      <p className="text-xs text-gray-400">{filteredData.length} record(s) found · Max possible score: {SAMPLE_DATA.reduce((sum, d) => Math.max(sum, d.score), 0)}</p>
    </div>
  );
};

export default MultiCriteriaAnalysisTable;
