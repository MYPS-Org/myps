import React, { useState, useEffect } from 'react';
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableHeader
} from '../../../../components/tailwindui/table';
import { Button } from '../../../../components/tailwindui/button';
import { PlusIcon, MagnifyingGlassIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';

interface TypeOfWork {
  id?: number;
  infraType: string;
  majorWorkCategory: string;
  typeOfWork: string;
  unitOfMeasure: string;
  dataType: 'Integer' | 'Real';
  minAmount: number | null;
  maxAmount: number | null;
}

// Replace with API call: GET /codetable/typeofwork
// Data truncated here — full dataset loaded from API in production
const SAMPLE_DATA: TypeOfWork[] = [
  { infraType: "Accessibility Facility", majorWorkCategory: "Construction", typeOfWork: "Construction of Accessibility Facility", unitOfMeasure: "Number of Units", dataType: "Integer", minAmount: 1, maxAmount: 40 },
  { infraType: "Accessibility Facility", majorWorkCategory: "Rehabilitation/Major Repair", typeOfWork: "Rehabilitation/Major Repair of Accessibility Facility", unitOfMeasure: "Number of Units", dataType: "Integer", minAmount: 1, maxAmount: 40 },
  { infraType: "Bridges", majorWorkCategory: "Construction", typeOfWork: "Completion of Bridge Construction", unitOfMeasure: "Number of Bridges", dataType: "Integer", minAmount: 1, maxAmount: 1 },
  { infraType: "Bridges", majorWorkCategory: "Construction", typeOfWork: "Construction of Bailey Bridge", unitOfMeasure: "Square meters", dataType: "Real", minAmount: null, maxAmount: 1000.0 },
  { infraType: "Bridges", majorWorkCategory: "Construction", typeOfWork: "Construction of Bridge", unitOfMeasure: "Square meters", dataType: "Real", minAmount: null, maxAmount: 13000.0 },
  { infraType: "Bridges", majorWorkCategory: "Construction", typeOfWork: "Construction of Bridge Approach", unitOfMeasure: "Lane Km", dataType: "Real", minAmount: null, maxAmount: 300 },
  { infraType: "Bridges", majorWorkCategory: "Construction", typeOfWork: "Construction of Concrete Bridge", unitOfMeasure: "Square meters", dataType: "Real", minAmount: null, maxAmount: 50000.0 },
  { infraType: "Bridges", majorWorkCategory: "Construction", typeOfWork: "Construction of Flyover", unitOfMeasure: "Square meters", dataType: "Real", minAmount: 1, maxAmount: 50000.0 },
  { infraType: "Bridges", majorWorkCategory: "Construction", typeOfWork: "Construction of Interchange", unitOfMeasure: "Square meters", dataType: "Real", minAmount: null, maxAmount: 50000.0 },
  { infraType: "Bridges", majorWorkCategory: "Construction", typeOfWork: "Construction of Steel Bridge", unitOfMeasure: "Square meters", dataType: "Real", minAmount: 1, maxAmount: 10000.0 },
  { infraType: "Bridges", majorWorkCategory: "Construction", typeOfWork: "Construction of Substructure", unitOfMeasure: "Number of Bridges", dataType: "Integer", minAmount: 1, maxAmount: 10 },
  { infraType: "Bridges", majorWorkCategory: "Construction", typeOfWork: "Construction of Superstructure", unitOfMeasure: "Number of Bridges", dataType: "Integer", minAmount: 1, maxAmount: 10 },
  { infraType: "Bridges", majorWorkCategory: "Construction", typeOfWork: "ROW Acquisition", unitOfMeasure: "Square meters", dataType: "Real", minAmount: null, maxAmount: null },
  { infraType: "Bridges", majorWorkCategory: "Rehabilitation/Major Repair", typeOfWork: "Rehabilitation / Major Repair of Bridge", unitOfMeasure: "Number of Bridges", dataType: "Integer", minAmount: 1, maxAmount: 1 },
  { infraType: "Bridges", majorWorkCategory: "Replacement", typeOfWork: "Replacement of Bridge", unitOfMeasure: "Square meters", dataType: "Real", minAmount: null, maxAmount: 15000.0 },
  { infraType: "Bridges", majorWorkCategory: "Retrofitting/Strengthening", typeOfWork: "Retrofitting / Strengthening of Bridge", unitOfMeasure: "Number of Bridges", dataType: "Integer", minAmount: 1, maxAmount: 1 },
  { infraType: "Bridges", majorWorkCategory: "Widening", typeOfWork: "Construction of Parallel Bridge", unitOfMeasure: "Square meters", dataType: "Real", minAmount: null, maxAmount: 35000.0 },
  { infraType: "Bridges", majorWorkCategory: "Widening", typeOfWork: "Widening of Bridge", unitOfMeasure: "Square meters", dataType: "Real", minAmount: null, maxAmount: 35000.0 },
  { infraType: "Consultancy", majorWorkCategory: "Consultancy", typeOfWork: "Business Case Study", unitOfMeasure: "Number of Units", dataType: "Integer", minAmount: 1, maxAmount: 1 },
  { infraType: "Consultancy", majorWorkCategory: "Consultancy", typeOfWork: "Detailed Architectural and Engineering Design", unitOfMeasure: "Number of Units", dataType: "Integer", minAmount: 1, maxAmount: 1 },
  { infraType: "Consultancy", majorWorkCategory: "Consultancy", typeOfWork: "Feasibility Study", unitOfMeasure: "Number of Units", dataType: "Integer", minAmount: 1, maxAmount: 1 },
  { infraType: "Consultancy", majorWorkCategory: "Consultancy", typeOfWork: "Preliminary Engineering Design", unitOfMeasure: "Number of Units", dataType: "Integer", minAmount: 1, maxAmount: 1 },
  { infraType: "Consultancy", majorWorkCategory: "Consultancy", typeOfWork: "Road Safety Engineering", unitOfMeasure: "Number of Units", dataType: "Integer", minAmount: 1, maxAmount: 1 },
  { infraType: "Flood Control Structures", majorWorkCategory: "Construction", typeOfWork: "Construction of Dike", unitOfMeasure: "Lineal meters", dataType: "Real", minAmount: null, maxAmount: 17000.0 },
  { infraType: "Flood Control Structures", majorWorkCategory: "Construction", typeOfWork: "Construction of Drainage Structure", unitOfMeasure: "Lineal meters", dataType: "Real", minAmount: null, maxAmount: 60000.0 },
  { infraType: "Flood Control Structures", majorWorkCategory: "Construction", typeOfWork: "Construction of Flood Mitigation Structure", unitOfMeasure: "Lineal meters", dataType: "Real", minAmount: null, maxAmount: null },
  { infraType: "Flood Control Structures", majorWorkCategory: "Construction", typeOfWork: "Construction of Revetment", unitOfMeasure: "Lineal meters", dataType: "Real", minAmount: null, maxAmount: 25000.0 },
  { infraType: "Flood Control Structures", majorWorkCategory: "Rehabilitation/Major Repair", typeOfWork: "Rehabilitation / Major Repair of Flood Control Structure", unitOfMeasure: "Lineal meters", dataType: "Real", minAmount: 1, maxAmount: 10000.0 },
  { infraType: "Hospitals", majorWorkCategory: "Construction", typeOfWork: "Construction of Hospital", unitOfMeasure: "Number of Hospitals", dataType: "Integer", minAmount: 1, maxAmount: 1 },
  { infraType: "Hospitals", majorWorkCategory: "Construction", typeOfWork: "Construction of Rural Health Unit", unitOfMeasure: "Number of Units", dataType: "Integer", minAmount: 1, maxAmount: 1 },
  { infraType: "Hospitals", majorWorkCategory: "Rehabilitation/Major Repair", typeOfWork: "Rehabilitation / Major Repair of Hospital", unitOfMeasure: "Number of Hospitals", dataType: "Integer", minAmount: 1, maxAmount: 1 },
  { infraType: "Multi Purpose Buildings", majorWorkCategory: "Construction", typeOfWork: "Construction of Evacuation Center", unitOfMeasure: "Number of Buildings", dataType: "Integer", minAmount: 1, maxAmount: 10 },
  { infraType: "Multi Purpose Buildings", majorWorkCategory: "Construction", typeOfWork: "Construction of Multi Purpose Building", unitOfMeasure: "Number of Buildings", dataType: "Integer", minAmount: 1, maxAmount: 100 },
  { infraType: "Multi Purpose Buildings", majorWorkCategory: "Rehabilitation/Major Repair", typeOfWork: "Rehabilitation / Major Repair of Multi Purpose Building", unitOfMeasure: "Number of Buildings", dataType: "Integer", minAmount: 1, maxAmount: 20 },
  { infraType: "Non-Infra", majorWorkCategory: "Consultancy", typeOfWork: "Capacity Building and/or Development", unitOfMeasure: "Number of Units", dataType: "Integer", minAmount: 1, maxAmount: 1 },
  { infraType: "Other Buildings", majorWorkCategory: "Construction", typeOfWork: "Construction of Other Building", unitOfMeasure: "Number of Buildings", dataType: "Integer", minAmount: 1, maxAmount: 200 },
  { infraType: "Other Buildings", majorWorkCategory: "Rehabilitation/Major Repair", typeOfWork: "Repair/Rehabilitation of Other Buildings", unitOfMeasure: "Number of Buildings", dataType: "Integer", minAmount: 1, maxAmount: 200 },
  { infraType: "Rain Water Collector", majorWorkCategory: "Construction", typeOfWork: "Construction of Rain Water Collector", unitOfMeasure: "Number of Units", dataType: "Integer", minAmount: 1, maxAmount: 40 },
  { infraType: "Roads", majorWorkCategory: "Construction", typeOfWork: "Construction of Asphalt Road", unitOfMeasure: "Lane Km", dataType: "Real", minAmount: null, maxAmount: 50 },
  { infraType: "Roads", majorWorkCategory: "Construction", typeOfWork: "Construction of Concrete Road", unitOfMeasure: "Lane Km", dataType: "Real", minAmount: null, maxAmount: 40000.0 },
  { infraType: "Roads", majorWorkCategory: "Construction", typeOfWork: "Construction of Flyover", unitOfMeasure: "Lane Km", dataType: "Real", minAmount: null, maxAmount: 100 },
  { infraType: "Roads", majorWorkCategory: "Construction", typeOfWork: "Construction of Gravel Road", unitOfMeasure: "Lane Km", dataType: "Real", minAmount: null, maxAmount: 70 },
  { infraType: "Roads", majorWorkCategory: "Preventive Maintenance", typeOfWork: "Preventive Maintenance of Road: Asphalt Overlay", unitOfMeasure: "Lane Km", dataType: "Real", minAmount: null, maxAmount: 250 },
  { infraType: "Roads", majorWorkCategory: "Preventive Maintenance", typeOfWork: "Preventive Maintenance of Road: Concrete Reblocking", unitOfMeasure: "Lane Km", dataType: "Real", minAmount: null, maxAmount: 1500.0 },
  { infraType: "Roads", majorWorkCategory: "ROW Acquisition", typeOfWork: "ROW Acquisition", unitOfMeasure: "Square meters", dataType: "Real", minAmount: null, maxAmount: null },
  { infraType: "Roads", majorWorkCategory: "Reconstruction", typeOfWork: "Reconstruction from Asphalt to Concrete", unitOfMeasure: "Lane Km", dataType: "Real", minAmount: null, maxAmount: 50 },
  { infraType: "Roads", majorWorkCategory: "Rehabilitation", typeOfWork: "Rehabilitation of Asphalt Road", unitOfMeasure: "Lane Km", dataType: "Real", minAmount: null, maxAmount: 300 },
  { infraType: "Roads", majorWorkCategory: "Rehabilitation", typeOfWork: "Rehabilitation of Concrete Road", unitOfMeasure: "Lane Km", dataType: "Real", minAmount: null, maxAmount: 110 },
  { infraType: "Roads", majorWorkCategory: "Rehabilitation/Major Repair", typeOfWork: "Rehabilitation / Major Repair of Drainage Structure along Road", unitOfMeasure: "Lineal meters", dataType: "Real", minAmount: null, maxAmount: 20000.0 },
  { infraType: "Roads", majorWorkCategory: "Road Safety", typeOfWork: "Road Safety: Guardrails", unitOfMeasure: "Lineal meters", dataType: "Real", minAmount: null, maxAmount: null },
  { infraType: "Roads", majorWorkCategory: "Road Safety", typeOfWork: "Road Safety: Pavement Markings", unitOfMeasure: "Lineal meters", dataType: "Real", minAmount: null, maxAmount: 50000.0 },
  { infraType: "Roads", majorWorkCategory: "Road Safety", typeOfWork: "Road Safety: Road Signs", unitOfMeasure: "Number of Signs", dataType: "Integer", minAmount: 1, maxAmount: 5000 },
  { infraType: "Roads", majorWorkCategory: "Road Safety", typeOfWork: "Road Safety: Traffic Signals", unitOfMeasure: "Number of Traffic Signals", dataType: "Integer", minAmount: 1, maxAmount: 10 },
  { infraType: "Roads", majorWorkCategory: "Upgrading", typeOfWork: "Road Upgrading Asphalt to Concrete", unitOfMeasure: "Lane Km", dataType: "Real", minAmount: null, maxAmount: 100 },
  { infraType: "Roads", majorWorkCategory: "Upgrading", typeOfWork: "Road Upgrading Gravel to Paved", unitOfMeasure: "Lane Km", dataType: "Real", minAmount: null, maxAmount: 50 },
  { infraType: "Roads", majorWorkCategory: "Widening", typeOfWork: "Road Widening", unitOfMeasure: "Lane Km", dataType: "Real", minAmount: null, maxAmount: 300 },
  { infraType: "School Buildings", majorWorkCategory: "Construction", typeOfWork: "Construction of Classrooms", unitOfMeasure: "Number of Classrooms", dataType: "Integer", minAmount: 1, maxAmount: 150 },
  { infraType: "School Buildings", majorWorkCategory: "Construction", typeOfWork: "Construction of School Buildings", unitOfMeasure: "Number of School Buildings", dataType: "Integer", minAmount: 1, maxAmount: 10 },
  { infraType: "School Buildings", majorWorkCategory: "Rehabilitation/Major Repair", typeOfWork: "Rehabilitation / Major Repair of Classrooms", unitOfMeasure: "Number of Classrooms", dataType: "Integer", minAmount: 1, maxAmount: 150 },
  { infraType: "Septage and Sewerage Plants", majorWorkCategory: "Construction", typeOfWork: "Construction of Septage / Sewerage Plants", unitOfMeasure: "Number of Septage/Sewerage Plants", dataType: "Integer", minAmount: 1, maxAmount: 1 },
  { infraType: "Water Supply Systems", majorWorkCategory: "Construction", typeOfWork: "Construction of Water Supply Systems", unitOfMeasure: "Number of Water Supply Systems", dataType: "Integer", minAmount: 1, maxAmount: 20 },
  { infraType: "Water Supply Systems", majorWorkCategory: "Rehabilitation", typeOfWork: "Rehabilitation of Water Supply Systems", unitOfMeasure: "Number of Water Supply Systems", dataType: "Integer", minAmount: 1, maxAmount: 20 },
  { infraType: "Waterway", majorWorkCategory: "Channelization", typeOfWork: "Channelization", unitOfMeasure: "Cubic meters", dataType: "Real", minAmount: null, maxAmount: null },
  { infraType: "Waterway", majorWorkCategory: "Dredging / Desilting", typeOfWork: "Dredging / Desilting", unitOfMeasure: "Cubic meters", dataType: "Real", minAmount: null, maxAmount: null },
];

const UNIQUE_INFRA_TYPES = [...new Set(SAMPLE_DATA.map(d => d.infraType))].sort();
const UNIQUE_WORK_CATEGORIES = [...new Set(SAMPLE_DATA.map(d => d.majorWorkCategory))].sort();

const formatAmount = (val: number | null) => val === null ? <span className="text-gray-400">—</span> : <span>{val.toLocaleString()}</span>;

const TypeOfWorkTable: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedInfraType, setSelectedInfraType] = useState('');
  const [selectedWorkCategory, setSelectedWorkCategory] = useState('');
  const [filteredData, setFilteredData] = useState<TypeOfWork[]>(SAMPLE_DATA);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  useEffect(() => {
    let filtered = SAMPLE_DATA;
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      filtered = filtered.filter(d =>
        d.typeOfWork.toLowerCase().includes(lower) ||
        d.infraType.toLowerCase().includes(lower) ||
        d.majorWorkCategory.toLowerCase().includes(lower)
      );
    }
    if (selectedInfraType) filtered = filtered.filter(d => d.infraType === selectedInfraType);
    if (selectedWorkCategory) filtered = filtered.filter(d => d.majorWorkCategory === selectedWorkCategory);
    setFilteredData(filtered);
    setCurrentPage(1);
  }, [searchTerm, selectedInfraType, selectedWorkCategory]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const pageData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-lg font-semibold text-gray-900">Type of Work</h4>
          <p className="text-sm text-gray-500 mt-0.5">Specific work type definitions with measurement units and quantity limits</p>
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
          <select
            value={selectedWorkCategory}
            onChange={e => setSelectedWorkCategory(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Work Categories</option>
            {UNIQUE_WORK_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <Button color="indigo" className="flex items-center gap-1 text-sm">
            <PlusIcon className="h-4 w-4" /> Add
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>Infrastructure Type</TableHeader>
              <TableHeader>Work Category</TableHeader>
              <TableHeader>Type of Work</TableHeader>
              <TableHeader>Unit of Measure</TableHeader>
              <TableHeader className="w-20 text-center">Data Type</TableHeader>
              <TableHeader className="w-24 text-center">Min</TableHeader>
              <TableHeader className="w-24 text-center">Max</TableHeader>
              <TableHeader className="w-24">Actions</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {pageData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-10 text-gray-500">No records found.</TableCell>
              </TableRow>
            ) : (
              pageData.map((item, idx) => (
                <TableRow key={`${item.infraType}-${item.typeOfWork}-${idx}`}>
                  <TableCell>
                    <span className="inline-flex px-2 py-0.5 text-xs font-medium bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200">
                      {item.infraType}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-gray-700">{item.majorWorkCategory}</TableCell>
                  <TableCell className="text-sm text-gray-900">{item.typeOfWork}</TableCell>
                  <TableCell className="text-sm text-gray-600">{item.unitOfMeasure}</TableCell>
                  <TableCell className="text-center">
                    <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full border ${
                      item.dataType === 'Integer'
                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : 'bg-green-50 text-green-700 border-green-200'
                    }`}>
                      {item.dataType}
                    </span>
                  </TableCell>
                  <TableCell className="text-center text-sm">{formatAmount(item.minAmount)}</TableCell>
                  <TableCell className="text-center text-sm">{formatAmount(item.maxAmount)}</TableCell>
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

      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>
          Showing {filteredData.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}–{Math.min(currentPage * itemsPerPage, filteredData.length)} of {filteredData.length} entries
        </span>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <Button color="zinc" className="text-xs px-3 py-1" onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} disabled={currentPage === 1}>Previous</Button>
            <span>Page {currentPage} of {totalPages}</span>
            <Button color="zinc" className="text-xs px-3 py-1" onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages}>Next</Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default TypeOfWorkTable;
