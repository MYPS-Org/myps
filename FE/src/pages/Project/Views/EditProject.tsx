"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import ProjectForm from '../components/ProjectForm';
import type { ProjectFormPayload } from '../Model.d';
import { getProjectDetails } from '../Service';

const EditProject: React.FC = () => {
    const { project } = useParams<{ project: string }>();
    const id = useMemo(() => project?.split(':'), [project]);
    const [initialData, setInitialData] = useState<ProjectFormPayload | undefined>(undefined);
    const [isLoading, setIsLoading] = useState(true);
    const [refreshKey, setRefreshKey] = useState(0);

    const handleRefresh = () => setRefreshKey(prev => prev + 1);

    useEffect(() => {
        setIsLoading(true); // Reset so ProjectForm fully unmounts and remounts with fresh state
        setInitialData(undefined);
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
    }, [id, refreshKey]);

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

    if (isLoading || !initialData) {
        return null;
    }

    return (
        <ProjectForm
            initialData={initialData}
            mode="edit"
            onRefresh={handleRefresh}
        />
    );
};

export default EditProject;
