"use client";

import React from 'react';
import ProjectForm from '../components/ProjectForm';
import type { ProjectFormPayload } from '../Model.d';

const AddProject: React.FC = () => {
    const handleAddProject = async (formData: ProjectFormPayload) => {
        try {
            // Here you would typically make an API call to add the project
            // For example:
            // await addProject(formData);
            console.log('Project added:', formData);
            // After successful addition, you might want to redirect or show a success message
        } catch (error) {
            console.error('Error adding project:', error);
            // Handle error appropriately, e.g., show a toast or alert
        }
    };

    const handleSaveSection = async (sectionName: string, sectionData: any) => {
        try {
            // Here you would typically make an API call to save just this section
            // For a new project, this might be a partial save or temporary save
            console.log(`Saving section ${sectionName}:`, sectionData);
            // You could implement:
            // - Save to localStorage for draft
            // - Save to backend as draft
            // - Validate specific section
            alert(`${sectionName} section saved successfully!`);
        } catch (error) {
            console.error(`Error saving ${sectionName}:`, error);
            throw error; // Re-throw to let ProjectForm handle UI feedback
        }
    };

    return (
        <ProjectForm
            // onSubmit={handleAddProject}
            onSaveSection={handleSaveSection}
            mode="add"
        />
    );
};

export default AddProject;