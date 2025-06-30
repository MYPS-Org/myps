"use-client";
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import type { Programs } from '../Model'; // Adjust the import path as necessary

import { Table, TableHead, TableBody, TableRow, TableCell, TableHeader } from '../../../components/tailwindui/table'; // Adjust the import path as necessary

import { Button } from '../../../components/tailwindui/button'; // Adjust the import path as necessary
import { PlusIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'; // Adjust the import path as necessary

const Program: React.FC = () => {
const navigate = useNavigate();
const [programs, setPrograms] = useState<Programs[]>([
    // Example initial state, replace with actual data or leave empty
    { id: 1, name: 'Program A', description: 'Description A' },
    { id: 2, name: 'Program B', description: 'Description B' }
]);
const [isLoading, setIsLoading] = useState(false);

useEffect(() => {
    fetchPrograms();
}, []);

const fetchPrograms = async () => {
    setIsLoading(true);
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
    } finally {
    setIsLoading(false);
    }
};

const handleViewDetails = (programId: number) => {
    navigate(`/programs/${programId}`);
};

const handleEditProgram = (programId: number) => {
    // Navigate to edit form or open modal
    console.log('Edit program:', programId);
};

const handleDeleteProgram = (programId: number) => {
    // Handle delete logic
    if (window.confirm('Are you sure you want to delete this program?')) {
        console.log('Delete program:', programId);
        // You can add actual delete API call here
    }
};

  return (
    <div className="max-w-10xl mx-auto p-6 space-y-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white">Users</h3>
                        <div className="flex items-center space-x-3">
                            <div className="relative">
                                <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Search Programs..."
                                    className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>
                            <Button color="blue">
                                <PlusIcon className="w-4 h-4 mr-1" />
                                Add Program
                            </Button>
                        </div>
                    </div>
                </div>
            <Table>
                <TableHead>
                <TableRow>
                    <TableHeader>Name</TableHeader>
                    <TableHeader>Description</TableHeader>
                    <TableHeader>Actions</TableHeader>
                </TableRow>
                </TableHead>
                <TableBody>
                {programs.map(program => (
                    <TableRow key={program.id}>
                    <TableCell>{program.name}</TableCell>
                    <TableCell>{program.description}</TableCell>
                    <TableCell>
                        <div className="flex space-x-2">
                            <Button 
                                color="blue" 
                                onClick={() => handleViewDetails(program.id)}
                                className="text-xs px-2 py-1"
                            >
                                View Details
                            </Button>
                            <Button 
                                color="zinc" 
                                onClick={() => handleEditProgram(program.id)}
                                className="text-xs px-2 py-1"
                            >
                                Edit
                            </Button>
                            <Button 
                                color="red" 
                                onClick={() => handleDeleteProgram(program.id)}
                                className="text-xs px-2 py-1"
                            >
                                Delete
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