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