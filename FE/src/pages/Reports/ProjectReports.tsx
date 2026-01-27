import React, { useState } from 'react';
import { 
  DocumentArrowDownIcon, 
  FunnelIcon, 
  MagnifyingGlassIcon,
  DocumentTextIcon,
  TableCellsIcon,
  ChartBarIcon,
  CalendarIcon,
  WrenchScrewdriverIcon,
  CurrencyDollarIcon,
  MapIcon
} from '@heroicons/react/24/outline';
import { Button } from '../../components/tailwindui/button';
import { Input } from '../../components/tailwindui/input';

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  category: 'summary' | 'detailed' | 'financial' | 'technical';
}

const reportTemplates: ReportTemplate[] = [
  {
    id: 'project-summary',
    name: 'Project Summary Report',
    description: 'High-level overview of all projects with key metrics',
    icon: DocumentTextIcon,
    category: 'summary'
  },
  {
    id: 'project-detailed',
    name: 'Detailed Project Report',
    description: 'Comprehensive project information including components and activities',
    icon: TableCellsIcon,
    category: 'detailed'
  },
  {
    id: 'project-financial',
    name: 'Project Financial Report',
    description: 'Budget, costs, disbursements, and financial status',
    icon: CurrencyDollarIcon,
    category: 'financial'
  },
  {
    id: 'project-progress',
    name: 'Project Progress Report',
    description: 'Implementation status and milestone tracking',
    icon: ChartBarIcon,
    category: 'summary'
  },
  {
    id: 'project-components',
    name: 'Component Cost Report',
    description: 'Breakdown of project components and their costs',
    icon: WrenchScrewdriverIcon,
    category: 'technical'
  },
  {
    id: 'project-timeline',
    name: 'Project Timeline Report',
    description: 'Schedule analysis and timeline comparisons',
    icon: CalendarIcon,
    category: 'detailed'
  },
  {
    id: 'project-location',
    name: 'Project Location Report',
    description: 'Geographic distribution and location analysis',
    icon: MapIcon,
    category: 'technical'
  },
  {
    id: 'project-revision',
    name: 'Revision History Report',
    description: 'Track all project modifications and revisions',
    icon: DocumentTextIcon,
    category: 'detailed'
  }
];

const ProjectReports: React.FC = () => {
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    program: '',
    region: '',
    status: '',
    dateFrom: '',
    dateTo: '',
    componentType: '',
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
    technical: 'bg-orange-50 border-orange-200 text-orange-700'
  };

  const categoryLabels = {
    summary: 'Summary',
    detailed: 'Detailed',
    financial: 'Financial',
    technical: 'Technical'
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Project Reports</h1>
            <p className="mt-1 text-sm text-gray-500">Generate and export project reports</p>
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
                    placeholder="Search projects..."
                    value={filters.searchQuery}
                    onChange={(e) => setFilters({ ...filters, searchQuery: e.target.value })}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Program</label>
                <select
                  value={filters.program}
                  onChange={(e) => setFilters({ ...filters, program: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Programs</option>
                  <option value="program1">Infrastructure Program 2024</option>
                  <option value="program2">Social Development 2024</option>
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
                  <option value="ongoing">Ongoing</option>
                  <option value="completed">Completed</option>
                  <option value="on-hold">On Hold</option>
                  <option value="terminated">Terminated</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Component Type</label>
                <select
                  value={filters.componentType}
                  onChange={(e) => setFilters({ ...filters, componentType: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Components</option>
                  <option value="cw">Civil Works</option>
                  <option value="row">Right of Way</option>
                  <option value="dr">Detailed Engineering</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date Range</label>
                <div className="flex gap-2">
                  <Input
                    type="date"
                    value={filters.dateFrom}
                    onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                    placeholder="From"
                  />
                  <Input
                    type="date"
                    value={filters.dateTo}
                    onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                    placeholder="To"
                  />
                </div>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <Button color="blue">Apply Filters</Button>
              <Button 
                color="zinc" 
                onClick={() => setFilters({
                  program: '',
                  region: '',
                  status: '',
                  dateFrom: '',
                  dateTo: '',
                  componentType: '',
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

        {/* Statistics Overview */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Report Statistics</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-blue-600">156</p>
              <p className="text-sm text-gray-600 mt-1">Total Projects</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-green-600">89</p>
              <p className="text-sm text-gray-600 mt-1">Active Projects</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-orange-600">₱2.5B</p>
              <p className="text-sm text-gray-600 mt-1">Total Budget</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-purple-600">67%</p>
              <p className="text-sm text-gray-600 mt-1">Avg. Completion</p>
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
                <p className="font-medium text-gray-900">Export All Projects</p>
                <p className="text-xs text-gray-500">Download complete project list</p>
              </div>
            </button>
            
            <button className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <ChartBarIcon className="w-5 h-5 text-green-600" />
              <div className="text-left">
                <p className="font-medium text-gray-900">View Dashboard</p>
                <p className="text-xs text-gray-500">Project analytics and insights</p>
              </div>
            </button>
            
            <button className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <CalendarIcon className="w-5 h-5 text-purple-600" />
              <div className="text-left">
                <p className="font-medium text-gray-900">Schedule Report</p>
                <p className="text-xs text-gray-500">Automate report generation</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectReports;
