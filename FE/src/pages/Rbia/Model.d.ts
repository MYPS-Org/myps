export interface FutureRoadsClassification {
	Id: number;
	Classification: string;
	Description: string;
	CreatedBy: string;
	CreatedDate: string;
	UpdatedBy?: string;
	UpdateDate?: string;
}
export interface FutureRoads {
	Id: number;
	RoadId: string;
	Name: string;
	Classification: string;
	CreatedBy?: string;
	CreatedDate?: string;
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
	RoadId: string;
  RoadSectionId: string;
	RoadLength: string;
	DEO: string;
	CreatedBy: string;
	CreatedDate: string;
	UpdatedBy: string;
	UpdatedDate: string;
}
export interface RoadSectionPagination extends PaginationParams {
  filters?: RoadSectionFilter;
  sortField?: string; // Remove the = 'Id' default value - this is invalid in TypeScript interfaces
  sortDirection?: 0 | 1;
}
export interface RoadSectionFilter {
  RoadId?: string;
  RoadSectionId?: string;
  DEO?: string;
  RoadLength?: string;
}
export interface FutureBridge {
	Id: number;
	RoadSectionId: string;
	BridgeId: string;
	Name: string;
	From: string;
	Length: string;
	CarriageWay: string;
	CreatedBy: string;
	CreatedDate: string;
	UpdatedBy: string;
	UpdatedDate: string;
}
export interface BridgePagination extends PaginationParams {
  filters?: BridgeFilter;
  sortField?: string; // Remove the = 'Id' default value - this is invalid in TypeScript interfaces
  sortDirection?: 0 | 1;
}
export interface BridgeFilter {
  RoadSectionId?: string,
  BridgeId?: string,
  Name?: string,
  From?: string,
  Length?: string,
  CarriageWay?: string
}