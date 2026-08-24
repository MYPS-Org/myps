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
import ModificationDetails from '../pages/Modification/views/ModificationDetails';
import ViewRevision from '../pages/Modification/views/ViewRevision';
import Reports from '../pages/Reports/Reports';
// NOTE: LSWalletList and LSWalletDetail do not exist yet — they are built in
// the junior-engineer pass that follows this senior-engineer pass. The imports
// below will cause a TypeScript/Vite error until those View files are created.
// That is expected and will be resolved in the next implementation step.
import AddWallet from '../pages/LSWallet/Views/AddWallet';
import LSWalletList from '../pages/LSWallet/Views/LSWalletList';
import LSWalletDetail from '../pages/LSWallet/Views/LSWalletDetail';
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

  // #region Reports Routes
  { RouteName: 'Reports', path: '/reports', element: <Reports /> },
  // #endregion Reports Routes

  // #region Settings Routes
  { RouteName: 'Settings', path: '/settings', element: <Settings /> },
  { RouteName: 'CodeTables', path: '/code-tables', element: <CodeTables /> },
  // #endregion Settings Routes

  // #region LS Wallet Routes
  { RouteName: 'LumpSumList', path: '/lumpsum', element: <LSWalletList /> },
  { RouteName: 'AddWallet', path: '/lumpsum/add', element: <AddWallet /> },
  { RouteName: 'LumpSumDetails', path: '/lumpsum/:walletId', element: <LSWalletDetail /> },
  // #endregion LS Wallet Routes
];
export default protectedRoutes;
