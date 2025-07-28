import type { InfraData, RoadSections, Bridge, FCS, OtherInfra } from '../Model.d';

// Mock data for Road Sections
const mockRoadSections: RoadSections[] = [
  {
    Id: 1,
    SectionId: "RS-001",
    NetworkStatus: 1,
    SectionLength: 15.8,
    RegionCode: "NCR",
    DeoCode: "NCR-01",
    RoadId: "EDSA-N01",
    CDOCode: "CDO-001",
    CDOName: "EDSA Northbound Section 1"
  },
  {
    Id: 2,
    SectionId: "RS-002",
    NetworkStatus: 1,
    SectionLength: 12.5,
    RegionCode: "NCR",
    DeoCode: "NCR-02",
    RoadId: "C5-E01",
    CDOCode: "CDO-002",
    CDOName: "C5 Eastbound Section"
  },
  {
    Id: 3,
    SectionId: "RS-003",
    NetworkStatus: 0,
    SectionLength: 8.3,
    RegionCode: "R03",
    DeoCode: "R03-01",
    RoadId: "NLEX-001",
    CDOCode: "CDO-003",
    CDOName: "North Luzon Expressway Section A"
  },
  {
    Id: 4,
    SectionId: "RS-004",
    NetworkStatus: 1,
    SectionLength: 22.1,
    RegionCode: "R04A",
    DeoCode: "R04A-01",
    RoadId: "SLEX-S01",
    CDOCode: "CDO-004",
    CDOName: "South Luzon Expressway Section 1"
  },
  {
    Id: 5,
    SectionId: "RS-005",
    NetworkStatus: 1,
    SectionLength: 6.7,
    RegionCode: "NCR",
    DeoCode: "NCR-03",
    RoadId: "SHAW-W01",
    CDOCode: "CDO-005",
    CDOName: "Shaw Boulevard West Section"
  },
  {
    Id: 6,
    SectionId: "RS-006",
    NetworkStatus: 0,
    SectionLength: 18.9,
    RegionCode: "R04A",
    DeoCode: "R04A-02",
    RoadId: "CALAX-001",
    CDOCode: "CDO-006",
    CDOName: "Cavite-Laguna Expressway Main"
  },
  {
    Id: 7,
    SectionId: "RS-007",
    NetworkStatus: 1,
    SectionLength: 11.2,
    RegionCode: "R07",
    DeoCode: "R07-01",
    RoadId: "CEB-N01",
    CDOCode: "CDO-007",
    CDOName: "Cebu North Road Section"
  },
  {
    Id: 8,
    SectionId: "RS-008",
    NetworkStatus: 1,
    SectionLength: 9.8,
    RegionCode: "R11",
    DeoCode: "R11-01",
    RoadId: "DAV-S01",
    CDOCode: "CDO-008",
    CDOName: "Davao South Coastal Road"
  }
];

// Mock data for Bridges
const mockBridges: Bridge[] = [
  {
    Id: 1,
    BridgeId: "BR-001",
    BridgeName: "Quezon Bridge",
    Location: "Manila, NCR",
    Length: 690.5,
    Width: 18.2,
    RegionCode: "NCR",
    DeoCode: "NCR-01"
  },
  {
    Id: 2,
    BridgeId: "BR-002",
    BridgeName: "Mactan-Mandaue Bridge",
    Location: "Cebu, R07",
    Length: 864.0,
    Width: 24.5,
    RegionCode: "R07",
    DeoCode: "R07-01"
  },
  {
    Id: 3,
    BridgeId: "BR-003",
    BridgeName: "San Juanico Bridge",
    Location: "Leyte-Samar, R08",
    Length: 2164.0,
    Width: 12.8,
    RegionCode: "R08",
    DeoCode: "R08-01"
  },
  {
    Id: 4,
    BridgeId: "BR-004",
    BridgeName: "Jones Bridge",
    Location: "Manila, NCR",
    Length: 180.3,
    Width: 22.0,
    RegionCode: "NCR",
    DeoCode: "NCR-01"
  },
  {
    Id: 5,
    BridgeId: "BR-005",
    BridgeName: "Magapit Bridge",
    Location: "Cagayan, R02",
    Length: 1369.0,
    Width: 15.5,
    RegionCode: "R02",
    DeoCode: "R02-01"
  },
  {
    Id: 6,
    BridgeId: "BR-006",
    BridgeName: "Candaba Viaduct",
    Location: "Pampanga, R03",
    Length: 5109.0,
    Width: 21.3,
    RegionCode: "R03",
    DeoCode: "R03-01"
  },
  {
    Id: 7,
    BridgeId: "BR-007",
    BridgeName: "Bangui Windmill Bridge",
    Location: "Ilocos Norte, R01",
    Length: 245.7,
    Width: 11.8,
    RegionCode: "R01",
    DeoCode: "R01-01"
  }
];

