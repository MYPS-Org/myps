/**
 * config.ts — flat list of searchable fields.
 *
 * Each entry maps a user-facing label to a backend (TableKey + ColumnField) pair,
 * the result columns to display, and an optional navigation link.
 *
 * To add a new searchable field:
 *   1. Add an entry here.
 *   2. Make sure the TableKey + ColumnField are whitelisted in GlobalSearchController.cs.
 */

export interface SearchFieldConfig {
  /** Unique key used internally */
  key: string;
  /** Label shown in the "Search By" dropdown */
  label: string;
  /** Backend: which view/table to query */
  tableKey: string;
  /** Backend: which column to search against */
  columnField: string;
  /** Placeholder hint shown in the value input */
  placeholder?: string;
  /** Columns to render in the results table */
  resultColumns: { field: string; label: string }[];
  /** Given a result row, return the navigation URL or null */
  getLink: ((row: Record<string, unknown>) => string | null) | null;
}

export const SEARCH_FIELD_CONFIG: SearchFieldConfig[] = [
  {
    key: 'projectId',
    label: 'Project ID',
    tableKey: 'Projects',
    columnField: 'ProjectId',
    placeholder: 'e.g. 2024-DPWH-001',
    resultColumns: [
      { field: 'ProjectId',    label: 'Project ID'   },
      { field: 'Description',  label: 'Description'  },
      { field: 'ProgramName',  label: 'Program'      },
      { field: 'StageName',    label: 'Stage'        },
      { field: 'Region',       label: 'Region'       },
    ],
    getLink: (row) =>
      row['ProjectId'] && row['StageName']
        ? `/projects/project-details/${row['ProjectId']}:${row['StageName']}`
        : row['ProjectId']
        ? `/projects/project-details/${row['ProjectId']}`
        : null,
  },
  {
    key: 'alternateId',
    label: 'Alternate ID',
    tableKey: 'Projects',
    columnField: 'AlternateId',
    placeholder: 'e.g. ALT-2024-001',
    resultColumns: [
      { field: 'ProjectId',   label: 'Project ID'   },
      { field: 'AlternateId', label: 'Alternate ID' },
      { field: 'Description', label: 'Description'  },
      { field: 'StageName',   label: 'Stage'        },
      { field: 'Region',      label: 'Region'       },
    ],
    getLink: (row) =>
      row['ProjectId'] && row['StageName']
        ? `/projects/project-details/${row['ProjectId']}:${row['StageName']}`
        : row['ProjectId']
        ? `/projects/project-details/${row['ProjectId']}`
        : null,
  },
  {
    key: 'description',
    label: 'Description',
    tableKey: 'Projects',
    columnField: 'Description',
    placeholder: 'e.g. Construction of road…',
    resultColumns: [
      { field: 'ProjectId',   label: 'Project ID'  },
      { field: 'Description', label: 'Description' },
      { field: 'ProgramName', label: 'Program'     },
      { field: 'StageName',   label: 'Stage'       },
      { field: 'Region',      label: 'Region'      },
    ],
    getLink: (row) =>
      row['ProjectId'] && row['StageName']
        ? `/projects/project-details/${row['ProjectId']}:${row['StageName']}`
        : row['ProjectId']
        ? `/projects/project-details/${row['ProjectId']}`
        : null,
  },
  {
    key: 'uacs',
    label: 'UACS',
    tableKey: 'Projects',
    columnField: 'UACS',
    placeholder: 'e.g. 212202000',
    resultColumns: [
      { field: 'ProjectId',   label: 'Project ID'  },
      { field: 'UACS',        label: 'UACS'        },
      { field: 'Description', label: 'Description' },
      { field: 'StageName',   label: 'Stage'       },
      { field: 'Region',      label: 'Region'      },
    ],
    getLink: (row) =>
      row['ProjectId'] && row['StageName']
        ? `/projects/project-details/${row['ProjectId']}:${row['StageName']}`
        : row['ProjectId']
        ? `/projects/project-details/${row['ProjectId']}`
        : null,
  },
  {
    key: 'programName',
    label: 'Program Name',
    tableKey: 'Programs',
    columnField: 'Name',
    placeholder: 'e.g. DPWH Infrastructure Program',
    resultColumns: [
      { field: 'ProgramId', label: 'Program ID'   },
      { field: 'Name',      label: 'Program Name' },
      { field: 'StageName', label: 'Stage'        },
      { field: 'YearStart', label: 'Year Start'   },
      { field: 'Status',    label: 'Status'       },
    ],
    getLink: (row) =>
      row['ProgramId'] ? `/programs/programdetails/${row['ProgramId']}` : null,
  },
  {
    key: 'roads',
    label: 'Roads',
    tableKey: 'vRoads',
    columnField: 'RoadName',
    placeholder: 'e.g. National Highway',
    resultColumns: [
      { field: 'RoadId',   label: 'Road ID'   },
      { field: 'RoadName', label: 'Road Name' },
      { field: 'Region',   label: 'Region'    },
      { field: 'Length',   label: 'Length'    },
    ],
    getLink: null,
  },
  {
    key: 'roadSection',
    label: 'Road Section',
    tableKey: 'vRoadSections',
    columnField: 'RoadSectionId',
    placeholder: 'e.g. RS-001',
    resultColumns: [
      { field: 'RoadSectionId', label: 'Section ID'   },
      { field: 'RoadName',      label: 'Road Name'    },
      { field: 'Region',        label: 'Region'       },
      { field: 'RoadLength',    label: 'Length (m)'   },
    ],
    getLink: null,
  },
  {
    key: 'bridge',
    label: 'Bridge',
    tableKey: 'vBridges',
    columnField: 'BridgeName',
    placeholder: 'e.g. Marcos Bridge',
    resultColumns: [
      { field: 'BridgeId',   label: 'Bridge ID'   },
      { field: 'BridgeName', label: 'Bridge Name' },
      { field: 'Region',     label: 'Region'      },
      { field: 'Length',     label: 'Length (m)'  },
    ],
    getLink: null,
  },
];
