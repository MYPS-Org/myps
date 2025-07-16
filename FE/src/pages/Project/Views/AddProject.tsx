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

    return (
        <ProjectForm
            onSubmit={handleAddProject}
            mode="add"
        />
    );
};

export default AddProject;