export interface EventListPagination extends PaginationParams {
	filters?: EventList;
	sortField?: string;
	sortDirection?: 0 | 1;
}
export interface EventList {
	Id: number;
	Name: string;
	EventDate: Date;
	Status: number;
	LocationName: string;
	StickerAvailable: number;
	StickerUsed: number;
	CurrentLapName: string;
	CurrentLapId: number
}
export interface LocationList {
    id: number;
    locationName: string;
    lat: number;
    latDegree: number;
    latMinutes: number;
    latSeconds: number;
    lng: number;
    lngDegree: number;
    lngMinutes: number;
    lngSeconds: number;
}
/*
	"data": [
            {
                "id": 1,
                "name": "Marikina",
                "eventDate": "2025-06-11T00:36:42.0118748",
                "status": 0,
                "locationName": "1st Location",
                "stickerAvailable": 0,
                "stickerUsed": 0,
                "currentLapName": "Lap1",
                "currentLapId": 1
            },
            {
                "id": 2,
                "name": "Antipolo",
                "eventDate": "2025-06-11T00:36:42.2227482",
                "status": 0,
                "locationName": "1st Location",
                "stickerAvailable": 0,
                "stickerUsed": 0,
                "currentLapName": null,
                "currentLapId": null
            }
        ],
        "page": 1,
        "limit": 2,
        "total": 7,
        "totalPages": 4
	*/