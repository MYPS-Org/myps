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
	CreatedBy: string;
	CreatedDate: string;
	UpdatedBy: string;
	UpdatedDate: string;
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