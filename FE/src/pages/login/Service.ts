
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
  Name: string;
  UserName: string;
  UserId: string;
  UserRole: string;
  PhoneNumber: string;
  Credit: number;
  UserGroupNames: string[];
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

  async logout(){
    console.log('👋 Processing logout');
    const response = await httpClient.post<null>(
      '/auth/logout',
      null,
      { preloaderMessage: "Signing you out...", withCredentials: true }
    );
    console.log('✅ Logout successful - cookie cleared by server');
    return response;
  }

  async validateSession() {
    console.log('🔍 Validating session via cookie');
    
    try {
      const response = await httpClient.post<ApiResponse>(
        '/auth/validate',
        null,
        { preloaderMessage: "Validating session...", withCredentials: true }
      );
      return response;
    } catch (error) {
      console.error('❌ Session validation failed:', error);
      throw error;
    }
  }
}

export const authService = new AuthService();
