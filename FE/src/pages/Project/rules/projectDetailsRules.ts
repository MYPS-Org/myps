import type { ValidationRule } from "../../../utils/FormValidation";
import type { ProjectDetails } from "../Model";

export const projectDetailsRules: ValidationRule<ProjectDetails>[] = [
    {
        field: "ProgramId",
        message: "Program ID is required.",
        validate: (value) => !!value
    },
    // {
    //     field: "ProgramName",
    //     message: "Program Name is required.",
    //     validate: (value) => !!value
    // },
    {
        field: "Description",
        message: "Description is required.",
        validate: (value) => !!value
    },
    {
        field: "Category",
        message: "Category is required.",
        validate: (value) => typeof value === 'number' && value > 0
    },
    {
        field: "Thrust",
        message: "Thrust is required.",
        validate: (value) => typeof value === 'number' && value > 0
    },
    {
        field: "Origin",
        message: "Origin is required.",
        validate: (value) => typeof value === 'number' && value > 0
    },
    {
        field: "City",
        message: "City is required.",
        validate: (value) => !!value
    },
    {
        field: "LegislativeDistrict",
        message: "Legislative District is required.",
        validate: (value) => !!value
    },
    {
        field: "OperatingUnit",
        message: "Operating Unit is required.",
        validate: (value) => !!value
    },
    {
        field: "ImplementingOffice",
        message: "Implementing Office is required.",
        validate: (value) => !!value
    },
    {
        field: "DEO",
        message: "DEO is required.",
        validate: (value) => !!value
    },
    {
        field: "Region",
        message: "Region is required.",
        validate: (value) => !!value
    },
    {
        field: "Agency",
        message: "Agency is required.",
        validate: (value) => typeof value === 'number' && value > 0
    },
    // {
    //     field: "ProjectCode",
    //     message: "Agency is required.",
    //     validate: (value) => typeof value === 'number' && value > 0
    // },
    {
        field: "ImplementationMode",
        message: "Implementation Mode is required.",
        validate: (value) => typeof value === 'number' && value > 0
    },
    {
        field: "EmergencyMode",
        message: "Emergency Mode is required.",
        validate: (value) => typeof value === 'number' && value > 0
    },
    {
        field: "Feasibility",
        message: "Feasibility is required.",
        validate: (value) => typeof value === 'number' && value > 0
    },
    // {
    //     field: "DetailedDesign",
    //     message: "Detailed Design is required.",
    //     validate: (value) => typeof value === 'boolean'
    // },
    // {
    //     field: "RowAvailable",
    //     message: "Row Available is required.",
    //     validate: (value) => typeof value === 'boolean'
    // }
]