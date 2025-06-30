
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
import Settings from './pages/Settings/Settings';

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
