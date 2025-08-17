import React, { useState, useEffect } from 'react';
import { 
  Table, 
  TableHead, 
  TableBody, 
  TableRow, 
  TableCell, 
  TableHeader 
} from '../../../components/tailwindui/table';
import { Button } from '../../../components/tailwindui/button';
import { 
  PlusIcon, 
  MagnifyingGlassIcon,
  PencilIcon,
  TrashIcon
} from '@heroicons/react/24/outline';

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

// Sample data
const SAMPLE_DATA: TypeOfWork[] = [
  {
    infraType: "Accessibility Facility",
    majorWorkCategory: "Construction",
    typeOfWork: "Construction of Accessibility Facility",
    unitOfMeasure: "Number of Units",
    dataType: "Integer",
    minAmount: 1,
    maxAmount: 40,
  },
  {
    infraType: "Accessibility Facility",
    majorWorkCategory: "Rehabilitation/Major Repair",
    typeOfWork: "Rehabilitation/Major Repair of Accessibility Facility",
    unitOfMeasure: "Number of Units",
    dataType: "Integer",
    minAmount: 1,
    maxAmount: 40,
  },
  {
    infraType: "Bridges",
    majorWorkCategory: "Construction",
    typeOfWork: "Completion of Bridge Construction",
    unitOfMeasure: "Number of Bridges",
    dataType: "Integer",
    minAmount: 1,
    maxAmount: 1,
  },
  {
    infraType: "Bridges",
    majorWorkCategory: "Construction",
    typeOfWork: "Construction of Bailey Bridge",
    unitOfMeasure: "Square meters",
    dataType: "Real",
    minAmount: null,
    maxAmount: 1000.0,
  },
  {
    infraType: "Bridges",
    majorWorkCategory: "Construction",
    typeOfWork: "Construction of Bridge",
    unitOfMeasure: "Square meters",
    dataType: "Real",
    minAmount: null,
    maxAmount: 13000.0,
  },
  {
    infraType: "Bridges",
    majorWorkCategory: "Construction",
    typeOfWork: "Construction of Bridge Approach",
    unitOfMeasure: "Lane Km",
    dataType: "Real",
    minAmount: null,
    maxAmount: 300,
  },
  {
    infraType: "Bridges",
    majorWorkCategory: "Construction",
    typeOfWork: "Construction of Concrete Bridge",
    unitOfMeasure: "Square meters",
    dataType: "Real",
    minAmount: null,
    maxAmount: 50000.0,
  },
  {
    infraType: "Bridges",
    majorWorkCategory: "Construction",
    typeOfWork: "Construction of Flood Mitigation Structure",
    unitOfMeasure: "Lineal meters",
    dataType: "Real",
    minAmount: null,
    maxAmount: 10000.0,
  },
  {
    infraType: "Bridges",
    majorWorkCategory: "Construction",
    typeOfWork: "Construction of Flyover",
    unitOfMeasure: "Square meters",
    dataType: "Real",
    minAmount: 1,
    maxAmount: 50000.0,
  },
  {
    infraType: "Bridges",
    majorWorkCategory: "Construction",
    typeOfWork: "Construction of Interchange",
    unitOfMeasure: "Square meters",
    dataType: "Real",
    minAmount: null,
    maxAmount: 50000.0,
  },
  {
    infraType: "Bridges",
    majorWorkCategory: "Construction",
    typeOfWork: "Construction of Steel Bridge",
    unitOfMeasure: "Square meters",
    dataType: "Real",
    minAmount: 1,
    maxAmount: 10000.0,
  },
  {
    infraType: "Bridges",
    majorWorkCategory: "Construction",
    typeOfWork: "Construction of Substructure",
    unitOfMeasure: "Number of Bridges",
    dataType: "Integer",
    minAmount: 1,
    maxAmount: 10,
  },
  {
    infraType: "Bridges",
    majorWorkCategory: "Construction",
    typeOfWork: "Construction of Superstructure",
    unitOfMeasure: "Number of Bridges",
    dataType: "Integer",
    minAmount: 1,
    maxAmount: 10,
  },
  {
    infraType: "Bridges",
    majorWorkCategory: "Construction",
    typeOfWork: "Construction of Viaduct",
    unitOfMeasure: "Square meters",
    dataType: "Real",
    minAmount: 1,
    maxAmount: null,
  },
  {
    infraType: "Bridges",
    majorWorkCategory: "Construction",
    typeOfWork: "ROW Acquisition",
    unitOfMeasure: "Square meters",
    dataType: "Real",
    minAmount: null,
    maxAmount: null,
  },
  {
    infraType: "Bridges",
    majorWorkCategory: "Rehabilitation/Major Repair",
    typeOfWork: "Rehabilitation / Major Repair of Bridge",
    unitOfMeasure: "Number of Bridges",
    dataType: "Integer",
    minAmount: 1,
    maxAmount: 1,
  },
  {
    infraType: "Bridges",
    majorWorkCategory: "Replacement",
    typeOfWork: "Replacement of Bridge",
    unitOfMeasure: "Square meters",
    dataType: "Real",
    minAmount: null,
    maxAmount: 15000.0,
  },
  {
    infraType: "Bridges",
    majorWorkCategory: "Retrofitting/Strengthening",
    typeOfWork: "Retrofitting / Strengthening of Bridge",
    unitOfMeasure: "Number of Bridges",
    dataType: "Integer",
    minAmount: 1,
    maxAmount: 1,
  },
  {
    infraType: "Bridges",
    majorWorkCategory: "Widening",
    typeOfWork: "Construction of Parallel Bridge",
    unitOfMeasure: "Square meters",
    dataType: "Real",
    minAmount: null,
    maxAmount: 35000.0,
  },
  {
    infraType: "Bridges",
    majorWorkCategory: "Widening",
    typeOfWork: "Widening of Bridge",
    unitOfMeasure: "Square meters",
    dataType: "Real",
    minAmount: null,
    maxAmount: 35000.0,
  },
  {
    infraType: "Consultancy",
    majorWorkCategory: "Consultancy",
    typeOfWork: "Business Case Study",
    unitOfMeasure: "Number of Units",
    dataType: "Integer",
    minAmount: 1,
    maxAmount: 1,
  },
  {
    infraType: "Consultancy",
    majorWorkCategory: "Consultancy",
    typeOfWork: "Convergence",
    unitOfMeasure: "Number of Units",
    dataType: "Integer",
    minAmount: 1,
    maxAmount: 1,
  },
  {
    infraType: "Consultancy",
    majorWorkCategory: "Consultancy",
    typeOfWork: "Detailed Architectural and Engineering Design",
    unitOfMeasure: "Number of Units",
    dataType: "Integer",
    minAmount: 1,
    maxAmount: 1,
  },
  {
    infraType: "Consultancy",
    majorWorkCategory: "Consultancy",
    typeOfWork: "Master Plan Preparation",
    unitOfMeasure: "Number of Units",
    dataType: "Integer",
    minAmount: 1,
    maxAmount: 1,
  },
  {
    infraType: "Consultancy",
    majorWorkCategory: "Consultancy",
    typeOfWork: "Parcellary Surveys",
    unitOfMeasure: "Number of Units",
    dataType: "Integer",
    minAmount: 1,
    maxAmount: 1,
  },
  {
    infraType: "Consultancy",
    majorWorkCategory: "Consultancy",
    typeOfWork: "Pavement Engineering",
    unitOfMeasure: "Number of Units",
    dataType: "Integer",
    minAmount: 1,
    maxAmount: 1,
  },
  {
    infraType: "Consultancy",
    majorWorkCategory: "Consultancy",
    typeOfWork: "Planning System and Policy Development",
    unitOfMeasure: "Number of Units",
    dataType: "Integer",
    minAmount: 1,
    maxAmount: 1,
  },
  {
    infraType: "Consultancy",
    majorWorkCategory: "Consultancy",
    typeOfWork: "Preliminary Engineering Design",
    unitOfMeasure: "Number of Units",
    dataType: "Integer",
    minAmount: 1,
    maxAmount: 1,
  },
  {
    infraType: "Consultancy",
    majorWorkCategory: "Consultancy",
    typeOfWork: "Project Development",
    unitOfMeasure: "Number of Units",
    dataType: "Integer",
    minAmount: 1,
    maxAmount: 1,
  },
  {
    infraType: "Consultancy",
    majorWorkCategory: "Consultancy",
    typeOfWork: "Quality Assurance",
    unitOfMeasure: "Number of Units",
    dataType: "Integer",
    minAmount: 1,
    maxAmount: 1,
  },
  {
    infraType: "Consultancy",
    majorWorkCategory: "Consultancy",
    typeOfWork: "Retrofitting",
    unitOfMeasure: "Number of Units",
    dataType: "Integer",
    minAmount: 1,
    maxAmount: 1,
  },
  {
    infraType: "Consultancy",
    majorWorkCategory: "Consultancy",
    typeOfWork: "Road Safety Engineering",
    unitOfMeasure: "Number of Units",
    dataType: "Integer",
    minAmount: 1,
    maxAmount: 1,
  },
  {
    infraType: "Consultancy",
    majorWorkCategory: "Consultancy",
    typeOfWork: "Soil Boring Explorations",
    unitOfMeasure: "Number of Units",
    dataType: "Integer",
    minAmount: 1,
    maxAmount: 1,
  },
  {
    infraType: "Consultancy",
    majorWorkCategory: "Consultancy",
    typeOfWork: "Structural Investigation, Analysis and/or Design",
    unitOfMeasure: "Number of Units",
    dataType: "Integer",
    minAmount: 1,
    maxAmount: 1,
  },
  {
    infraType: "Consultancy",
    majorWorkCategory: "Consultancy",
    typeOfWork: "Topographic Surveys",
    unitOfMeasure: "Number of Units",
    dataType: "Integer",
    minAmount: 1,
    maxAmount: 1,
  },
  {
    infraType: "Consultancy",
    majorWorkCategory: "Consultancy",
    typeOfWork: "Traffic Engineering",
    unitOfMeasure: "Number of Units",
    dataType: "Integer",
    minAmount: 1,
    maxAmount: 1,
  },
  {
    infraType: "Consultancy",
    majorWorkCategory: "Consultancy",
    typeOfWork: "Urban Planning",
    unitOfMeasure: "Number of Units",
    dataType: "Integer",
    minAmount: 1,
    maxAmount: 1,
  }
];

