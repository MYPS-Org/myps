export interface FutureRoad {
  RoadId: string;
  Name: string;
  Classification: number;
}

export interface FutureRoadSection {
  RoadId: string;
  SectionRoadId: string;
  Length: number;
  EngineeringDistrict: number;
}

export interface FutureBridge {
  RoadId: string;
  SectionRoadId: string;
  Name: string;
  From: number;
  Length: number;
  CarriageWay: number;
}