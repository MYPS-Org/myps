"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import ProjectForm from '../projectmodification/components/ProjectForm';
import type { ProjectFormPayload } from '../../Project/Model.d';
import { getLabelField, fetchRevisionData } from '../Service';
import { determinePCMAStatus, determinePackageStatus } from '../utils/pcmaStatusHelper';
import { useAPIIntegration } from '../hooks/useFieldPermissions';

const ModifyProject: React.FC = () => {
    const { project } = useParams<{ project: string }>();
    const location = useLocation();
    const id = useMemo(() => project?.split(':'), [project]);
    const [initialData, setInitialData] = useState<ProjectFormPayload | undefined>(undefined);
    const [isLoading, setIsLoading] = useState(true);
    const [fieldLabels, setFieldLabels] = useState<Record<string, any>>({});
    const { setStatusFromAPI, setModificationContext } = useAPIIntegration();

    // Get category and reason from navigation state
    const categoryDesc = location.state?.categoryDesc;
    const reasonDesc = location.state?.reasonDesc || '';
    const selectedReasonId = location.state?.reasonId || 0;
    const selectedCategoryId = location.state?.categoryId || null;
    const selectedRevisionGroupId = location.state?.revisionGroupId || 0;

    console.log('ModificationDetails - Navigation state:', location.state);
    console.log('ModificationDetails - Category:', categoryDesc);
    console.log('ModificationDetails - Reason:', reasonDesc);
    console.log('ModificationDetails - Reason ID:', selectedReasonId);
    console.log('ModificationDetails - Category ID:', selectedCategoryId);
    console.log('ModificationDetails - Revision Group ID:', selectedRevisionGroupId);

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

    
    const fetchProjectDetails = useCallback(async (projectId: string, _stageName: string) => {
        try {
            console.log('Calling fetchRevisionData with:', { 
                ProjectId: projectId, 
                RevisionGroupId: selectedRevisionGroupId,
                CategoryId: selectedCategoryId,
                ReasonId: selectedReasonId 
            });
            const response = await fetchRevisionData(
                projectId,
                selectedRevisionGroupId,
                selectedCategoryId,
                selectedReasonId
            );
            console.log('Revision data response:', response);
            
            const data = response.Data as ProjectFormPayload;
            setInitialData(data);

            // Debug: Check what properties exist in the response
            console.log('=== RESPONSE DATA STRUCTURE ===');
            console.log('All keys in response.Data:', Object.keys(data));
            console.log('ProjectComponentStatus:', data.ProjectComponentStatus);
            console.log('ComponentsStatus (if exists):', (data as any).ComponentsStatus);
            console.log('===============================');

            // Process ComponentsStatus if available - check both possible property names
            const componentsStatus = data.ComponentsStatus || data.ProjectComponentStatus;
            
            if (componentsStatus && componentsStatus.length > 0) {
                console.log('=== PCMA STATUS DETERMINATION ===');
                console.log('Raw Components Status from API:', componentsStatus);
                
                const pcmaStatus = determinePCMAStatus(componentsStatus);
                const packageStatus = determinePackageStatus(componentsStatus);
                
                console.log('Determined PCMA Status:', pcmaStatus);
                console.log('Determined Package Status:', packageStatus);
                console.log('Expected Case: C (Completed + Packaged)');
                
                // Verify the determination
                componentsStatus.forEach((comp: any, idx: number) => {
                    console.log(`Component ${idx}:`, {
                        ConstructionStatusName: comp.ConstructionStatusName,
                        PackedStatusName: comp.PackedStatusName
                    });
                });

                // Set the status to Jotai atoms
                setStatusFromAPI(pcmaStatus, packageStatus);
                console.log('Status set to Jotai atoms');
                console.log('=================================');
            } else {
                console.warn('No ComponentsStatus found in response');
                console.warn('componentsStatus value:', componentsStatus);
                // Set default values
                setStatusFromAPI('Not yet started', 'Not Packaged');
            }

            // Set modification context
            setModificationContext({
                category: categoryDesc || '',
                reason: reasonDesc || '',
                reasonId: selectedReasonId
            });

        } catch (error) {
            console.error('Error fetching revision data:', error);
        } finally {
            setIsLoading(false);
        }
    }, [selectedRevisionGroupId, selectedCategoryId, selectedReasonId, categoryDesc, reasonDesc, setStatusFromAPI, setModificationContext]);

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
            categoryId={selectedCategoryId}
            revisionGroupId={selectedRevisionGroupId}
            fieldLabels={fieldLabels}
        />
    );
};

export default ModifyProject;
