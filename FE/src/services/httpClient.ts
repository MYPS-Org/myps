import axios from 'axios';
import type { AxiosInstance, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from 'axios';

export interface PreloaderState {
  loading: boolean;
  progress: number;
  message: string;
}

export interface ApiResponse<T = any> {
  data: T;
  message?: string;
  status: number;
}

export interface RequestConfig extends AxiosRequestConfig {
  preloaderMessage?: string;
}

class HttpClient {
  private client: AxiosInstance;
  private preloaderCallbacks: ((state: PreloaderState) => void)[] = [];

  constructor() {
    this.client = axios.create({
      baseURL: import.meta.env.VITE_API_BASE_URL,
      timeout: 0, // No timeout
      withCredentials: true,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor
    this.client.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        const customConfig = config as InternalAxiosRequestConfig & { preloaderMessage?: string };
        if (customConfig.preloaderMessage) {
          this.updatePreloader({
            loading: true,
            progress: 0,
            message: customConfig.preloaderMessage
          });
        }
        console.log('🚀 HTTP Request:', config.method?.toUpperCase(), config.url);
        return config;
      },
      (error: any) => {
        this.updatePreloader({ loading: false, progress: 0, message: '' });
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response: AxiosResponse) => {
        this.updatePreloader({
          loading: false,
          progress: 100,
          message: 'Request completed'
        });
        
        // Hide preloader after a short delay
        setTimeout(() => {
          this.updatePreloader({ loading: false, progress: 0, message: '' });
        }, 500);

        console.log('✅ HTTP Response:', response.status, response.config.url);
        return response;
      },
      (error: any) => {
        this.updatePreloader({ loading: false, progress: 0, message: '' });
        console.error('❌ HTTP Error:', error.response?.status, error.config?.url, error.message);
        
        if (error.response?.data?.Message) {
          throw new Error(error.response.data.Message);
        }
        
        throw error;
      }
    );
  }

  private updatePreloader(state: PreloaderState) {
    this.preloaderCallbacks.forEach(callback => callback(state));
  }

  addPreloaderCallback(callback: (state: PreloaderState) => void) {
    this.preloaderCallbacks.push(callback);
  }

  removePreloaderCallback(callback: (state: PreloaderState) => void) {
    const index = this.preloaderCallbacks.indexOf(callback);
    if (index > -1) {
      this.preloaderCallbacks.splice(index, 1);
    }
  }

  async get<T>(url: string, config?: RequestConfig): Promise<ApiResponse<T>> {
    const response: AxiosResponse<T> = await this.client.get(url, config);
    return {
      data: response.data,
      status: response.status,
    };
  }

  async post<T>(url: string, data?: any, config?: RequestConfig): Promise<ApiResponse<T>> {
    const response: AxiosResponse<T> = await this.client.post(url, data, config);
    return {
      data: response.data,
      status: response.status,
    };
  }

  async put<T>(url: string, data?: any, config?: RequestConfig): Promise<ApiResponse<T>> {
    const response: AxiosResponse<T> = await this.client.put(url, data, config);
    return {
      data: response.data,
      status: response.status,
    };
  }

  async delete<T>(url: string, config?: RequestConfig): Promise<ApiResponse<T>> {
    const response: AxiosResponse<T> = await this.client.delete(url, config);
    return {
      data: response.data,
      status: response.status,
    };
  }
}

export const httpClient = new HttpClient();
