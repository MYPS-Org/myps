import React, { useState, useEffect } from 'react';
import { 
  Table, 
  TableHead, 
  TableBody, 
  TableRow, 
  TableCell, 
  TableHeader 
} from '../../../components/tailwindui/table';
import { Button } from '../../../components/tailwindui/button';
import { 
  PlusIcon, 
  MagnifyingGlassIcon,
  PencilIcon,
  TrashIcon
} from '@heroicons/react/24/outline';

interface TypeOfWork {
  id?: number;
  infraType: string;
  majorWorkCategory: string;
  typeOfWork: string;
  unitOfMeasure: string;
  dataType: 'Integer' | 'Real';
  minAmount: number | null;
  maxAmount: number | null;
}

// Complete Type of Work data
const SAMPLE_DATA: TypeOfWork[] = [
  {
    infraType: "Accessibility Facility",
    majorWorkCategory: "Construction",
    typeOfWork: "Construction of Accessibility Facility",
    unitOfMeasure: "Number of Units",
    dataType: "Integer",
    minAmount: 1,
    maxAmount: 40,
  },
  {
    infraType: "Accessibility Facility",
    majorWorkCategory: "Rehabilitation/Major Repair",
    typeOfWork: "Rehabilitation/Major Repair of Accessibility Facility",
    unitOfMeasure: "Number of Units",
    dataType: "Integer",
    minAmount: 1,
    maxAmount: 40,
  },
  {
    infraType: "Bridges",
    majorWorkCategory: "Construction",
    typeOfWork: "Completion of Bridge Construction",
    unitOfMeasure: "Number of Bridges",
    dataType: "Integer",
    minAmount: 1,
    maxAmount: 1,
  },
  {
    infraType: "Bridges",
    majorWorkCategory: "Construction",
    typeOfWork: "Construction of Bailey Bridge",
    unitOfMeasure: "Square meters",
    dataType: "Real",
    minAmount: null,
    maxAmount: 1000.0,
  },
  {
    infraType: "Bridges",
    majorWorkCategory: "Construction",
    typeOfWork: "Construction of Bridge",
    unitOfMeasure: "Square meters",
    dataType: "Real",
    minAmount: null,
    maxAmount: 13000.0,
  },
  {
    infraType: "Bridges",
    majorWorkCategory: "Construction",
    typeOfWork: "Construction of Bridge Approach",
    unitOfMeasure: "Lane Km",
    dataType: "Real",
    minAmount: null,
    maxAmount: 300,
  },
  {
    infraType: "Bridges",
    majorWorkCategory: "Construction",
    typeOfWork: "Construction of Concrete Bridge",
    unitOfMeasure: "Square meters",
    dataType: "Real",
    minAmount: null,
    maxAmount: 50000.0,
  },
  {
    infraType: "Bridges",
    majorWorkCategory: "Construction",
    typeOfWork: "Construction of Flood Mitigation Structure",
    unitOfMeasure: "Lineal meters",
    dataType: "Real",
    minAmount: null,
    maxAmount: 10000.0,
  },
  {
    infraType: "Bridges",
    majorWorkCategory: "Construction",
    typeOfWork: "Construction of Flyover",
    unitOfMeasure: "Square meters",
    dataType: "Real",
    minAmount: 1,
    maxAmount: 50000.0,
  },
  {
    infraType: "Bridges",
    majorWorkCategory: "Construction",
    typeOfWork: "Construction of Interchange",
    unitOfMeasure: "Square meters",
    dataType: "Real",
    minAmount: null,
    maxAmount: 50000.0,
  },
  {
    infraType: "Bridges",
    majorWorkCategory: "Construction",
    typeOfWork: "Construction of Steel Bridge",
    unitOfMeasure: "Square meters",
    dataType: "Real",
    minAmount: 1,
    maxAmount: 10000.0,
  },
  {
    infraType: "Bridges",
    majorWorkCategory: "Construction",
    typeOfWork: "Construction of Substructure",
    unitOfMeasure: "Number of Bridges",
    dataType: "Integer",
    minAmount: 1,
    maxAmount: 10,
  },
  {
    infraType: "Bridges",
    majorWorkCategory: "Construction",
    typeOfWork: "Construction of Superstructure",
    unitOfMeasure: "Number of Bridges",
    dataType: "Integer",
    minAmount: 1,
    maxAmount: 10,
  },
  {
    infraType: "Bridges",
    majorWorkCategory: "Construction",
    typeOfWork: "Construction of Viaduct",
    unitOfMeasure: "Square meters",
    dataType: "Real",
    minAmount: 1,
    maxAmount: null,
  },
  {
    infraType: "Bridges",
    majorWorkCategory: "Construction",
    typeOfWork: "ROW Acquisition",
    unitOfMeasure: "Square meters",
    dataType: "Real",
    minAmount: null,
    maxAmount: null,
  },
  {
    infraType: "Bridges",
    majorWorkCategory: "Rehabilitation/Major Repair",
    typeOfWork: "Rehabilitation / Major Repair of Bridge",
    unitOfMeasure: "Number of Bridges",
    dataType: "Integer",
    minAmount: 1,
    maxAmount: 1,
  },
  {
    infraType: "Bridges",
    majorWorkCategory: "Replacement",
    typeOfWork: "Replacement of Bridge",
    unitOfMeasure: "Square meters",
    dataType: "Real",
    minAmount: null,
    maxAmount: 15000.0,
  },
  {
    infraType: "Bridges",
    majorWorkCategory: "Retrofitting/Strengthening",
    typeOfWork: "Retrofitting / Strengthening of Bridge",
    unitOfMeasure: "Number of Bridges",
    dataType: "Integer",
    minAmount: 1,
    maxAmount: 1,
  },
  {
    infraType: "Bridges",
    majorWorkCategory: "Widening",
    typeOfWork: "Construction of Parallel Bridge",
    unitOfMeasure: "Square meters",
    dataType: "Real",
    minAmount: null,
    maxAmount: 35000.0,
  },
  {
    infraType: "Bridges",
    majorWorkCategory: "Widening",
    typeOfWork: "Widening of Bridge",
    unitOfMeasure: "Square meters",
    dataType: "Real",
    minAmount: null,
    maxAmount: 35000.0,
  },
  {
    infraType: "Consultancy",
    majorWorkCategory: "Consultancy",
    typeOfWork: "Business Case Study",
    unitOfMeasure: "Number of Units",
    dataType: "Integer",
    minAmount: 1,
    maxAmount: 1,
  },
  {
    infraType: "Consultancy",
    majorWorkCategory: "Consultancy",
    typeOfWork: "Convergence",
    unitOfMeasure: "Number of Units",
    dataType: "Integer",
    minAmount: 1,
    maxAmount: 1,
  },
  {
    infraType: "Consultancy",
    majorWorkCategory: "Consultancy",
    typeOfWork: "Detailed Architectural and Engineering Design",
    unitOfMeasure: "Number of Units",
    dataType: "Integer",
    minAmount: 1,
    maxAmount: 1,
  },
  {
    infraType: "Consultancy",
    majorWorkCategory: "Consultancy",
    typeOfWork: "Master Plan Preparation",
    unitOfMeasure: "Number of Units",
    dataType: "Integer",
    minAmount: 1,
    maxAmount: 1,
  },
  {
    infraType: "Consultancy",
    majorWorkCategory: "Consultancy",
    typeOfWork: "Parcellary Surveys",
    unitOfMeasure: "Number of Units",
    dataType: "Integer",
    minAmount: 1,
    maxAmount: 1,
  },
  {
    infraType: "Consultancy",
    majorWorkCategory: "Consultancy",
    typeOfWork: "Pavement Engineering",
    unitOfMeasure: "Number of Units",
    dataType: "Integer",
    minAmount: 1,
    maxAmount: 1,
  },
  {
    infraType: "Consultancy",
    majorWorkCategory: "Consultancy",
    typeOfWork: "Planning System and Policy Development",
    unitOfMeasure: "Number of Units",
    dataType: "Integer",
    minAmount: 1,
    maxAmount: 1,
  },
  {
    infraType: "Consultancy",
    majorWorkCategory: "Consultancy",
    typeOfWork: "Preliminary Engineering Design",
    unitOfMeasure: "Number of Units",
    dataType: "Integer",
    minAmount: 1,
    maxAmount: 1,
  },
  {
    infraType: "Consultancy",
    majorWorkCategory: "Consultancy",
    typeOfWork: "Project Development",
    unitOfMeasure: "Number of Units",
    dataType: "Integer",
    minAmount: 1,
    maxAmount: 1,
  },
  {
    infraType: "Consultancy",
    majorWorkCategory: "Consultancy",
    typeOfWork: "Quality Assurance",
    unitOfMeasure: "Number of Units",
    dataType: "Integer",
    minAmount: 1,
    maxAmount: 1,
  },
  {
    infraType: "Consultancy",
    majorWorkCategory: "Consultancy",
    typeOfWork: "Retrofitting",
    unitOfMeasure: "Number of Units",
    dataType: "Integer",
    minAmount: 1,
    maxAmount: 1,
  },
  {
    infraType: "Consultancy",
    majorWorkCategory: "Consultancy",
    typeOfWork: "Road Safety Engineering",
    unitOfMeasure: "Number of Units",
    dataType: "Integer",
    minAmount: 1,
    maxAmount: 1,
  },
  {
    infraType: "Consultancy",
    majorWorkCategory: "Consultancy",
    typeOfWork: "Soil Boring Explorations",
    unitOfMeasure: "Number of Units",
    dataType: "Integer",
    minAmount: 1,
    maxAmount: 1,
  },
  {
    infraType: "Consultancy",
    majorWorkCategory: "Consultancy",
    typeOfWork: "Structural Investigation, Analysis and/or Design",
    unitOfMeasure: "Number of Units",
    dataType: "Integer",
    minAmount: 1,
    maxAmount: 1,
  },
  {
    infraType: "Consultancy",
    majorWorkCategory: "Consultancy",
    typeOfWork: "Topographic Surveys",
    unitOfMeasure: "Number of Units",
    dataType: "Integer",
    minAmount: 1,
    maxAmount: 1,
  },
  {
    infraType: "Consultancy",
    majorWorkCategory: "Consultancy",
    typeOfWork: "Traffic Engineering",
    unitOfMeasure: "Number of Units",
    dataType: "Integer",
    minAmount: 1,
    maxAmount: 1,
  },
  {
    infraType: "Consultancy",
    majorWorkCategory: "Consultancy",
    typeOfWork: "Urban Planning",
    unitOfMeasure: "Number of Units",
    dataType: "Integer",
    minAmount: 1,
    maxAmount: 1,
  },
  {
    infraType: "Flood Control Structures",
    majorWorkCategory: "Construction",
    typeOfWork: "Construction of Cutoff Channel",
    unitOfMeasure: "Lineal meters",
    dataType: "Real",
    minAmount: null,
    maxAmount: 10000.0,
  },
  {
    infraType: "Flood Control Structures",
    majorWorkCategory: "Construction",
    typeOfWork: "Construction of Dike",
    unitOfMeasure: "Lineal meters",
    dataType: "Real",
    minAmount: null,
    maxAmount: 17000.0,
  },
  {
    infraType: "Flood Control Structures",
    majorWorkCategory: "Construction",
    typeOfWork: "Construction of Drainage Structure",
    unitOfMeasure: "Lineal meters",
    dataType: "Real",
    minAmount: null,
    maxAmount: 60000.0,
  },
  {
    infraType: "Flood Control Structures",
    majorWorkCategory: "Construction",
    typeOfWork: "Construction of Flood Gate / Sluice Gate",
    unitOfMeasure: "Lineal meters",
    dataType: "Real",
    minAmount: null,
    maxAmount: 10000.0,
  },
  {
    infraType: "Flood Control Structures",
    majorWorkCategory: "Construction",
    typeOfWork: "Construction of Flood Mitigation Facility",
    unitOfMeasure: "Number of Facilities",
    dataType: "Integer",
    minAmount: 1,
    maxAmount: 10,
  },
  {
    infraType: "Flood Control Structures",
    majorWorkCategory: "Construction",
    typeOfWork: "Construction of Flood Mitigation Structure",
    unitOfMeasure: "Lineal meters",
    dataType: "Real",
    minAmount: null,
    maxAmount: null,
  },
  {
    infraType: "Flood Control Structures",
    majorWorkCategory: "Construction",
    typeOfWork: "Construction of Groundsill",
    unitOfMeasure: "Lineal meters",
    dataType: "Real",
    minAmount: null,
    maxAmount: 20000.0,
  },
  {
    infraType: "Flood Control Structures",
    majorWorkCategory: "Construction",
    typeOfWork: "Construction of Retarding Basin",
    unitOfMeasure: "Square meters",
    dataType: "Real",
    minAmount: 100,
    maxAmount: null,
  },
  {
    infraType: "Flood Control Structures",
    majorWorkCategory: "Construction",
    typeOfWork: "Construction of Revetment",
    unitOfMeasure: "Lineal meters",
    dataType: "Real",
    minAmount: null,
    maxAmount: 25000.0,
  },
  {
    infraType: "Flood Control Structures",
    majorWorkCategory: "Construction",
    typeOfWork: "Construction of Sabo Dam",
    unitOfMeasure: "Lineal meters",
    dataType: "Real",
    minAmount: null,
    maxAmount: 10000.0,
  },
  {
    infraType: "Flood Control Structures",
    majorWorkCategory: "Construction",
    typeOfWork: "Construction of Slope Protection Structure",
    unitOfMeasure: "Square meters",
    dataType: "Real",
    minAmount: null,
    maxAmount: null,
  },
  {
    infraType: "Flood Control Structures",
    majorWorkCategory: "Construction",
    typeOfWork: "Construction of Spur Dike",
    unitOfMeasure: "Lineal meters",
    dataType: "Real",
    minAmount: null,
    maxAmount: 10000.0,
  },
  {
    infraType: "Flood Control Structures",
    majorWorkCategory: "Construction",
    typeOfWork: "Construction of Waterway",
    unitOfMeasure: "Lineal meters",
    dataType: "Real",
    minAmount: null,
    maxAmount: 10000.0,
  },
  {
    infraType: "Flood Control Structures",
    majorWorkCategory: "Construction",
    typeOfWork: "Embankment",
    unitOfMeasure: "Cubic meters",
    dataType: "Real",
    minAmount: null,
    maxAmount: null,
  },
  {
    infraType: "Flood Control Structures",
    majorWorkCategory: "Construction",
    typeOfWork: "ROW Acquisition",
    unitOfMeasure: "Square meters",
    dataType: "Real",
    minAmount: null,
    maxAmount: null,
  },
  {
    infraType: "Flood Control Structures",
    majorWorkCategory: "Rehabilitation/Major Repair",
    typeOfWork: "Rehabilitation / Major Repair of Drainage Structure",
    unitOfMeasure: "Lineal meters",
    dataType: "Real",
    minAmount: null,
    maxAmount: 50000.0,
  },
  {
    infraType: "Flood Control Structures",
    majorWorkCategory: "Rehabilitation/Major Repair",
    typeOfWork: "Rehabilitation / Major Repair of Flood Control Structure",
    unitOfMeasure: "Lineal meters",
    dataType: "Real",
    minAmount: 1,
    maxAmount: 10000.0,
  },
  {
    infraType: "Flood Control Structures",
    majorWorkCategory: "Rehabilitation/Major Repair",
    typeOfWork: "Rehabilitation / Major Repair of Flood Mitigation Facility",
    unitOfMeasure: "Number of Facilities",
    dataType: "Real",
    minAmount: null,
    maxAmount: 50,
  },
  {
    infraType: "Flood Control Structures",
    majorWorkCategory: "Rehabilitation/Major Repair",
    typeOfWork: "Rehabilitation / Major Repair of Slope Protection Structure",
    unitOfMeasure: "Square meters",
    dataType: "Real",
    minAmount: null,
    maxAmount: 50000.0,
  },
  {
    infraType: "Flood Control Structures",
    majorWorkCategory: "Repair/Maintenance",
    typeOfWork: "Repair/Maintenance of Flood Control Structures",
    unitOfMeasure: "Lineal meters",
    dataType: "Integer",
    minAmount: null,
    maxAmount: 10000,
  },
  {
    infraType: "Flood Control Structures",
    majorWorkCategory: "Upgrading",
    typeOfWork: "Upgrading of Drainage Structure",
    unitOfMeasure: "Lineal meters",
    dataType: "Real",
    minAmount: null,
    maxAmount: 10000.0,
  },
  {
    infraType: "Hospitals",
    majorWorkCategory: "Construction",
    typeOfWork: "Construction of Barangay Health Station",
    unitOfMeasure: "Number of Units",
    dataType: "Integer",
    minAmount: 1,
    maxAmount: 1,
  },
  {
    infraType: "Hospitals",
    majorWorkCategory: "Construction",
    typeOfWork: "Construction of Hospital",
    unitOfMeasure: "Number of Hospitals",
    dataType: "Integer",
    minAmount: 1,
    maxAmount: 1,
  },
  {
    infraType: "Hospitals",
    majorWorkCategory: "Construction",
    typeOfWork: "Construction of Rural Health Unit",
    unitOfMeasure: "Number of Units",
    dataType: "Integer",
    minAmount: 1,
    maxAmount: 1,
  },
  {
    infraType: "Hospitals",
    majorWorkCategory: "Rehabilitation/Major Repair",
    typeOfWork: "Rehabilitation / Major Repair of Barangay Health Station",
    unitOfMeasure: "Number of Units",
    dataType: "Integer",
    minAmount: 1,
    maxAmount: 1,
  },
  {
    infraType: "Hospitals",
    majorWorkCategory: "Rehabilitation/Major Repair",
    typeOfWork: "Rehabilitation / Major Repair of Hospital",
    unitOfMeasure: "Number of Hospitals",
    dataType: "Integer",
    minAmount: 1,
    maxAmount: 1,
  },
  {
    infraType: "Hospitals",
    majorWorkCategory: "Rehabilitation/Major Repair",
    typeOfWork: "Rehabilitation / Major Repair of Rural Health Unit",
    unitOfMeasure: "Number of Units",
    dataType: "Integer",
    minAmount: 1,
    maxAmount: 1,
  },
  {
    infraType: "Multi Purpose Buildings",
    majorWorkCategory: "Construction",
    typeOfWork: "Construction of Evacuation Center",
    unitOfMeasure: "Number of Buildings",
    dataType: "Integer",
    minAmount: 1,
    maxAmount: 10,
  },
  {
    infraType: "Multi Purpose Buildings",
    majorWorkCategory: "Construction",
    typeOfWork: "Construction of Multi Purpose Building",
    unitOfMeasure: "Number of Buildings",
    dataType: "Integer",
    minAmount: 1,
    maxAmount: 100,
  },
  {
    infraType: "Multi Purpose Buildings",
    majorWorkCategory: "Construction",
    typeOfWork: "Construction of Other Building",
    unitOfMeasure: "Number of Buildings",
    dataType: "Integer",
    minAmount: 1,
    maxAmount: 100,
  },
  {
    infraType: "Multi Purpose Buildings",
    majorWorkCategory: "Construction",
    typeOfWork: "Construction of Other Facilities",
    unitOfMeasure: "Number of Facilities",
    dataType: "Real",
    minAmount: 1,
    maxAmount: 100,
  },
  {
    infraType: "Multi Purpose Buildings",
    majorWorkCategory: "Construction",
    typeOfWork: "ROW Acquisition",
    unitOfMeasure: "Square meters",
    dataType: "Real",
    minAmount: null,
    maxAmount: null,
  },
  {
    infraType: "Multi Purpose Buildings",
    majorWorkCategory: "Rehabilitation/Major Repair",
    typeOfWork: "Rehabilitation / Major Repair of Facilities",
    unitOfMeasure: "Number of Facilities",
    dataType: "Real",
    minAmount: 1,
    maxAmount: 20,
  },
  {
    infraType: "Multi Purpose Buildings",
    majorWorkCategory: "Rehabilitation/Major Repair",
    typeOfWork: "Rehabilitation / Major Repair of Multi Purpose Building",
    unitOfMeasure: "Number of Buildings",
    dataType: "Integer",
    minAmount: 1,
    maxAmount: 20,
  },
  {
    infraType: "Multi Purpose Buildings",
    majorWorkCategory: "Rehabilitation/Major Repair",
    typeOfWork: "Rehabilitation / Major Repair of Other Building",
    unitOfMeasure: "Number of Buildings",
    dataType: "Integer",
    minAmount: 1,
    maxAmount: 1,
  },
  {
    infraType: "Multi Purpose Buildings",
    majorWorkCategory: "Repair/Maintenance",
    typeOfWork: "Repair/Maintenance of Buildings",
    unitOfMeasure: "Number of Buildings",
    dataType: "Real",
    minAmount: 1,
    maxAmount: 10,
  },
  {
    infraType: "Multi Purpose Buildings",
    majorWorkCategory: "Retrofitting/Strengthening",
    typeOfWork: "Retrofitting / Strengthening of Building",
    unitOfMeasure: "Number of Buildings",
    dataType: "Integer",
    minAmount: 1,
    maxAmount: 10,
  },
  {
    infraType: "Non-Infra",
    majorWorkCategory: "Consultancy",
    typeOfWork: "Capacity Building and/or Development",
    unitOfMeasure: "Number of Units",
    dataType: "Integer",
    minAmount: 1,
    maxAmount: 1,
  },
  {
    infraType: "Non-Infra",
    majorWorkCategory: "Consultancy",
    typeOfWork: "ISO Certifications/Audit",
    unitOfMeasure: "Number of Units",
    dataType: "Integer",
    minAmount: 1,
    maxAmount: 1,
  },
  {
    infraType: "Non-Infra",
    majorWorkCategory: "Consultancy",
    typeOfWork: "Institutional Capacity Development",
    unitOfMeasure: "Number of Units",
    dataType: "Integer",
    minAmount: 1,
    maxAmount: 1,
  },
  {
    infraType: "Non-Infra",
    majorWorkCategory: "Consultancy",
    typeOfWork: "Perception Survey",
    unitOfMeasure: "Number of Units",
    dataType: "Integer",
    minAmount: 1,
    maxAmount: 1,
  },
  {
    infraType: "Other Buildings",
    majorWorkCategory: "Construction",
    typeOfWork: "Construction of Other Building",
    unitOfMeasure: "Number of Buildings",
    dataType: "Integer",
    minAmount: 1,
    maxAmount: 200,
  },
  {
    infraType: "Other Buildings",
    majorWorkCategory: "Construction",
    typeOfWork: "Construction of Other Facilities",
    unitOfMeasure: "Number of Facilities",
    dataType: "Integer",
    minAmount: 1,
    maxAmount: 200,
  },
  {
    infraType: "Other Buildings",
    majorWorkCategory: "Rehabilitation/Major Repair",
    typeOfWork: "Repair/Rehabilitation of Other Buildings",
    unitOfMeasure: "Number of Buildings",
    dataType: "Integer",
    minAmount: 1,
    maxAmount: 200,
  },
  {
    infraType: "Other Buildings",
    majorWorkCategory: "Retrofitting/Strengthening",
    typeOfWork: "Retrofitting / Strengthening of Other Building",
    unitOfMeasure: "Number of Buildings",
    dataType: "Integer",
    minAmount: 1,
    maxAmount: 10,
  },
  {
    infraType: "Rain Water Collector",
    majorWorkCategory: "Construction",
    typeOfWork: "Construction of Rain Water Collector",
    unitOfMeasure: "Number of Units",
    dataType: "Integer",
    minAmount: 1,
    maxAmount: 40,
  },
  {
    infraType: "Roads",
    majorWorkCategory: "Construction",
    typeOfWork: "Construction of Asphalt Road",
    unitOfMeasure: "Lane Km",
    dataType: "Real",
    minAmount: null,
    maxAmount: 50,
  },
  {
    infraType: "Roads",
    majorWorkCategory: "Construction",
    typeOfWork: "Construction of Concrete Barrier",
    unitOfMeasure: "Lineal meters",
    dataType: "Integer",
    minAmount: null,
    maxAmount: 50000,
  },
  {
    infraType: "Roads",
    majorWorkCategory: "Construction",
    typeOfWork: "Construction of Concrete Road",
    unitOfMeasure: "Lane Km",
    dataType: "Real",
    minAmount: null,
    maxAmount: 40000.0,
  },
  {
    infraType: "Roads",
    majorWorkCategory: "Construction",
    typeOfWork: "Construction of Drainage Structure along Road",
    unitOfMeasure: "Lineal meters",
    dataType: "Real",
    minAmount: null,
    maxAmount: null,
  },
  {
    infraType: "Roads",
    majorWorkCategory: "Construction",
    typeOfWork: "Construction of Flyover",
    unitOfMeasure: "Lane Km",
    dataType: "Real",
    minAmount: null,
    maxAmount: 100,
  },
  {
    infraType: "Roads",
    majorWorkCategory: "Construction",
    typeOfWork: "Construction of Gravel Road",
    unitOfMeasure: "Lane Km",
    dataType: "Real",
    minAmount: null,
    maxAmount: 70,
  },
  {
    infraType: "Roads",
    majorWorkCategory: "Construction",
    typeOfWork: "Construction of Other Facilities",
    unitOfMeasure: "Number of Facilities",
    dataType: "Integer",
    minAmount: 1,
    maxAmount: 200,
  },
  {
    infraType: "Roads",
    majorWorkCategory: "Construction",
    typeOfWork: "Construction of Road Slope Protection Structure",
    unitOfMeasure: "Square meters",
    dataType: "Real",
    minAmount: null,
    maxAmount: null,
  },
  {
    infraType: "Roads",
    majorWorkCategory: "Construction",
    typeOfWork: "Construction of Tunnel",
    unitOfMeasure: "Lane Km",
    dataType: "Real",
    minAmount: null,
    maxAmount: 30,
  },
  {
    infraType: "Roads",
    majorWorkCategory: "Construction",
    typeOfWork: "Construction of Underpass",
    unitOfMeasure: "Square meters",
    dataType: "Real",
    minAmount: null,
    maxAmount: 32000.0,
  },
  {
    infraType: "Roads",
    majorWorkCategory: "Construction",
    typeOfWork: "Embankment",
    unitOfMeasure: "Cubic meters",
    dataType: "Real",
    minAmount: null,
    maxAmount: null,
  },
  {
    infraType: "Roads",
    majorWorkCategory: "Off Carriageway Improvement",
    typeOfWork: "Off-Carriageway Improvement: Construction of Sidewalk",
    unitOfMeasure: "Square meters",
    dataType: "Real",
    minAmount: null,
    maxAmount: null,
  },
  {
    infraType: "Roads",
    majorWorkCategory: "Off Carriageway Improvement",
    typeOfWork: "Off-Carriageway Improvement: Construction of Traffic Island",
    unitOfMeasure: "Square meters",
    dataType: "Real",
    minAmount: null,
    maxAmount: null,
  },
  {
    infraType: "Roads",
    majorWorkCategory: "Off Carriageway Improvement",
    typeOfWork: "Off-Carriageway Improvement: Paving of Shoulders",
    unitOfMeasure: "Square meters",
    dataType: "Real",
    minAmount: null,
    maxAmount: null,
  },
  {
    infraType: "Roads",
    majorWorkCategory: "Off-Carriageway Improvement",
    typeOfWork: "Off-Carriageway Improvement: Construction of Bike Lanes",
    unitOfMeasure: "Square meters",
    dataType: "Real",
    minAmount: 1,
    maxAmount: 82000.0,
  },
  {
    infraType: "Roads",
    majorWorkCategory: "Off-Carriageway Improvement",
    typeOfWork: "Off-Carriageway Improvement: Construction of Bike lanes",
    unitOfMeasure: "Number of Projects",
    dataType: "Integer",
    minAmount: 1,
    maxAmount: 20,
  },
  {
    infraType: "Roads",
    majorWorkCategory: "Off-Carriageway Improvement",
    typeOfWork: "Off-Carriageway Improvement: Construction of Laybys",
    unitOfMeasure: "Number of Laybys",
    dataType: "Integer",
    minAmount: 1,
    maxAmount: 20,
  },
  {
    infraType: "Roads",
    majorWorkCategory: "Off-Carriageway Improvement",
    typeOfWork: "Off-Carriageway Improvement: Construction of Loading and Unloading Bays",
    unitOfMeasure: "Number of Loading and Unloading Bays",
    dataType: "Integer",
    minAmount: 1,
    maxAmount: 20,
  },
  {
    infraType: "Roads",
    majorWorkCategory: "Off-Carriageway Improvement",
    typeOfWork: "Off-Carriageway Improvement: Construction of Median/Center Island",
    unitOfMeasure: "Square meters",
    dataType: "Real",
    minAmount: 1,
    maxAmount: null,
  },
  {
    infraType: "Roads",
    majorWorkCategory: "Off-Carriageway Improvement",
    typeOfWork: "Off-Carriageway Improvement: Construction of Turnouts",
    unitOfMeasure: "Number of Turnouts",
    dataType: "Integer",
    minAmount: 1,
    maxAmount: 20,
  },
  {
    infraType: "Roads",
    majorWorkCategory: "Off-Carriageway Improvement",
    typeOfWork: "Off-Carriageway Improvement: Flaring of Intersections",
    unitOfMeasure: "Number of Intersections",
    dataType: "Integer",
    minAmount: 1,
    maxAmount: 20,
  },
  {
    infraType: "Roads",
    majorWorkCategory: "Off-Carriageway Improvement",
    typeOfWork: "Off-Carriageway Improvement: Flaring of Intersections / Improvement of Intersections",
    unitOfMeasure: "Number of Intersections",
    dataType: "Integer",
    minAmount: 1,
    maxAmount: 20,
  },
  {
    infraType: "Roads",
    majorWorkCategory: "Off-Carriageway Improvement",
    typeOfWork: "Off-Carriageway Improvement: Loading Bays",
    unitOfMeasure: "Number of Loading Bays",
    dataType: "Integer",
    minAmount: 1,
    maxAmount: 20,
  },
  {
    infraType: "Roads",
    majorWorkCategory: "Off-Carriageway Improvement",
    typeOfWork: "Off-Carriageway Improvement: Shoulder Paving / Construction",
    unitOfMeasure: "Square meters",
    dataType: "Real",
    minAmount: null,
    maxAmount: null,
  },
  {
    infraType: "Roads",
    majorWorkCategory: "Preventive Maintenance",
    typeOfWork: "Preventive Maintenance of Road: Asphalt Overlay",
    unitOfMeasure: "Lane Km",
    dataType: "Real",
    minAmount: null,
    maxAmount: 250,
  },
  {
    infraType: "Roads",
    majorWorkCategory: "Preventive Maintenance",
    typeOfWork: "Preventive Maintenance of Road: Concrete Reblocking",
    unitOfMeasure: "Lane Km",
    dataType: "Real",
    minAmount: null,
    maxAmount: 1500.0,
  },
  {
    infraType: "Roads",
    majorWorkCategory: "Preventive Maintenance",
    typeOfWork: "Rehabilitation / Major Repair of Drainage Structure along Road",
    unitOfMeasure: "Lineal meters",
    dataType: "Real",
    minAmount: null,
    maxAmount: 10000.0,
  },
  {
    infraType: "Roads",
    majorWorkCategory: "ROW Acquisition",
    typeOfWork: "ROW Acquisition",
    unitOfMeasure: "Square meters",
    dataType: "Real",
    minAmount: null,
    maxAmount: null,
  },
  {
    infraType: "Roads",
    majorWorkCategory: "Reconstruction",
    typeOfWork: "Reconstruction from Asphalt to Concrete",
    unitOfMeasure: "Lane Km",
    dataType: "Real",
    minAmount: null,
    maxAmount: 50,
  },
  {
    infraType: "Roads",
    majorWorkCategory: "Reconstruction",
    typeOfWork: "Reconstruction from Concrete to Concrete",
    unitOfMeasure: "Lane Km",
    dataType: "Real",
    minAmount: null,
    maxAmount: 50,
  },
  {
    infraType: "Roads",
    majorWorkCategory: "Reconstruction",
    typeOfWork: "Reconstruction from Paved to Concrete",
    unitOfMeasure: "Lane Km",
    dataType: "Real",
    minAmount: null,
    maxAmount: 50,
  },
  {
    infraType: "Roads",
    majorWorkCategory: "Reconstruction",
    typeOfWork: "Reconstruction to Concrete Pavement",
    unitOfMeasure: "Lane Km",
    dataType: "Real",
    minAmount: null,
    maxAmount: 1000.0,
  },
  {
    infraType: "Roads",
    majorWorkCategory: "Reconstruction",
    typeOfWork: "Reconstruction: Raising of Grade",
    unitOfMeasure: "Lane Km",
    dataType: "Real",
    minAmount: null,
    maxAmount: 50,
  },
  {
    infraType: "Roads",
    majorWorkCategory: "Rehabilitation",
    typeOfWork: "Rehabilitation / Major Repair of Drainage Structure along Road",
    unitOfMeasure: "Lineal meters",
    dataType: "Real",
    minAmount: null,
    maxAmount: 20000.0,
  },
  {
    infraType: "Roads",
    majorWorkCategory: "Rehabilitation",
    typeOfWork: "Rehabilitation of Asphalt Road",
    unitOfMeasure: "Lane Km",
    dataType: "Real",
    minAmount: null,
    maxAmount: 300,
  },
  {
    infraType: "Roads",
    majorWorkCategory: "Rehabilitation",
    typeOfWork: "Rehabilitation of Concrete Road",
    unitOfMeasure: "Lane Km",
    dataType: "Real",
    minAmount: null,
    maxAmount: 110,
  },
  {
    infraType: "Roads",
    majorWorkCategory: "Rehabilitation",
    typeOfWork: "Rehabilitation of Paved Road",
    unitOfMeasure: "Lane Km",
    dataType: "Real",
    minAmount: null,
    maxAmount: 5000.0,
  },
  {
    infraType: "Roads",
    majorWorkCategory: "Rehabilitation/Major Repair",
    typeOfWork: "Rehabilitation / Major Repair of Drainage Structure along Road",
    unitOfMeasure: "Lineal meters",
    dataType: "Real",
    minAmount: null,
    maxAmount: 20000.0,
  },
  {
    infraType: "Roads",
    majorWorkCategory: "Rehabilitation/Major Repair",
    typeOfWork: "Rehabilitation / Major Repair of Road Slope Protection Structure",
    unitOfMeasure: "Square meters",
    dataType: "Real",
    minAmount: null,
    maxAmount: null,
  },
  {
    infraType: "Roads",
    majorWorkCategory: "Road Safety",
    typeOfWork: "Road Safety: Guardrails",
    unitOfMeasure: "Lineal meters",
    dataType: "Real",
    minAmount: null,
    maxAmount: null,
  },
  {
    infraType: "Roads",
    majorWorkCategory: "Road Safety",
    typeOfWork: "Road Safety: Guardrails (Old)",
    unitOfMeasure: "Meters",
    dataType: "Real",
    minAmount: null,
    maxAmount: 10000.0,
  },
  {
    infraType: "Roads",
    majorWorkCategory: "Road Safety",
    typeOfWork: "Road Safety: Pavement Markings",
    unitOfMeasure: "Lineal meters",
    dataType: "Real",
    minAmount: null,
    maxAmount: 50000.0,
  },
  {
    infraType: "Roads",
    majorWorkCategory: "Road Safety",
    typeOfWork: "Road Safety: Pavement markings",
    unitOfMeasure: "Lane Km",
    dataType: "Real",
    minAmount: null,
    maxAmount: 350,
  },
  {
    infraType: "Roads",
    majorWorkCategory: "Road Safety",
    typeOfWork: "Road Safety: Pedestrian Overpass",
    unitOfMeasure: "Number of Pedestrian Overpass",
    dataType: "Integer",
    minAmount: 1,
    maxAmount: 5,
  },
  {
    infraType: "Roads",
    majorWorkCategory: "Road Safety",
    typeOfWork: "Road Safety: Road Signs",
    unitOfMeasure: "Number of Signs",
    dataType: "Integer",
    minAmount: 1,
    maxAmount: 5000,
  },
  {
    infraType: "Roads",
    majorWorkCategory: "Road Safety",
    typeOfWork: "Road Safety: Roadway Lighting",
    unitOfMeasure: "Number of Units",
    dataType: "Integer",
    minAmount: 1,
    maxAmount: 3000,
  },
  {
    infraType: "Roads",
    majorWorkCategory: "Road Safety",
    typeOfWork: "Road Safety: Solar / Reflectorized Pavement Studs",
    unitOfMeasure: "Number of Units",
    dataType: "Integer",
    minAmount: 1,
    maxAmount: 15000,
  },
  {
    infraType: "Roads",
    majorWorkCategory: "Road Safety",
    typeOfWork: "Road Safety: Street Lighting",
    unitOfMeasure: "Km",
    dataType: "Real",
    minAmount: null,
    maxAmount: 2000.0,
  },
  {
    infraType: "Roads",
    majorWorkCategory: "Road Safety",
    typeOfWork: "Road Safety: Traffic Signals",
    unitOfMeasure: "Number of Traffic Signals",
    dataType: "Integer",
    minAmount: 1,
    maxAmount: 10,
  },
  {
    infraType: "Roads",
    majorWorkCategory: "Upgrading",
    typeOfWork: "Paving of Unpaved Roads",
    unitOfMeasure: "Lane Km",
    dataType: "Real",
    minAmount: null,
    maxAmount: 150,
  },
  {
    infraType: "Roads",
    majorWorkCategory: "Upgrading",
    typeOfWork: "Road Upgrading Asphalt to Concrete",
    unitOfMeasure: "Lane Km",
    dataType: "Real",
    minAmount: null,
    maxAmount: 100,
  },
  {
    infraType: "Roads",
    majorWorkCategory: "Upgrading",
    typeOfWork: "Road Upgrading Gravel to Paved",
    unitOfMeasure: "Lane Km",
    dataType: "Real",
    minAmount: null,
    maxAmount: 50,
  },
  {
    infraType: "Roads",
    majorWorkCategory: "Upgrading",
    typeOfWork: "Road Upgrading Raising of Grade",
    unitOfMeasure: "Lane Km",
    dataType: "Real",
    minAmount: null,
    maxAmount: 100,
  },
  {
    infraType: "Roads",
    majorWorkCategory: "Upgrading",
    typeOfWork: "Upgrading of Drainage Structure along Road",
    unitOfMeasure: "Lineal meters",
    dataType: "Real",
    minAmount: null,
    maxAmount: 25000.0,
  },
  {
    infraType: "Roads",
    majorWorkCategory: "Widening",
    typeOfWork: "Additional Lane Width",
    unitOfMeasure: "Square meters",
    dataType: "Real",
    minAmount: null,
    maxAmount: null,
  },
  {
    infraType: "Roads",
    majorWorkCategory: "Widening",
    typeOfWork: "Road Widening",
    unitOfMeasure: "Lane Km",
    dataType: "Real",
    minAmount: null,
    maxAmount: 300,
  },
  {
    infraType: "School Buildings",
    majorWorkCategory: "Construction",
    typeOfWork: "Completion of Classrooms",
    unitOfMeasure: "Number of Classrooms",
    dataType: "Integer",
    minAmount: 1,
    maxAmount: 150,
  },
  {
    infraType: "School Buildings",
    majorWorkCategory: "Construction",
    typeOfWork: "Completion of School Buildings",
    unitOfMeasure: "Number of School Buildings",
    dataType: "Integer",
    minAmount: 1,
    maxAmount: 20,
  },
  {
    infraType: "School Buildings",
    majorWorkCategory: "Construction",
    typeOfWork: "Construction of 1-Storey Classrooms",
    unitOfMeasure: "Number of 1-Storey Classrooms",
    dataType: "Integer",
    minAmount: 1,
    maxAmount: 10,
  },
  {
    infraType: "School Buildings",
    majorWorkCategory: "Construction",
    typeOfWork: "Construction of 2-Storey Classrooms",
    unitOfMeasure: "Number of 2-Storey Classrooms",
    dataType: "Integer",
    minAmount: 1,
    maxAmount: 10,
  },
  {
    infraType: "School Buildings",
    majorWorkCategory: "Construction",
    typeOfWork: "Construction of 3-Storey Classrooms",
    unitOfMeasure: "Number of 3-Storey Classrooms",
    dataType: "Integer",
    minAmount: 1,
    maxAmount: 10,
  },
  {
    infraType: "School Buildings",
    majorWorkCategory: "Construction",
    typeOfWork: "Construction of 4-Storey Classrooms",
    unitOfMeasure: "Number of 4-Storey Classrooms",
    dataType: "Integer",
    minAmount: 1,
    maxAmount: 10,
  },
  {
    infraType: "School Buildings",
    majorWorkCategory: "Construction",
    typeOfWork: "Construction of Classrooms",
    unitOfMeasure: "Number of Classrooms",
    dataType: "Integer",
    minAmount: 1,
    maxAmount: 150,
  },
  {
    infraType: "School Buildings",
    majorWorkCategory: "Construction",
    typeOfWork: "Construction of School Buildings",
    unitOfMeasure: "Number of School Buildings",
    dataType: "Integer",
    minAmount: 1,
    maxAmount: 10,
  },
  {
    infraType: "School Buildings",
    majorWorkCategory: "Rehabilitation/Major Repair",
    typeOfWork: "Rehabilitation / Major Repair of 1-Storey Classrooms",
    unitOfMeasure: "Number of 1-Storey Classrooms",
    dataType: "Integer",
    minAmount: 1,
    maxAmount: 10,
  },
  {
    infraType: "School Buildings",
    majorWorkCategory: "Rehabilitation/Major Repair",
    typeOfWork: "Rehabilitation / Major Repair of 2-Storey Classrooms",
    unitOfMeasure: "Number of 2-Storey Classrooms",
    dataType: "Integer",
    minAmount: 1,
    maxAmount: 10,
  },
  {
    infraType: "School Buildings",
    majorWorkCategory: "Rehabilitation/Major Repair",
    typeOfWork: "Rehabilitation / Major Repair of Classrooms",
    unitOfMeasure: "Number of Classrooms",
    dataType: "Integer",
    minAmount: 1,
    maxAmount: 150,
  },
  {
    infraType: "School Buildings",
    majorWorkCategory: "Rehabilitation/Major Repair",
    typeOfWork: "Rehabilitation / Major Repair of School Buildings",
    unitOfMeasure: "Number of School Buildings",
    dataType: "Integer",
    minAmount: 1,
    maxAmount: 10,
  },
  {
    infraType: "Septage and Sewerage Plants",
    majorWorkCategory: "Construction",
    typeOfWork: "Construction of Septage / Sewerage Plants",
    unitOfMeasure: "Number of Septage/Sewerage Plants",
    dataType: "Integer",
    minAmount: 1,
    maxAmount: 1,
  },
  {
    infraType: "Septage and Sewerage Plants",
    majorWorkCategory: "Rehabilitation/Major Repair",
    typeOfWork: "Rehabilitation / Major Repair of Septage / Sewerage Plants",
    unitOfMeasure: "Number of Septage/Sewerage Plants",
    dataType: "Integer",
    minAmount: 1,
    maxAmount: 1,
  },
  {
    infraType: "Water Supply Systems",
    majorWorkCategory: "Construction",
    typeOfWork: "Construction of Water Supply Systems",
    unitOfMeasure: "Number of Water Supply Systems",
    dataType: "Integer",
    minAmount: 1,
    maxAmount: 20,
  },
  {
    infraType: "Water Supply Systems",
    majorWorkCategory: "Rehabilitation",
    typeOfWork: "Rehabilitation of Water Supply Systems",
    unitOfMeasure: "Number of Water Supply Systems",
    dataType: "Integer",
    minAmount: 1,
    maxAmount: 20,
  },
  {
    infraType: "Waterway",
    majorWorkCategory: "Channelization",
    typeOfWork: "Channelization",
    unitOfMeasure: "Cubic meters",
    dataType: "Real",
    minAmount: null,
    maxAmount: null,
  },
  {
    infraType: "Waterway",
    majorWorkCategory: "Dredging / Desilting",
    typeOfWork: "Dredging / Desilting",
    unitOfMeasure: "Cubic meters",
    dataType: "Real",
    minAmount: null,
    maxAmount: null,
  }
];

