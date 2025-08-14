"use client";

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import ProjectForm from '../components/ProjectForm';
import type { ProjectFormPayload } from '../Model.d';
import { getProjectDetails } from '../Service';

const EditProject: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [initialData, setInitialData] = useState<ProjectFormPayload | undefined>(undefined);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Load project data based on ID
        const loadProjectData = async () => {
            await getProjectDetails({ ProjectId: id || '' })
                .then(response => {
                    console.log('Project details loaded:', response);
                    setInitialData(response.Data);
                })
                .catch(error => {
                    console.error('Error loading project details:', error);
                    // Handle error appropriately, e.g., show a toast or alert
                })
                .finally(() => {
                    setIsLoading(false);
                });
        };

        loadProjectData();
    }, [id]);

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="text-lg text-gray-600">Loading project data...</div>
            </div>
        );
    }

    return (
        <ProjectForm
            initialData={initialData}
            mode="edit"
        />
    );
};

export default EditProject;
