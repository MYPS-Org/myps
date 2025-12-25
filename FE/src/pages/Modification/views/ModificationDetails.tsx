"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useParams, useLocation } from 'react-router-dom';
import ProjectForm from '../projectmodification/components/ProjectForm';
import { fetchRevisionData } from '../Service';
import { useAPIIntegration } from '../hooks/useFieldPermissions';
import type { RevisionProjectPayload, FieldRules } from '../Model';

const ModifyProject: React.FC = () => {
    const { project } = useParams<{ project: string }>();
    const location = useLocation();
    const id = useMemo(() => project?.split(':'), [project]);
    const [initialData, setInitialData] = useState<RevisionProjectPayload | undefined>(undefined);
    const [isLoading, setIsLoading] = useState(true);
    const { setStatusFromAPI, setModificationContext, setFieldRules } = useAPIIntegration();
    const navigate = useNavigate();

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

    // Set modification context once on mount from navigation state
    useEffect(() => {
        setModificationContext({
            category: categoryDesc || '',
            reason: reasonDesc || '',
            reasonId: selectedReasonId
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Empty deps - set once on mount only from initial navigation state

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
            
            const data = response.Data as RevisionProjectPayload;
            setInitialData(data);

            // Debug: Check what properties exist in the response
            console.log('=== RESPONSE DATA STRUCTURE ===');
            console.log('All keys in response.Data:', Object.keys(data));
            console.log('ProjectComponentStatus:', data.ComponentsStatus);
            console.log('ComponentsStatus (if exists):', (data as any).ComponentsStatus);
            console.log('===============================');

            // Get ProjectStatus directly from API response
            if (data.ProjectStatus) {
                console.log('=== PROJECT STATUS FROM API ===');
                console.log('ProjectStatus:', data.ProjectStatus);
                console.log('Construction Status:', data.ProjectStatus.ConstructionStatus);
                console.log('Package Status:', data.ProjectStatus.PackageStatus);
                
                // Set the status to Jotai atoms directly from API
                setStatusFromAPI(
                    data.ProjectStatus.ConstructionStatus,
                    data.ProjectStatus.PackageStatus
                );
                console.log('Status set to Jotai atoms from API ProjectStatus');
                console.log('===============================');
            } else {
                console.warn('No ProjectStatus found in response');
            }

            // Parse and set field rules from API
            if (data.Rules && data.Rules.Field) {
                try {
                    console.log('=== FIELD RULES FROM API ===');
                    console.log('Raw Field string:', data.Rules.Field);
                    console.log('Field string type:', typeof data.Rules.Field);
                    console.log('Field string length:', data.Rules.Field.length);
                    
                    // Try to parse
                    let parsedRules: FieldRules;
                    try {
                        parsedRules = JSON.parse(data.Rules.Field) as FieldRules;
                    } catch (firstParseError) {
                        console.warn('⚠️ First parse attempt failed, trying to repair JSON...');
                        
                        // Common issue: Missing closing braces
                        let repairedJson = data.Rules.Field.trim();
                        
                        // Count opening and closing braces
                        const openBraces = (repairedJson.match(/{/g) || []).length;
                        const closeBraces = (repairedJson.match(/}/g) || []).length;
                        
                        console.log('Open braces:', openBraces, 'Close braces:', closeBraces);
                        
                        // Add missing closing braces
                        if (openBraces > closeBraces) {
                            const missingBraces = openBraces - closeBraces;
                            console.log(`Adding ${missingBraces} missing closing brace(s)`);
                            repairedJson += '}'.repeat(missingBraces);
                        }
                        
                        // Try parsing the repaired JSON
                        console.log('Attempting to parse repaired JSON...');
                        parsedRules = JSON.parse(repairedJson) as FieldRules;
                        console.log('✓ Successfully parsed repaired JSON');
                    }
                    
                    console.log('✓ Successfully parsed Field Rules');
                    console.log('Parsed Field Rules:', parsedRules);
                    console.log('Parsed keys:', Object.keys(parsedRules));
                    
                    setFieldRules(parsedRules);
                    console.log('✓ Field rules set to Jotai atoms');
                    console.log('===========================');
                } catch (parseError) {
                    console.error('❌ ERROR PARSING FIELD RULES JSON (even after repair attempt)');
                    console.error('Parse Error:', parseError);
                    console.error('Error message:', (parseError as Error).message);
                    console.error('Raw string that failed to parse:', data.Rules.Field);
                    
                    // Try to identify the issue
                    if (data.Rules.Field) {
                        const firstChar = data.Rules.Field.charAt(0);
                        const lastChar = data.Rules.Field.charAt(data.Rules.Field.length - 1);
                        console.error('First character:', firstChar, 'Code:', firstChar.charCodeAt(0));
                        console.error('Last character:', lastChar, 'Code:', lastChar.charCodeAt(0));
                        
                        // Show a snippet around the error position if available
                        const errorMatch = (parseError as Error).message.match(/position (\d+)/);
                        if (errorMatch) {
                            const pos = parseInt(errorMatch[1]);
                            const start = Math.max(0, pos - 50);
                            const end = Math.min(data.Rules.Field.length, pos + 50);
                            console.error('Context around error position:', data.Rules.Field.substring(start, end));
                        }
                    }
                }
            } else {
                console.warn('No Rules.Field found in response');
                console.warn('data.Rules:', data.Rules);
            }

        } catch (error) {
            setTimeout(() => {
                navigate('/revision');
            }, 3000);
        } finally {
            setIsLoading(false);
        }
    }, [selectedRevisionGroupId, selectedCategoryId, selectedReasonId, setStatusFromAPI, setFieldRules]);
    
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
        />
    );
};

export default ModifyProject;
