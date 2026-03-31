import { httpClient, type ApiResponse } from "../../services/httpClient";
import type { ProgramList } from "../Program/Model";
import type { ProjectLists, ComponentCost, ProjectDetails, MajorItemOfWork, MajorItemLocations, FundingProfile, ProjectNote, ProjectEnums, ProjectFormPayload, ProjectPagination, AddNotes, InfraData, ProjectSupportingDocs, ProjectRevisionList, ComponentCostPerYear, ImportProjectDTO } from "./Model.d";

// #region INITIALIZE Project Lists
export const fetchProject = async (data: ProjectPagination) => {
    try {
        const response = await httpClient.post<PaginationResponse<ProjectLists>>(`/Project/showprojects`, data, {
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
        const response = await httpClient.post<ProgramList>(`/Project/Details/${programId}`, null, {
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
        const response = await httpClient.post<ProgramList>(`/Project/Search/${programName}`, null, {
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
        const response = await httpClient.post<{ProjectId: string, StageName: string, Type: string, Title: string, Message: string}>(`/Project/addproject/`, projectDetails, {
            preloaderMessage: 'Adding project details...'
        });
        return response;
    } catch (ErrorResponse) {
        console.error('Error adding project details:', ErrorResponse);
        throw ErrorResponse;
    }
};
export const getProjectDetails = async ({ProjectId, StageName}: {ProjectId: string, StageName: string}) => {
    try {
        const response = await httpClient.post<ProjectFormPayload>(`/Project/ProjectDetails/`, {ProjectId, StageName}, {
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
        const response = await httpClient.post<{ProjectId: string, Title: string, Message: string}>(`/Project/UpdateProjectDetails/`, projectDetails, {
            preloaderMessage: 'Updating project details...'
        });
        return response;
    } catch (ErrorResponse) {
        console.error('Error updating project details:', ErrorResponse);
        throw ErrorResponse;
    }
};

// Update entire project (all sections except ProgramDetails and Notes)
export const updateEntireProject = async (payload: {
    ProjectDetails: ProjectDetails;
    ComponentCosts: ComponentCost[];
    ComponentCostPerYear: ComponentCostPerYear[];
    MajorItemOfWorks: MajorItemOfWork[];
    MajorItemLocations: MajorItemLocations[];
    FundingProfile: FundingProfile[];
    IsAllowedToProceed: boolean;
}) => {
    try {
        const response = await httpClient.post<{Type: string, Message: string, Title: string}>(`/Project/UpdateProjectDetails/`, payload, {
            preloaderMessage: 'Updating entire project...'
        });
        return response;
    } catch (ErrorResponse) {
        console.error('Error updating entire project:', ErrorResponse);
        throw ErrorResponse;
    }
};
// #endregion

// #region Notes
export const addNote = async (formData: AddNotes) => {
  try {
    const response = await httpClient.post<ApiResponse>(`/Project/UploadNotes/`, formData, {
      preloaderMessage: 'Adding note...',
    });
    return response;
  } catch (error) {
    console.error('Error adding note:', error);
    throw error;
  }
};
export const addDoc = async (formData: AddNotes) => {
  try {
    const response = await httpClient.post<ApiResponse>(`/Project/UploadSupportingDocs/`, formData, {
      preloaderMessage: 'Adding document...',
    });
    return response;
  } catch (error) {
    console.error('Error adding document:', error);
    throw error;
  }
};
export const deleteNote = async (notes: ProjectNote[]) => {
    try {
        const response = await httpClient.post<ProjectNote[]>(`/Project/DeleteNote/`, notes, {
            preloaderMessage: 'Deleting note...'
        });
        return response;
    } catch (ErrorResponse) {
        console.error('Error deleting note:', ErrorResponse);
        throw ErrorResponse;
    }
}
export const deleteDoc = async (docs: ProjectSupportingDocs) => {
    try {
        const response = await httpClient.post<ProjectSupportingDocs>(`/Project/DeleteSupportingDocs/`, docs, {
            preloaderMessage: 'Deleting document...'
        });
        return response;
    } catch (ErrorResponse) {
        console.error('Error deleting document:', ErrorResponse);
        throw ErrorResponse;
    }
}
// #endregion

// #region Infrastructure Data
export const getInfrastructureData = async () => {
    try {
        const response = await httpClient.post<InfraData>(`/Project/InfrastructureData`, null, {
            preloaderMessage: 'Loading infrastructure data...'
        });
        return response;
    } catch (ErrorResponse) {
        console.error('Error fetching infrastructure data:', ErrorResponse);
        throw ErrorResponse;
    }
};
// #endregion

// #region Project Stages
export const fetchProjectStagesByProjectId = async (projectId: string) => {
    try {
        const response = await httpClient.post<ProjectRevisionList>(`/Project/ShowProjectStages`, {ProjectId: projectId}, {
            preloaderMessage: 'Loading project revisions...'
        });
        return response;
    } catch (ErrorResponse) {
        console.error('Error fetching project revisions:', ErrorResponse);
        // If API fails, return empty revisions for graceful degradation
        return {
            Data: {
                Stages: [],
                Dropdowns: {
                    CategoryEnum: [],
                    ThrustEnum: []
                }
            },
            Status: 200,
            Message: "No revisions found"
        }
    }
};
// #endregion

// #region GeoJSON Data
export const fetchProjectGeoJSON = async (projectId: string, programId: string, username: string, stageName: string) => {
    try {
        const params = new URLSearchParams({
            project_id: projectId,
            program_id: programId,
            username,
            program_stage_name: stageName,
        });
        const apiUrl = `https://slavishly-otoscopic-adelynn.ngrok-free.dev/api_v2.0/project/features_v4?${params.toString()}`;
        // const apiUrl = `http://localhost:8001/api_v2.0/project/features_v4?${params.toString()}`;

        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': 'true',
            },
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        return {
            Data: data,
            Status: response.status,
            Message: 'Success'
        };
    } catch (error) {
        console.error('Error fetching GeoJSON data:', error);
        throw error;
    }
};

export const chainageToLrpConverter = async (sectionId: string, chainage: number) => {
    try {
        const params = new URLSearchParams({
            road_section_id: sectionId,
            chainage: chainage.toString(),
        });
        const apiUrl = `https://slavishly-otoscopic-adelynn.ngrok-free.dev/api_v2.0/infra/chainage_to_lrp?${params.toString()}`;
        // const apiUrl = `http://localhost:8001/api_v2.0/infra/chainage_to_lrp?${params.toString()}`;

        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': 'true',
            },
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return {
            Data: data,
            Status: response.status,
            Message: 'Success'
        };
    } catch (error) {
        console.error('Error converting chainage to LRP:', error);
        throw error;
    }
};

// #region Import
export const importProject = async (payload: ImportProjectDTO) => {
    try {
        const response = await httpClient.post(`/Importing/ImportProject/`, payload, {
            preloaderMessage: 'Importing lump sum project...'
        });
        return response;
    } catch (ErrorResponse) {
        console.error('Error importing lump sum project:', ErrorResponse);
        throw ErrorResponse;
    }
};
// #endregion

export const lrpToChainageConverter = async (sectionId: string, lrp: string) => {
    try {
        const apiUrl = `https://slavishly-otoscopic-adelynn.ngrok-free.dev/api_v2.0/infra/lrp_to_chainage?road_section_id=${encodeURIComponent(sectionId)}&lrp_string=${encodeURIComponent(lrp)}`;
        // const apiUrl = `http://localhost:8001/api_v2.0/infra/lrp_to_chainage?road_section_id=${encodeURIComponent(sectionId)}&lrp_string=${encodeURIComponent(lrp)}`;

        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': 'true',
            },
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return {
            Data: data,
            Status: response.status,
            Message: 'Success'
        };
    } catch (error) {
        console.error('Error converting LRP to chainage:', error);
        throw error;
    }
};
// #endregion