// Mock data for FCS (Flood Control Structures)
const mockFCS: FCS[] = [
  {
    Id: 1,
    FCSId: "FCS-001",
    FCSName: "Marikina River Flood Control",
    Location: "Marikina, NCR",
    Capacity: 2500.0,
    RegionCode: "NCR",
    DeoCode: "NCR-02"
  },
  {
    Id: 2,
    FCSId: "FCS-002",
    FCSName: "Pasig River Flood Control System",
    Location: "Manila, NCR",
    Capacity: 1800.5,
    RegionCode: "NCR",
    DeoCode: "NCR-01"
  },
  {
    Id: 3,
    FCSId: "FCS-003",
    FCSName: "Laguna de Bay Flood Management",
    Location: "Laguna, R04A",
    Capacity: 5200.0,
    RegionCode: "R04A",
    DeoCode: "R04A-01"
  },
  {
    Id: 4,
    FCSId: "FCS-004",
    FCSName: "Cagayan River Flood Control",
    Location: "Tuguegarao, R02",
    Capacity: 3100.8,
    RegionCode: "R02",
    DeoCode: "R02-01"
  },
  {
    Id: 5,
    FCSId: "FCS-005",
    FCSName: "Davao River Flood Control",
    Location: "Davao City, R11",
    Capacity: 1950.3,
    RegionCode: "R11",
    DeoCode: "R11-01"
  },
  {
    Id: 6,
    FCSId: "FCS-006",
    FCSName: "Iloilo River Flood Management",
    Location: "Iloilo City, R06",
    Capacity: 1425.7,
    RegionCode: "R06",
    DeoCode: "R06-01"
  },
  {
    Id: 7,
    FCSId: "FCS-007",
    FCSName: "Cebu River Flood Control",
    Location: "Cebu City, R07",
    Capacity: 1680.2,
    RegionCode: "R07",
    DeoCode: "R07-01"
  }
];

// Mock data for Other Infrastructure
const mockOtherInfra: OtherInfra[] = [
  {
    Id: 1,
    InfraId: "OI-001",
    InfraName: "NAIA Terminal 3 Access Road",
    InfraType: "Airport Infrastructure",
    Location: "Pasay, NCR",
    Description: "Main access road connecting NAIA Terminal 3 to the major highways",
    RegionCode: "NCR",
    DeoCode: "NCR-01"
  },
  {
    Id: 2,
    InfraId: "OI-002",
    InfraName: "Manila Port Area Expansion",
    InfraType: "Port Infrastructure",
    Location: "Manila, NCR",
    Description: "Port expansion project including new container yards and cargo handling facilities",
    RegionCode: "NCR",
    DeoCode: "NCR-01"
  },
  {
    Id: 3,
    InfraId: "OI-003",
    InfraName: "Cebu IT Park Connector",
    InfraType: "IT Infrastructure",
    Location: "Cebu City, R07",
    Description: "High-speed fiber optic network connecting major IT parks in Cebu",
    RegionCode: "R07",
    DeoCode: "R07-01"
  },
  {
    Id: 4,
    InfraId: "OI-004",
    InfraName: "Davao Coastal Road Seawall",
    InfraType: "Coastal Protection",
    Location: "Davao City, R11",
    Description: "Seawall protection system along Davao coastal road to prevent erosion",
    RegionCode: "R11",
    DeoCode: "R11-01"
  },
  {
    Id: 5,
    InfraId: "OI-005",
    InfraName: "Baguio Tunnel Ventilation System",
    InfraType: "Tunnel Infrastructure",
    Location: "Baguio, CAR",
    Description: "Advanced ventilation system for mountain tunnel safety and air quality",
    RegionCode: "CAR",
    DeoCode: "CAR-01"
  },
  {
    Id: 6,
    InfraId: "OI-006",
    InfraName: "Clark Airport Railway Station",
    InfraType: "Transportation Hub",
    Location: "Pampanga, R03",
    Description: "Railway station connecting Clark Airport to Metro Manila rail network",
    RegionCode: "R03",
    DeoCode: "R03-01"
  },
  {
    Id: 7,
    InfraId: "OI-007",
    InfraName: "Subic Bay Port Modernization",
    InfraType: "Port Infrastructure",
    Location: "Subic, R03",
    Description: "Port modernization including new cranes and automated cargo systems",
    RegionCode: "R03",
    DeoCode: "R03-02"
  },
  {
    Id: 8,
    InfraId: "OI-008",
    InfraName: "Boracay Waste Treatment Facility",
    InfraType: "Environmental Infrastructure",
    Location: "Aklan, R06",
    Description: "Advanced wastewater treatment facility for sustainable tourism development",
    RegionCode: "R06",
    DeoCode: "R06-01"
  },
  {
    Id: 9,
    InfraId: "OI-009",
    InfraName: "Palawan Solar Farm Access Road",
    InfraType: "Energy Infrastructure",
    Location: "Palawan, MIMAROPA",
    Description: "Access road and transmission lines for renewable energy solar farm project",
    RegionCode: "MIMAROPA",
    DeoCode: "MIMAROPA-01"
  },
  {
    Id: 10,
    InfraId: "OI-010",
    InfraName: "Zamboanga Port Security System",
    InfraType: "Security Infrastructure",
    Location: "Zamboanga, R09",
    Description: "Integrated security system with CCTV, access control, and monitoring facilities",
    RegionCode: "R09",
    DeoCode: "R09-01"
  }
];

// Combined mock data
export const mockInfraData: InfraData = {
  RoadSections: mockRoadSections,
  Bridges: mockBridges,
  FCS: mockFCS,
  OtherInfra: mockOtherInfra
};

// Export individual arrays for convenience
export {
  mockRoadSections,
  mockBridges,
  mockFCS,
  mockOtherInfra
};
