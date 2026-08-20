import { httpClient, gisClient, type ApiResponse } from "../../services/httpClient";
import type { ProgramList, ProgramLatest } from "../Program/Model";
import { fetchProgram } from "../Program/Service";
import type { ProjectLists, ComponentCost, ProjectDetails, MajorItemOfWork, MajorItemLocations, FundingProfile, ProjectNote, ProjectEnums, Dropdowns, ProjectFormPayload, ProjectFilter, AddNotes, InfraData, ProjectSupportingDocs, ProjectRevisionList, ComponentCostPerYear, ImportProjectDTO, SearchProgram } from "./Model.d";

// #region INITIALIZE Project Lists
export const fetchProject = async (data: PaginatedRequest<ProjectFilter>) => {
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

// vProgramLatest has no end-year column, so YearEnd isn't returned by /Program/ShowProgram.
// Fall back to StartYear here to preserve the year-range behavior consumers (e.g. ComponentCostDialog) expect.
const mapToProgramLatest = (program: ProgramLatest): ProgramLatest => ({
    ...program,
    YearEnd: program.StartYear,
});

export const searchProgram = async (programName: string, limit: number = 100): Promise<ApiResponse<SearchProgram>> => {
    try {
        const response = await fetchProgram({
            Filters: { Name: programName, StartYear: null, StageName: '', Type: '' },
            page: 1,
            limit,
            sortDirection: 0,
        });
        return {
            ...response,
            Data: { Programs: (response.Data.lists || []).map(mapToProgramLatest) }
        };
    } catch (ErrorResponse) {
        console.error('Error searching program:', ErrorResponse);
        throw ErrorResponse;
    }
};

export const getProjectEnums = async () => {
    try {
        const response = await httpClient.post<ProjectEnums>(`/Project/ShowProjectDropdowns`, null, {
            preloaderMessage: 'Loading project data...'
        });
        return response;
    } catch (ErrorResponse) {
        console.error('Error fetching project enums:', ErrorResponse);
        throw ErrorResponse;
    }
};

export const getComponentsEnums = async () => {
    try {
        const response = await httpClient.post<Dropdowns>(`/Project/ShowProjectComponentDropdowns`, null, {
            preloaderMessage: 'Loading project data...'
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
        const response = await httpClient.post<ProjectFormPayload>(`/Project/ShowProjectDetails/`, {ProjectId, StageName}, {
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
// transactionId is revision-module only: when present, it replaces revision_id so the GIS
// service resolves the layer for that specific revision transaction instead of the base project.
export const fetchProjectGeoJSON = async (referenceId: string, programId: string, username: string, stageName: string, transactionId?: string) => {
    try {
        const response = await gisClient.get(
            `/projects_and_programs/get_proj_geom`,
            {
                project_id: referenceId,
                program_pk: programId,
                username,
                program_stage_name: stageName,
                ...(transactionId ? { transaction_id: transactionId } : {}),
            },
            { preloaderMessage: 'Loading map data...' }
        );
        return response;
    } catch (error) {
        console.error('Error fetching GeoJSON data:', error);
        throw error;
    }
};

export const chainageToLrpConverter = async (sectionId: string, chainage: number) => {
    try {
        const response = await gisClient.get(
            `/infra_inventory/lrp/chainage_to_lrp`,
            {
                road_section_id: sectionId,
                chainage: chainage.toString(),
            },
            { preloaderMessage: 'Converting chainage...' }
        );
        return response;
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
        const response = await gisClient.get(
            `/infra_inventory/lrp/lrp_to_chainage`,
            {
                road_section_id: sectionId,
                lrp_string: lrp,
            },
            { preloaderMessage: 'Converting LRP...' }
        );
        return response;
    } catch (error) {
        console.error('Error converting LRP to chainage:', error);
        throw error;
    }
};

export const autoFillComponentDescription = async (username: string, project_id: string, component_id: string, program_pk: string, program_stage_name: string) => {
    try {
        const response = await gisClient.get(
            `/projects_and_programs/get_proj_component_description`,
            {
                username,
                project_id,
                component_id,
                program_pk,
                program_stage_name,
            },
            { preloaderMessage: 'Loading component description...' }
        );
        return response;
    } catch (error) {
        console.error('Error autofilling component description:', error);
        throw error;
    }
}