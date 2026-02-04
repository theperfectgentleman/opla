import axios from 'axios';

// API Base URL from environment
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

// Create axios instance
const apiClient = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor - attach access token
apiClient.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('access_token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor - handle 401 and auto-refresh token
apiClient.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        // If 401 and we haven't tried to refresh yet
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            try {
                const refreshToken = localStorage.getItem('refresh_token');

                if (!refreshToken) {
                    // No refresh token, logout user
                    localStorage.removeItem('access_token');
                    localStorage.removeItem('refresh_token');
                    localStorage.removeItem('user');
                    window.location.href = '/login';
                    return Promise.reject(error);
                }

                // Try to refresh the access token
                const response = await axios.post(`${API_URL}/auth/refresh`, {
                    refresh_token: refreshToken,
                });

                const { access_token, refresh_token: newRefreshToken } = response.data;

                // Store new tokens
                localStorage.setItem('access_token', access_token);
                localStorage.setItem('refresh_token', newRefreshToken);

                // Retry original request with new token
                originalRequest.headers.Authorization = `Bearer ${access_token}`;
                return apiClient(originalRequest);
            } catch (refreshError) {
                // Refresh failed, logout user
                localStorage.removeItem('access_token');
                localStorage.removeItem('refresh_token');
                localStorage.removeItem('user');
                window.location.href = '/login';
                return Promise.reject(refreshError);
            }
        }

        return Promise.reject(error);
    }
);

// ============= Auth API Methods =============

export const authAPI = {
    // Register with email
    registerEmail: async (data: {
        email: string;
        password: string;
        full_name: string;
    }) => {
        const response = await apiClient.post('/auth/register/email', data);
        return response.data;
    },

    // Register with phone
    registerPhone: async (data: { phone: string; full_name: string }) => {
        const response = await apiClient.post('/auth/register/phone', data);
        return response.data;
    },

    // Login with email/password
    login: async (data: { email: string; password: string }) => {
        const response = await apiClient.post('/auth/login', data);
        return response.data;
    },

    // Request OTP
    requestOTP: async (data: { phone: string }) => {
        const response = await apiClient.post('/auth/otp/request', data);
        return response.data;
    },

    // Verify OTP
    verifyOTP: async (data: { phone: string; otp: string }) => {
        const response = await apiClient.post('/auth/otp/verify', data);
        return response.data;
    },

    // Refresh access token
    refreshToken: async (refreshToken: string) => {
        const response = await apiClient.post('/auth/refresh', {
            refresh_token: refreshToken,
        });
        return response.data;
    },

    // Get current user
    getCurrentUser: async () => {
        const response = await apiClient.get('/auth/me');
        return response.data;
    },
};

export default apiClient;
