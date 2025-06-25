
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css'
import { AuthProvider } from './contexts/AuthContext'
import LoginForm from './pages/login/Page';
import Dashboard from './pages/Dashboard/Dashboard';
import ProtectedRoute from './components/protectedroutes';
import Preloader from './components/Preloader';

function App() {
	return (
		<>
			<AuthProvider>
				<Router>
					<Preloader />
					<Routes>
						<Route path="/login" element={<LoginForm />} />
						<Route 
							path="/dashboard" 
							element={
								<ProtectedRoute>
									<Dashboard />
								</ProtectedRoute>
							} 
						/>
						<Route path="/" element={<Navigate to="/dashboard" replace />} />
					</Routes>
				</Router>
			</AuthProvider>
		</>
	)
}

export default App
