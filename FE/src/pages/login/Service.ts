
import { httpClient, type ApiResponse } from '../../services/httpClient';

export interface LoginRequest {
  UserName: string;
  Password: string;
}

export interface LoginResponse<T = any> {
  user: T;
  message?: string;
}

export interface AuthError {
  Message: string;
  Status: number;
  Errors?: Record<string, string[]>;
}

export interface User {
  FirstName: string;
  LastName: string;
  UserName: string;
  UserRole: string;
  PhoneNumber: string;
  Credit: number;
}

class AuthService {
  async login(credentials: LoginRequest): Promise<ApiResponse<LoginResponse>> {
    console.log('🚀 Attempting login');
    const response = await httpClient.post<LoginResponse>(
      '/Auth/Login', 
      credentials,
      { preloaderMessage: "Signing you in..." }
    );
    console.log('✅ Login successful - cookie set by server');
    return response;
  }

  async logout(): Promise<ApiResponse<null>> {
    console.log('👋 Processing logout');
    const response = await httpClient.post<null>(
      '/auth/logout',
      null,
      { preloaderMessage: "Signing you out..." }
    );
    console.log('✅ Logout successful - cookie cleared by server');
    return response;
  }

  async validateSession(): Promise<ApiResponse<{ Authenticated: boolean; User?: any }>> {
    console.log('🔍 Validating session via cookie');
    
    try {
      const response = await httpClient.post<{ message: string; Authenticated: boolean; User?: any }>(
        '/auth/validate',
        null,
        { preloaderMessage: "Validating session..." }
      );
      console.log('✅ Session validation completed:', response.Data.Authenticated ? 'Valid' : 'Invalid');
      return response;
    } catch (error) {
      console.error('❌ Session validation failed:', error);
      throw error;
    }
  }
}

export const authService = new AuthService();
