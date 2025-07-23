"use client";

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import ProjectForm from '../components/ProjectForm';
import type { ProjectDetails, ProjectFormPayload } from '../Model.d';
import { getProjectDetails } from '../Service';

const EditProject: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [initialData, setInitialData] = useState<ProjectFormPayload | undefined>(undefined);
    const [projectDetails, setProjectDetails] = useState<ProjectFormPayload>({
        ProgramDetails: {
            Id: 0,
            ProgramId: '',
            RevisionNumber: 0,
            Name: '',
            StageId: 0,
            StageName: '',
            UserGroup: 0,
            RegionCode: '',
            Status: 0,
            Type: 0,
            Cost: 0,
            YearStart: 0,
            YearEnd: 0,
            CreatedBy: '',
            CreatedDate: '',
            UpdatedBy: '',
            UpdatedDate: ''
        },
        ProjectDetails: {
            Id: 0,
            ProgramId: '',
            ReferenceId: '',
            RevisionNumber: 0,
            Description: '',
            Category: 0,
            Thrust: 0,
            Origin: 0,
            City: 0,
            LegislativeDistrict: 0,
            OperatingUnit: '',
            ImplementingOffice: '',
            DEO: '',
            Region: '',
            Agency: 0,
            ProjectCode: '',
            ImplementationMode: 0,
            EmergencyMode: false,
            Feasibility: 0,
            DetailedDesign: false,
            RowAvailable: false,
            CreatedBy: '',
            CreatedDate: '',
            UpdatedBy: '',
            UpdatedDate: '',
        },
        ComponentCosts: [],
        ComponentCostPerYear: [],
        MajorItemOfWorks: [],
        ProjectNotes: [],
        FundingProfile: [],
        Dropdowns: {
            Categories: [],
            Thrusts: [],
            Origins: [],
            Cities: [],
            ComponentTypes: [],
            LDs: [],
            OperatingUnits: [],
            IOs: [],
            DEOs: [],
            Feasibility: [],
            Agencies: [],
            ImplementationModes: [],
            EmergencyModes: [],

            //Component Cost
            // ComponentTypes: [],

            //Funding Profile
            Agreements: [],
            Sources: [],
        },
        Activities: []
    });
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Load project data based on ID
        const loadProjectData = async () => {
            await getProjectDetails({ ProjectId: id || '' })
                .then(response => {
                    console.log('Project details loaded:', response);
                    setInitialData(response.Data);
                })
                .catch(error => {
                    console.error('Error loading project details:', error);
                    // Handle error appropriately, e.g., show a toast or alert
                })
                .finally(() => {
                    setIsLoading(false);
                });
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
            // onSubmit={handleUpdateProject}
            onSaveSection={handleSaveSection}
            mode="edit"
        />
    );
};

export default EditProject;
