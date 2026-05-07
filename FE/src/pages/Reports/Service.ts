

export const fetchProjectGeoJSON = async (referenceId: string, programId: string) => {
    try {
        // Using external API endpoint with query parameters
        const apiUrl = `http://192.168.1.93:8000/api_v1.0/project/features?project_id=${referenceId}&program_id=${programId}`;
        
        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
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