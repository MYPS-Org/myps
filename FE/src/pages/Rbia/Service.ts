import { httpClient } from '../../services/httpClient';
import type { RODEOEnum } from '../Project/Model';

import type { FutureRoads, FutureRoadSections, FutureBridge, FutureRoadsClassification, BridgePagination, RoadSectionPagination, RoadPagination } from './Model.d';

export const fetchRoadInitData = async () => {
    try {
        const response = await httpClient.post<FutureRoadsClassification[]>('/futureInfra/initfilterFutureRoads');
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

export const addFutureRoad = async (road: FutureRoads) => {
    try {
        const response = await httpClient.post<FutureRoads>('/rbia/addFutureRoad', road, );
        return response;
    } catch (error) {
        console.error('Error adding future road:', error);
        throw error;
    }
}

export const editFutureRoad = async (road: FutureRoads) => {
    try {
        const response = await httpClient.post<FutureRoads>('/rbia/editFutureRoad', road, );
        return response;
    } catch (error) {
        console.error('Error editing future road:', error);
        throw error;
    }
}

export const deleteFutureRoad = async (roadId: string) => {
    try {
        const response = await httpClient.post<{ success: boolean }>('/rbia/deleteFutureRoad', { RoadId: roadId });
        return response;
    } catch (error) {
        console.error('Error deleting future road:', error);
        throw error;
    }
}

export const fetchRoadSectionInitData = async () => {
    try {
        const response = await httpClient.post<FutureRoadsClassification[]>('/futureinfra/InitFilterFutureRoadSections');
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

export const addFutureRoadSection = async (section: FutureRoadSections) => {
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
        const response = await httpClient.post<FutureRoadSections>('/futureinfra/editFutureRoadSection', section, );
        return response;
    } catch (error) {
        console.error('Error editing future road section:', error);
        throw error;
    }
}

export const deleteFutureRoadSection = async (sectionRoadId: string) => {
    try {
        const response = await httpClient.post<{ success: boolean }>('/futureinfra/deleteFutureRoadSection', { SectionRoadId: sectionRoadId });
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

export const addBridgeSection = async (section: FutureRoadSections) => {
    try {
        const response = await httpClient.post('/futureinfra/addFutureRoadSections', section, );
        return response;
    } catch (error) {
        console.error('Error adding future road section:', error);
        throw error;
    }
}

export const editFutureBridge = async (bridge: FutureBridge) => {
    try {
        const response = await httpClient.post<FutureBridge>('/rbia/editFutureBridge', bridge, );
        return response;
    } catch (error) {
        console.error('Error editing future bridge:', error);
        throw error;
    }
}

export const deleteFutureBridge = async (bridgeId: string) => {
    try {
        const response = await httpClient.post<{ success: boolean }>('/rbia/deleteFutureBridge', { BridgeId: bridgeId });
        return response;
    } catch (error) {
        console.error('Error deleting future bridge:', error);
        throw error;
    }
}
