export interface FutureRoadsClassification {
	Id: number;
	Classification: number;
	Description: string;
	CreatedBy: string;
	CreatedDate: string;
	UpdatedBy?: string;
	UpdateDate?: string;
}
export interface FutureRoads {
	Id: number;
	NetworkStatusId: number;
	InfraExistingOrFutureId: number;
	RoadId: string;
	Name: string;
	Classification: number;
	CreatedBy: string;
	CreatedDate: string;
	UpdatedBy?: string;
	UpdatedDate?: string;
}
export interface RoadPagination extends PaginationParams {
  filters?: RoadFilter;
  sortField?: string; // Remove the = 'Id' default value - this is invalid in TypeScript interfaces
  sortDirection?: 0 | 1;
}
export interface RoadFilter {
  RoadId?: string;
  Name?: string;
  Classification?: string;
}
export interface FutureRoadSections {
	Id: number;
	NetworkStatusId: number;
	InfraExistingOrFutureId: number;
	RoadId: string;
	RoadSectionId: string;
	RoadLength: number;
	DEO: string;
	CreatedBy: string;
	CreatedDate: string;
	UpdatedBy?: string;
	UpdatedDate?: string;
}
export interface RoadSectionPagination extends PaginationParams {
  filters?: RoadSectionFilter;
  sortField?: string; // Remove the = 'Id' default value - this is invalid in TypeScript interfaces
  sortDirection?: 0 | 1;
  // Optional keyset-pagination fields (BE's FilterDataCursor contract — see Pagination.d.ts).
  // Additive/optional so existing callers that only send page/limit keep compiling untouched.
  Navigation?: PaginationNavigationValue;
  PreviousFilteredId?: number | null;
  NextFilteredId?: number | null;
  PageCursorId?: number | null;
}
export interface RoadSectionFilter {
  RoadId?: string;
  RoadSectionId?: string;
  DEO?: string;
  RoadLength?: string;
}
export interface FutureBridge {
	Id: number;
	NetworkStatusId: number;
	InfraExistingOrFutureId: number;
	RoadSectionId: string;
	BridgeId: string;
	Name: string;
	From: number;
	Length: number;
	CarriageWay?: number;
	OverallWidth: number;
	CreatedBy: string;
	CreatedDate: string;
	UpdatedBy?: string;
	UpdatedDate?: string;
}
export interface BridgePagination extends PaginationParams {
  filters?: BridgeFilter;
  sortField?: string; // Remove the = 'Id' default value - this is invalid in TypeScript interfaces
  sortDirection?: 0 | 1;
  // Optional keyset-pagination fields (BE's FilterDataCursor contract — see Pagination.d.ts).
  // Additive/optional so existing callers that only send page/limit keep compiling untouched.
  Navigation?: PaginationNavigationValue;
  PreviousFilteredId?: number | null;
  NextFilteredId?: number | null;
  PageCursorId?: number | null;
}
export interface BridgeFilter {
  RoadSectionId?: string,
  BridgeId?: string,
  Name?: string,
  From?: number,
  Length?: number,
  CarriageWay?: number
}

// Backed by FutureInfraController's ShowInfraRoadSections/ShowInfraBridges — distinct from
// ShowFutureRoadSections/ShowFutureBridge above (RBIA-admin CRUD). These require DEO and
// return the scoped, human-readable vInfraRoadSectionOptions/vInfraBridgeOptions views used
// by the Project/Revision work-location picker (AddInfraDialog).
export interface InfraRoadSectionOption {
	Id: number;
	RoadId: string;
	RoadSectionId: string;
	RoadName?: string;
	LengthM: number;
	DEOParticipantId: string;
	RegionParticipantId?: string;
	NetworkStatusId: number;
	CreatedBy: string;
	CreatedByName?: string;
	CreatedDate: string;
	UpdatedBy?: string;
	UpdatedByName?: string;
	UpdatedDate?: string;
}
export interface InfraRoadSectionPagination extends PaginationParams {
  filters?: InfraRoadSectionFilter;
  sortField?: string;
  sortDirection?: 0 | 1;
  Navigation?: PaginationNavigationValue;
  PreviousFilteredId?: number | null;
  NextFilteredId?: number | null;
  PageCursorId?: number | null;
}
export interface InfraRoadSectionFilter {
  DEO: string;
  RoadName?: string;
}

export interface InfraBridgeOption {
	Id: number;
	BridgeId: string;
	RoadSectionId: string;
	BridgeName?: string;
	DEOParticipantId?: string;
	RegionParticipantId?: string;
	FromChainage: number;
	Length: number;
	CarriageWay?: number;
	OverallWidth: number;
	CreatedBy: string;
	CreatedByName?: string;
	CreatedDate: string;
	UpdatedBy?: string;
	UpdatedByName?: string;
	UpdatedDate?: string;
}
export interface InfraBridgePagination extends PaginationParams {
  filters?: InfraBridgeFilter;
  sortField?: string;
  sortDirection?: 0 | 1;
  Navigation?: PaginationNavigationValue;
  PreviousFilteredId?: number | null;
  NextFilteredId?: number | null;
  PageCursorId?: number | null;
}
export interface InfraBridgeFilter {
  DEO: string;
  BridgeName?: string;
  RoadSectionId?: string;
}