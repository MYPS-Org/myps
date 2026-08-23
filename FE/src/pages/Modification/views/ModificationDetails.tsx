"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useParams, useLocation } from 'react-router-dom';
import ProjectForm from '../projectmodification/components/ProjectForm';
import { fetchRevisionData } from '../Service';
import { useAPIIntegration } from '../hooks/useFieldPermissions';
import type { RevisionProjectPayload, FieldRules, ApiMessageResult } from '../Model';

// Backend errors that must block the Revision flow with their exact message rather than a
// generic redirect (see revision-frontend-integration-handoff.md section 19). These cover the
// published-project gate, blocked revision groups (9/13), LS/wallet rejection, and duplicate
// in-flight requests — all enforced server-side and surfaced through this one error path.
const BLOCKING_ERROR_TITLES = new Set([
    'Project Not Published',
    'Revision Type Temporarily Blocked',
    'Revision Reason Requires Confirmation',
    'Pending Modification Request',
]);

const ModificationDetails: React.FC = () => {
    const { project } = useParams<{ project: string }>();
    const location = useLocation();
    const id = useMemo(() => project?.split(':'), [project]);
    const [initialData, setInitialData] = useState<RevisionProjectPayload | undefined>(undefined);
    const [isLoading, setIsLoading] = useState(true);
    const [blockingError, setBlockingError] = useState<ApiMessageResult | null>(null);
    const { setStatusFromAPI, setModificationContext, setFieldRules } = useAPIIntegration();
    const navigate = useNavigate();
    const errorRedirectRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    // Get category and reason from navigation state
    const categoryDesc = location.state?.categoryDesc;
    const reasonDesc = location.state?.reasonDesc || '';
    const selectedReasonId = location.state?.reasonId || 0;
    const selectedCategoryId = location.state?.categoryId || null;
    const selectedRevisionGroupId = location.state?.revisionGroupId || 0;

    // Cleanup error redirect timeout on unmount
    useEffect(() => {
        return () => {
            if (errorRedirectRef.current) {
                clearTimeout(errorRedirectRef.current);
            }
        };
    }, []);

    // Set modification context when navigation state changes
    useEffect(() => {
        setModificationContext({
            category: categoryDesc || '',
            reason: reasonDesc || '',
            reasonId: selectedReasonId
        });
    }, [categoryDesc, reasonDesc, selectedReasonId, setModificationContext]);

    useEffect(() => {
        // Load project data based on ID
        const loadProjectData = async () => {
            setIsLoading(true);
            try {
                if (id && id.length == 2) {
                    // console.log('Loading project details for:', id[0], id[1]); // Debug log
                    await fetchProjectDetails(id[0], id[1]);
                } else {
                    // console.error('Invalid project ID format. Expected format: "ProjectId:StageName"', id);
                    setIsLoading(false);
                }
            } catch (error) {
                // console.error('Unexpected error loading project details:', error);
                setIsLoading(false);
            }
        };

        loadProjectData();
    }, [id, selectedRevisionGroupId, selectedCategoryId, selectedReasonId]);

    
    const fetchProjectDetails = useCallback(async (projectId: string, stageName: string) => {
        setBlockingError(null);
        try {
            const response = await fetchRevisionData(
                projectId,
                selectedRevisionGroupId,
                selectedCategoryId,
                selectedReasonId
            );
            
            const data = response.Data as RevisionProjectPayload;
            setInitialData(data);

            // Get ProjectStatus directly from API response
            if (data.ProjectStatus) {
                
                // Set the status to Jotai atoms directly from API
                setStatusFromAPI(
                    data.ProjectStatus.ConstructionStatus,
                    data.ProjectStatus.PackageStatus
                );
            } else {
                console.warn('No ProjectStatus found in response');
            }

            // Parse and set field rules from API
            if (data.Rules && data.Rules.Field) {
                try {
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

                    setFieldRules(parsedRules);
                    // console.log('✓ Field rules set to Jotai atoms');
                    // console.log('===========================');
                } catch (parseError) {
                    console.error('ERROR PARSING FIELD RULES JSON (even after repair attempt)');
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
            console.error('Error fetching project details:', error);
            const apiError = error as ApiMessageResult;

            if (apiError?.Title && BLOCKING_ERROR_TITLES.has(apiError.Title)) {
                // Show the backend's exact message as a blocking notice instead of a generic
                // redirect — this covers the publish gate, blocked revision groups 9/13, and
                // LS/wallet rejection, all enforced server-side.
                setBlockingError(apiError);
                return;
            }

            // Genuinely unrecoverable errors (e.g. Invalid Project) — redirect back.
            errorRedirectRef.current = setTimeout(() => {
                navigate(`/projects/project-details/${projectId}:${stageName}`);
            }, 2000);
        } finally {
            setIsLoading(false);
        }
    }, [selectedRevisionGroupId, selectedCategoryId, selectedReasonId, setStatusFromAPI, setFieldRules, navigate]);

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="text-lg text-gray-600">Loading project data...</div>
            </div>
        );
    }

    if (blockingError) {
        return (
            <div className="max-w-3xl mx-auto p-6">
                <div className="bg-red-50 border border-red-200 rounded-lg p-6 space-y-2">
                    <h3 className="text-lg font-semibold text-red-800">{blockingError.Title}</h3>
                    <p className="text-sm text-red-700">{blockingError.Message}</p>
                    <button
                        type="button"
                        onClick={() => navigate(id && id.length === 2 ? `/projects/project-details/${id[0]}:${id[1]}` : '/revision')}
                        className="mt-2 text-sm font-medium text-red-800 underline"
                    >
                        Back to Project Details
                    </button>
                </div>
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

export default ModificationDetails;
