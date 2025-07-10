"use-client";
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import type { Programs } from '../Model'; // Adjust the import path as necessary

import { Table, TableHead, TableBody, TableRow, TableCell, TableHeader } from '../../../components/tailwindui/table'; // Adjust the import path as necessary

import { Button } from '../../../components/tailwindui/button'; // Adjust the import path as necessary
import { 
    PlusIcon, 
    MagnifyingGlassIcon,
    FolderIcon,
    FolderOpenIcon,
    ChevronRightIcon,
    ChevronDownIcon
} from '@heroicons/react/24/outline'; // Adjust the import path as necessary
import { getPrograms } from '../Service';

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
        DataSecurity: 'Region I',
        dateCreated: '2026-01-15'
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
        DataSecurity: 'Region I',
        dateCreated: '2029-02-20'
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
        DataSecurity: 'Region I',
        dateCreated: '2026-03-10'
    },
    {
        Id: 4,
        Name: 'Infrastructure Program 2025',
        Description: 'Infrastructure Development',
        Status: 'Working',
        ProgramStage: 'Planning',
        ProgramType: 'Infrastructure',
        StartYear: 2025,
        User: 'Jane Smith - RPC',
        DataSecurity: 'Region II',
        dateCreated: '2025-04-05'
    },
    {
        Id: 5,
        Name: 'Education Program 2025',
        Description: 'Education Enhancement',
        Status: 'Approved',
        ProgramStage: 'Implementation',
        ProgramType: 'Education',
        StartYear: 2025,
        User: 'Bob Johnson - RPC',
        DataSecurity: 'Region III',
        dateCreated: '2025-05-12'
    },
    {
        Id: 6,
        Name: 'Healthcare Initiative 2024',
        Description: 'Healthcare Improvement',
        Status: 'Pending',
        ProgramStage: 'Review',
        ProgramType: 'Healthcare',
        StartYear: 2024,
        User: 'Alice Brown - RPC',
        DataSecurity: 'Region IV',
        dateCreated: '2024-06-18'
    }
]);
const [expandedYears, setExpandedYears] = useState<Set<number>>(new Set());
const [groupByCreatedDate, setGroupByCreatedDate] = useState<boolean>(false);
// const [isLoading, setIsLoading] = useState(false);

useEffect(() => {
    fetchPrograms();
}, []);

const fetchPrograms = async () => {
    try {
    const response = await getPrograms();
    if (!response.Data) {
        throw new Error('Failed to fetch programs');
    }
    setPrograms(response.Data.lists);
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

// Group programs by year
const groupProgramsByYear = (programs: Programs[]) => {
    const grouped = programs.reduce((acc, program) => {
        let year: number;
        if (groupByCreatedDate && program.dateCreated) {
            year = new Date(program.dateCreated).getFullYear();
        } else {
            year = program.StartYear;
        }
        
        if (!acc[year]) {
            acc[year] = [];
        }
        acc[year].push(program);
        return acc;
    }, {} as Record<number, Programs[]>);

    // Sort years in descending order (newest first)
    const sortedYears = Object.keys(grouped)
        .map(year => parseInt(year))
        .sort((a, b) => b - a);

    return sortedYears.map(year => ({
        year,
        programs: grouped[year]
    }));
};

const toggleYearExpansion = (year: number) => {
    setExpandedYears(prev => {
        const newSet = new Set(prev);
        if (newSet.has(year)) {
            newSet.delete(year);
        } else {
            newSet.add(year);
        }
        return newSet;
    });
};

const expandAllYears = () => {
    const allYears = new Set(groupedPrograms.map(group => group.year));
    setExpandedYears(allYears);
};

const collapseAllYears = () => {
    setExpandedYears(new Set());
};

const groupedPrograms = groupProgramsByYear(programs);

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
                                <Button 
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
                                </Button>
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
            <Table className="px-5" dense>
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
                {groupedPrograms.map(({ year, programs: yearPrograms }) => (
                    <React.Fragment key={year}>
                        {/* Year Folder Row */}
                        <TableRow className="bg-gradient-to-r from-gray-50 to-gray-100 hover:from-gray-100 hover:to-gray-200 cursor-pointer border-b-2 border-gray-300">
                            <TableCell colSpan={8}>
                                <div 
                                    className="flex items-center space-x-2 font-semibold text-gray-800 py-2"
                                    onClick={() => toggleYearExpansion(year)}
                                >
                                    {expandedYears.has(year) ? (
                                        <ChevronDownIcon className="w-5 h-5 text-blue-600" />
                                    ) : (
                                        <ChevronRightIcon className="w-5 h-5 text-blue-600" />
                                    )}
                                    {expandedYears.has(year) ? (
                                        <FolderOpenIcon className="w-6 h-6 text-blue-600" />
                                    ) : (
                                        <FolderIcon className="w-6 h-6 text-blue-600" />
                                    )}
                                    <span>{year} ({yearPrograms.length} programs) {groupByCreatedDate ? '- Created' : '- Start Year'}</span>
                                </div>
                            </TableCell>
                        </TableRow>
                        
                        {/* Programs in this year - only show if expanded */}
                        {expandedYears.has(year) && yearPrograms.map(program => (
                            <TableRow key={program.Id} className="border-l-4 border-l-blue-300 bg-blue-50/30 hover:bg-blue-50/50">
                                <TableCell className="pl-12">
                                    <div className="flex items-center space-x-2">
                                        <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                                        <button 
                                            onClick={() => handleViewDetails(program.Id)}
                                            className="text-blue-600 hover:text-blue-800 font-medium hover:underline"
                                        >
                                            {program.Name}
                                        </button>
                                    </div>
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
                                            className="!text-[10px] px-3 !py-0.5 bg-orange-500 hover:bg-orange-600 text-white rounded"
                                        >
                                            Validate
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </React.Fragment>
                ))}
                </TableBody>
            </Table>
            </div>
        </div>
    </div>
  );
}

export default Program;