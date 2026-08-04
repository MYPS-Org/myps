// Static list of all app routes used for syncing route permissions with the backend.
// Kept separate from Routes.tsx to avoid circular dependency issues.
export interface AppRouteData {
    RouteName: string;
    path: string;
}

export const appRouteList: AppRouteData[] = [
    { RouteName: 'Dashboard',           path: '/dashboard' },
    { RouteName: 'UserManagement',      path: '/user-management' },
    { RouteName: 'InfraManagement',     path: '/infrastructure-management' },
    { RouteName: 'ProgramList',         path: '/programs' },
    { RouteName: 'ProgramDetails',      path: '/programs/programdetails/:program' },
    { RouteName: 'ProjectList',         path: '/projects' },
    { RouteName: 'AddProject',          path: '/projects/addproject' },
    { RouteName: 'ProjectDetails',      path: '/projects/project-details/:project' },
    { RouteName: 'RevisionList',        path: '/revision' },
    { RouteName: 'RevisionView',        path: '/revision/view/:modificationType/:transactionId' },
    { RouteName: 'RevisionDetails',     path: '/revision/:modificationType/:project' },
    { RouteName: 'ProjectGroupList',    path: '/project-groups' },
    { RouteName: 'ProjectGroupDetails', path: '/project-groups/:groupId' },
    { RouteName: 'MultiYearList',       path: '/multiyear/programs' },
    { RouteName: 'MultiYearDetails',    path: '/multiyear/programs/:programId' },
    { RouteName: 'MYProjectDetails',    path: '/multiyear/project-details/:project' },
    { RouteName: 'MultiYearReports',    path: '/reports/multiyear' },
    { RouteName: 'ProgramReports',      path: '/reports/programs' },
    { RouteName: 'ProjectReports',      path: '/reports/projects' },
    { RouteName: 'Settings',            path: '/settings' },
    { RouteName: 'CodeTables',          path: '/code-tables' },
    { RouteName: 'LumpSumList',         path: '/lumpsum' },
    { RouteName: 'LumpSumDetails',      path: '/lumpsum/:walletId' },
    { RouteName: 'AddWallet',           path: '/lumpsum/add' },
];
