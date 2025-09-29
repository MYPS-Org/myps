import { httpClient } from "../../services/httpClient";
import type { ModificationCategory } from "./Model.d"

export const fetchDropDownData = async () => {
    try {
        const response = await httpClient.post<{ ModCategories: ModificationCategory[], ModReasons: ModificationCategory[] }>('/modification/initDropdowns');
        return response;
    } catch (error) {
        console.error('Error fetching modification dropdown data:', error);
        throw error;
    }
}