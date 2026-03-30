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

const protectedRoutes: RouteObject[] = [
  { path: '/dashboard', element: <Dashboard /> },
  { path: '/user-management', element: <Rbac /> },
  { path: '/infrastructure-management', element: <Rbia /> },
  { path: '/programs', element: <Programs /> },
  { path: '/programs/programdetails/:program', element: <ProgramDetail /> },
  { path: '/projects', element: <Project /> },
  { path: '/projects/add', element: <AddProject /> },
  { path: '/projects/addproject', element: <AddProject /> },
  { path: '/projects/project-details/:project', element: <EditProject /> },
  { path: '/modification/list', element: <ModificationList /> },
  { path: '/revision', element: <ModificationList /> },
  { path: '/revision/view/:modificationType/:transactionId', element: <ViewRevision /> },
  { path: '/revision/:modificationType/:project', element: <ModificationDetails /> },
  { path: '/project-groups', element: <ProjectGroup /> },
  { path: '/project-groups/:groupId', element: <ProjectGroupDetails /> },
  { path: '/multiyear/programs', element: <MultiYear /> },
  { path: '/multiyear/programs/:programId', element: <MultiYearDetails /> },
  { path: '/multiyear/project-details/:project', element: <MYProjectDetails /> },
  { path: '/reports/multiyear', element: <MultiYearReports /> },
  { path: '/reports/programs', element: <ProgramReports /> },
  { path: '/reports/projects', element: <ProjectReports /> },
  { path: '/settings', element: <Settings /> },
  { path: '/code-tables', element: <CodeTables /> },
  { path: '/lumpsum', element: <LumpSumList /> },
  { path: '/lumpsum/:projectId', element: <LumpSumDetails /> },
];
export default protectedRoutes;
