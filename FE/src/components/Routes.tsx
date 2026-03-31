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
  { RouteName: 'ProgramList', path: '/programs', element: <Programs /> },
  { RouteName: 'ProgramDetails', path: '/programs/programdetails/:program', element: <ProgramDetail /> },
  { RouteName: 'ProjectList', path: '/projects', element: <Project /> },
  { RouteName: 'AddProject', path: '/projects/add', element: <AddProject /> },
  { RouteName: 'AddProject', path: '/projects/addproject', element: <AddProject /> },
  { RouteName: 'ProjectDetails', path: '/projects/project-details/:project', element: <EditProject /> },
  { RouteName: '', path: '/modification/list', element: <ModificationList /> },
  { RouteName: 'RevisionList', path: '/revision', element: <ModificationList /> },
  { RouteName: '', path: '/revision/view/:modificationType/:transactionId', element: <ViewRevision /> },
  { RouteName: '', path: '/revision/:modificationType/:project', element: <ModificationDetails /> },
  { RouteName: '', path: '/project-groups', element: <ProjectGroup /> },
  { RouteName: '', path: '/project-groups/:groupId', element: <ProjectGroupDetails /> },
  { RouteName: '', path: '/multiyear/programs', element: <MultiYear /> },
  { RouteName: '', path: '/multiyear/programs/:programId', element: <MultiYearDetails /> },
  { RouteName: '', path: '/multiyear/project-details/:project', element: <MYProjectDetails /> },
  { RouteName: '', path: '/reports/multiyear', element: <MultiYearReports /> },
  { RouteName: '', path: '/reports/programs', element: <ProgramReports /> },
  { RouteName: '', path: '/reports/projects', element: <ProjectReports /> },
  { RouteName: '', path: '/settings', element: <Settings /> },
  { RouteName: 'CodeTables', path: '/code-tables', element: <CodeTables /> },
  { RouteName: '', path: '/lumpsum', element: <LumpSumList /> },
  { RouteName: '', path: '/lumpsum/:projectId', element: <LumpSumDetails /> },
];
export default protectedRoutes;
