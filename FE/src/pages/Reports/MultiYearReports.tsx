import React, { useState } from 'react';
import { 
  DocumentArrowDownIcon, 
  FunnelIcon, 
  MagnifyingGlassIcon,
  DocumentChartBarIcon,
  TableCellsIcon,
  ChartBarIcon,
  CalendarDaysIcon,
  CurrencyDollarIcon,
  ArrowTrendingUpIcon
} from '@heroicons/react/24/outline';
import { Button } from '../../components/tailwindui/button';
import { Input } from '../../components/tailwindui/input';

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  category: 'summary' | 'detailed' | 'financial' | 'analysis';
}

const reportTemplates: ReportTemplate[] = [
  {
    id: 'multiyear-summary',
    name: 'Multi-Year Summary Report',
    description: 'Overview of multi-year programs and projects',
    icon: DocumentChartBarIcon,
    category: 'summary'
  },
  {
    id: 'multiyear-detailed',
    name: 'Detailed Multi-Year Report',
    description: 'Comprehensive breakdown by year and program',
    icon: TableCellsIcon,
    category: 'detailed'
  },
  {
    id: 'multiyear-financial',
    name: 'Multi-Year Financial Report',
    description: 'Budget allocation and disbursement across years',
    icon: CurrencyDollarIcon,
    category: 'financial'
  },
  {
    id: 'multiyear-trends',
    name: 'Trend Analysis Report',
    description: 'Year-over-year performance and trends',
    icon: ArrowTrendingUpIcon,
    category: 'analysis'
  },
  {
    id: 'multiyear-projection',
    name: 'Multi-Year Projection Report',
    description: 'Future year projections and forecasts',
    icon: ChartBarIcon,
    category: 'analysis'
  },
  {
    id: 'multiyear-timeline',
    name: 'Multi-Year Timeline Report',
    description: 'Long-term scheduling and milestones',
    icon: CalendarDaysIcon,
    category: 'detailed'
  }
];

const MultiYearReports: React.FC = () => {
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    yearFrom: new Date().getFullYear().toString(),
    yearTo: (new Date().getFullYear() + 5).toString(),
    program: '',
    region: '',
    status: '',
    searchQuery: ''
  });

  const handleGenerateReport = (format: 'pdf' | 'excel' | 'csv') => {
    console.log('Generating report:', selectedReport, 'in format:', format, 'with filters:', filters);
    alert(`Generating ${format.toUpperCase()} report...`);
  };

  const categoryColors = {
    summary: 'bg-blue-50 border-blue-200 text-blue-700',
    detailed: 'bg-purple-50 border-purple-200 text-purple-700',
    financial: 'bg-green-50 border-green-200 text-green-700',
    analysis: 'bg-orange-50 border-orange-200 text-orange-700'
  };

  const categoryLabels = {
    summary: 'Summary',
    detailed: 'Detailed',
    financial: 'Financial',
    analysis: 'Analysis'
  };

  const generateYearOptions = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let i = currentYear - 5; i <= currentYear + 10; i++) {
      years.push(i);
    }
    return years;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Multi-Year Reports</h1>
            <p className="mt-1 text-sm text-gray-500">Generate and analyze multi-year planning data</p>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Year From</label>
                <select
                  value={filters.yearFrom}
                  onChange={(e) => setFilters({ ...filters, yearFrom: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {generateYearOptions().map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Year To</label>
                <select
                  value={filters.yearTo}
                  onChange={(e) => setFilters({ ...filters, yearTo: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {generateYearOptions().map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Program</label>
                <select
                  value={filters.program}
                  onChange={(e) => setFilters({ ...filters, program: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Programs</option>
                  <option value="program1">Multi-Year Infrastructure 2024-2028</option>
                  <option value="program2">Development Program 2025-2030</option>
                </select>
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
                  <option value="planned">Planned</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <Button color="blue">Apply Filters</Button>
              <Button 
                color="zinc" 
                onClick={() => setFilters({
                  yearFrom: new Date().getFullYear().toString(),
                  yearTo: (new Date().getFullYear() + 5).toString(),
                  program: '',
                  region: '',
                  status: '',
                  searchQuery: ''
                })}
              >
                Clear Filters
              </Button>
            </div>
          </div>
        )}

        {/* Year Range Preview */}
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg shadow-sm p-6 mb-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold mb-1">Selected Year Range</h3>
              <p className="text-blue-100">Analyzing data from {filters.yearFrom} to {filters.yearTo}</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold">{parseInt(filters.yearTo) - parseInt(filters.yearFrom) + 1}</p>
              <p className="text-blue-100">Years</p>
            </div>
          </div>
        </div>

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

        {/* Multi-Year Statistics */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Multi-Year Overview</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-blue-600">24</p>
              <p className="text-sm text-gray-600 mt-1">Active Programs</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-green-600">342</p>
              <p className="text-sm text-gray-600 mt-1">Total Projects</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-orange-600">₱15.8B</p>
              <p className="text-sm text-gray-600 mt-1">Total Investment</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-purple-600">2024-2030</p>
              <p className="text-sm text-gray-600 mt-1">Planning Horizon</p>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <DocumentArrowDownIcon className="w-5 h-5 text-blue-600" />
              <div className="text-left">
                <p className="font-medium text-gray-900">Export Full Dataset</p>
                <p className="text-xs text-gray-500">Download all multi-year data</p>
              </div>
            </button>
            
            <button className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <ChartBarIcon className="w-5 h-5 text-green-600" />
              <div className="text-left">
                <p className="font-medium text-gray-900">View Analytics</p>
                <p className="text-xs text-gray-500">Detailed trend analysis</p>
              </div>
            </button>
            
            <button className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <CalendarDaysIcon className="w-5 h-5 text-purple-600" />
              <div className="text-left">
                <p className="font-medium text-gray-900">Schedule Report</p>
                <p className="text-xs text-gray-500">Automated multi-year reports</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MultiYearReports;
