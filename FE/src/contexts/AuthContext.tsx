import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { authService } from '../pages/login/Service';
import { Navigate } from 'react-router-dom';

interface AuthState<T = any> {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: T;
}

interface AuthContextType extends AuthState {
  validateSession: () => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (role: string | string[]) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
    const [authState, setAuthState] = useState<AuthState>({
        isAuthenticated: false,
        isLoading: true,
        user: null
    });

    const validateSession = async () => {
        console.log('🔄 Validating session on app load');

        // Check for URL parameter bypass
        // subukan mo to http://localhost:8080/dashboard?bypass=true
        const urlParams = new URLSearchParams(window.location.search);
        const bypassAuth = urlParams.get('bypass') === 'true';

        if (bypassAuth) {
            console.log('🚫 Auth bypass via URL parameter');
            setAuthState({
                isAuthenticated: true,
                isLoading: false,
                user: { id: 'dev', name: 'Dev User', UserRole: 'admin' }
            });
            return;
        }

        // Bypass authentication in development
        if (import.meta.env.VITE_BYPASS_AUTH === 'true') {
            console.log('🚫 Auth bypass enabled - skipping authentication');
            setAuthState({
                isAuthenticated: true,
                isLoading: false,
                user: {
                    id: 'dev-user',
                    name: 'Development User',
                    UserRole: 'admin'
                }
            });
            return;
        }
        else{
        
            try {
                const response = await authService.validateSession();
                if (response.Data.Authenticated) {
                    setAuthState({
                        isAuthenticated: true,
                        isLoading: false,
                        user: response.Data.User
                    });
                    const path = localStorage.getItem('currentPath') || window.location.pathname;
	                window.location.href = path || import.meta.env.VITE_DEFAULT_ROUTE || '/dashboard';
                    return;
                } else {
                    console.log('❌ No valid session found', response);
                    setAuthState({
                        isAuthenticated: false,
                        isLoading: false,
                        user: null
                    });
                    localStorage.setItem('currentPath', window.location.pathname);
                    if (window.location.pathname !== '/login') {
                        // Redirect to login if not authenticated
                        window.location.href = '/login';
                    }
	                // window.location.href = window.location.pathname || import.meta.env.VITE_DEFAULT_ROUTE || '/dashboard';
                }
            } catch (error) {
                console.error('❌ Session validation failed:', error);
                setAuthState({
                    isAuthenticated: false,
                    isLoading: false,
                    user: null
                });
            }
        }
    };

    useEffect(() => {
        validateSession();
    }, []);

    const logout = async () => {
        console.log('👋 Logging out user');
        
        try {
            await authService.logout();
            console.log('✅ Server logout completed');
        } catch (error) {
            console.error('⚠️ Logout error (continuing anyway):', error);
        }
        
        setAuthState({
            isAuthenticated: false,
            isLoading: false,
            user: null
        });
    };

    const hasRole = (role: string | string[]): boolean => {
        if (!authState.user) return false;
        const roles = Array.isArray(role) ? role : [role];
        return roles.includes(authState.user.UserRole);
    };

    return (
        <AuthContext.Provider
            value={{
                ...authState,
                validateSession,
                logout,
                hasRole
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
