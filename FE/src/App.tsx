// App.tsx
import { BrowserRouter as Router } from 'react-router-dom';
import './App.css';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import Preloader from './components/Preloader';
import { ModalProvider } from './components/Modal/ModalContext';
import GlobalModal from './components/Modal/Modal';
import { ToasterProvider } from './components/toaster/ToasterContext';
import { HttpClientSetup } from './components/HttpClientSetup';
import AppRoutes from './components/AppRoutes'; // ✅ new component

function App() {
  return (
    <ModalProvider>
      <ToasterProvider>
        <HttpClientSetup />
        <ThemeProvider>
          <AuthProvider>          {/* ✅ AuthProvider wraps Router */}
            <Router>
              <Preloader />
              <AppRoutes />       {/* ✅ useAuth() safely called inside here */}
            </Router>
          </AuthProvider>
        </ThemeProvider>
        <GlobalModal />
      </ToasterProvider>
    </ModalProvider>
  );
}

export default App;