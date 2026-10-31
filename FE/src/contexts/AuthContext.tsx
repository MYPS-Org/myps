import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { authService } from '../pages/login/Service';
import type { User } from '../pages/login/Service';

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  ViewAccess : string[];
  /** Granted API actions, as "ProgramController.AddProgram". */
  ActionAccess: string[];
}

interface AuthContextType extends AuthState {
  validateSession: () => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (role: string | string[]) => boolean;
  /** True when the user's groups may call the action: can('Program', 'AddProgram'). */
  can: (controller: string, action: string) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

/*  Pages (ViewAccess) and actions (ActionAccess) are exactly what the user's groups are granted in
    User Management > User Groups > Edit Group. 2026-10-31: the 2026-10-18 rule that always hid Lump Sum
    and Code Tables from DPC/RPC by group name is gone; those pages follow the group's grants like the rest. */

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
    const [authState, setAuthState] = useState<AuthState>({
        isAuthenticated: false,
        isLoading: true,
        user: null,
        ViewAccess: [],
        ActionAccess: []
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
                    ViewAccess: response.Data.Data.ViewAccess || [],
                    ActionAccess: response.Data.Data.ActionAccess || []
                });
                if(window.location.pathname === '/login') {
                    const storedPath = localStorage.getItem('currentPath');
                    // Avoid infinite loop by not redirecting back to login
                    const path = (storedPath && storedPath !== '/login')
                        ? storedPath
                        : (import.meta.env.VITE_DEFAULT_ROUTE || '/dashboard');
                    localStorage.removeItem('currentPath'); // Clean up after use
                    window.location.href = path;
                }
            } else {
                console.log('❌ No valid session found', response);
                setAuthState({
                    isAuthenticated: false,
                    isLoading: false,
                    user: null,
                    ViewAccess: [],
                    ActionAccess: []
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
                user: null,
                ViewAccess: [],
                ActionAccess: []
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
            ViewAccess: [],
            ActionAccess: []
        });
    };

    const hasRole = (role: string | string[]): boolean => {
        if (!authState.user) return false;
        const roles = Array.isArray(role) ? role : [role];
        return roles.includes(authState.user.UserRole);
    };

    /*  2026-10-31: hides what the API would refuse with 403 (it checks the same grants). The API stays the
        gate; this only keeps a button from being offered to a group that may not use it. */
    const can = (controller: string, action: string): boolean =>
        authState.ActionAccess.includes(`${controller}Controller.${action}`);

    return (
        <AuthContext.Provider
            value={{
                ...authState,
                validateSession,
                logout,
                hasRole,
                can
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
