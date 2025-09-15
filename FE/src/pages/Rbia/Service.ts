import { httpClient } from '../../services/httpClient';

import type { FutureRoad, FutureRoadSection, FutureBridge } from './Model.d';

export const fetchRbiaData = async () => {
    try {
        const response = await httpClient.post<FutureRoad[]>('/rbia');
        return response;
    } catch (error) {
        console.error('Error fetching RBIA data:', error);
        throw error;
    }
}

export const addFutureRoad = async (road: FutureRoad) => {
    try {
        const response = await httpClient.post<FutureRoad>('/rbia/addFutureRoad', road, );
        return response;
    } catch (error) {
        console.error('Error adding future road:', error);
        throw error;
    }
}

export const editFutureRoad = async (road: FutureRoad) => {
    try {
        const response = await httpClient.post<FutureRoad>('/rbia/editFutureRoad', road, );
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

export const addFutureRoadSection = async (section: FutureRoadSection) => {
    try {
        const response = await httpClient.post<FutureRoadSection>('/rbia/addFutureRoadSection', section, );
        return response;
    } catch (error) {
        console.error('Error adding future road section:', error);
        throw error;
    }
}

export const editFutureRoadSection = async (section: FutureRoadSection) => {
    try {
        const response = await httpClient.post<FutureRoadSection>('/rbia/editFutureRoadSection', section, );
        return response;
    } catch (error) {
        console.error('Error editing future road section:', error);
        throw error;
    }
}

export const deleteFutureRoadSection = async (sectionRoadId: string) => {
    try {
        const response = await httpClient.post<{ success: boolean }>('/rbia/deleteFutureRoadSection', { SectionRoadId: sectionRoadId });
        return response;
    } catch (error) {
        console.error('Error deleting future road section:', error);
        throw error;
    }
}

export const addFutureBridge = async (bridge: FutureBridge) => {
    try {
        const response = await httpClient.post<FutureBridge>('/rbia/addFutureBridge', bridge, );
        return response;
    } catch (error) {
        console.error('Error adding future bridge:', error);
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
