import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { authService } from '../services/authService';

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
        
        try {
            const response = await authService.validateSession();
            
            if (response.data.Authenticated && response.data.user) {
                setAuthState({
                    isAuthenticated: true,
                    isLoading: false,
                    user: response.data.user
                });
            } else {
                console.log('❌ No valid session found', response);
                setAuthState({
                    isAuthenticated: false,
                    isLoading: false,
                    user: null
                });
            }
        } catch (error) {
            console.error('❌ Session validation failed:', error);
            setAuthState({
                isAuthenticated: false,
                isLoading: false,
                user: null
            });
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
