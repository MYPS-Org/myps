/**
 * config.ts — maps each searchable table to:
 *   - resultColumns: which columns to show in the results table
 *   - getLink: given a result row, returns a navigation URL (or null if not navigable)
 *
 * Keep this in sync with AllowedColumns in GlobalSearchController.cs.
 */

export interface TableConfig {
  key: string;
  label: string;
  resultColumns: { field: string; label: string }[];
  getLink: ((row: Record<string, unknown>) => string | null) | null;
}

export const SEARCH_TABLE_CONFIG: TableConfig[] = [
  {
    key: 'vProjects',
    label: 'Projects',
    resultColumns: [
      { field: 'ProjectId',          label: 'Project ID'          },
      { field: 'Description',        label: 'Description'         },
      { field: 'ProgramName',        label: 'Program'             },
      { field: 'Category',           label: 'Category'            },
      { field: 'Region',             label: 'Region'              },
      { field: 'StageName',          label: 'Stage'               },
      { field: 'ImplementingOffice', label: 'Implementing Office' },
    ],
    getLink: (row) =>
      row['ProjectId'] ? `/projects/project-details/${row['ProjectId']}` : null,
  },
  {
    key: 'vPrograms',
    label: 'Programs',
    resultColumns: [
      { field: 'ProgramId', label: 'Program ID'   },
      { field: 'Name',      label: 'Program Name' },
      { field: 'StageName', label: 'Stage'        },
      { field: 'YearStart', label: 'Year Start'   },
      { field: 'Status',    label: 'Status'       },
      { field: 'Type',      label: 'Type'         },
    ],
    getLink: (row) =>
      row['ProgramId'] ? `/programs/programdetails/${row['ProgramId']}` : null,
  },
  {
    key: 'vProjectGroups',
    label: 'Project Groups',
    resultColumns: [
      { field: 'GroupId',       label: 'Group ID'    },
      { field: 'Name',          label: 'Name'        },
      { field: 'Description',   label: 'Description' },
      { field: 'UserGroupName', label: 'User Group'  },
    ],
    getLink: (row) =>
      row['GroupId'] ? `/project-groups/${row['GroupId']}` : null,
  },
  {
    key: 'vUsers',
    label: 'Users',
    resultColumns: [
      { field: 'UserId',          label: 'User ID' },
      { field: 'Name',            label: 'Name'    },
      { field: 'Email',           label: 'Email'   },
      { field: 'PlantillaOffice', label: 'Office'  },
    ],
    getLink: null,
  },
  {
    key: 'vRevisionLists',
    label: 'Revisions',
    resultColumns: [
      { field: 'TransactionId', label: 'Transaction ID' },
      { field: 'RevisionName',  label: 'Revision Name'  },
      { field: 'CategoryName',  label: 'Category'       },
      { field: 'Reason',        label: 'Reason'         },
      { field: 'CreatedBy',     label: 'Created By'     },
    ],
    getLink: (row) =>
      row['TransactionId']
        ? `/revision/view/Revision/${row['TransactionId']}`
        : null,
  },
];
