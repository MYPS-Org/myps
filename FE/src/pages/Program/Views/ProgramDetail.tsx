"use-client";
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

import type { Programs } from '../Model'; // Adjust the import path as necessary
import { Button } from '../../../components/tailwindui/button';
// import { Badge } from '../../../components/tailwindui/badge';

// Mock projects data for the table
const mockProjects = [
  {
    id: 'P00000001MN',
    programName: 'BP 2019 - 002',
    category: 'DA Farm to Market Roads',
    totalCost: '90,000,123',
    createdBy: 'John Doe - DPD',
    createdDate: '17-Mar-2025'
  },
  {
    id: 'P00000002MN',
    programName: 'BP 2019 - 002',
    category: 'DA Farm to Market Roads',
    totalCost: '10,200,431',
    createdBy: 'John Doe - DPD',
    createdDate: '17-Mar-2025'
  },
  {
    id: 'P00000003MN',
    programName: 'BP 2019 - 002',
    category: 'DA Farm to Market Roads',
    totalCost: '500,123',
    createdBy: 'John Doe - DPD',
    createdDate: '17-Mar-2025'
  }
];

const ProgramDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [program, setProgram] = useState<Programs | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      fetchProgramDetail(parseInt(id));
    }
  }, [id]);

  const fetchProgramDetail = async (programId: number) => {
    setIsLoading(true);
    setError(null);
    try {
      // Replace with your actual API endpoint
      const response = await fetch(`/api/programs/${programId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch program details');
      }
      const data = await response.json();
      setProgram(data);
    } catch (error) {
      console.error('Error fetching program details:', error);
      setError(error instanceof Error ? error.message : 'Unknown error occurred');
      
      // For demo purposes, let's set some mock data if API fails
      setProgram({
        Id: programId,
        Name: `RBF FY 2026 Region IV-A`,
        Description: `This is a detailed description for Program ${programId}. This would typically come from your API.`,
        Status: 'Working',
        ProgramStage: 'General Appropriation',
        ProgramType: 'Regular Infrastructure',
        StartYear: 2026,
        User: 'John Doe - DPD Admin',
        DataSecurity: 'Region IV'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    navigate('/programs');
  };

  const handleUpdate = () => {
    // Handle update logic here
    console.log('Update program:', program?.Id);
    alert('Update functionality would be implemented here');
  };

  if (isLoading) {
    return (
      <div className="mx-auto p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-300 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-gray-300 rounded w-full mb-2"></div>
          <div className="h-4 bg-gray-300 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  if (error && !program) {
    return (
      <div className="w-full mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h2 className="text-lg font-semibold text-red-800 mb-2">Error Loading Program</h2>
          <p className="text-red-600">{error}</p>
          <Button onClick={handleBack} color="red" className="mt-4">
            Back to Programs
          </Button>
        </div>
      </div>
    );
  }

  if (!program) {
    return (
      <div className="w-full mx-auto p-6">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-gray-800 mb-2">Program Not Found</h2>
          <p className="text-gray-600 mb-4">The program you're looking for doesn't exist.</p>
          <Button onClick={handleBack} color="blue">
            Back to Programs
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full text-left mx-auto p-6 space-y-6">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-500 mb-4">
        <span>Program Management</span>
        <span className="mx-2">&gt;</span>
        <span>Programs</span>
        <span className="mx-2">&gt;</span>
        <span className="text-gray-900">Program Details</span>
      </nav>

      {/* Main Program Details Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
          {/* Left Column - Form Fields */}
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <div className='col-span-2'>
                <label className="block text-left text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={program.Name}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-900"
                />
              </div>
              <div className='col-span-1'>
                <label className="block text-left text-sm font-medium text-gray-700 mb-1">Start Year</label>
                <input
                  type="text"
                  value={program.StartYear}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className='col-span-2'>
                <label className="block text-left text-sm font-medium text-gray-700 mb-1">Cost</label>
                <input
                  type="text"
                  value="12,004,234"
                  readOnly
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-900"
                />
              </div>
              <div className='col-span-1'>
                <label className="block text-left text-sm font-medium text-gray-700 mb-1">Status</label>
                <div className="flex items-center">
                  <select
                    value={program.Status}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-900"
                  >
                    <option>{program.Status}</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-left text-sm font-medium text-gray-700 mb-1">Program Stage</label>
                <input
                  type="text"
                  value={program.ProgramStage}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-900"
                />
              </div>
              <div>
                <label className="block text-left text-sm font-medium text-gray-700 mb-1">Program Type</label>
                <input
                  type="text"
                  value={program.ProgramType}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-left text-sm font-medium text-gray-700 mb-1">User</label>
              <select
                value={program.User}
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-900"
              >
                <option>{program.User}</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-left text-sm font-medium text-gray-700 mb-1">User Group</label>
                <select
                  value="DPD Admin"
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-900"
                >
                  <option>DPD Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-left text-sm font-medium text-gray-700 mb-1">Data Security</label>
                <select
                  value={program.DataSecurity}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-900"
                >
                  <option>{program.DataSecurity}</option>
                </select>
              </div>
            </div>

            <div className="pt-4 text-right">
              <Button color="green" className="w-24" onClick={handleUpdate}>
                Update
              </Button>
            </div>
          </div>

          {/* Right Column - Map */}
          <div className="col-span-2 bg-gray-100 rounded-lg flex items-center justify-center border">
            <div className="text-center text-gray-500">
              <div className="w-16 h-16 mx-auto mb-4 bg-gray-300 rounded-lg flex items-center justify-center">
                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                </svg>
              </div>
              <p className="text-sm">Map View</p>
              <p className="text-xs text-gray-400">Interactive map would be loaded here</p>
            </div>
          </div>
        </div>
      </div>

      {/* Projects Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900">Projects</h2>
          <Button color="blue">
            Add Project
          </Button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Project ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Program Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Project Cost
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created By
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created Date
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {mockProjects.map((project) => (
                <tr key={project.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button className="text-blue-600 hover:text-blue-800 font-medium">
                      {project.id}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {project.programName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {project.category}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {project.totalCost}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {project.createdBy}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {project.createdDate}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default ProgramDetail;