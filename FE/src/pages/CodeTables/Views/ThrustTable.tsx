import React, { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/tailwindui/table';
import { Button } from '../../../components/tailwindui/button';
import { TrashIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';

interface ThrustData {
  id: number;
  name: string;
  infraType: string;
  yearStart: number;
  yearEnd: number;
  priority: number;
  thrustId: number;
}

const ThrustTable: React.FC = () => {
  const [sortDirection, setSortDirection] = useState<0 | 1 | null>(null);
  const [sortColumn, setSortColumn] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedInfraType, setSelectedInfraType] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  // Complete Thrust data
  const [thrusts] = useState<ThrustData[]>([
    { id: 1, name: 'Buildings and Other Structures - School Buildings', infraType: 'School Buildings', yearStart: 2016, yearEnd: 2017, priority: 850, thrustId: 1035 },
    { id: 2, name: 'Buildings and Other Structures - School Buildings - Construction / Repair / Rehabilitation / Improvement of Various Infrastructure including Local Projects', infraType: 'School Buildings', yearStart: 2018, yearEnd: 2021, priority: 840, thrustId: 1034 },
    { id: 3, name: 'Buildings and Other Structures - School Buildings - Local Infrastructure Program', infraType: 'School Buildings', yearStart: 2018, yearEnd: 2021, priority: 850, thrustId: 1035 },
    { id: 4, name: 'Construction and Maintenance of Bridges along National Roads - Construction of New Permanent Bridges', infraType: 'Bridges', yearStart: 2016, yearEnd: 2017, priority: 620, thrustId: 1037 },
    { id: 5, name: 'Construction and Maintenance of Bridges along National Roads - Construction of New Permanent Bridges', infraType: 'Roads', yearStart: 2016, yearEnd: 2017, priority: 620, thrustId: 1037 },
    { id: 6, name: 'Construction and Maintenance of Bridges along National Roads - Rehabilitation/ Major Repair of Permanent Bridges', infraType: 'Bridges', yearStart: 2016, yearEnd: 2017, priority: 570, thrustId: 1038 },
    { id: 7, name: 'Construction and Maintenance of Bridges along National Roads - Replacement of Bridges (Temporary to Permanent)', infraType: 'Bridges', yearStart: 2016, yearEnd: 2016, priority: 500, thrustId: 1039 },
    { id: 8, name: 'Construction and Maintenance of Bridges along National Roads - Replacement of Bridges from Temporary to Permanent', infraType: 'Bridges', yearStart: 2017, yearEnd: 2017, priority: 500, thrustId: 1039 },
    { id: 9, name: 'Construction and Maintenance of Bridges along National Roads - Replacement of Permanent Weak Bridges', infraType: 'Roads', yearStart: 2016, yearEnd: 2017, priority: 530, thrustId: 1040 },
    { id: 10, name: 'Construction and Maintenance of Bridges along National Roads - Replacement of Permanent Weak Bridges', infraType: 'Bridges', yearStart: 2016, yearEnd: 2017, priority: 530, thrustId: 1040 },
    { id: 11, name: 'Construction and Maintenance of Bridges along National Roads - Retrofitting/ Strengthening of Permanent Bridges', infraType: 'Road Slope Protection Strucutures', yearStart: 2016, yearEnd: 2017, priority: 550, thrustId: 1041 },
    { id: 12, name: 'Construction and Maintenance of Bridges along National Roads - Retrofitting/ Strengthening of Permanent Bridges', infraType: 'Bridges', yearStart: 2016, yearEnd: 2017, priority: 550, thrustId: 1041 },
    { id: 13, name: 'Construction and Maintenance of Bridges along National Roads - Widening of Permanent Bridges from 1 to 2 Lanes', infraType: 'Bridges', yearStart: 2016, yearEnd: 2017, priority: 590, thrustId: 1042 },
    { id: 14, name: 'Construction and Maintenance of Bridges along National Roads - Widening of Permanent Bridges to more than 2 Lanes', infraType: 'Bridges', yearStart: 2016, yearEnd: 2017, priority: 600, thrustId: 1043 },
    { id: 15, name: 'Construction and Maintenance of Bridges along National Roads - Widening of Permanent Bridges to more than 2 Lanes', infraType: 'Roads', yearStart: 2016, yearEnd: 2017, priority: 600, thrustId: 1043 },
    { id: 16, name: 'Construction of By-Pass and Diversion Roads', infraType: 'Bridges', yearStart: 2016, yearEnd: 2016, priority: 340, thrustId: 1081 },
    { id: 17, name: 'Construction/ Improvement of Access Roads leading to Airports, Seaports, and Declared Tourism Destinations - To Airports', infraType: 'Bridges', yearStart: 2016, yearEnd: 2017, priority: 670, thrustId: 1044 },
    { id: 18, name: 'Construction/ Improvement of Access Roads leading to Airports, Seaports, and Declared Tourism Destinations - To Seaports', infraType: 'Bridges', yearStart: 2016, yearEnd: 2017, priority: 690, thrustId: 1045 },
    { id: 19, name: 'Construction/ Improvement of Access Roads leading to Airports, Seaports, and Declared Tourism Destinations - to Airports', infraType: 'Roads', yearStart: 2016, yearEnd: 2017, priority: 670, thrustId: 1044 },
    { id: 20, name: 'Construction/ Improvement of Access Roads leading to Airports, Seaports, and Declared Tourism Destinations - to Declared Tourism Destinations', infraType: 'Roads', yearStart: 2016, yearEnd: 2017, priority: 710, thrustId: 1046 },
    { id: 21, name: 'Construction/ Improvement of Access Roads leading to Airports, Seaports, and Declared Tourism Destinations - to Declared Tourism Destinations', infraType: 'Bridges', yearStart: 2016, yearEnd: 2017, priority: 710, thrustId: 1046 },
    { id: 22, name: 'Construction/ Improvement of Access Roads leading to Airports, Seaports, and Declared Tourism Destinations - to Seaports', infraType: 'Roads', yearStart: 2016, yearEnd: 2017, priority: 690, thrustId: 1045 },
    { id: 23, name: 'Construction/ Maintenance of Flood Mitigation Structures and Drainage Systems', infraType: 'Bridges', yearStart: 2016, yearEnd: 0, priority: 640, thrustId: 1068 },
    { id: 24, name: 'Construction/ Maintenance of Flood Mitigation Structures and Drainage Systems', infraType: 'Flood Control Structures', yearStart: 2016, yearEnd: 0, priority: 640, thrustId: 1068 },
    { id: 25, name: 'Construction/ Maintenance of Flood Mitigation Structures and Drainage Systems', infraType: 'Waterway', yearStart: 2016, yearEnd: 0, priority: 640, thrustId: 1068 },
    { id: 26, name: 'Construction/ Rehabilitation of Flood Mitigation Facilities along Major River Basins and Principal Rivers', infraType: 'Flood Control Structures', yearStart: 2017, yearEnd: 2017, priority: 660, thrustId: 1069 },
    { id: 27, name: 'Construction/ Rehabilitation of Flood Mitigation Facilities within Major River Basins and Principal Rivers', infraType: 'Bridges', yearStart: 2018, yearEnd: 0, priority: 660, thrustId: 1069 },
    { id: 28, name: 'Construction/ Rehabilitation of Flood Mitigation Facilities within Major River Basins and Principal Rivers', infraType: 'Flood Control Structures', yearStart: 2018, yearEnd: 0, priority: 660, thrustId: 1069 },
    { id: 29, name: 'Construction/ Rehabilitation of Flood Mitigation Facilities within Major River Basins and Principal Rivers', infraType: 'Waterway', yearStart: 2018, yearEnd: 0, priority: 660, thrustId: 1069 },
    { id: 30, name: 'Construction/ Rehabilitation of Water Supply/ Septage and Sewerage/ Rain Water Collectors - Rain Water Collectors', infraType: 'Rain Water Collector', yearStart: 2018, yearEnd: 0, priority: 770, thrustId: 1056 },
    { id: 31, name: 'Construction/ Rehabilitation of Water Supply/ Septage and Sewerage/ Rain Water Collectors - Septage and Sewerage', infraType: 'Septage and Sewerage Plants', yearStart: 2018, yearEnd: 0, priority: 760, thrustId: 1055 },
    { id: 32, name: 'Construction/ Rehabilitation of Water Supply/ Septage and Sewerage/ Rain Water Collectors - Water Supply', infraType: 'Water Supply Systems', yearStart: 2018, yearEnd: 0, priority: 750, thrustId: 1054 },
    { id: 33, name: 'Construction/ Rehabilitation of Water Supply/ Septage and Sewerage/ Rainwater Collector System', infraType: 'Rain Water Collector', yearStart: 2016, yearEnd: 2017, priority: 750, thrustId: 1054 },
    { id: 34, name: 'Construction/ Rehabilitation of Water Supply/ Septage and Sewerage/ Rainwater Collector System - Rainwater Collector System', infraType: 'Rain Water Collector', yearStart: 2021, yearEnd: 0, priority: 790, thrustId: 1138 },
    { id: 35, name: 'Construction/ Rehabilitation of Water Supply/ Septage and Sewerage/ Rainwater Collector System - Septage and Sewerage', infraType: 'Septage and Sewerage Plants', yearStart: 2022, yearEnd: 0, priority: 780, thrustId: 1137 },
    { id: 36, name: 'Construction/ Rehabilitation of Water Supply/ Septage and Sewerage/ Rainwater Collector System - Water Supply', infraType: 'Water Supply Systems', yearStart: 2021, yearEnd: 0, priority: 250, thrustId: 1136 },
    { id: 37, name: 'Construction/Rehabilitation of Accessibility Facilities for Physically Challenged Persons', infraType: 'Accessibility Facility', yearStart: 2016, yearEnd: 0, priority: 800, thrustId: 1057 },
    { id: 38, name: 'Construction/Rehabilitation/Improvement of Facilities for Persons with Disabilities (PWD) and Elderlies/Senior Citizens, including Gender-Responsive Facilities', infraType: 'Accessibility Facility', yearStart: 2021, yearEnd: 0, priority: 820, thrustId: 1141 },
    { id: 39, name: 'Contingent Fund - Fund Subsidies for Contingencies - Other Infrastructure Assets', infraType: 'Roads', yearStart: 2016, yearEnd: 2022, priority: 9990, thrustId: 1158 },
    { id: 40, name: 'Convergence and Special Support Program - Construction/ Improvement of Access Roads leading to Airports', infraType: 'Roads', yearStart: 2018, yearEnd: 2022, priority: 720, thrustId: 1049 },
    { id: 41, name: 'Convergence and Special Support Program - Construction/ Improvement of Access Roads leading to Airports (Kalsada Tungo sa Paliparan, Riles at Daungan Program - KATUPARAN)', infraType: 'Roads', yearStart: 2022, yearEnd: 0, priority: 720, thrustId: 1049 },
    { id: 42, name: 'Convergence and Special Support Program - Construction/ Improvement of Access Roads leading to Airports (Kalsada Tungo sa Paliparan, Riles at Daungan Program - KATUPARAN)', infraType: 'Bridges', yearStart: 2022, yearEnd: 0, priority: 720, thrustId: 1049 },
    { id: 43, name: 'Convergence and Special Support Program - Construction/ Improvement of Access Roads leading to Declared Tourism Destinations', infraType: 'Bridges', yearStart: 2018, yearEnd: 2022, priority: 730, thrustId: 1050 },
    { id: 44, name: 'Convergence and Special Support Program - Construction/ Improvement of Access Roads leading to Declared Tourism Destinations', infraType: 'Roads', yearStart: 2018, yearEnd: 2022, priority: 730, thrustId: 1050 },
    { id: 45, name: 'Convergence and Special Support Program - Construction/ Improvement of Access Roads leading to Declared Tourism Destinations (Tourism Road Infrastructure Program - TRIP)', infraType: 'Roads', yearStart: 2022, yearEnd: 0, priority: 730, thrustId: 1050 },
    { id: 46, name: 'Convergence and Special Support Program - Construction/ Improvement of Access Roads leading to Declared Tourism Destinations (Tourism Road Infrastructure Program - TRIP)', infraType: 'Bridges', yearStart: 2022, yearEnd: 0, priority: 730, thrustId: 1050 },
    { id: 47, name: 'Convergence and Special Support Program - Construction/ Improvement of Access Roads leading to Railway Stations', infraType: 'Roads', yearStart: 2020, yearEnd: 2022, priority: 750, thrustId: 1053 },
    { id: 48, name: 'Convergence and Special Support Program - Construction/ Improvement of Access Roads leading to Railway Stations (Kalsada Tungo sa Paliparan, Riles at Daungan Program - KATUPARAN)', infraType: 'Roads', yearStart: 2022, yearEnd: 0, priority: 751, thrustId: 1131 },
    { id: 49, name: 'Convergence and Special Support Program - Construction/ Improvement of Access Roads leading to Railway Stations (Kalsada Tungo sa Paliparan, Riles at Daungan Program - KATUPARAN)', infraType: 'Bridges', yearStart: 2022, yearEnd: 0, priority: 751, thrustId: 1131 },
    { id: 50, name: 'Convergence and Special Support Program - Construction/ Improvement of Access Roads leading to Seaports', infraType: 'Roads', yearStart: 2018, yearEnd: 2022, priority: 700, thrustId: 1051 },
    { id: 51, name: 'Convergence and Special Support Program - Construction/ Improvement of Access Roads leading to Seaports (Kalsada Tungo sa Paliparan, Riles at Daungan Program - KATUPARAN)', infraType: 'Roads', yearStart: 2022, yearEnd: 0, priority: 700, thrustId: 1051 },
    { id: 52, name: 'Convergence and Special Support Program - Construction/ Improvement of Access Roads leading to Seaports (Kalsada Tungo sa Paliparan, Riles at Daungan Program - KATUPARAN)', infraType: 'Bridges', yearStart: 2022, yearEnd: 0, priority: 700, thrustId: 1051 },
    { id: 53, name: 'Convergence and Special Support Program - Construction/ Improvement of Access Roads leading to Trades, Industries and Economic Zones', infraType: 'Bridges', yearStart: 2018, yearEnd: 2022, priority: 740, thrustId: 1052 },
    { id: 54, name: 'Convergence and Special Support Program - Construction/ Improvement of Access Roads leading to Trades, Industries and Economic Zones', infraType: 'Roads', yearStart: 2018, yearEnd: 2022, priority: 740, thrustId: 1052 },
    { id: 55, name: 'Convergence and Special Support Program - Construction/ Improvement of Access Roads leading to Trades, Industries and Economic Zones (Roads Leveraging Linkages for Industry and Trade Infrastructure Program - ROLL-IT)', infraType: 'Roads', yearStart: 2022, yearEnd: 0, priority: 740, thrustId: 1052 },
    { id: 56, name: 'Convergence and Special Support Program - Construction/ Improvement of Access Roads leading to Trades, Industries and Economic Zones (Roads Leveraging Linkages for Industry and Trade Infrastructure Program - ROLL-IT)', infraType: 'Bridges', yearStart: 2022, yearEnd: 0, priority: 740, thrustId: 1052 },
    { id: 57, name: 'Convergence and Special Support Program - Construction/ Improvement of Various Infrastructure in support of National Security', infraType: 'Roads', yearStart: 2019, yearEnd: 2022, priority: 750, thrustId: 1053 },
    { id: 58, name: 'Convergence and Special Support Program - Construction/ Improvement of Various Infrastructure in support of National Security', infraType: 'Other Buildings', yearStart: 2019, yearEnd: 2022, priority: 750, thrustId: 1053 },
    { id: 59, name: 'Convergence and Special Support Program - Construction/Improvement of Various Infrastructures in Support of National Security (Tatag ng Imprastraktura para sa Kapayapaan at Seguridad Program - TIKAS)', infraType: 'Roads', yearStart: 2022, yearEnd: 0, priority: 750, thrustId: 1053 },
    { id: 60, name: 'Convergence and Special Support Program - Construction/Improvement of Various Infrastructures in Support of National Security (Tatag ng Imprastraktura para sa Kapayapaan at Seguridad Program - TIKAS)', infraType: 'Other Buildings', yearStart: 2022, yearEnd: 0, priority: 750, thrustId: 1053 },
    { id: 61, name: 'Convergence and Special Support Program - Construction/Improvement of Various Infrastructures in Support of National Security (Tatag ng Imprastraktura para sa Kapayapaan at Seguridad Program - TIKAS)', infraType: 'Multi Purpose Buildings', yearStart: 2022, yearEnd: 0, priority: 750, thrustId: 1053 },
    { id: 62, name: 'Convergence and Special Support Program - Improvement of Capacity of Provincial Bridges along Provincial Roads', infraType: 'Bridges', yearStart: 2020, yearEnd: 2022, priority: 750, thrustId: 1053 },
    { id: 63, name: 'Convergence and Special Support Program - Improvement of Capacity of Provincial Bridges along Provincial Roads (Provincial Bridges for Economic Development - PROBRED)', infraType: 'Bridges', yearStart: 2022, yearEnd: 0, priority: 753, thrustId: 1135 },
    { id: 64, name: 'Convergence and Special Support Program - Pasig River Ferry Convergence Program', infraType: 'Waterway', yearStart: 2019, yearEnd: 0, priority: 820, thrustId: 1058 },
    { id: 65, name: 'DA Farm to Market Roads', infraType: 'Roads', yearStart: 2016, yearEnd: 0, priority: 1140, thrustId: 1059 },
    { id: 66, name: 'DA Farm to Market Roads', infraType: 'Bridges', yearStart: 2016, yearEnd: 0, priority: 1140, thrustId: 1059 },
    { id: 67, name: 'DOH Health Facility Enhancement Program', infraType: 'Hospitals', yearStart: 2016, yearEnd: 0, priority: 1180, thrustId: 1061 },
    { id: 68, name: 'DepEd School Buildings', infraType: 'School Buildings', yearStart: 2016, yearEnd: 0, priority: 1160, thrustId: 1060 },
    { id: 69, name: 'DepEd School Buildings', infraType: 'Flood Control Structures', yearStart: 2020, yearEnd: 2022, priority: 1160, thrustId: 1060 },
    { id: 70, name: 'Feasibility Study', infraType: 'Consultancy', yearStart: 2019, yearEnd: 0, priority: 9990, thrustId: 1001 },
    { id: 71, name: 'Flood Control and Drainage - Drainage/Protection Works', infraType: 'Flood Control Structures', yearStart: 2016, yearEnd: 2018, priority: 930, thrustId: 1062 },
    { id: 72, name: 'Flood Control and Drainage - Drainage/Protection Works', infraType: 'Waterway', yearStart: 2016, yearEnd: 0, priority: 930, thrustId: 1062 },
    { id: 73, name: 'Flood Control and Drainage - Flood Control Structures/Facilities', infraType: 'Flood Control Structures', yearStart: 2016, yearEnd: 0, priority: 900, thrustId: 1065 },
    { id: 74, name: 'Flood Control and Drainage - Flood Control Structures/Facilities', infraType: 'Waterway', yearStart: 2016, yearEnd: 0, priority: 900, thrustId: 1065 },
    { id: 75, name: 'Flood Control and Drainage - Drainage / Protection Works - Construction / Repair / Rehabilitation / Improvement of Various Infrastructure including Local Projects', infraType: 'Flood Control Structures', yearStart: 2018, yearEnd: 2021, priority: 940, thrustId: 1063 },
    { id: 76, name: 'Flood Control and Drainage - Drainage / Protection Works - Local Infrastructure Program', infraType: 'Flood Control Structures', yearStart: 2018, yearEnd: 2021, priority: 950, thrustId: 1064 },
    { id: 77, name: 'Flood Control and Drainage - Flood Control Structures / Facilities - Construction / Repair / Rehabilitation / Improvement of Various Infrastructure including Local Projects', infraType: 'Flood Control Structures', yearStart: 2018, yearEnd: 2021, priority: 910, thrustId: 1066 },
    { id: 78, name: 'Flood Control and Drainage - Flood Control Structures / Facilities - Local Infrastructure Program', infraType: 'Flood Control Structures', yearStart: 2018, yearEnd: 2021, priority: 920, thrustId: 1067 },
    { id: 79, name: 'Local Roads and Bridges - Local Bridges - Construction / Repair / Rehabilitation / Improvement of Various Infrastructure including Local Projects', infraType: 'Bridges', yearStart: 2018, yearEnd: 2021, priority: 1080, thrustId: 1070 },
    { id: 80, name: 'Local Roads and Bridges - Local Bridges - Construction / Repair / Rehabilitation / Improvement of Various Infrastructure including Local Projects', infraType: 'Roads', yearStart: 2018, yearEnd: 2021, priority: 1080, thrustId: 1070 },
    { id: 81, name: 'Local Roads and Bridges - Local Bridges - Local Infrastructure Program', infraType: 'Bridges', yearStart: 2018, yearEnd: 2021, priority: 1050, thrustId: 1073 },
    { id: 82, name: 'Local Roads and Bridges - Local Bridges - Local Infrastructure Program', infraType: 'Roads', yearStart: 2018, yearEnd: 2021, priority: 1050, thrustId: 1073 },
    { id: 83, name: 'Local Roads and Bridges - Local Roads - Construction / Repair / Rehabilitation / Improvement of Various Infrastructure including Local Projects', infraType: 'Roads', yearStart: 2018, yearEnd: 2021, priority: 1040, thrustId: 1072 },
    { id: 84, name: 'Local Roads and Bridges - Local Roads - Construction / Repair / Rehabilitation / Improvement of Various Infrastructure including Local Projects', infraType: 'Bridges', yearStart: 2018, yearEnd: 2021, priority: 1040, thrustId: 1072 },
    { id: 85, name: 'Local Roads and Bridges - Local Roads - Local Infrastructure Program', infraType: 'Roads', yearStart: 2018, yearEnd: 2021, priority: 1050, thrustId: 1073 },
    { id: 86, name: 'Local Roads and Bridges - Local Roads - Local Infrastructure Program', infraType: 'Flood Control Structures', yearStart: 2018, yearEnd: 2021, priority: 1050, thrustId: 1073 },
    { id: 87, name: 'Local Roads and Bridges - Local Roads - Local Infrastructure Program', infraType: 'Bridges', yearStart: 2018, yearEnd: 2021, priority: 1050, thrustId: 1073 },
    { id: 88, name: 'Maintenance, Repair and Rehabilitation of Infrastructure Facilities and Other Related Activities', infraType: 'Flood Control Structures', yearStart: 2018, yearEnd: 0, priority: 9990, thrustId: 1001 },
    { id: 89, name: 'Maintenance, Repair and Rehabilitation of Infrastructure Facilities and Other Related Activities', infraType: 'Multi Purpose Buildings', yearStart: 2018, yearEnd: 0, priority: 9990, thrustId: 1001 },
    { id: 90, name: 'Maintenance, Repair and Rehabilitation of Infrastructure Facilities and Other Related Activities', infraType: 'Consultancy', yearStart: 2019, yearEnd: 0, priority: 9990, thrustId: 1001 },
    { id: 91, name: 'National Roads and Bridges - National Bridges - Construction / Repair / Rehabilitation / Improvement of Various Infrastructure including Local Projects', infraType: 'Bridges', yearStart: 2018, yearEnd: 2021, priority: 1010, thrustId: 1074 },
    { id: 92, name: 'National Roads and Bridges - National Bridges - Local Infrastructure Program', infraType: 'Bridges', yearStart: 2018, yearEnd: 2021, priority: 990, thrustId: 1077 },
    { id: 93, name: 'National Roads and Bridges - National Roads - Construction / Repair / Rehabilitation / Improvement of Various Infrastructure including Local Projects', infraType: 'Roads', yearStart: 2018, yearEnd: 2021, priority: 980, thrustId: 1076 },
    { id: 94, name: 'National Roads and Bridges - National Roads - Local Infrastructure Program', infraType: 'Roads', yearStart: 2018, yearEnd: 2021, priority: 990, thrustId: 1077 },
    { id: 95, name: 'National Roads and Bridges - National Roads- Public-Private Partnership Strategic Support Fund (including ROW and Subsidy)', infraType: 'Roads', yearStart: 2018, yearEnd: 0, priority: 970, thrustId: 1078 },
    { id: 96, name: 'Network Development - Construction of By-Pass and Diversion Roads', infraType: 'Roads', yearStart: 2018, yearEnd: 0, priority: 330, thrustId: 1080 },
    { id: 97, name: 'Network Development - Construction of By-Pass and Diversion Roads', infraType: 'Bridges', yearStart: 2018, yearEnd: 0, priority: 330, thrustId: 1080 },
    { id: 98, name: 'Network Development - Construction of By-Passes/ Diversion Rds including ROW', infraType: 'Bridges', yearStart: 2016, yearEnd: 2016, priority: 340, thrustId: 1081 },
    { id: 99, name: 'Network Development - Construction of By-Passes/ Diversion Rds including ROW', infraType: 'Roads', yearStart: 2016, yearEnd: 2016, priority: 340, thrustId: 1081 },
    { id: 100, name: 'Network Development - Construction of By-Passes/ Diversion Roads, including ROW', infraType: 'Flood Control Structures', yearStart: 2016, yearEnd: 2017, priority: 340, thrustId: 1081 },
    { id: 101, name: 'Network Development - Construction of By-Passes/ Diversion Roads, including ROW', infraType: 'Bridges', yearStart: 2016, yearEnd: 2017, priority: 340, thrustId: 1081 },
    { id: 102, name: 'Network Development - Construction of By-Passes/ Diversion Roads, including ROW', infraType: 'Roads', yearStart: 2016, yearEnd: 2017, priority: 340, thrustId: 1081 },
    { id: 103, name: 'Network Development - Construction of Flyovers/ Interchanges/ Underpasses', infraType: 'Roads', yearStart: 2016, yearEnd: 2017, priority: 380, thrustId: 1083 },
    { id: 104, name: 'Network Development - Construction of Flyovers/ Interchanges/ Underpasses', infraType: 'Bridges', yearStart: 2016, yearEnd: 2017, priority: 380, thrustId: 1083 },
    { id: 105, name: 'Network Development - Construction of Flyovers/ Interchanges/ Underpasses/ Long Span Bridges', infraType: 'Bridges', yearStart: 2018, yearEnd: 0, priority: 370, thrustId: 1084 },
    { id: 106, name: 'Network Development - Construction of Flyovers/ Interchanges/ Underpasses/ Long Span Bridges', infraType: 'Roads', yearStart: 2018, yearEnd: 0, priority: 370, thrustId: 1084 },
    { id: 107, name: 'Network Development - Construction of Missing Gaps connecting National Roads, including ROW', infraType: 'Roads', yearStart: 2016, yearEnd: 2017, priority: 360, thrustId: 1085 },
    { id: 108, name: 'Network Development - Construction of Missing Gaps connecting National Roads, including ROW', infraType: 'Bridges', yearStart: 2016, yearEnd: 2017, priority: 360, thrustId: 1085 },
    { id: 109, name: 'Network Development - Construction of Missing Links/ New Roads', infraType: 'Roads', yearStart: 2018, yearEnd: 0, priority: 350, thrustId: 1082 },
    { id: 110, name: 'Network Development - Construction of Missing Links/ New Roads', infraType: 'Bridges', yearStart: 2018, yearEnd: 0, priority: 350, thrustId: 1082 },
    { id: 111, name: 'Network Development - Improvement/Widening of National Roads - N1', infraType: 'Roads', yearStart: 2017, yearEnd: 2017, priority: 260, thrustId: 1086 },
    { id: 112, name: 'Network Development - Improvement/Widening of National Roads - Other Primary', infraType: 'Roads', yearStart: 2017, yearEnd: 2017, priority: 270, thrustId: 1127 },
    { id: 113, name: 'Network Development - Improvement/Widening of National Roads - Primary', infraType: 'Roads', yearStart: 2016, yearEnd: 0, priority: 260, thrustId: 1086 },
    { id: 114, name: 'Network Development - Improvement/Widening of National Roads - Secondary', infraType: 'Roads', yearStart: 2016, yearEnd: 2018, priority: 290, thrustId: 1087 },
    { id: 115, name: 'Network Development - Improvement/Widening of National Roads - Tertiary', infraType: 'Roads', yearStart: 2016, yearEnd: 2018, priority: 310, thrustId: 1088 },
    { id: 116, name: 'Network Development - Off-Carriageway Improvement - Primary Roads', infraType: 'Roads', yearStart: 2018, yearEnd: 0, priority: 420, thrustId: 1090 },
    { id: 117, name: 'Network Development - Off-Carriageway Improvement - Secondary Roads', infraType: 'Roads', yearStart: 2018, yearEnd: 0, priority: 430, thrustId: 1091 },
    { id: 118, name: 'Network Development - Off-Carriageway Improvement - Tertiary Roads', infraType: 'Roads', yearStart: 2018, yearEnd: 0, priority: 440, thrustId: 1092 },
    { id: 119, name: 'Network Development - Off-Carriageway Improvement including drainage', infraType: 'Roads', yearStart: 2016, yearEnd: 0, priority: 380, thrustId: 1089 },
    { id: 120, name: 'Network Development - Off-Carriageway Improvement including drainage - Primary', infraType: 'Roads', yearStart: 2017, yearEnd: 0, priority: 420, thrustId: 1090 },
    { id: 121, name: 'Network Development - Off-Carriageway Improvement including drainage - Secondary', infraType: 'Roads', yearStart: 2017, yearEnd: 0, priority: 430, thrustId: 1091 },
    { id: 122, name: 'Network Development - Off-Carriageway Improvement including drainage - Tertiary', infraType: 'Roads', yearStart: 2017, yearEnd: 0, priority: 440, thrustId: 1092 },
    { id: 123, name: 'Network Development - Paving of Unpaved Roads - Primary Roads', infraType: 'Roads', yearStart: 2018, yearEnd: 0, priority: 470, thrustId: 1093 },
    { id: 124, name: 'Network Development - Paving of Unpaved Roads - Secondary Roads', infraType: 'Roads', yearStart: 2018, yearEnd: 0, priority: 480, thrustId: 1094 },
    { id: 125, name: 'Network Development - Paving of Unpaved Roads - Tertiary Roads', infraType: 'Roads', yearStart: 2018, yearEnd: 0, priority: 490, thrustId: 1095 },
    { id: 126, name: 'Network Development - Road Upgrading (unpaved to paved) - Secondary', infraType: 'Roads', yearStart: 2017, yearEnd: 2017, priority: 9990, thrustId: 1096 },
    { id: 127, name: 'Network Development - Road Upgrading (unpaved to paved) - Tertiary', infraType: 'Roads', yearStart: 2017, yearEnd: 2017, priority: 9990, thrustId: 1097 },
    { id: 128, name: 'Network Development - Road Widening - Primary Roads', infraType: 'Roads', yearStart: 2018, yearEnd: 0, priority: 280, thrustId: 1098 },
    { id: 129, name: 'Network Development - Road Widening - Secondary Roads', infraType: 'Roads', yearStart: 2018, yearEnd: 0, priority: 300, thrustId: 1099 },
    { id: 130, name: 'Network Development - Road Widening - Tertiary Roads', infraType: 'Roads', yearStart: 2018, yearEnd: 0, priority: 320, thrustId: 1100 },
    { id: 131, name: 'Other Infrastructure Assets', infraType: 'Flood Control Structures', yearStart: 2018, yearEnd: 2018, priority: 9990, thrustId: 1001 },
    { id: 132, name: 'Other Infrastructure Assets', infraType: 'Accessibility Facility', yearStart: 2018, yearEnd: 2018, priority: 9990, thrustId: 1001 },
    { id: 133, name: 'Other Infrastructure Assets', infraType: 'Multi Purpose Buildings', yearStart: 2018, yearEnd: 2022, priority: 9990, thrustId: 1001 },
    { id: 134, name: 'PAGCOR School Buildings', infraType: 'School Buildings', yearStart: 2016, yearEnd: 2016, priority: 1170, thrustId: 1101 },
    { id: 135, name: 'Preliminary and Detailed Engineering', infraType: 'Consultancy', yearStart: 2019, yearEnd: 0, priority: 9990, thrustId: 1001 },
    { id: 136, name: 'Preparation of Masterplans', infraType: 'Consultancy', yearStart: 2019, yearEnd: 0, priority: 9990, thrustId: 1001 },
    { id: 137, name: 'Project Development', infraType: 'Consultancy', yearStart: 2019, yearEnd: 0, priority: 9990, thrustId: 1001 },
    { id: 138, name: 'Rehabilitation of Disaster-Related Infrastructure and Other Facilities', infraType: 'Roads', yearStart: 2019, yearEnd: 0, priority: 9990, thrustId: 1001 },
    { id: 139, name: 'Rehabilitation of Disaster-Related Infrastructure and Other Facilities', infraType: 'Flood Control Structures', yearStart: 2019, yearEnd: 0, priority: 9990, thrustId: 1001 },
    { id: 140, name: 'Rehabilitation of Disaster-Related Infrastructure and Other Facilities', infraType: 'Bridges', yearStart: 2019, yearEnd: 0, priority: 9990, thrustId: 1001 },
    { id: 141, name: 'Rehabilitation of Disaster-Related Infrastructure and Other Facilities', infraType: 'School Buildings', yearStart: 2021, yearEnd: 2027, priority: 9990, thrustId: 1001 },
    { id: 142, name: 'Repair/Rehabilitation and Construction of Farm - to - Market Roads in Designated Key Production Areas', infraType: 'Roads', yearStart: 2022, yearEnd: 2025, priority: 1140, thrustId: 1059 },
    { id: 143, name: 'Road Board Preventive Maintenance', infraType: 'Roads', yearStart: 2016, yearEnd: 0, priority: 113, thrustId: 1109 },
    { id: 144, name: 'Road Safety', infraType: 'Roads', yearStart: 2016, yearEnd: 0, priority: 1130, thrustId: 1108 },
    { id: 145, name: 'Road Upgrading (unpaved to paved) based on Gravel Road Strategies, Traffic Benchmark for Upgrading to Paved Road Standards (HDM-4 Project Analysis) - Secondary', infraType: 'Roads', yearStart: 2016, yearEnd: 2017, priority: 450, thrustId: 1102 },
    { id: 146, name: 'Road Upgrading (unpaved to paved) based on Gravel Road Strategies, Traffic Benchmark for Upgrading to Paved Road Standards (HDM-4 Project Analysis) - Tertiary', infraType: 'Roads', yearStart: 2016, yearEnd: 2017, priority: 460, thrustId: 1103 },
    { id: 147, name: 'Roads and Bridges - Local Bridges', infraType: 'Bridges', yearStart: 2016, yearEnd: 2017, priority: 1070, thrustId: 1104 },
    { id: 148, name: 'Roads and Bridges - Local Bridges', infraType: 'Roads', yearStart: 2016, yearEnd: 2017, priority: 1070, thrustId: 1104 },
    { id: 149, name: 'Roads and Bridges - Local Roads', infraType: 'Drainage Structures along Roads', yearStart: 2016, yearEnd: 2017, priority: 1030, thrustId: 1105 },
    { id: 150, name: 'Roads and Bridges - Local Roads', infraType: 'Roads', yearStart: 2016, yearEnd: 2017, priority: 1030, thrustId: 1105 },
    { id: 151, name: 'Roads and Bridges - Local Roads', infraType: 'Bridges', yearStart: 2016, yearEnd: 2017, priority: 1030, thrustId: 1105 },
    { id: 152, name: 'Roads and Bridges - Local Roads', infraType: 'Flood Control Structures', yearStart: 2016, yearEnd: 2017, priority: 1030, thrustId: 1105 },
    { id: 153, name: 'Roads and Bridges - National Bridges', infraType: 'Roads', yearStart: 2016, yearEnd: 2017, priority: 1000, thrustId: 1106 },
    { id: 154, name: 'Roads and Bridges - National Bridges', infraType: 'Bridges', yearStart: 2016, yearEnd: 2017, priority: 1000, thrustId: 1106 },
    { id: 155, name: 'Roads and Bridges - National Roads', infraType: 'Roads', yearStart: 2016, yearEnd: 2017, priority: 960, thrustId: 1107 },
    { id: 156, name: 'SRA Farm to Mill Bridges', infraType: 'Bridges', yearStart: 2019, yearEnd: 0, priority: 1150, thrustId: 1110 },
    { id: 157, name: 'SRA Farm to Mill Roads', infraType: 'Roads', yearStart: 2016, yearEnd: 0, priority: 1150, thrustId: 1110 },
    { id: 158, name: 'South East Asean Games and Para Games Related Infrastructure', infraType: 'Other Buildings', yearStart: 2018, yearEnd: 2020, priority: 9990, thrustId: 1001 },
    { id: 159, name: 'Special Road Fund - Motor Vehicle Users Charge (MVUC) as per R.A. 11239', infraType: 'Roads', yearStart: 2021, yearEnd: 0, priority: 830, thrustId: 1142 },
    { id: 160, name: 'Special Road Fund - Motor Vehicle Users Charge (MVUC) as per R.A. 11239', infraType: 'Water Supply Systems', yearStart: 2021, yearEnd: 0, priority: 830, thrustId: 1142 },
    { id: 161, name: 'Sustainable Infrastructure Projects Alleviating Gaps (SIPAG) - Access Roads and/or Bridges from the National Road/s leading to Major/ Strategic Public Buildings/ Facilities', infraType: 'Roads', yearStart: 2022, yearEnd: 0, priority: 840, thrustId: 1143 },
    { id: 162, name: 'Sustainable Infrastructure Projects Alleviating Gaps (SIPAG) - Access Roads and/or Bridges from the National Road/s leading to Major/ Strategic Public Buildings/ Facilities', infraType: 'Bridges', yearStart: 2022, yearEnd: 0, priority: 840, thrustId: 1143 },
    { id: 163, name: 'Sustainable Infrastructure Projects Alleviating Gaps (SIPAG) - Access Roads and/or Bridges from the National Roads connecting to Indigenous People (IP) Communities', infraType: 'Roads', yearStart: 2022, yearEnd: 0, priority: 850, thrustId: 1144 },
    { id: 164, name: 'Sustainable Infrastructure Projects Alleviating Gaps (SIPAG) - Access Roads and/or Bridges from the National Roads connecting to Indigenous People (IP) Communities', infraType: 'Bridges', yearStart: 2022, yearEnd: 0, priority: 850, thrustId: 1144 },
    { id: 165, name: 'Sustainable Infrastructure Projects Alleviating Gaps (SIPAG) - Coastal Roads/Causeway for environmental protection/conservation', infraType: 'Roads', yearStart: 2022, yearEnd: 0, priority: 870, thrustId: 1146 },
    { id: 166, name: 'Sustainable Infrastructure Projects Alleviating Gaps (SIPAG) - Flood Mitigation Structures protecting Major/ Strategic Public Buildings/ Facilities', infraType: 'Flood Control Structures', yearStart: 2024, yearEnd: 0, priority: 880, thrustId: 1169 },
    { id: 167, name: 'Sustainable Infrastructure Projects Alleviating Gaps (SIPAG) - Flood Mitigation Structures protecting Public Infrastructures/Facilities', infraType: 'Flood Control Structures', yearStart: 2022, yearEnd: 0, priority: 880, thrustId: 1147 },
    { id: 168, name: 'Sustainable Infrastructure Projects Alleviating Gaps (SIPAG) - Flood Mitigation Structures protecting Public Infrastructures/Facilities', infraType: 'Waterway', yearStart: 2022, yearEnd: 0, priority: 880, thrustId: 1147 },
    { id: 169, name: 'Sustainable Infrastructure Projects Alleviating Gaps (SIPAG) - Interjurisdictional Roads and/or Bridges (or, roads that traverse multiple LGU jurisdictions)', infraType: 'Roads', yearStart: 2022, yearEnd: 0, priority: 860, thrustId: 1145 },
    { id: 170, name: 'Sustainable Infrastructure Projects Alleviating Gaps (SIPAG) - Interjurisdictional Roads and/or Bridges (or, roads that traverse multiple LGU jurisdictions)', infraType: 'Bridges', yearStart: 2022, yearEnd: 0, priority: 860, thrustId: 1145 },
    { id: 171, name: 'Sustainable Infrastructure Projects Alleviating Gaps (SIPAG) - Major/Strategic Public Buildings/Facilities Structural and Resilience Program', infraType: 'Multi Purpose Buidlings', yearStart: 2024, yearEnd: 0, priority: 880, thrustId: 1067 },
    { id: 172, name: 'Sustainable Infrastructure Projects Alleviating Gaps (SIPAG) - Multi-Purpose Buildings/ Facilities to support Social Services', infraType: 'Multi Purpose Buildings', yearStart: 2022, yearEnd: 0, priority: 890, thrustId: 1148 },
    { id: 173, name: 'Various Completed Projects', infraType: 'Roads', yearStart: 2018, yearEnd: 2018, priority: 9990, thrustId: 1001 },
    { id: 174, name: 'Water Management - Water Supply', infraType: 'Water Supply Systems', yearStart: 2017, yearEnd: 2017, priority: 1100, thrustId: 1111 },
    { id: 175, name: 'Water Management Facilities - Water Supply - Construction / Repair / Rehabilitation / Improvement of Various Infrastructure including Local Projects', infraType: 'Water Supply Systems', yearStart: 2018, yearEnd: 2021, priority: 1110, thrustId: 1112 },
    { id: 176, name: 'Water Management Facilities - Water Supply - Local Infrastructure Program', infraType: 'Water Supply Systems', yearStart: 2018, yearEnd: 2021, priority: 1120, thrustId: 1113 }
  ]);

  // Get unique infrastructure types for filter dropdown
  const uniqueInfraTypes = [...new Set(thrusts.map(item => item.infraType))];

  // Filter data based on search and filters
  const filteredThrusts = thrusts.filter(thrust => {
    const matchesSearch = searchTerm === '' || 
      thrust.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      thrust.infraType.toLowerCase().includes(searchTerm.toLowerCase()) ||
      thrust.thrustId.toString().includes(searchTerm);
    
    const matchesInfraType = selectedInfraType === '' || thrust.infraType === selectedInfraType;
    
    return matchesSearch && matchesInfraType;
  });

  // Calculate pagination
  const totalPages = Math.ceil(filteredThrusts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentData = filteredThrusts.slice(startIndex, endIndex);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedInfraType]);

  const handleSort = (columnIndex: number, direction: 0 | 1) => {
    setSortColumn(columnIndex);
    setSortDirection(direction);
    console.log(`Sorting column ${columnIndex} in direction ${direction}`);
  };

  const getYearRange = (yearStart: number, yearEnd: number) => {
    if (yearEnd === 0) return `${yearStart} - Ongoing`;
    if (yearStart === yearEnd) return yearStart.toString();
    return `${yearStart} - ${yearEnd}`;
  };

  return (
    <div className="space-y-6">
      {/* Header with search and filters */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-gray-900">Thrust Management</h2>
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative">
            <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search thrusts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Infrastructure Type Filter */}
          <select
            value={selectedInfraType}
            onChange={(e) => setSelectedInfraType(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Infrastructure Types</option>
            {uniqueInfraTypes.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>

          <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm">
            Add New Thrust
          </button>
        </div>
      </div>

      <Table className="w-full">
        <TableHead>
          <TableRow>
            <TableHeader 
              sortable 
              sortDirection={sortColumn === 0 ? sortDirection : null} 
              onSort={(direction) => handleSort(0, direction)}
              className="text-gray-500"
            >
              ID
            </TableHeader>
            <TableHeader 
              sortable 
              sortDirection={sortColumn === 1 ? sortDirection : null} 
              onSort={(direction) => handleSort(1, direction)}
              className="text-gray-500"
            >
              Thrust Name
            </TableHeader>
            <TableHeader 
              sortable 
              sortDirection={sortColumn === 2 ? sortDirection : null} 
              onSort={(direction) => handleSort(2, direction)}
              className="text-gray-500"
            >
              Infrastructure Type
            </TableHeader>
            <TableHeader 
              sortable 
              sortDirection={sortColumn === 3 ? sortDirection : null} 
              onSort={(direction) => handleSort(3, direction)}
              className="text-gray-500"
            >
              Year Range
            </TableHeader>
            <TableHeader 
              sortable 
              sortDirection={sortColumn === 4 ? sortDirection : null} 
              onSort={(direction) => handleSort(4, direction)}
              className="text-gray-500"
            >
              Thrust ID
            </TableHeader>
            <TableHeader className="text-gray-500">Actions</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {currentData.map((thrust, index) => (
            <TableRow key={thrust.id} className={`hover:bg-gray-50 ${
              index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
            }`}>
              <TableCell className="font-medium text-gray-900">
                {thrust.id}
              </TableCell>
              <TableCell className="text-gray-900 max-w-xs">
                <div className="truncate" title={thrust.name}>
                  {thrust.name}
                </div>
              </TableCell>
              <TableCell className="text-gray-600">
                <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                  {thrust.infraType}
                </span>
              </TableCell>
              <TableCell className="text-gray-600">
                {getYearRange(thrust.yearStart, thrust.yearEnd)}
              </TableCell>
              <TableCell className="text-gray-600 font-mono">
                {thrust.thrustId}
              </TableCell>
              <TableCell>
                <div className="flex space-x-2">
                  <Button 
                      color="orange"
                      // onClick={() => handleViewDetails(program.ProgramId)}
                      className="text-xs px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded"
                  >
                      View
                  </Button>
                  <Button color="red" 
                      // onClick={() => {setIsDeleteProgramOpen(true); setSelectedProgram(program.ProgramId);}} 
                      className="text-xs px-3 py-1.5 bg-red-500 hover:bg-red-600 rounded">
                      <TrashIcon stroke='white' className="h-5 w-5 text-gray-900" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-500">
            Showing {startIndex + 1} to {Math.min(endIndex, filteredThrusts.length)} of {filteredThrusts.length} items
          </div>
          <div className="flex items-center space-x-1">
            <Button
              color="zinc"
              className="text-xs px-3 py-1"
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <span className="text-sm text-gray-500">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              color="zinc"
              className="text-xs px-3 py-1"
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* No data message */}
      {filteredThrusts.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No thrust data found matching your filters.
        </div>
      )}

    </div>
  );
};

export default ThrustTable;
