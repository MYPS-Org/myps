
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
import ProjectDetails from './pages/Project/Views/ProjectDetails';

function App() {
	return (
		<>
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
								path="/rbac" 
								element={
									<ProtectedRoute>
										<Rbac />
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
								path="/projects" 
								element={
									<ProtectedRoute>
										<Project />
									</ProtectedRoute>
								} 
							/>
							<Route 
								path="/programs/:id" 
								element={
									<ProtectedRoute>
										<ProgramDetail />
									</ProtectedRoute>
								} 
							/>
							<Route 
								path="/projects/:id" 
								element={
									<ProtectedRoute>
										<ProjectDetails />
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
		</>
	)
}

export default App
