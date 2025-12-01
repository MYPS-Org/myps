"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import ProjectForm from '../projectmodification/components/ProjectForm';
import type { ProjectFormPayload } from '../../Project/Model.d';
import { getProjectDetails } from '../../Project/Service';
import { getLabelField } from '../Service';

const ModifyProject: React.FC = () => {
    const { project } = useParams<{ project: string }>();
    const location = useLocation();
    const id = useMemo(() => project?.split(':'), [project]);
    const [initialData, setInitialData] = useState<ProjectFormPayload | undefined>(undefined);
    const [isLoading, setIsLoading] = useState(true);
    const [fieldLabels, setFieldLabels] = useState<Record<string, any>>({});

    // Get category and reason from navigation state
    const categoryDesc = location.state?.categoryDesc || 'modification';
    const reasonDesc = location.state?.reasonDesc || '';
    const selectedReasonId = location.state?.reasonId || 0;

    console.log('ModificationDetails - Navigation state:', location.state);
    console.log('ModificationDetails - Category:', categoryDesc);
    console.log('ModificationDetails - Reason:', reasonDesc);
    console.log('ModificationDetails - Reason ID:', selectedReasonId);

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

    
    const fetchProjectDetails = useCallback(async (projectId: string, stageName: string) => {
        try {
            console.log('Calling getProjectDetails with:', { ProjectId: projectId, StageName: stageName });
            const response = await getProjectDetails({ ProjectId: projectId, StageName: stageName });
            console.log('Project details response:', response);
            setInitialData(response.Data);
        } catch (error) {
            console.error('Error fetching project details:', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Fetch label fields when project data and modification details are available
    useEffect(() => {
        const fetchLabelField = async () => {
            if (!initialData || !categoryDesc || !reasonDesc) {
                return;
            }

            const payload = {
                categoryDesc,
                reasonId: selectedReasonId,
                projectId: initialData.ProjectDetails.ProjectId
            };
            
            console.log('Fetching label field with payload:', payload);
            
            try {
                const response = await getLabelField(payload);
                console.log('Label field response:', response);
                
                // Parse the stringified JSON from response.Data
                if (response.Data) {
                    try {
                        const parsedFields = typeof response.Data === 'string' 
                            ? JSON.parse(response.Data) 
                            : response.Data;
                        setFieldLabels(parsedFields);
                        console.log('Parsed field labels:', parsedFields);
                    } catch (parseError) {
                        console.error('Error parsing field labels JSON:', parseError);
                        setFieldLabels({});
                    }
                } else {
                    setFieldLabels({});
                }
            } catch (error) {
                console.error('Error fetching label field:', error);
            }
        };

        fetchLabelField();
    }, [initialData, categoryDesc, reasonDesc]);
    
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
            category={categoryDesc}
            reason={reasonDesc}
            reasonId={selectedReasonId}
            fieldLabels={fieldLabels}
        />
    );
};

export default ModifyProject;
