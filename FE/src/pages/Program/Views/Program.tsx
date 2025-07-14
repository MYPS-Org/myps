"use-client";
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import type { Programs } from '../Model'; // Adjust the import path as necessary

import { Table, TableHead, TableBody, TableRow, TableCell, TableHeader } from '../../../components/tailwindui/table'; // Adjust the import path as necessary

import { Button } from '../../../components/tailwindui/button'; // Adjust the import path as necessary
import { 
    PlusIcon, 
    MagnifyingGlassIcon
} from '@heroicons/react/24/outline'; // Adjust the import path as necessary

const Program: React.FC = () => {
const navigate = useNavigate();
const [programs, setPrograms] = useState<Programs[]>([
    {
        Id: 1,
        Name: 'RBP FY 2026 Region IV-A',
        Description: 'Regional Budget Proposal',
        Status: 'Working',
        ProgramStage: 'Regional Budget Proposal',
        ProgramType: 'Regular Infrastructure',
        StartYear: 2026,
        User: 'John Doe - RPC',
        DataSecurity: 'Region I'
    },
    {
        Id: 2,
        Name: 'RBP FY 2029 Region VI',
        Description: 'Regional Budget Proposal',
        Status: 'Working',
        ProgramStage: 'Regional Budget Proposal',
        ProgramType: 'Regular Infrastructure',
        StartYear: 2029,
        User: 'John Doe - RPC',
        DataSecurity: 'Region I'
    },
    {
        Id: 3,
        Name: 'RBP FY 2026 Region V',
        Description: 'Regional Budget Proposal',
        Status: 'Approved',
        ProgramStage: 'Regional Budget Proposal',
        ProgramType: 'Regular Infrastructure',
        StartYear: 2026,
        User: 'John Doe - RPC',
        DataSecurity: 'Region I'
    }
]);
// const [isLoading, setIsLoading] = useState(false);

useEffect(() => {
    fetchPrograms();
}, []);

const fetchPrograms = async () => {
    try {
    const response = await fetch('/api/programs');
    if (!response.ok) {
        throw new Error('Failed to fetch programs');
    }
    const data = await response.json();
    setPrograms(data);
    } catch (error) {
    console.error('Error fetching programs:', error);
    // You might want to show a toast or alert here
    alert('Failed to fetch programs: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
};

// Helper function to render status badge
const getStatusBadge = (status: string) => {
    const statusColors = {
        'Working': 'bg-orange-100 text-orange-800 border-orange-200',
        'Approved': 'bg-green-100 text-green-800 border-green-200',
        'Pending': 'bg-yellow-100 text-yellow-800 border-yellow-200',
        'Rejected': 'bg-red-100 text-red-800 border-red-200'
    };
    
    const colorClass = statusColors[status as keyof typeof statusColors] || 'bg-gray-100 text-gray-800 border-gray-200';
    
    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${colorClass}`}>
            {status}
        </span>
    );
};

const handleViewDetails = (programId: number) => {
    navigate(`/programs/${programId}`);
};

  return (
    
    <div className="max-w-10xl mx-auto p-6 space-y-6">
        {/* Breadcrumb */}
        <nav className="text-sm text-left text-gray-500 mb-4">
            <span>Program Management</span>
            <span className="mx-2">&gt;</span>
            <span>Programs</span>
            <span className="mx-2">&gt;</span>
        </nav>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-medium text-gray-900">Programs</h3>
                        <div className="flex items-center space-x-3">
                            <div className="flex items-center space-x-2">
                                {/* <Button 
                                    color={groupByCreatedDate ? "blue" : "zinc"}
                                    onClick={() => setGroupByCreatedDate(!groupByCreatedDate)}
                                    className="text-xs px-3 py-1.5"
                                >
                                    {groupByCreatedDate ? "Group by Created Date" : "Group by Start Year"}
                                </Button>
                                <Button 
                                    color="zinc"
                                    onClick={expandAllYears}
                                    className="text-xs px-3 py-1.5"
                                >
                                    Expand All
                                </Button>
                                <Button 
                                    color="zinc"
                                    onClick={collapseAllYears}
                                    className="text-xs px-3 py-1.5"
                                >
                                    Collapse All
                                </Button> */}
                            </div>
                            <div className="relative">
                                <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Search Programs..."
                                    className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>
                            <Button color="blue">
                                <PlusIcon className="w-4 h-4 mr-1" />
                                Add Program
                            </Button>
                        </div>
                    </div>
                </div>
            <Table className="px-5">
                <TableHead>
                <TableRow>
                    <TableHeader>Name</TableHeader>
                    <TableHeader>Status</TableHeader>
                    <TableHeader>Program Stage</TableHeader>
                    <TableHeader>Program Type</TableHeader>
                    <TableHeader>Start Year</TableHeader>
                    <TableHeader>User</TableHeader>
                    <TableHeader>Data Security</TableHeader>
                    <TableHeader>Actions</TableHeader>
                </TableRow>
                </TableHead>
                <TableBody>
                {programs.map(program => (
                    <TableRow key={program.Id}>
                    <TableCell>
                        <button 
                            onClick={() => handleViewDetails(program.Id)}
                            className="text-blue-600 hover:text-blue-800 font-medium hover:underline"
                        >
                            {program.Name}
                        </button>
                    </TableCell>
                    <TableCell>{getStatusBadge(program.Status)}</TableCell>
                    <TableCell>{program.ProgramStage}</TableCell>
                    <TableCell>{program.ProgramType}</TableCell>
                    <TableCell>{program.StartYear}</TableCell>
                    <TableCell>{program.User}</TableCell>
                    <TableCell>{program.DataSecurity}</TableCell>
                    <TableCell>
                        <div className="flex items-center space-x-1">
                            <Button 
                                color="orange"
                                onClick={() => handleViewDetails(program.Id)}
                                className="text-xs px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded"
                            >
                                Validate
                            </Button>
                        </div>
                    </TableCell>
                    </TableRow>
                ))}
                </TableBody>
            </Table>
            </div>
        </div>
    </div>
  );
}

export default Program;