import { httpClient } from "../../services/httpClient";
import type { ProgramDetails, ComponentCost, ProjectDetails, MajorItemOfWork, FundingProfile, ProjectNote, ProjectEnums, ProjectFormPayload, ProjectPagination } from "./Model.d";

// #region INITIALIZE Project Lists
export const fetchProject = async (data: ProjectPagination) => {
    try {
        const response = await httpClient.post<PaginationResponse<ProjectDetails>>(`/Project/showprojects`, data, {
            preloaderMessage: 'Loading project details...'
        });
        return response;
    } catch (ErrorResponse) {
        console.error('Error fetching project details:', ErrorResponse);
        throw ErrorResponse;
    }
};

// #region INITIALIZE Project details and Enums
export const initProgramDetails = async (programId: number) => {
    try {
        const response = await httpClient.post<ProgramDetails>(`/Project/Details/${programId}`, null, {
            preloaderMessage: 'Loading program details...'
        });
        return response;
    } catch (ErrorResponse) {
        console.error('Error fetching program details:', ErrorResponse);
        throw ErrorResponse;
    }
}

export const searchProgram = async (programName: string) => {
    try {
        const response = await httpClient.post<ProgramDetails>(`/Project/Search/${programName}`, null, {
            preloaderMessage: 'Searching program...'
        });
        return response;
    } catch (ErrorResponse) {
        console.error('Error searching program:', ErrorResponse);
        throw ErrorResponse;
    }
};

export const getProjectEnums = async () => {
    try {
        const response = await httpClient.post<ProjectEnums>(`/Project/InitAddProject`, null, {
            preloaderMessage: 'Loading project enums...'
        });
        return response;
    } catch (ErrorResponse) {
        console.error('Error fetching project enums:', ErrorResponse);
        throw ErrorResponse;
    }
};
// #endregion

// #region Project Details
export const addProjectDetails = async (projectDetails: ProjectDetails) => {
    try {
        const response = await httpClient.post<{ProjectId: string, Title: string, Message: string}>(`/Project/addproject/`, projectDetails, {
            preloaderMessage: 'Adding project details...'
        });
        return response;
    } catch (ErrorResponse) {
        console.error('Error adding project details:', ErrorResponse);
        throw ErrorResponse;
    }
};
export const getProjectDetails = async ({ProjectId}: {ProjectId: string}) => {
    try {
        const response = await httpClient.post<ProjectFormPayload>(`/Project/ProjectDetails/`, {ProjectId}, {
            preloaderMessage: 'Loading project details...'
        });
        return response;
    } catch (ErrorResponse) {
        console.error('Error loading project details:', ErrorResponse);
        throw ErrorResponse;
    }
};

export const updateProjectDetails = async (projectDetails: ProjectDetails) => {
    try {
        const response = await httpClient.post(`/Program/UpdateDetails/`, projectDetails, {
            preloaderMessage: 'Updating project details...'
        });
        return response;
    } catch (ErrorResponse) {
        console.error('Error updating project details:', ErrorResponse);
        throw ErrorResponse;
    }
};
// #endregion

// #region Component Costs
export const addComponentCost = async (componentCost: ComponentCost) => {
    try {
        const response = await httpClient.post<ComponentCost>(`/Program/AddComponentCost/`, componentCost, {
            preloaderMessage: 'Adding component cost...'
        });
        return response;
    } catch (ErrorResponse) {
        console.error('Error adding component cost:', ErrorResponse);
        throw ErrorResponse;
    }
}

export const updateComponentCost = async (componentCost: ComponentCost) => {
    try {
        const response = await httpClient.post(`/Program/UpdateComponentCost/`, componentCost, {
            preloaderMessage: 'Updating component cost...'
        });
        return response;
    } catch (ErrorResponse) {
        console.error('Error updating component cost:', ErrorResponse);
        throw ErrorResponse;
    }
}

