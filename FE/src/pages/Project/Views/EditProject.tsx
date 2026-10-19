"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import ProjectForm from '../components/ProjectForm';
import type { ProjectFormPayload } from '../Model.d';
import { getProjectDetails } from '../Service';
import { useToast } from '../../../components/toaster/ToasterContext';

const EditProject: React.FC = () => {
    const { project } = useParams<{ project: string }>();
    const id = useMemo(() => project?.split(':'), [project]);
    const [initialData, setInitialData] = useState<ProjectFormPayload | undefined>(undefined);
    const [isLoading, setIsLoading] = useState(true);
    const [refreshKey, setRefreshKey] = useState(0);
    // Set when the details could not be loaded -- including the API's deliberate "Project Not
    // Found" for a project outside the user's DEO/region -- so the page explains itself
    // instead of rendering nothing.
    const [loadFailed, setLoadFailed] = useState(false);
    const { showToast } = useToast();

    const handleRefresh = () => setRefreshKey(prev => prev + 1);

    useEffect(() => {
        setIsLoading(true); // Reset so ProjectForm fully unmounts and remounts with fresh state
        setInitialData(undefined);
        setLoadFailed(false);
        // Load project data based on ID
        const loadProjectData = async () => {
            try {
                if (id && id.length == 2) {
                    console.log('Loading project details for:', id[0], id[1]); // Debug log
                    await fetchProjectDetails(id[0], id[1]);
                } else {
                    console.error('Invalid project ID format. Expected format: "ProjectId:StageName"', id);
                    setLoadFailed(true);
                    setIsLoading(false);
                }
            } catch (error) {
                console.error('Unexpected error loading project details:', error);
                setLoadFailed(true);
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
            setLoadFailed(true);
            // The interceptor toasted (and set Message) for any API error that carried one.
            if (!(error as { Message?: string } | undefined)?.Message) {
                showToast({ type: 'error', message: 'Failed to load the project. Please try again.' });
            }
        } finally {
            setIsLoading(false);
        }
    };

    if (loadFailed) {
        return (
            <div className="p-6 space-y-4">
                <h1 className="text-2xl font-bold text-gray-800">Project Not Available</h1>
                <p className="text-gray-600">
                    Project{id?.[0] ? ` "${id[0]}"` : ''} was not found, or you do not have access to it.
                </p>
                <Link to="/projects" className="text-blue-600 hover:underline text-sm">
                    Back to Projects
                </Link>
            </div>
        );
    }

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
