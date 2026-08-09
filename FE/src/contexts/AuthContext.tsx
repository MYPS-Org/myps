import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { authService } from '../pages/login/Service';
import type { User } from '../pages/login/Service';
import {
    isBackendUnreachable,
    isKnownRoute,
    offlineFallbackEnabled,
    offlineRoute,
    offlineUser,
    offlineViewAccess,
    onlineRoute,
} from '../utils/offlineMode';

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  ViewAccess : string[];
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
        user: null,
        ViewAccess: []
    });

    const validateSession = async () => {
        console.log('🔄 Validating session on app load');

        // Check for URL parameter bypass
        // subukan mo to http://localhost:8080/dashboard?bypass=true
        try {
            const response = await authService.validateSession();
            // console.log('rine => ', response);
            if (response.Data.Data.Authenticated) {
                localStorage.setItem('currentPath', window.location.pathname);
                console.log('✅ Valid session found', response);
                setAuthState({
                    isAuthenticated: true,
                    isLoading: false,
                    user: { ...response.Data.Data.User,
                        // UserGroup: response.Data.Data.User.UserGroup
                        },
                    ViewAccess: response.Data.Data.ViewAccess || []
                });
                if(window.location.pathname === '/login') {
                    const storedPath = localStorage.getItem('currentPath');
                    // Avoid infinite loop by not redirecting back to login
                    const path = (storedPath && storedPath !== '/login')
                        ? storedPath
                        : onlineRoute;
                    localStorage.removeItem('currentPath'); // Clean up after use
                    window.location.href = path;
                }
            } else {
                console.log('❌ No valid session found', response);
                setAuthState({
                    isAuthenticated: false,
                    isLoading: false,
                    user: null,
                    ViewAccess: []
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

            // VPN down / backend unreachable: run offline instead of bouncing to /login,
            // which cannot be completed without the backend either.
            if (offlineFallbackEnabled && isBackendUnreachable(error)) {
                console.warn(`📴 Backend unreachable — offline session, landing on ${offlineRoute}`);
                setAuthState({
                    isAuthenticated: true,
                    isLoading: false,
                    user: offlineUser,
                    ViewAccess: offlineViewAccess
                });
                const path = window.location.pathname;
                if (path !== offlineRoute && !isKnownRoute(path)) {
                    window.location.href = offlineRoute;
                }
                return;
            }

            setAuthState({
                isAuthenticated: false,
                isLoading: false,
                user: null,
                ViewAccess: []
            });
            if (window.location.pathname !== '/login') {
                window.location.href = '/login';
            }
        }
    };

    useEffect(() => {
        validateSession();

        const handlePageShow = (event: PageTransitionEvent) => {
            if (event.persisted) {
                validateSession();
            }
        };
        window.addEventListener('pageshow', handlePageShow);
        return () => window.removeEventListener('pageshow', handlePageShow);
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
            user: null,
            ViewAccess: []
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
