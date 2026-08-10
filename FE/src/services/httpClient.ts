import axios from 'axios';
import type { AxiosInstance, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from 'axios';

export interface PreloaderState {
    loading: boolean;
    progress: number;
    message: string;
}

export interface ApiResponse<T = any> {
    Data: T;
    Message?: string;
    Type?: string;
    Title?: string;
    Status: number;
}
export interface ErrorResponse {
    Message?: string;
    Title?: string;
    Status: number;
}

export interface RequestConfig extends AxiosRequestConfig {
    preloaderMessage?: string;
}
export interface HttpClientConfig {
    baseURL: string;
    defaultHeaders?: Record<string, string>;
    withCredentials?: boolean;
}
const withPeriod = (msg: string) => msg.trimEnd().endsWith('.') ? msg : `${msg}.`;

class HttpClient {
    private client: AxiosInstance;
    private preloaderCallbacks: ((state: PreloaderState) => void)[] = [];
    private toastCallback: ((options: { type: 'success' | 'error' | 'info' | 'warning'; message: string }) => void) | null = null;
    private activeRequests = 0;
    private hideTimeout: ReturnType<typeof setTimeout> | null = null;

    constructor(config: HttpClientConfig) {
        this.client = axios.create({
            baseURL: config.baseURL,
            timeout: 0, // No timeout
            withCredentials: config.withCredentials ?? false,
            headers: {
                'Content-Type': 'application/json',
                ...config.defaultHeaders,
            },
        });

        this.setupInterceptors();
    }

    private setupInterceptors() {
        // Request interceptor
        this.client.interceptors.request.use(
            (config: InternalAxiosRequestConfig) => {
                const customConfig = config as InternalAxiosRequestConfig & { preloaderMessage?: string };
                // Cancel any pending hide so new request's loading state isn't cleared
                if (this.hideTimeout) {
                    clearTimeout(this.hideTimeout);
                    this.hideTimeout = null;
                }
                this.activeRequests++;
                this.updatePreloader({
                    loading: true,
                    progress: 0,
                    message: customConfig.preloaderMessage ?? 'Getting data...'
                });

                // console.log('🚀 HTTP Request:', config.method?.toUpperCase(), config.url);
                return config;
            },
            (error: any) => {
                this.activeRequests = Math.max(0, this.activeRequests - 1);
                if (this.activeRequests === 0) {
                    this.updatePreloader({ loading: false, progress: 0, message: '' });
                }
                return Promise.reject(error);
            }
        );

        // Response interceptor
        this.client.interceptors.response.use(
            (response: AxiosResponse) => {
                this.activeRequests = Math.max(0, this.activeRequests - 1);

                if (this.activeRequests === 0) {
                    this.updatePreloader({
                        loading: false,
                        progress: 100,
                        message: 'Request completed'
                    });
                    // Hide preloader after a short delay only when no more requests are inflight
                    this.hideTimeout = setTimeout(() => {
                        this.hideTimeout = null;
                        if (this.activeRequests === 0) {
                            this.updatePreloader({ loading: false, progress: 0, message: '' });
                        }
                    }, 500);
                }

                // console.log('✅ HTTP Response:', response.status, response.config.url);
                return response;
            },
            async (error: any) => {
                this.activeRequests = Math.max(0, this.activeRequests - 1);
                if (this.activeRequests === 0) {
                    this.updatePreloader({ loading: false, progress: 0, message: '' });
                }

                console.error('❌ HTTP Error:', error.response?.status, error.config?.url, error.message);

                // Handle 404 errors specifically
                if (error.response?.status === 400) {
                    const errorResponse: ErrorResponse = {
                        Message: error.response?.data?.Message || 'Resource not found',
                        Title: error.response?.data?.Title || 'Not Found',
                        Status: 404
                    };

                    if (this.toastCallback) {
                        this.toastCallback({
                            type: 'error',
                            message: withPeriod(errorResponse.Message || 'An unknown error occurred. Please try again later.')
                        });
                    }
                    
                    // const { showModal } = useModal();
                    // await showModal({
                    //     icon: 'error',
                    //     Title: errorResponse.Title || 'Unknown Error occurred',
                    //     Message: errorResponse.Message || 'An unknown error occurred. Please try again later.',
                    //     button: ['Close'],
                    //     type: 'alert' // optional, defaults to 'confirm' if not provided. types are 'confirm' and 'alert'
                    // });
                    throw errorResponse;
                }

                // Handle other errors
                if (error.response?.data?.Message) {
                    // console.log('API Error Message:', error);
                    if (this.toastCallback) {
                        this.toastCallback({
                            type: 'error',
                            message: withPeriod(error.response.data.Message)
                        });
                    }
                    const errorResponse: ErrorResponse = {
                        Message: error.response.data.Message,
                        Title: error.response.data.Title,
                        Status: error.response.status
                    };
                    throw errorResponse;
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

    setToastCallback(callback: (options: { type: 'success' | 'error' | 'info' | 'warning'; message: string }) => void) {
        this.toastCallback = callback;
    }

    async post<T>(url: string, data?: any, config?: RequestConfig): Promise<ApiResponse<T>> {
        const response: AxiosResponse<T> = await this.client.post(url, data, config);
        return {
            Data: response.data,
            Status: response.status,
        };
    }

    async put<T>(url: string, data?: any, config?: RequestConfig): Promise<ApiResponse<T>> {
        const response: AxiosResponse<T> = await this.client.put(url, data, config);
        return {
            Data: response.data,
            Status: response.status,
        };
    }

    async get<T>(url: string, params?: Record<string, string>, config?: RequestConfig): Promise<ApiResponse<T>> {
        const response: AxiosResponse<T> = await this.client.get(url, { params, ...config });
        return {
            Data: response.data,
            Status: response.status,
        };
    }
}

export const httpClient = new HttpClient({
    baseURL: '/api',
    withCredentials: true,
});

export const gisClient = new HttpClient({
    baseURL: import.meta.env.VITE_API_GIS_URL as string,
    defaultHeaders: { 'ngrok-skip-browser-warning': 'true' },
    withCredentials: false,
});
