# MapRenderer Integration Guide

## Overview
This document explains the new MapRenderer component that replaces MetroManilaMap in the ProjectForm. The new component uses MapLibre GL integrated with Deck.gl to render GeoJSON LineString features from the backend API.

## Installation

Run the following command in the FE directory to install the required dependencies:

```bash
npm install maplibre-gl deck.gl @deck.gl/layers @deck.gl/mapbox @deck.gl/core
```

Or install individually:
```bash
npm install maplibre-gl
npm install deck.gl
npm install @deck.gl/layers
npm install @deck.gl/mapbox
npm install @deck.gl/core
```

## Changes Made

### 1. New API Service (`FE/src/pages/Project/Service.ts`)
Added a new function to fetch GeoJSON data:

```typescript
export const fetchProjectGeoJSON = async (projectId: string, programId: string) => {
    try {
        const response = await httpClient.post<any>(`/Project/GetGeoJSON`, 
            { project_id: projectId, program_id: programId }, 
            {
                preloaderMessage: 'Loading map data...'
            }
        );
        return response;
    } catch (ErrorResponse) {
        console.error('Error fetching GeoJSON data:', ErrorResponse);
        throw ErrorResponse;
    }
};
```

### 2. New MapRenderer Component (`FE/src/components/map/MapRenderer.tsx`)
Created a comprehensive map renderer with the following features:

- **MapLibre GL** for base map rendering with OpenStreetMap tiles
- **Deck.gl** integration for efficient GeoJSON layer rendering
- **Interactive features:**
  - Click on features to show popup with project details
  - Hover effects with cursor changes
  - Auto-fitting bounds to show all project features
- **Color-coded visualization:**
  - Orange: Road Widening projects
  - Blue: Rehabilitation projects
  - Green: Construction projects
  - Red: Other project types
- **Legend** showing color codes
- **Loading and error states** with user-friendly messages
- **Navigation controls** (zoom, pan, rotate)
- **Fullscreen mode** support

### 3. Updated ProjectForm Component (`FE/src/pages/Project/components/ProjectForm.tsx`)
Modified to use the new MapRenderer:

- Imported `MapRenderer` and `fetchProjectGeoJSON`
- Added state for GeoJSON data: `geoJsonData`
- Added `useEffect` to fetch map data when in edit mode
- Replaced `MetroManilaMap` component with `MapRenderer`
- Map only loads data in edit mode (not in add mode)

## API Expected Response Format

The API endpoint `/Project/GetGeoJSON` expects a request payload:
```json
{
  "project_id": "P00906380VS",
  "program_id": "P_CO-PS-635_01302025_100232"
}
```

And should return a GeoJSON FeatureCollection:
```json
{
  "Data": {
    "type": "FeatureCollection",
    "features": [
      {
        "id": "0",
        "type": "Feature",
        "properties": {
          "projectid": "P00906380VS",
          "name": "Project Name",
          "work_scope": "Road Widening",
          "dsow": "Detailed scope description",
          "length": 123,
          "target_amount": 0.123,
          "target_unit": "Lane Km",
          "cost_x": 98624000,
          "start_station_limit": "K0716 + 962",
          "end_station_limit": "K0716 + 985"
        },
        "geometry": {
          "type": "LineString",
          "coordinates": [
            [124.4809268195014, 12.115092382866791],
            [124.48093414443073, 12.115058975969744]
          ]
        }
      }
    ]
  },
  "Status": 200
}
```

## Component Props

### MapRenderer Props
```typescript
interface MapRendererProps {
  geoJsonData?: GeoJSON.FeatureCollection | null;  // GeoJSON data to render
  height?: string;                                   // Map height (default: "400px")
  projectId?: string;                                // Optional project ID
  programId?: string;                                // Optional program ID
}
```

## Usage Example

```tsx
import MapRenderer from '../../../components/map/MapRenderer';

// In your component
const [geoJsonData, setGeoJsonData] = useState<GeoJSON.FeatureCollection | null>(null);

// Fetch data
useEffect(() => {
  const loadMapData = async () => {
    try {
      const response = await fetchProjectGeoJSON(projectId, programId);
      setGeoJsonData(response.Data);
    } catch (error) {
      console.error('Error loading map data:', error);
    }
  };
  loadMapData();
}, [projectId, programId]);

// Render
<MapRenderer 
  geoJsonData={geoJsonData}
  projectId={projectId}
  programId={programId}
  height="500px"
/>
```

## Features & Behavior

### 1. Automatic Bounds Fitting
When GeoJSON data is loaded, the map automatically zooms and pans to show all features with appropriate padding.

### 2. Feature Click Popup
Clicking on a feature shows a popup with:
- Project name
- Scope of work
- Work type
- Length
- Target amount and unit
- Cost
- Station limits

### 3. Color Coding
Features are automatically color-coded based on the `work_scope` property:
- Road Widening → Orange
- Rehabilitation → Blue
- Construction → Green
- Default → Red

### 4. Responsive Design
The map adapts to its container size and includes:
- Navigation controls (zoom, pan, rotate)
- Fullscreen toggle
- Legend overlay
- Loading/error state indicators

### 5. Error Handling
- Gracefully handles API errors
- Shows "No data available" message when no GeoJSON data
- Displays error messages for rendering failures

## Backend Requirements

The backend should implement the `/api/Project/GetGeoJSON` endpoint that:
1. Accepts `project_id` and `program_id` in the request body
2. Returns a GeoJSON FeatureCollection with project location data
3. Includes relevant properties in each feature for popup display
4. Returns appropriate HTTP status codes (200 for success, 400/500 for errors)

## Troubleshooting

### Map doesn't render
1. Check browser console for errors
2. Verify MapLibre GL and Deck.gl packages are installed
3. Check that API endpoint is accessible and returns valid GeoJSON

### Features not visible
1. Verify GeoJSON coordinates are in [longitude, latitude] format (not reversed)
2. Check that geometry type is supported (LineString, Point, Polygon)
3. Ensure feature properties exist for styling

### Popup not showing
1. Verify feature properties contain expected fields
2. Check browser console for JavaScript errors
3. Ensure MapLibre GL CSS is loaded

## Future Enhancements

Potential improvements:
- Add filtering by work scope or project type
- Export map as image
- Add measurement tools
- Support for multiple project layers
- Custom marker icons for point features
- Clustering for dense project areas
- Time-based animation for project phases

## Support

For issues or questions:
1. Check browser console for error messages
2. Verify API response format matches expected structure
3. Test with sample GeoJSON data from the attached file
