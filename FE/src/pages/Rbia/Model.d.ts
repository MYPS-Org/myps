// RBIA Model Definitions
export interface FutureRoad {
  roadId: string;
  name: string;
  classification: number;
}

export interface FutureRoadSection {
  roadId: string;
  sectionRoadId: string;
  length: number;
  engineeringDistrict: number;
}

export interface FutureBridge {
  roadId: string;
  sectionRoadId: string;
  name: string;
  from: number;
  length: number;
  carriageWay: number;
}