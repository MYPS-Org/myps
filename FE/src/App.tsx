
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css'
import { AuthProvider } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import LoginForm from './pages/login/Page';
import Dashboard from './pages/Dashboard/Dashboard';
import ProtectedRoute from './components/protectedroutes';
import Preloader from './components/Preloader';
import Layout from './pages/Layouts/Layout';
import AppLayout from './layouts/AppLayout';
import Rbac from './pages/Rbac/Rbac';
import Programs from './pages/Program/Views/Program';
import ProgramDetail from './pages/Program/Views/ProgramDetail';
import Settings from './pages/Settings/Settings';
import Project from './pages/Project/Views/Project';
import AddProject from './pages/Project/Views/AddProject';
import EditProject from './pages/Project/Views/EditProject';
import ProjectGroup from './pages/ProjectGroups/Views/ProjectGroup';
import ProjectGroupDetails from './pages/ProjectGroups/Views/ProjectGroupDetails';
import CodeTables from './pages/CodeTables/Views/CodeTables';
import { ModalProvider } from './components/Modal/ModalContext';
import GlobalModal from './components/Modal/Modal';
import { ToasterProvider } from './components/toaster/ToasterContext';
import { HttpClientSetup } from './components/HttpClientSetup';
import Rbia from './pages/Rbia/Views/Rbia';
import ModificationList from './pages/Modification/views/ModifcationList';
import MultiYear from './pages/MultiYear/views/MultiYear';
import MultiYearDetails from './pages/MultiYear/views/MultiYearDetails';
import ModificationDetails from './pages/Modification/views/ModificationDetails';
import MYProjectDetails from './pages/MultiYear/views/MYProjectDetails';
import ViewRevision from './pages/Modification/views/ViewRevision';

// import AddProgram from './pages/Program/Views/AddProgram';
function App() {
	return (
		<>
		    <ModalProvider>
				<ToasterProvider>
					<HttpClientSetup />
				<ThemeProvider>
					<AuthProvider>
					<Router>
						<Preloader />
						<Routes>
							<Route path="/login" element={<LoginForm />} />
							{/* Dashboard Routes */}
							<Route element={<AppLayout />}>
								<Route 
									path="/dashboard" 
									element={
										<ProtectedRoute>
											<Dashboard />
										</ProtectedRoute>
									} 
								/>
								<Route 
									path="/user-management" 
									element={
										<ProtectedRoute>
											<Rbac />
										</ProtectedRoute>
									} 
								/>
								<Route 
									path="/infrastructure-management" 
									element={
										<ProtectedRoute>
											<Rbia />
										</ProtectedRoute>
									} 
								/>
								<Route 
									path="/programs" 
									element={
										<ProtectedRoute>
											<Programs />
										</ProtectedRoute>
									} 
								/>
								<Route 
									path="/programs/programdetails/:program" 
									element={
										<ProtectedRoute>
											<ProgramDetail />
										</ProtectedRoute>
									} 
								/>
								<Route 
									path="/projects" 
									element={
										<ProtectedRoute>
											<Project />
										</ProtectedRoute>
									} 
								/>
								<Route 
									path="/projects/add" 
									element={
										<ProtectedRoute>
											<AddProject />
										</ProtectedRoute>
									} 
								/>
								<Route 
									path="/projects/addproject" 
									element={
										<ProtectedRoute>
											<AddProject />
										</ProtectedRoute>
									} 
								/>
								<Route 
									path="/projects/project-details/:project" 
									element={
										<ProtectedRoute>
											<EditProject />
										</ProtectedRoute>
									} 
								/>
								<Route 
									path="/modification/list" 
									element={
										<ProtectedRoute>
											<ModificationList />
										</ProtectedRoute>
									} 
								/>
								<Route 
									path="/revision" 
									element={
										<ProtectedRoute>
											<ModificationList />
										</ProtectedRoute>
									} 
								/>
								{/* View existing revisions - uses transactionId */}
								<Route 
									path="/revision/view/:modificationType/:transactionId" 
									element={
										<ProtectedRoute>
											<ViewRevision />
										</ProtectedRoute>
									} 
								/>
								{/* Edit/Create new modification (from project module) - uses project:stage */}
								<Route 
									path="/revision/:modificationType/:project" 
									element={<ProtectedRoute>
										<ModificationDetails />
										</ProtectedRoute>}
								/>
								<Route 
									path="/project-groups" 
									element={
										<ProtectedRoute>
											<ProjectGroup />
										</ProtectedRoute>
									} 
								/>
								<Route 
									path="/project-groups/:groupId" 
									element={
										<ProtectedRoute>
											<ProjectGroupDetails />
										</ProtectedRoute>
									} 
								/>
								<Route 
									path="/multiyear/programs"
									element={
										<ProtectedRoute>
											<MultiYear />
										</ProtectedRoute>
									}
								/>
								<Route 
									path="/multiyear/programs/:programId"
									element={
										<ProtectedRoute>
											<MultiYearDetails />
										</ProtectedRoute>
									}
								/>
								<Route 
									path="/multiyear/project-details/:project"
									element={
										<ProtectedRoute>
											<MYProjectDetails />
										</ProtectedRoute>
									}
								/>
								<Route 
									path="/settings" 
									element={
										<ProtectedRoute>
											<Settings />
										</ProtectedRoute>
									} 
								/>
								<Route 
									path="/code-tables" 
									element={
										<ProtectedRoute>
											<CodeTables />
										</ProtectedRoute>
									} 
								/>
							</Route>
							
							<Route 
								path="/layout" 
								element={
									<ProtectedRoute>
										<Layout />
									</ProtectedRoute>
								} 
							/>
							<Route path="/" element={<Navigate to="/dashboard" replace />} />
						</Routes>
					</Router>
				</AuthProvider>
				</ThemeProvider>
				<GlobalModal />
				</ToasterProvider>
		    </ModalProvider>
		</>
	)
}

export default App
