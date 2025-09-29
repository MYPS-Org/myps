export interface ModificationProject {
    id: string;
    programName: string;
    projectId: string;
    description: string;
    date: string;
    revisionType: string;
    status: 'Active' | 'Pending' | 'Completed';
    components: ProjectComponent[];
}

export interface ProjectComponent {
    id: string;
    compId: string;
    pcmaStatus: string;
    constructionStatus: string;
    permitted: boolean;
    implementationMode: string;
    selected?: boolean;
}

export const mockModificationProjects: ModificationProject[] = [
    {
        id: "MOD-001",
        programName: "GAA 2027 - South province building project",
        projectId: "P01155611LZ",
        description: "Highway expansion and improvement project for Region IV-A",
        date: "2024-03-15",
        revisionType: "Major Modification",
        status: "Active",
        components: [
            {
                id: "COMP-001",
                compId: "CW-1",
                pcmaStatus: "On-Going",
                constructionStatus: "Packaged",
                permitted: false,
                implementationMode: "By Contract"
            },
            {
                id: "COMP-002",
                compId: "CW-2",
                pcmaStatus: "Completed",
                constructionStatus: "On-Going",
                permitted: true,
                implementationMode: "By Administration"
            },
            {
                id: "COMP-003",
                compId: "CW-3",
                pcmaStatus: "Pending",
                constructionStatus: "Not Started",
                permitted: false,
                implementationMode: "By Contract"
            }
        ]
    },
    {
        id: "MOD-002",
        programName: "GAA 2024 - Water Supply Enhancement Program",
        projectId: "P01185765MN",
        description: "Water distribution system upgrade for Metro Manila",
        date: "2024-04-22",
        revisionType: "Minor Modification",
        status: "Pending",
        components: [
            {
                id: "COMP-004",
                compId: "WS-1",
                pcmaStatus: "On-Going",
                constructionStatus: "Bidding",
                permitted: true,
                implementationMode: "By Contract"
            },
            {
                id: "COMP-005",
                compId: "WS-2",
                pcmaStatus: "Completed",
                constructionStatus: "Packaged",
                permitted: false,
                implementationMode: "By Administration"
            }
        ]
    },
    {
        id: "MOD-003",
        programName: "GAA 2025 - North Luzon Infrastructure Program-NEP",
        projectId: "P00916771LZ",
        description: "Construction of new elementary school buildings in rural areas",
        date: "2024-05-10",
        revisionType: "Budget Revision",
        status: "Completed",
        components: [
            {
                id: "COMP-006",
                compId: "CW-1",
                pcmaStatus: "Completed",
                constructionStatus: "Completed",
                permitted: true,
                implementationMode: "By Contract"
            },
            {
                id: "COMP-007",
                compId: "CW-2",
                pcmaStatus: "On-Going",
                constructionStatus: "On-Going",
                permitted: true,
                implementationMode: "By Contract"
            }
        ]
    },
    {
        id: "MOD-004",
        programName: "GAA 2023 - Bridge Rehabilitation Program",
        projectId: "P01125235VS",
        description: "Structural assessment and rehabilitation of existing bridges",
        date: "2024-06-18",
        revisionType: "Technical Modification",
        status: "Active",
        components: [
            {
                id: "COMP-008",
                compId: "CW-1",
                pcmaStatus: "Pending",
                constructionStatus: "Design Phase",
                permitted: false,
                implementationMode: "By Administration"
            }
        ]
    },
    {
        id: "MOD-005",
        programName: "GAA 2019 - Road Maintenance Program",
        projectId: "BP00992154LZ",
        description: "Preventive maintenance and repair of national roads",
        date: "2024-07-25",
        revisionType: "Schedule Modification",
        status: "Active",
        components: [
            {
                id: "COMP-009",
                compId: "CW-1",
                pcmaStatus: "On-Going",
                constructionStatus: "Procurement",
                permitted: true,
                implementationMode: "By Contract"
            },
            {
                id: "COMP-010",
                compId: "CW-2",
                pcmaStatus: "Completed",
                constructionStatus: "On-Going",
                permitted: true,
                implementationMode: "By Contract"
            }
        ]
    }
];

export const getModificationProjects = (): ModificationProject[] => {
    return mockModificationProjects;
};

export const getProjectById = (id: string): ModificationProject | undefined => {
    return mockModificationProjects.find(project => project.id === id);
};

export const searchProjects = (searchTerm: string): ModificationProject[] => {
    const term = searchTerm.toLowerCase();
    return mockModificationProjects.filter(project => 
        project.programName.toLowerCase().includes(term) ||
        project.projectId.toLowerCase().includes(term) ||
        project.description.toLowerCase().includes(term) ||
        project.revisionType.toLowerCase().includes(term)
    );
};
