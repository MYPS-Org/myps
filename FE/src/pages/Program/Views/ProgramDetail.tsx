"use-client";
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

import type { Programs } from '../Model'; // Adjust the import path as necessary
import { Button } from '../../../components/tailwindui/button';

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
        id: programId,
        name: `Program ${programId}`,
        description: `This is a detailed description for Program ${programId}. This would typically come from your API.`
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    navigate('/programs');
  };

  const handleEdit = () => {
    if (program) {
      // Navigate to edit form or open modal
      console.log('Edit program:', program.id);
      // You could navigate to an edit route: navigate(`/programs/${program.id}/edit`);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
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
      <div className="max-w-4xl mx-auto p-6">
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
      <div className="max-w-4xl mx-auto p-6">
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
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {program.name}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Program ID: {program.id}
              </p>
            </div>
            <div className="flex space-x-3">
              <Button onClick={handleBack} color="zinc">
                Back to Programs
              </Button>
              <Button onClick={handleEdit} color="blue">
                Edit Program
              </Button>
            </div>
          </div>
        </div>
        
        <div className="px-6 py-6">
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
                Description
              </h3>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                {program.description}
              </p>
            </div>
            
            {/* Add more program details here as needed */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="text-md font-medium text-gray-900 dark:text-white mb-2">
                  Program Information
                </h4>
                <dl className="space-y-2">
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">ID</dt>
                    <dd className="text-sm text-gray-900 dark:text-white">{program.id}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Name</dt>
                    <dd className="text-sm text-gray-900 dark:text-white">{program.name}</dd>
                  </div>
                </dl>
              </div>
              
              <div>
                <h4 className="text-md font-medium text-gray-900 dark:text-white mb-2">
                  Additional Details
                </h4>
                <dl className="space-y-2">
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</dt>
                    <dd className="text-sm text-gray-900 dark:text-white">Active</dd>
                  </div>
                  {/* Add more fields as needed */}
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProgramDetail;