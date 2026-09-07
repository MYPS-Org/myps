import { httpClient, gisClient } from '../../services/httpClient';
import type { RODEOEnum } from '../Project/Model';

import type { FutureRoads, FutureRoadSections, FutureBridge, FutureRoadsClassification, BridgePagination, RoadSectionPagination, RoadPagination, RoadFilter, RoadSectionFilter, BridgeFilter, InfraRoadSectionOption, InfraBridgeOption, InfraRoadSectionPagination, InfraBridgePagination } from './Model.d';


export const fetchRoadInitData = async () => {
    try {
        const response = await httpClient.post<{ Classifications: FutureRoadsClassification[] }>('/futureInfra/initfilterFutureRoads');
        return response;
    } catch (error) {
        console.error('Error fetching RBIA data:', error);
        throw error;
    }
}

export const fetchRoads = async ( data: RoadPagination) => {
    try {
        const response = await httpClient.post<PaginationResponse<FutureRoads>>('/futureInfra/ShowFutureRoads', data);
        return response;
    } catch (error) {
        console.error('Error fetching future roads:', error);
        throw error;
    }
};

export const addFutureRoad = async (road: RoadFilter) => {
    try {
        const response = await httpClient.post<RoadFilter>('/futureInfra/addFutureRoads', road, );
        return response;
    } catch (error) {
        console.error('Error adding future road:', error);
        throw error;
    }
}

export const editFutureRoad = async (road: FutureRoads) => {
    try {
        const response = await httpClient.post<FutureRoads>('/futureInfra/editFutureRoads', road, );
        return response;
    } catch (error) {
        console.error('Error editing future road:', error);
        throw error;
    }
}

export const deleteFutureRoad = async (roadId: string) => {
    try {
        const response = await httpClient.post<{ success: boolean }>('/futureinfra/DeleteFutureRoad', { RoadId: roadId });
        return response;
    } catch (error) {
        console.error('Error deleting future road:', error);
        throw error;
    }
}

export const fetchRoadSectionInitData = async () => {
    try {
        const response = await httpClient.post<{ DEOs: RODEOEnum[] }>('/futureinfra/InitFilterFutureRoadSections');
        return response;
    } catch (error) {
        console.error('Error fetching RBIA data:', error);
        throw error;
    }
}
export const fetchRoadSectionData = async (data: RoadSectionPagination) => {
    try {
        const response = await httpClient.post<PaginationResponse<FutureRoadSections>>('/futureinfra/ShowFutureRoadSections', data);
        return response;
    } catch (error) {
        console.error('Error fetching road section data:', error);
        throw error;
    }
}

export const addFutureRoadSection = async (section: RoadSectionFilter) => {
    try {
        const response = await httpClient.post('/futureinfra/addFutureRoadSections', section, );
        return response;
    } catch (error) {
        console.error('Error adding future road section:', error);
        throw error;
    }
}

export const editFutureRoadSection = async (section: FutureRoadSections) => {
    try {
        const response = await httpClient.post<FutureRoadSections>('/futureinfra/editFutureRoadSections', section, );
        return response;
    } catch (error) {
        console.error('Error editing future road section:', error);
        throw error;
    }
}

export const deleteFutureRoadSection = async (sectionRoadId: string) => {
    try {
        const response = await httpClient.post<{ success: boolean }>('/futureinfra/DeleteFutureRoadSection', { RoadSectionId: sectionRoadId });
        return response;
    } catch (error) {
        console.error('Error deleting future road section:', error);
        throw error;
    }
}

export const fetchBridgeInitData = async () => {
    try {
        const response = await httpClient.post<{DEOs: RODEOEnum[]}>('/futureinfra/InitFilterFutureBridge');
        return response;
    } catch (error) {
        console.error('Error fetching RBIA data:', error);
        throw error;
    }
}
export const fetchBridgeData = async (data: BridgePagination) => {
    try {
        const response = await httpClient.post<PaginationResponse<FutureBridge>>('/futureinfra/ShowFutureBridge',data);
        return response;
    } catch (error) {
        console.error('Error fetching RBIA data:', error);
        throw error;
    }
}

export const addFutureBridge = async (bridge: BridgeFilter) => {
    try {
        const response = await httpClient.post('/futureinfra/addFutureBridge', bridge);
        return response;
    } catch (error) {
        console.error('Error adding future bridge:', error);
        throw error;
    }
}

export const editFutureBridge = async (bridge: FutureBridge) => {
    try {
        const response = await httpClient.post<FutureBridge>('/futureinfra/editFutureBridge', bridge, );
        return response;
    } catch (error) {
        console.error('Error editing future bridge:', error);
        throw error;
    }
}

export const deleteFutureBridge = async (bridgeId: string) => {
    try {
        const response = await httpClient.post<{ success: boolean }>('/futureinfra/DeleteFutureBridge', { BridgeId: bridgeId });
        return response;
    } catch (error) {
        console.error('Error deleting future bridge:', error);
        throw error;
    }
}

// Covers Roads, Road Section, Bridges, and Region — the GIS API only exposes one
// combined infrastructure import endpoint (no per-entity import).
export const importAllInfrastructure = async (userName: string) => {
    try {
        const response = await gisClient.put(
            `/infra_inventory/import_all?username=${encodeURIComponent(userName)}`,
            undefined,
            { preloaderMessage: 'Importing road network data...' }
        );
        return response;
    } catch (error) {
        console.error('Error importing road network data:', error);
        throw error;
    }
}

// Covers Region, City/Municipality + Legislative District, and DEO + Implementing Office —
// the GIS API only exposes one combined admin/org lookup import endpoint.
export const importAdminOrgLookups = async (userName: string) => {
    try {
        const response = await gisClient.put(
            `/admin_org_mgmt/import_aams_ioms?username=${encodeURIComponent(userName)}`,
            undefined,
            { preloaderMessage: 'Importing admin area and organization lookups...' }
        );
        return response;
    } catch (error) {
        console.error('Error importing admin/org lookups:', error);
        throw error;
    }
}

// Project/Revision work-location picker (AddInfraDialog) — distinct from fetchRoadSectionData/
// fetchBridgeData above (RBIA-admin CRUD screens). These call FutureInfraController's
// ShowInfraRoadSections/ShowInfraBridges, which require a DEO filter and return the
// scoped, human-readable vInfraRoadSectionOptions/vInfraBridgeOptions views.
export const fetchInfraRoadSections = async (data: InfraRoadSectionPagination) => {
    try {
        const response = await httpClient.post<PaginationResponse<InfraRoadSectionOption>>('/futureinfra/ShowInfraRoadSections', data);
        return response;
    } catch (error) {
        console.error('Error fetching infra road section options:', error);
        throw error;
    }
}

export const fetchInfraBridges = async (data: InfraBridgePagination) => {
    try {
        const response = await httpClient.post<PaginationResponse<InfraBridgeOption>>('/futureinfra/ShowInfraBridges', data);
        return response;
    } catch (error) {
        console.error('Error fetching infra bridge options:', error);
        throw error;
    }
}

export const getInfraCounts = async () => {
    try {
        const response = await httpClient.post<{ Roads: number; RoadSections: number; Bridge: number }>('FutureInfra/GetInfraInfo');
        return response;
    } catch (error) {
        console.error('Error fetching infrastructure counts:', error);
        throw error;
    }
}