"use client";

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import ProjectForm from '../components/ProjectForm';
import type { ProjectFormPayload } from '../Model.d';

const EditProject: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [initialData, setInitialData] = useState<ProjectFormPayload | undefined>(undefined);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Load project data based on ID
        const loadProjectData = async () => {
            try {
                // This is sample data - replace with actual API call
                const mockData: ProjectFormPayload = {
                    projectDetails: {
                        Id: id || 'P00001LZ',
                        ProjectName: 'Sample Project',
                        CityMunicipality: 'Sample City',
                        ReportingRegion: 'Region I',
                        Description: 'Sample project description',
                        LegislativeDistrict: 'District 1',
                        OriginatingRegion: 'Region I',
                        OperatingUnit: 'Sample Unit',
                        AlternativeProjCode: 'ALT001',
                        Category: 'Infrastructure',
                        ImplementingOffice: 'DPWH',
                        ImplementationCode: 'IMP001',
                        Thrust: 'Development',
                        DistrictEngOffice: 'District Engineering Office',
                        EmergencyCode: 'EMR001',
                        Origin: 'Government',
                        CreatedBy: 'John Doe',
                        CreatedDate: '2025-03-15',
                        FeasibilityStudy: true,
                        DetailedDesign: true,
                        RowAvailable: true
                    },
                    componentCosts: [
                        {
                            Id: 'CW1',
                            Description: 'Component cost based on engineering standards',
                            Cost: 100000000,
                            MYCAApproval: '2025-03-14',
                            UACsPAPCode: 'ABCD',
                            PlannedStartDate: '2025-03-14'
                        },
                        {
                            Id: 'CW2',
                            Description: 'Additional component for project enhancement',
                            Cost: 150000000,
                            MYCAApproval: '2025-03-14',
                            UACsPAPCode: 'EFGH',
                            PlannedStartDate: '2025-03-14'
                        }
                    ],
                    majorItemsOfWork: [
                        {
                            Id: 'MW1',
                            ComponentId: 'CW1',
                            YearOfWork: 2025,
                            TypeOfWork: 'Additional Lane Width',
                            TargetUnit: 'Lane KM',
                            PhysicalTarget: '10 KM',
                            DetailedScopeOfWork: 'Widening of existing road to accommodate additional lane',
                            InfraId: 'P50000LCR'
                        }
                    ],
                    projectNotes: [
                        {
                            Id: 'N1',
                            Description: 'Project approved with conditions for environmental compliance',
                            CreatedDate: '2025-03-14'
                        }
                    ],
                    fundingProfiles: [
                        {
                            Id: 'FP1',
                            Source: 'GOP',
                            Agreement: 'DPWH-GAA-2025',
                            Percentage: 100
                        }
                    ],
                    activities: [
                        {
                            Id: 'A1',
                            Description: 'Project details updated by administrator',
                            Date: '2025-03-14'
                        }
                    ]
                };

                setInitialData(mockData);
            } catch (error) {
                console.error('Error loading project data:', error);
            } finally {
                setIsLoading(false);
            }
        };

        loadProjectData();
    }, [id]);

    const handleUpdateProject = async (formData: ProjectFormPayload) => {
        try {
            // Here you would typically make an API call to update the project
            console.log('Project updated:', { id, formData });
            // After successful update, you might want to redirect or show a success message
        } catch (error) {
            console.error('Error updating project:', error);
            // Handle error appropriately
        }
    };

    const handleSaveSection = async (sectionName: string, sectionData: any) => {
        try {
            // Here you would typically make an API call to save just this section
            console.log(`Saving section ${sectionName} for project ${id}:`, sectionData);
            // You could implement:
            // - PATCH request to update specific section
            // - Optimistic updates with rollback on failure
            // - Real-time validation
            alert(`${sectionName} section saved successfully!`);
        } catch (error) {
            console.error(`Error saving ${sectionName}:`, error);
            throw error; // Re-throw to let ProjectForm handle UI feedback
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
            onSubmit={handleUpdateProject}
            onSaveSection={handleSaveSection}
            mode="edit"
        />
    );
};

export default EditProject;
