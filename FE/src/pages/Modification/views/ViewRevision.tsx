"use-client";

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchReviseProjectDetails } from '../Service';
import type { RevisionProjectPayload } from '../Model.d';
import { useToast } from '../../../components/toaster/ToasterContext';
import { Button } from '../../../components/tailwindui/button';
import { ArrowLeftIcon } from '@heroicons/react/20/solid';
import ProjectForm from '../projectmodification/components/ProjectForm';
import { useAPIIntegration } from '../hooks/useFieldPermissions';
import type { FieldRules } from '../Model';
import { useTransactionId } from '../hooks/useTransactionId';

const ViewRevision: React.FC = () => {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [revisionData, setRevisionData] = useState<RevisionProjectPayload | null>(null);
    const { setStatusFromAPI, setModificationContext, setFieldRules } = useAPIIntegration();

    const transactionId = useTransactionId();

    useEffect(() => {
        if (!transactionId) {
            showToast({
                type: 'error',
                message: 'No transaction ID provided'
            });
            navigate('/modification/list');
            return;
        }
        
        const fetchDetails = async () => {
            setIsLoading(true);
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
                        const parsedRules = JSON.parse(response.Data.Rules.Field) as FieldRules;
                        // setFieldRules(parsedRules);
                    } catch (error) {
                        console.error('Error parsing field rules:', error);
                    }
                }
                
                setRevisionData(response.Data);
            } catch (error) {
                console.error('Error fetching revision details:', error);
                showToast({
                    type: 'error',
                    message: 'Failed to fetch revision details'
                });
            } finally {
                setIsLoading(false);
            }
        }; fetchDetails();
    }, [transactionId]);

    const handleBack = () => {
        navigate('/modification/list');
    };

    const handleActionSuccess = () => {
        // Navigate back to list after successful approve/reject/for review
        navigate('/modification/list');
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
                    <div className="text-center text-gray-500">No revision data found</div>
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