"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import ProjectForm from '../components/ProjectForm';
import type { ProjectFormPayload } from '../../Project/Model.d';
import { getProjectDetails } from '../../Project/Service';

const LumpSumDetails: React.FC = () => {
    const { project } = useParams<{ project: string }>();
    const id = useMemo(() => project?.split(':'), [project]);
    const [initialData, setInitialData] = useState<ProjectFormPayload | undefined>(undefined);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Load project data based on ID
        const loadProjectData = async () => {
            try {
                if (id && id.length == 2) {
                    console.log('Loading project details for:', id[0], id[1]); // Debug log
                    await fetchProjectDetails(id[0], id[1]);
                } else {
                    console.error('Invalid project ID format. Expected format: "ProjectId:StageName"', id);
                    setIsLoading(false);
                }
            } catch (error) {
                console.error('Unexpected error loading project details:', error);
                setIsLoading(false);
            }
        };

        loadProjectData();
    }, [id]);

    const fetchProjectDetails = async (projectId: string, stageName: string) => {
        try {
            console.log('Calling getProjectDetails with:', { ProjectId: projectId, StageName: stageName }); // Debug log
            const response = await getProjectDetails({ ProjectId: projectId, StageName: stageName });
            console.log('Project details response:', response); // Debug log
            setInitialData(response.Data);
        } catch (error) {
            console.error('Error fetching project details:', error);
        } finally {
            setIsLoading(false);
        }
    };

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

export default LumpSumDetails;
