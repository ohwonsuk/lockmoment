import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { StorageService } from './StorageService';
import { Config } from '../config/Config';

// Standard API Response wrapper
export interface ApiResponse<T = any> {
    success: boolean;
    data: T;
    message?: string;
}

class ApiService {
    private api: AxiosInstance;

    constructor() {
        this.api = axios.create({
            baseURL: Config.API_BASE_URL,
            headers: {
                'Content-Type': 'application/json',
            },
            timeout: Config.API_TIMEOUT,
        });
        console.log(`[ApiService] Initialized with BaseURL: ${Config.API_BASE_URL}`);

        this.setupInterceptors();
    }

    private setupInterceptors() {
        // Request Interceptor: Attach Token
        this.api.interceptors.request.use(
            async (config) => {
                const token = await StorageService.getAccessToken();
                if (token) {
                    config.headers.Authorization = `Bearer ${token}`;
                }
                return config;
            },
            (error) => Promise.reject(error)
        );

        // Response Interceptor: Handle Errors (e.g., 401)
        this.api.interceptors.response.use(
            (response) => {
                return response;
            },
            async (error) => {
                const originalRequest = error.config;
                return Promise.reject(error);
            }
        );
    }

    // Generic GET method
    public async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
        try {
            console.log(`[API GET Request] ${url}`);
            const response: AxiosResponse<T> = await this.api.get(url, config);
            console.log(`[API GET Success] ${url}`, JSON.stringify(response.data, null, 2));
            return response.data;
        } catch (error: any) {
            console.error(`[API GET Error] ${url}`, error.response?.data || error.message);
            throw error.response?.data || error.message;
        }
    }

    // Generic POST method
    public async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
        try {
            console.log(`[API POST Request] ${url}`, JSON.stringify(data, null, 2));
            const response: AxiosResponse<T> = await this.api.post(url, data, config);
            console.log(`[API POST Success] ${url}`, JSON.stringify(response.data, null, 2));
            return response.data;
        } catch (error: any) {
            console.error(`[API POST Error] ${url}`, error.response?.data || error.message);
            throw error.response?.data || error.message;
        }
    }

    // Generic PUT method
    public async put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
        try {
            console.log(`[API PUT Request] ${url}`, data);
            const response: AxiosResponse<T> = await this.api.put(url, data, config);
            console.log(`[API PUT Success] ${url}`, response.data);
            return response.data;
        } catch (error: any) {
            console.error(`[API PUT Error] ${url}`, error.response?.data || error.message);
            throw error.response?.data || error.message;
        }
    }

    // Generic PATCH method
    public async patch<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
        try {
            console.log(`[API PATCH Request] ${url}`, data);
            const response: AxiosResponse<T> = await this.api.patch(url, data, config);
            console.log(`[API PATCH Success] ${url}`, response.data);
            return response.data;
        } catch (error: any) {
            console.error(`[API PATCH Error] ${url}`, error.response?.data || error.message);
            throw error.response?.data || error.message;
        }
    }

    // Generic DELETE method
    public async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
        try {
            console.log(`[API DELETE Request] ${url}`);
            const response: AxiosResponse<T> = await this.api.delete(url, config);
            console.log(`[API DELETE Success] ${url}`, response.data);
            return response.data;
        } catch (error: any) {
            console.error(`[API DELETE Error] ${url}`, error.response?.data || error.message);
            throw error.response?.data || error.message;
        }
    }
}

export const apiService = new ApiService();