const TypeOfWorkTable: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedInfraType, setSelectedInfraType] = useState('');
  const [selectedMajorWorkCategory, setSelectedMajorWorkCategory] = useState('');
  const [filteredData, setFilteredData] = useState<TypeOfWork[]>(SAMPLE_DATA);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  // Get unique values for filter dropdowns
  const uniqueInfraTypes = [...new Set(SAMPLE_DATA.map(item => item.infraType))];
  const uniqueMajorWorkCategories = [...new Set(SAMPLE_DATA.map(item => item.majorWorkCategory))];

  // Filter data based on search and filters
  useEffect(() => {
    let filtered = SAMPLE_DATA;

    if (searchTerm) {
      filtered = filtered.filter(item => 
        item.typeOfWork.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.infraType.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.majorWorkCategory.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (selectedInfraType) {
      filtered = filtered.filter(item => item.infraType === selectedInfraType);
    }

    if (selectedMajorWorkCategory) {
      filtered = filtered.filter(item => item.majorWorkCategory === selectedMajorWorkCategory);
    }

    setFilteredData(filtered);
    setCurrentPage(1); // Reset to first page when filters change
  }, [searchTerm, selectedInfraType, selectedMajorWorkCategory]);

  // Calculate pagination
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentData = filteredData.slice(startIndex, endIndex);

  // Helper function to render data type badge
  const getDataTypeBadge = (dataType: string) => {
    const colorClass = dataType === 'Integer' 
      ? 'bg-blue-100 text-blue-800 border-blue-200'
      : 'bg-green-100 text-green-800 border-green-200';
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${colorClass}`}>
        {dataType}
      </span>
    );
  };

  // Helper function to format amount values
  const formatAmount = (amount: number | null) => {
    if (amount === null) return 'N/A';
    return amount.toLocaleString();
  };

  return (
    <div className="space-y-4">
      {/* Header with filters */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h4 className="text-lg font-medium text-gray-900">Type of Work</h4>
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative">
            <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search..."
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

          {/* Major Work Category Filter */}
          <select
            value={selectedMajorWorkCategory}
            onChange={(e) => setSelectedMajorWorkCategory(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Work Categories</option>
            {uniqueMajorWorkCategories.map(category => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>

          <Button color="blue" className="text-xs px-3 py-2">
            <PlusIcon className="w-4 h-4 mr-1" />
            Add
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <Table striped>
          <TableHead>
            <TableRow>
              <TableHeader className="text-xs">Infrastructure Type</TableHeader>
              <TableHeader className="text-xs">Major Work Category</TableHeader>
              <TableHeader className="text-xs">Type of Work</TableHeader>
              <TableHeader className="text-xs">Unit of Measure</TableHeader>
              <TableHeader className="text-xs">Data Type</TableHeader>
              <TableHeader className="text-xs">Min Amount</TableHeader>
              <TableHeader className="text-xs">Max Amount</TableHeader>
              <TableHeader className="text-xs">Actions</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {currentData.map((item, idx) => (
              <TableRow key={`${item.infraType}-${item.typeOfWork}-${idx}`}>
                <TableCell className="text-sm font-medium">
                  {item.infraType}
                </TableCell>
                <TableCell className="text-sm">
                  {item.majorWorkCategory}
                </TableCell>
                <TableCell className="text-sm">
                  {item.typeOfWork}
                </TableCell>
                <TableCell className="text-sm">
                  {item.unitOfMeasure}
                </TableCell>
                <TableCell>
                  {getDataTypeBadge(item.dataType)}
                </TableCell>
                <TableCell className="text-sm">
                  {formatAmount(item.minAmount)}
                </TableCell>
                <TableCell className="text-sm">
                  {formatAmount(item.maxAmount)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center space-x-1">
                    <Button 
                      color="blue"
                      className="text-xs px-2 py-1"
                    >
                      <PencilIcon className="w-3 h-3" />
                    </Button>
                    <Button 
                      color="red" 
                      className="text-xs px-2 py-1"
                    >
                      <TrashIcon className="w-3 h-3" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-500">
            Showing {startIndex + 1} to {Math.min(endIndex, filteredData.length)} of {filteredData.length} items
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
      {filteredData.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No type of work data found matching your filters.
        </div>
      )}
    </div>
  );
};

export default TypeOfWorkTable;
