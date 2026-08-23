"use client";

import React from 'react';
import { useSearchParams } from 'react-router-dom';
import ProjectForm from '../components/ProjectForm';
// import type { ProjectFormPayload } from '../Model.d';

const AddProject: React.FC = () => {
    const [searchParams] = useSearchParams();
    const programPK = searchParams.get('programPK');
    const stageName = searchParams.get('stageName');

    return (
        <ProjectForm
            // onSubmit={handleAddProject}
            // onSaveSection={handleSaveSection}
            mode="add"
            initialProgramPK={programPK || undefined}
            initialStageName={stageName || undefined}
        />
    );
};

export default AddProject;