import React, { useState } from 'react';
import { 
  DocumentArrowDownIcon, 
  FunnelIcon, 
  MagnifyingGlassIcon,
  DocumentTextIcon,
  TableCellsIcon,
  ChartBarIcon,
  CalendarIcon,
  MapPinIcon,
  CurrencyDollarIcon
} from '@heroicons/react/24/outline';
import { Button } from '../../components/tailwindui/button';
import { Input } from '../../components/tailwindui/input';

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  category: 'summary' | 'detailed' | 'financial' | 'geographic';
}

const reportTemplates: ReportTemplate[] = [
  {
    id: 'program-summary',
    name: 'Program Summary Report',
    description: 'Overview of all programs with key metrics and status',
    icon: DocumentTextIcon,
    category: 'summary'
  },
  {
    id: 'program-detailed',
    name: 'Detailed Program Report',
    description: 'Comprehensive information about programs including all projects',
    icon: TableCellsIcon,
    category: 'detailed'
  },
  {
    id: 'program-financial',
    name: 'Program Financial Report',
    description: 'Budget allocation, disbursements, and financial analysis',
    icon: CurrencyDollarIcon,
    category: 'financial'
  },
  {
    id: 'program-performance',
    name: 'Program Performance Report',
    description: 'Progress tracking and performance indicators',
    icon: ChartBarIcon,
    category: 'summary'
  },
  {
    id: 'program-timeline',
    name: 'Program Timeline Report',
    description: 'Scheduled vs actual timelines and milestones',
    icon: CalendarIcon,
    category: 'detailed'
  },
  {
    id: 'program-geographic',
    name: 'Geographic Distribution Report',
    description: 'Programs by region, province, and district',
    icon: MapPinIcon,
    category: 'geographic'
  }
];

const ProgramReports: React.FC = () => {
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    region: '',
    status: '',
    dateFrom: '',
    dateTo: '',
    programType: '',
    searchQuery: ''
  });

  const handleGenerateReport = (format: 'pdf' | 'excel' | 'csv') => {
    console.log('Generating report:', selectedReport, 'in format:', format, 'with filters:', filters);
    // TODO: Implement actual report generation
    alert(`Generating ${format.toUpperCase()} report...`);
  };

  const categoryColors = {
    summary: 'bg-blue-50 border-blue-200 text-blue-700',
    detailed: 'bg-purple-50 border-purple-200 text-purple-700',
    financial: 'bg-green-50 border-green-200 text-green-700',
    geographic: 'bg-orange-50 border-orange-200 text-orange-700'
  };

  const categoryLabels = {
    summary: 'Summary',
    detailed: 'Detailed',
    financial: 'Financial',
    geographic: 'Geographic'
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Program Reports</h1>
            <p className="mt-1 text-sm text-gray-500">Generate and export program reports</p>
          </div>
          <Button 
            color="blue" 
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2"
          >
            <FunnelIcon className="w-4 h-4" />
            {showFilters ? 'Hide Filters' : 'Show Filters'}
          </Button>
        </div>
      </div>

      <div className="p-6">
        {/* Filters Panel */}
        {showFilters && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Report Filters</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Search programs..."
                    value={filters.searchQuery}
                    onChange={(e) => setFilters({ ...filters, searchQuery: e.target.value })}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Region</label>
                <select
                  value={filters.region}
                  onChange={(e) => setFilters({ ...filters, region: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Regions</option>
                  <option value="ncr">NCR</option>
                  <option value="region1">Region I</option>
                  <option value="region2">Region II</option>
                  <option value="region3">Region III</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Status</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="on-hold">On Hold</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date From</label>
                <Input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date To</label>
                <Input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Program Type</label>
                <select
                  value={filters.programType}
                  onChange={(e) => setFilters({ ...filters, programType: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Types</option>
                  <option value="infrastructure">Infrastructure</option>
                  <option value="social">Social</option>
                  <option value="economic">Economic</option>
                </select>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <Button 
                color="blue" 
                onClick={() => console.log('Applying filters:', filters)}
              >
                Apply Filters
              </Button>
              <Button 
                color="zinc" 
                onClick={() => setFilters({
                  region: '',
                  status: '',
                  dateFrom: '',
                  dateTo: '',
                  programType: '',
                  searchQuery: ''
                })}
              >
                Clear Filters
              </Button>
            </div>
          </div>
        )}

        {/* Report Templates Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
          {reportTemplates.map((template) => {
            const Icon = template.icon;
            return (
              <div
                key={template.id}
                onClick={() => setSelectedReport(template.id)}
                className={`bg-white rounded-lg shadow-sm border-2 transition-all cursor-pointer hover:shadow-md ${
                  selectedReport === template.id
                    ? 'border-blue-500 ring-2 ring-blue-200'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="p-6">
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-lg ${categoryColors[template.category]}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900">{template.name}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${categoryColors[template.category]}`}>
                          {categoryLabels[template.category]}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">{template.description}</p>
                    </div>
                  </div>
                  
                  {selectedReport === template.id && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <p className="text-xs text-gray-500 mb-2">Export as:</p>
                      <div className="flex gap-2">
                        <Button 
                          color="red" 
                        //   size="sm"
                          onClick={(e: any) => {
                            e.stopPropagation();
                            handleGenerateReport('pdf');
                          }}
                        >
                          PDF
                        </Button>
                        <Button 
                          color="green" 
                        //   size="sm"
                          onClick={(e: any) => {
                            e.stopPropagation();
                            handleGenerateReport('excel');
                          }}
                        >
                          Excel
                        </Button>
                        <Button 
                          color="blue" 
                        //   size="sm"
                          onClick={(e: any) => {
                            e.stopPropagation();
                            handleGenerateReport('csv');
                          }}
                        >
                          CSV
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <DocumentArrowDownIcon className="w-5 h-5 text-blue-600" />
              <div className="text-left">
                <p className="font-medium text-gray-900">Export All Programs</p>
                <p className="text-xs text-gray-500">Download complete program list</p>
              </div>
            </button>
            
            <button className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <ChartBarIcon className="w-5 h-5 text-green-600" />
              <div className="text-left">
                <p className="font-medium text-gray-900">Dashboard Summary</p>
                <p className="text-xs text-gray-500">View overall statistics</p>
              </div>
            </button>
            
            <button className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <CalendarIcon className="w-5 h-5 text-purple-600" />
              <div className="text-left">
                <p className="font-medium text-gray-900">Schedule Report</p>
                <p className="text-xs text-gray-500">Set up automated reports</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProgramReports;
