"use client";
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { 
  ProjectDetails as ProjectDetailsType, 
  ComponentCost, 
  MajorItemOfWork, 
  ProjectNote, 
  FundingProfile, 
  Activity 
} from '../Model';

import { Button } from '../../../components/tailwindui/button';
import { Table, TableHead, TableBody, TableRow, TableCell, TableHeader } from '../../../components/tailwindui/table';
import { 
  PencilIcon, 
  TrashIcon, 
  PlusIcon
} from '@heroicons/react/24/outline';

const ProjectDetails: React.FC = () => {
  const navigate = useNavigate();
  
  const [projectDetails] = useState<ProjectDetailsType>({
    Id: 'P00001LZ',
    ProgramName: 'RBP FY 2025',
    ProgramType: 'Regional Budget Pro...',
    UserGroup: 'DPD Admin',
    StartYear: 2025,
    ProgramStage: 'Regular Infrastructure',
    DataSecurity: 'Region IV',
    ProjectName: 'P00001LZ',
    CityMunicipality: 'sample',
    ReportingRegion: 'sample',
    Description: 'Sample Description',
    LegislativeDistrict: 'sample',
    OriginatingRegion: 'sample',
    OperatingUnit: 'sample',
    AlternativeProjCode: 'sample',
    Category: 'sample',
    ImplementingOffice: 'sample',
    ImplementationCode: 'sample',
    Thrust: 'sample',
    DistrictEngOffice: 'P00001LZ',
    EmergencyCode: 'sample',
    Origin: 'P00001LZ',
    CreatedBy: 'John Doe',
    CreatedDate: '15-Mar-2025',
    FeasibilityStudy: true,
    DetailedDesign: true,
    RowAvailable: true
  });

  const [componentCosts] = useState<ComponentCost[]>([
    {
      Id: 'CW1',
      Description: 'Component cost based on...',
      Cost2025: 100000330,
      Cost2026: 100500330,
      MYCAApproval: '14-Mar-2025',
      UACsPAPCode: 'ABCD',
      PlannedStartDate: '14-Mar-2025'
    },
    {
      Id: 'CW2',
      Description: 'Component cost based on...',
      Cost2025: 150000330,
      Cost2026: 0,
      MYCAApproval: '14-Mar-2025',
      UACsPAPCode: 'ABCD',
      PlannedStartDate: '14-Mar-2025'
    }
  ]);

  const [majorItems] = useState<MajorItemOfWork[]>([
    {
      Id: 'MW1',
      ComponentId: 'CW1',
      YearOfWork: 2,
      TypeOfWork: 'Additional Lane Width',
      TargetUnit: 'Lane KM',
      PhysicalTarget: 'number anything',
      DetailedScopeOfWork: 'Comment',
      InfraId: 'P50000LCR'
    },
    {
      Id: 'MW2',
      ComponentId: 'CW1',
      YearOfWork: 2,
      TypeOfWork: 'Additional Lane Width',
      TargetUnit: 'Lane KM',
      PhysicalTarget: 'number anything',
      DetailedScopeOfWork: 'Comment',
      InfraId: 'P50000LCR'
    }
  ]);

  const [notes] = useState<ProjectNote[]>([
    {
      Id: 'N1',
      Description: 'Requested by John Doe...',
      CreatedDate: '14-Mar-2025'
    },
    {
      Id: 'N2',
      Description: 'Requested by John Doe...',
      CreatedDate: '14-Mar-2025'
    }
  ]);

  const [fundingProfiles] = useState<FundingProfile[]>([
    {
      Id: 'FP1',
      Source: 'GOP',
      Agreement: 'DPWH-GAA-2014',
      Percentage: 100
    },
    {
      Id: 'FP2',
      Source: 'GOP',
      Agreement: 'DPWH-GAA-2015',
      Percentage: 100
    }
  ]);

  const [activities] = useState<Activity[]>([
    {
      Id: 'A1',
      Description: 'Major Item of work CW1 Type of work change from "Sample" to "Additional Lane Width"',
      Date: '14-Mar-2025'
    },
    {
      Id: 'A2',
      Description: 'Major Item of work CW1 Type of work change from "Sample" to "Additional Lane Width"',
      Date: '14-Mar-2025'
    }
  ]);

  const totalCosts = {
    totalCost: 238500692,
    totalCostCw1: 100700862010,
    totalCostCw2: 150000330,
    totalCost2025: 235400480,
    totalCost2026: 192000200638
  };

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('en-PH');
  };

  const handleGoBack = () => {
    navigate('/projects');
  };

  return (
    <div className="max-w-10xl mx-auto p-6 space-y-6">
        <div className='flex items-center justify-between mb-6'>
            {/* Breadcrumb */}
            <nav className="flex items-center text-sm text-left text-gray-500">
                <span>MYPS Admin</span>
                <span className="mx-2">&gt;</span>
                <span 
                className="text-blue-600 hover:text-blue-800 cursor-pointer"
                onClick={handleGoBack}
                >
                Project Revision
                </span>
                <span className="mx-2">&gt;</span>
                <span>Ongoing</span>
                <span className="mx-2">&gt;</span>
            </nav>
            <div className="flex space-x-3">
                <Button color="red">Delete Project</Button>
                <Button color="blue">Save Changes</Button>
            </div>
        </div>

      {/* Map Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="h-64 bg-blue-100 rounded-lg flex items-center justify-center">
          <div className="text-gray-500 text-lg">Map View - {projectDetails.ProjectName}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Program Details */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-left text-lg font-semibold text-gray-900 mb-4">Program Details</h2>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className='w-full flex flex-row text-left gap-5 items-center'>
              <label className="flex-1/3 text-gray-600">Program Name:</label>
              <input
               type="text"
               value={projectDetails.ProgramName} 
               className='flex-2/3 mt-1 px-3 py-2 border border-gray-300 rounded-md'
               />
            </div>
            <div className='flex flex-row text-left gap-5 items-center'>
              <label className="flex-1/3 text-gray-600">Program Type:</label>
              <input
               type="text"
               value={projectDetails.ProgramType}
               className='flex-2/3 mt-1 px-3 py-2 border border-gray-300 rounded-md'
               />
            </div>
            <div className='flex flex-row text-left gap-5 items-center'>
              <label className="flex-1/3 text-gray-600">Start Year:</label>
              <input
               type="text"
               value={projectDetails.StartYear}
               className='flex-2/3 mt-1 px-3 py-2 border border-gray-300 rounded-md'
               />
            </div>
            <div className='flex flex-row text-left gap-5 items-center'>
              <label className="flex-1/3 text-gray-600">Program Stage:</label>
              <input
               type="text"
               value={projectDetails.ProgramStage}
               className='flex-2/3 mt-1 px-3 py-2 border border-gray-300 rounded-md'
               />
            </div>
            <div className='flex flex-row text-left gap-5 items-center'>
              <label className="flex-1/3 text-gray-600">User Group:</label>
              <input
               type="text"
               value={projectDetails.UserGroup}
               className='flex-2/3 mt-1 px-3 py-2 border border-gray-300 rounded-md'
               />
            </div>
            <div className='flex flex-row text-left gap-5 items-center'>
              <label className="flex-1/3 text-gray-600">Data Security:</label>
              <input
               type="text"
               value={projectDetails.DataSecurity}
               className='flex-2/3 mt-1 px-3 py-2 border border-gray-300 rounded-md'
               />
            </div>
          </div>
        </div>

        {/* Project Details */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-left text-lg font-semibold text-gray-900 mb-4">Project Details</h2>
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-3 gap-5">
              <div className='w-full flex flex-row text-left gap-5 items-center'>
                <label className="flex-1/3 text-gray-600">Project Name:</label>
                <input 
                  type="text" 
                  value={projectDetails.ProjectName}
                  className="flex-2/3 mt-1 px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div className='w-full flex flex-row text-left gap-5 items-center'>
                <label className="flex-1/3 text-gray-600">City/Municipality:</label>
                <select className="flex-2/3 mt-1 px-3 py-2 border border-gray-300 rounded-md">
                  <option>{projectDetails.CityMunicipality}</option>
                </select>
              </div>
              <div className='w-full flex flex-row text-left gap-5 items-center'>
                <label className="flex-1/3 text-gray-600">Reporting Program:</label>
                <select className="flex-2/3 mt-1 px-3 py-2 border border-gray-300 rounded-md">
                  <option>sample</option>
                </select>
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-5">
              <div className='w-full flex flex-row text-left gap-5'>
                <label className="flex-1/3 text-gray-600 mt-3">Description:</label>
                <textarea 
                  rows={4} 
                  value={projectDetails.Description}
                  className="flex-2/3 mt-1 px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <div className='w-full flex flex-row text-left gap-5 mb-5 items-center'>
                  <label className="flex-1/3 text-gray-600">Legislative:</label>
                  <select className="flex-2/3 mt-1 px-3 py-2 border border-gray-300 rounded-md">
                    <option>sample</option>
                  </select>
                </div>
                <div className='w-full flex flex-row text-left gap-5 items-center'>
                  <label className="flex-1/3 text-gray-600">Operating Unit:</label>
                  <select className="flex-2/3 mt-1 px-3 py-2 border border-gray-300 rounded-md">
                    <option>{projectDetails.OperatingUnit}</option>
                  </select>
                </div>
              </div>
              <div>
                <div className='w-full flex flex-row text-left gap-5 items-center mb-5'>
                  <label className="flex-1/3 text-gray-600">Origination Region:</label>
                  <select className="flex-2/3 mt-1 px-3 py-2 border border-gray-300 rounded-md">
                    <option>sample</option>
                  </select>
                </div>
                <div className='w-full flex flex-row text-left gap-5 items-center'>
                  <label className="flex-1/3 text-gray-600">Origination Region:</label>
                  <select className="flex-2/3 mt-1 px-3 py-2 border border-gray-300 rounded-md">
                    <option>sample</option>
                  </select>
                </div>
              </div>
              
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-gray-600">Legislative District:</label>
                <select className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md">
                  <option>{projectDetails.LegislativeDistrict}</option>
                </select>
              </div>
              <div>
                <label className="text-gray-600">Originating Region:</label>
                <select className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md">
                  <option>{projectDetails.OriginatingRegion}</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-gray-600">Created by:</label>
                <p className="font-medium">{projectDetails.CreatedBy}</p>
              </div>
              <div>
                <label className="text-gray-600">Created Date:</label>
                <p className="font-medium">{projectDetails.CreatedDate}</p>
              </div>
            </div>

            <div className='flex flex-row justify-evenly text-left gap-5 items-center'>
              <div>
                <label className="text-gray-600">Feasibility Study:</label>
                <div className="flex space-x-4 mt-2">
                  <label className="flex items-center">
                    <input type="radio" name="feasibility" checked={projectDetails.FeasibilityStudy} className="mr-2" />
                    Yes
                  </label>
                  <label className="flex items-center">
                    <input type="radio" name="feasibility" checked={!projectDetails.FeasibilityStudy} className="mr-2" />
                    No
                  </label>
                </div>
              </div>

              <div>
                <label className="text-gray-600">Detailed Design:</label>
                <div className="flex space-x-4 mt-2">
                  <label className="flex items-center">
                    <input type="radio" name="design" checked={projectDetails.DetailedDesign} className="mr-2" />
                    Yes
                  </label>
                  <label className="flex items-center">
                    <input type="radio" name="design" checked={!projectDetails.DetailedDesign} className="mr-2" />
                    No
                  </label>
                </div>
              </div>

              <div>
                <label className="text-gray-600">Row Available:</label>
                <div className="flex space-x-4 mt-2">
                  <label className="flex items-center">
                    <input type="radio" name="row" checked={projectDetails.RowAvailable} className="mr-2" />
                    Yes
                  </label>
                  <label className="flex items-center">
                    <input type="radio" name="row" checked={!projectDetails.RowAvailable} className="mr-2" />
                    No
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Component Cost Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Component Cost</h2>
          <Button color="blue">
            <PlusIcon className="w-4 h-4 mr-1" />
            Add Cost
          </Button>
        </div>

        {/* Cost Summary Cards */}
        <div className="grid grid-cols-5 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg text-center">
            <div className="text-sm text-gray-600">Total Cost</div>
            <div className="text-lg font-semibold text-blue-600">{formatCurrency(totalCosts.totalCost)}</div>
          </div>
          <div className="bg-blue-50 p-4 rounded-lg text-center">
            <div className="text-sm text-gray-600">Total Cost (CW1)</div>
            <div className="text-lg font-semibold text-blue-600">{formatCurrency(totalCosts.totalCostCw1)}</div>
          </div>
          <div className="bg-blue-50 p-4 rounded-lg text-center">
            <div className="text-sm text-gray-600">Total Cost (CW2)</div>
            <div className="text-lg font-semibold text-blue-600">{formatCurrency(totalCosts.totalCostCw2)}</div>
          </div>
          <div className="bg-blue-50 p-4 rounded-lg text-center">
            <div className="text-sm text-gray-600">Total Cost (2025)</div>
            <div className="text-lg font-semibold text-blue-600">{formatCurrency(totalCosts.totalCost2025)}</div>
          </div>
          <div className="bg-blue-50 p-4 rounded-lg text-center">
            <div className="text-sm text-gray-600">Total Cost (2026)</div>
            <div className="text-lg font-semibold text-blue-600">{formatCurrency(totalCosts.totalCost2026)}</div>
          </div>
        </div>

        {/* Component Cost Table */}
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>Actions</TableHeader>
              <TableHeader>Component ID</TableHeader>
              <TableHeader>Description</TableHeader>
              <TableHeader>2025</TableHeader>
              <TableHeader>2026</TableHeader>
              <TableHeader>MYCA Approval</TableHeader>
              <TableHeader>UACs PAP Code</TableHeader>
              <TableHeader>Planned Start Date</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {componentCosts.map(cost => (
              <TableRow key={cost.Id}>
                <TableCell>
                  <div className="flex space-x-1">
                    <button className="text-blue-600 hover:text-blue-800">
                      <PencilIcon className="w-4 h-4" />
                    </button>
                    <button className="text-red-600 hover:text-red-800">
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </TableCell>
                <TableCell>{cost.Id}</TableCell>
                <TableCell>{cost.Description}</TableCell>
                <TableCell className="text-right">{formatCurrency(cost.Cost2025)}</TableCell>
                <TableCell className="text-right">{formatCurrency(cost.Cost2026)}</TableCell>
                <TableCell>{cost.MYCAApproval}</TableCell>
                <TableCell>{cost.UACsPAPCode}</TableCell>
                <TableCell>{cost.PlannedStartDate}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Major Item of Work Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Major Item of Work</h2>
          <Button color="blue">
            <PlusIcon className="w-4 h-4 mr-1" />
            Add Item
          </Button>
        </div>

        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>Actions</TableHeader>
              <TableHeader>Component ID</TableHeader>
              <TableHeader>Year of Work</TableHeader>
              <TableHeader>Type of Work</TableHeader>
              <TableHeader>Target Unit</TableHeader>
              <TableHeader>Physical Target</TableHeader>
              <TableHeader>Detailed Scope of Work</TableHeader>
              <TableHeader>Infra ID</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {majorItems.map(item => (
              <TableRow key={item.Id}>
                <TableCell>
                  <div className="flex space-x-1">
                    <button className="text-blue-600 hover:text-blue-800">
                      <PencilIcon className="w-4 h-4" />
                    </button>
                    <button className="text-red-600 hover:text-red-800">
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </TableCell>
                <TableCell>{item.ComponentId}</TableCell>
                <TableCell>{item.YearOfWork}</TableCell>
                <TableCell>{item.TypeOfWork}</TableCell>
                <TableCell>{item.TargetUnit}</TableCell>
                <TableCell>{item.PhysicalTarget}</TableCell>
                <TableCell>{item.DetailedScopeOfWork}</TableCell>
                <TableCell>{item.InfraId}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Notes Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Notes</h2>
            <Button color="blue">
              <PlusIcon className="w-4 h-4 mr-1" />
              Add Notes
            </Button>
          </div>

          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>Actions</TableHeader>
                <TableHeader>Description</TableHeader>
                <TableHeader>Created Date</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {notes.map(note => (
                <TableRow key={note.Id}>
                  <TableCell>
                    <div className="flex space-x-1">
                      <button className="text-blue-600 hover:text-blue-800">
                        <PencilIcon className="w-4 h-4" />
                      </button>
                      <button className="text-red-600 hover:text-red-800">
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </TableCell>
                  <TableCell>{note.Description}</TableCell>
                  <TableCell>{note.CreatedDate}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Funding Profile Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Funding Profile</h2>
            <Button color="blue">
              <PlusIcon className="w-4 h-4 mr-1" />
              Add Funding Profile
            </Button>
          </div>

          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>Actions</TableHeader>
                <TableHeader>Source</TableHeader>
                <TableHeader>Agreement</TableHeader>
                <TableHeader>Percentage</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {fundingProfiles.map(funding => (
                <TableRow key={funding.Id}>
                  <TableCell>
                    <div className="flex space-x-1">
                      <button className="text-blue-600 hover:text-blue-800">
                        <PencilIcon className="w-4 h-4" />
                      </button>
                      <button className="text-red-600 hover:text-red-800">
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </TableCell>
                  <TableCell>{funding.Source}</TableCell>
                  <TableCell>{funding.Agreement}</TableCell>
                  <TableCell>{funding.Percentage}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Activities Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Activities</h2>
        
        <div className="space-y-4">
          {activities.map(activity => (
            <div key={activity.Id} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-sm font-medium text-blue-600">T</span>
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-800">{activity.Description}</p>
                <p className="text-xs text-gray-500 mt-1">{activity.Date}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ProjectDetails;
