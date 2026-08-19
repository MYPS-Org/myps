"use-client";

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchReviseProjectDetails } from '../Service';
import type { RevisionProjectPayload } from '../Model';
import { useToast } from '../../../components/toaster/ToasterContext';
import { Button } from '../../../components/tailwindui/button';
import { ArrowLeftIcon } from '@heroicons/react/20/solid';
import ProjectForm from '../projectmodification/components/ProjectForm';
import { useAPIIntegration } from '../hooks/useFieldPermissions';
import type { FieldRules, ApiMessageResult } from '../Model';
import { useSetAtom } from 'jotai';
import { transactionIdAtom } from '../store/routeContextStore';

const ViewRevision: React.FC = () => {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const { transactionId } = useParams<{ transactionId: string }>();
    const [isLoading, setIsLoading] = useState(false);
    const [revisionData, setRevisionData] = useState<RevisionProjectPayload | null>(null);
    const [fetchError, setFetchError] = useState<ApiMessageResult | null>(null);
    const { setStatusFromAPI, setModificationContext, setFieldRules } = useAPIIntegration();
    const setTransactionIdAtom = useSetAtom(transactionIdAtom);

    useEffect(() => {
        if (!transactionId) {
            showToast({
                type: 'error',
                message: 'No transaction ID provided'
            });
            navigate('/revision');
            return;
        }
        
        // Set the transactionId in the atom so dialogs can access it
        setTransactionIdAtom(transactionId);
        console.log('Set transactionId atom to:', transactionId);
        
        const fetchDetails = async () => {
            setIsLoading(true);
            setFetchError(null);
            try {
                setIsLoading(true);
                const response = await fetchReviseProjectDetails(transactionId);
                console.log('Revision Details:', response.Data);
                
                // Set modification context from the fetched data
                const category = response.Data.Category.Id !== 0
                    ? response.Data.Category.CategoryName
                    : response.Data.Header.RevisionName;

                setModificationContext({
                    category,
                    reason: response.Data.Reason.Reason,
                    reasonId: response.Data.Reason.ReasonId
                });
                
                // Set status from API if available
                if (response.Data.ProjectStatus) {
                    setStatusFromAPI(
                        response.Data.ProjectStatus.ConstructionStatus,
                        response.Data.ProjectStatus.PackageStatus
                    );
                }
                
                // Set field rules if available
                if (response.Data.Rules?.Field) {
                    try {
                        console.log('=== FIELD RULES FROM API ===');
                        console.log('Raw Field string:', response.Data.Rules.Field);
                        
                        // Try to parse
                        let parsedRules: FieldRules;
                        try {
                            parsedRules = JSON.parse(response.Data.Rules.Field) as FieldRules;
                        } catch (firstParseError) {
                            console.warn('⚠️ First parse attempt failed, trying to repair JSON...');
                            
                            // Common issue: Missing closing braces
                            let repairedJson = response.Data.Rules.Field.trim();
                            
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
                        console.log('✓ Field rules set to Jotai atoms');
                        console.log('===========================');
                    } catch (error) {
                        console.error('❌ Error parsing field rules (even after repair):', error);
                    }
                }
                
                setRevisionData(response.Data);
            } catch (error) {
                console.error('Error fetching revision details:', error);
                // httpClient's interceptor already toasts the backend message; surface the same
                // Title/Message in the fallback panel below instead of a generic "not found".
                setFetchError(error as ApiMessageResult);
            } finally {
                setIsLoading(false);
            }
        }; fetchDetails();
    }, [transactionId]);

    const handleBack = () => {
        navigate('/revision');
    };

    const handleActionSuccess = () => {
        // Navigate back to list after successful approve/reject/for review
        navigate('/revision');
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="text-lg text-gray-600">Loading revision details...</div>
            </div>
        );
    }

    if (!revisionData) {
        return (
            <div className="max-w-10xl mx-auto p-6">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
                    <div className="flex items-center space-x-4 mb-4">
                        <Button 
                            color="zinc" 
                            onClick={handleBack}
                            className="text-xs px-3 py-1.5"
                        >
                            <ArrowLeftIcon className="w-4 h-4 mr-1" />
                            Back to List
                        </Button>
                    </div>
                    {fetchError?.Message ? (
                        <div className="text-center text-red-700 space-y-1">
                            {fetchError.Title && <p className="font-semibold">{fetchError.Title}</p>}
                            <p className="text-sm">{fetchError.Message}</p>
                        </div>
                    ) : (
                        <div className="text-center text-gray-500">No revision data found</div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-10xl mx-auto p-6 space-y-6">
            {/* <div className="flex items-center space-x-4">
                <Button 
                    color="zinc" 
                    onClick={handleBack}
                    className="text-xs px-3 py-1.5"
                >
                    <ArrowLeftIcon className="w-4 h-4 mr-1" />
                    Back to List
                </Button>
                <h2 className="text-xl font-semibold text-gray-900">
                    Revision Details - {transactionId}
                </h2>
            </div> */}
            
            <ProjectForm
                initialData={revisionData}
                mode="edit"
                category={revisionData.Category.CategoryName}
                reason={revisionData.Reason.Reason}
                reasonId={revisionData.Reason.ReasonId}
                categoryId={revisionData.Category.CategoryId}
                revisionGroupId={revisionData.Rules?.RevisionGroupId}
                onActionSuccess={handleActionSuccess}
            />
        </div>
    );
};

export default ViewRevision;