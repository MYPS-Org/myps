
import { gisClient } from '../../services/httpClient';

export const fetchProjectGeoJSON = async (referenceId: string, programId: string) => {
    try {
        const response = await gisClient.get(
            `/api_v1.0/project/features`,
            {
                project_id: referenceId,
                program_id: programId,
            },
            { preloaderMessage: 'Loading map data...' }
        );
        return response;
    } catch (error) {
        console.error('Error fetching GeoJSON data:', error);
        throw error;
    }
};