const TypeOfWorkTable: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedInfraType, setSelectedInfraType] = useState('');
  const [selectedMajorWorkCategory, setSelectedMajorWorkCategory] = useState('');
  const [filteredData, setFilteredData] = useState<TypeOfWork[]>(SAMPLE_DATA);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  // Get unique values for filter dropdowns
  const uniqueInfraTypes = [...new Set(SAMPLE_DATA.map(item => item.infraType))];
  const uniqueMajorWorkCategories = [...new Set(SAMPLE_DATA.map(item => item.majorWorkCategory))];

  // Filter data based on search and filters
  useEffect(() => {
    let filtered = SAMPLE_DATA;

    if (searchTerm) {
      filtered = filtered.filter(item => 
        item.typeOfWork.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.infraType.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.majorWorkCategory.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (selectedInfraType) {
      filtered = filtered.filter(item => item.infraType === selectedInfraType);
    }

    if (selectedMajorWorkCategory) {
      filtered = filtered.filter(item => item.majorWorkCategory === selectedMajorWorkCategory);
    }

    setFilteredData(filtered);
    setCurrentPage(1); // Reset to first page when filters change
  }, [searchTerm, selectedInfraType, selectedMajorWorkCategory]);

  // Calculate pagination
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentData = filteredData.slice(startIndex, endIndex);

  // Helper function to render data type badge
  const getDataTypeBadge = (dataType: string) => {
    const colorClass = dataType === 'Integer' 
      ? 'bg-blue-100 text-blue-800 border-blue-200'
      : 'bg-green-100 text-green-800 border-green-200';
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${colorClass}`}>
        {dataType}
      </span>
    );
  };

  // Helper function to format amount values
  const formatAmount = (amount: number | null) => {
    if (amount === null) return 'N/A';
    return amount.toLocaleString();
  };

  return (
    <div className="space-y-4">
      {/* Header with filters */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h4 className="text-lg font-medium text-gray-900">Type of Work</h4>
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative">
            <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Infrastructure Type Filter */}
          <select
            value={selectedInfraType}
            onChange={(e) => setSelectedInfraType(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Infrastructure Types</option>
            {uniqueInfraTypes.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>

          {/* Major Work Category Filter */}
          <select
            value={selectedMajorWorkCategory}
            onChange={(e) => setSelectedMajorWorkCategory(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Work Categories</option>
            {uniqueMajorWorkCategories.map(category => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>

          <Button color="blue" className="text-xs px-3 py-2">
            <PlusIcon className="w-4 h-4 mr-1" />
            Add
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <Table striped>
          <TableHead>
            <TableRow>
              <TableHeader className="text-xs">Infrastructure Type</TableHeader>
              <TableHeader className="text-xs">Major Work Category</TableHeader>
              <TableHeader className="text-xs">Type of Work</TableHeader>
              <TableHeader className="text-xs">Unit of Measure</TableHeader>
              <TableHeader className="text-xs">Data Type</TableHeader>
              <TableHeader className="text-xs">Min Amount</TableHeader>
              <TableHeader className="text-xs">Max Amount</TableHeader>
              <TableHeader className="text-xs">Actions</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {currentData.map((item, idx) => (
              <TableRow key={`${item.infraType}-${item.typeOfWork}-${idx}`}>
                <TableCell className="text-sm font-medium">
                  {item.infraType}
                </TableCell>
                <TableCell className="text-sm">
                  {item.majorWorkCategory}
                </TableCell>
                <TableCell className="text-sm">
                  {item.typeOfWork}
                </TableCell>
                <TableCell className="text-sm">
                  {item.unitOfMeasure}
                </TableCell>
                <TableCell>
                  {getDataTypeBadge(item.dataType)}
                </TableCell>
                <TableCell className="text-sm">
                  {formatAmount(item.minAmount)}
                </TableCell>
                <TableCell className="text-sm">
                  {formatAmount(item.maxAmount)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center space-x-1">
                    <Button 
                      color="blue"
                      className="text-xs px-2 py-1"
                    >
                      <PencilIcon className="w-3 h-3" />
                    </Button>
                    <Button 
                      color="red" 
                      className="text-xs px-2 py-1"
                    >
                      <TrashIcon className="w-3 h-3" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-500">
            Showing {startIndex + 1} to {Math.min(endIndex, filteredData.length)} of {filteredData.length} items
          </div>
          <div className="flex items-center space-x-1">
            <Button
              color="zinc"
              className="text-xs px-3 py-1"
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <span className="text-sm text-gray-500">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              color="zinc"
              className="text-xs px-3 py-1"
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* No data message */}
      {filteredData.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No type of work data found matching your filters.
        </div>
      )}
    </div>
  );
};

export default TypeOfWorkTable;