export const deleteComponentCost = async (componentCostId: string) => {
    try {
        const response = await httpClient.post(`/Program/DeleteComponentCost/${componentCostId}`, null, {
            preloaderMessage: 'Deleting component cost...'
        });
        return response;
    } catch (ErrorResponse) {
        console.error('Error deleting component cost:', ErrorResponse);
        throw ErrorResponse;
    }
}
// #endregion

// #region Major Items of Work
export const addMajorItemOfWork = async (majorItems: MajorItemOfWork[]) => {
    try {
        const response = await httpClient.post<MajorItemOfWork[]>(`/Program/AddMajorItemOfWork/`, majorItems, {
            preloaderMessage: 'Adding major item of work...'
        });
        return response;
    } catch (ErrorResponse) {
        console.error('Error adding major item of work:', ErrorResponse);
        throw ErrorResponse;
    }
}

export const updateMajorItemOfWork = async (majorItems: MajorItemOfWork[]) => {
    try {
        const response = await httpClient.post<MajorItemOfWork[]>(`/Program/UpdateMajorItemOfWork/`, majorItems, {
            preloaderMessage: 'Updating major item of work...'
        });
        return response;
    } catch (ErrorResponse) {
        console.error('Error updating major item of work:', ErrorResponse);
        throw ErrorResponse;
    }
}

export const deleteMajorItemOfWork = async (majorItems: MajorItemOfWork[]) => {
    try {
        const response = await httpClient.post<MajorItemOfWork[]>(`/Program/DeleteMajorItemOfWork/`, majorItems, {
            preloaderMessage: 'Deleting major item of work...'
        });
        return response;
    } catch (ErrorResponse) {
        console.error('Error deleting major item of work:', ErrorResponse);
        throw ErrorResponse;
    }
}

// #endregion

// #region Funding Profiles
export const addFundingProfile = async (fundingProfiles: FundingProfile[]) => {
    try {
        const response = await httpClient.post<FundingProfile[]>(`/Program/AddFundingProfile/`, fundingProfiles, {
            preloaderMessage: 'Adding funding profile...'
        });
        return response;
    } catch (ErrorResponse) {
        console.error('Error adding funding profile:', ErrorResponse);
        throw ErrorResponse;
    }
}

export const updateFundingProfile = async (fundingProfiles: FundingProfile[]) => {
    try {
        const response = await httpClient.post<FundingProfile[]>(`/Program/UpdateFundingProfile/`, fundingProfiles, {
            preloaderMessage: 'Updating funding profile...'
        });
        return response;
    } catch (ErrorResponse) {
        console.error('Error updating funding profile:', ErrorResponse);
        throw ErrorResponse;
    }
}

export const deleteFundingProfile = async (fundingProfiles: FundingProfile[]) => {
    try {
        const response = await httpClient.post(`/Program/DeleteFundingProfile/`, fundingProfiles, {
            preloaderMessage: 'Deleting funding profile...'
        });
        return response;
    } catch (ErrorResponse) {
        console.error('Error deleting funding profile:', ErrorResponse);
        throw ErrorResponse;
    }
}

// #endregion

// #region Notes
export const addNote = async (notes: ProjectNote[]) => {
    try {
        const response = await httpClient.post<ProjectNote[]>(`/Program/AddNote/`, notes, {
            preloaderMessage: 'Adding note...'
        });
        return response;
    } catch (ErrorResponse) {
        console.error('Error adding note:', ErrorResponse);
        throw ErrorResponse;
    }
}

export const updateNote = async (notes: ProjectNote[]) => {
    try {
        const response = await httpClient.post<ProjectNote[]>(`/Program/UpdateNote/`, notes, {
            preloaderMessage: 'Updating note...'
        });
        return response;
    } catch (ErrorResponse) {
        console.error('Error updating note:', ErrorResponse);
        throw ErrorResponse;
    }
}

export const deleteNote = async (notes: ProjectNote[]) => {
    try {
        const response = await httpClient.post<ProjectNote[]>(`/Program/DeleteNote/`, notes, {
            preloaderMessage: 'Deleting note...'
        });
        return response;
    } catch (ErrorResponse) {
        console.error('Error deleting note:', ErrorResponse);
        throw ErrorResponse;
    }
}
// #endregion