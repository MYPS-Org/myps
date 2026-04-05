import type { RouteObject } from 'react-router-dom';
import Dashboard from '../pages/Dashboard/Dashboard';
import Rbac from '../pages/Rbac/Rbac';
import Programs from '../pages/Program/Views/Program';
import ProgramDetail from '../pages/Program/Views/ProgramDetail';
import Settings from '../pages/Settings/Settings';
import Project from '../pages/Project/Views/Project';
import AddProject from '../pages/Project/Views/AddProject';
import EditProject from '../pages/Project/Views/EditProject';
import ProjectGroup from '../pages/ProjectGroups/Views/ProjectGroup';
import ProjectGroupDetails from '../pages/ProjectGroups/Views/ProjectGroupDetails';
import CodeTables from '../pages/CodeTables/Views/CodeTables';
import Rbia from '../pages/Rbia/Views/Rbia';
import ModificationList from '../pages/Modification/views/ModifcationList';
import MultiYear from '../pages/MultiYear/views/MultiYear';
import MultiYearDetails from '../pages/MultiYear/views/MultiYearDetails';
import ModificationDetails from '../pages/Modification/views/ModificationDetails';
import MYProjectDetails from '../pages/MultiYear/views/MYProjectDetails';
import ViewRevision from '../pages/Modification/views/ViewRevision';
import MultiYearReports from '../pages/Reports/MultiYearReports';
import ProgramReports from '../pages/Reports/ProgramReports';
import ProjectReports from '../pages/Reports/ProjectReports';
import LumpSumList from '../pages/LumpSum/Views/LumpSumList';
import LumpSumDetails from '../pages/LumpSum/Views/LumpSumDetails';
// ✅ Extend RouteObject with a permission key
export type AppRoute = RouteObject & {
  RouteName?: string; // matches keys returned by your session/API
};
const protectedRoutes: AppRoute[] = [
  { RouteName: 'Dashboard', path: '/dashboard', element: <Dashboard /> },
  { RouteName: 'UserManagement', path: '/user-management', element: <Rbac /> },
  { RouteName: 'InfraManagement', path: '/infrastructure-management', element: <Rbia /> },
  // #region Program Routes
  { RouteName: 'ProgramList', path: '/programs', element: <Programs /> },
  { RouteName: 'ProgramDetails', path: '/programs/programdetails/:program', element: <ProgramDetail /> },
  // #endregion Program Routes

  // #region Project Routes
  { RouteName: 'ProjectList', path: '/projects', element: <Project /> },
  // { RouteName: 'AddProject', path: '/projects/add', element: <AddProject /> },
  { RouteName: 'AddProject', path: '/projects/addproject', element: <AddProject /> },
  { RouteName: 'ProjectDetails', path: '/projects/project-details/:project', element: <EditProject /> },
  // #endregion Project Routes

  // #region Revision Routes
  // { RouteName: '', path: '/modification/list', element: <ModificationList /> },
  { RouteName: 'RevisionList', path: '/revision', element: <ModificationList /> },
  { RouteName: 'RevisionView', path: '/revision/view/:modificationType/:transactionId', element: <ViewRevision /> },
  { RouteName: 'RevisionDetails', path: '/revision/:modificationType/:project', element: <ModificationDetails /> },
  // #endregion Revision Routes

  // #region Project Group Routes
  { RouteName: 'ProjectGroupList', path: '/project-groups', element: <ProjectGroup /> },
  { RouteName: 'ProjectGroupDetails', path: '/project-groups/:groupId', element: <ProjectGroupDetails /> },
  // #endregion Project Group Routes

  // #region MultiYear Routes
  { RouteName: 'MultiYearList', path: '/multiyear/programs', element: <MultiYear /> },
  { RouteName: 'MultiYearDetails', path: '/multiyear/programs/:programId', element: <MultiYearDetails /> },
  { RouteName: 'MYProjectDetails', path: '/multiyear/project-details/:project', element: <MYProjectDetails /> },
  // #endregion MultiYear Routes

  // #region Reports Routes
  { RouteName: 'MultiYearReports', path: '/reports/multiyear', element: <MultiYearReports /> },
  { RouteName: 'ProgramReports', path: '/reports/programs', element: <ProgramReports /> },
  { RouteName: 'ProjectReports', path: '/reports/projects', element: <ProjectReports /> },
  // #endregion Reports Routes

  // #region Settings Routes
  { RouteName: 'Settings', path: '/settings', element: <Settings /> },
  { RouteName: 'CodeTables', path: '/code-tables', element: <CodeTables /> },
  // #endregion Settings Routes

  // #region LumpSum Routes
  { RouteName: 'LumpSumList', path: '/lumpsum', element: <LumpSumList /> },
  { RouteName: 'LumpSumDetails', path: '/lumpsum/:projectId', element: <LumpSumDetails /> },
  // #endregion LumpSum Routes
];
export default protectedRoutes;
