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

// ============= Organization API Methods =============

export const orgAPI = {
    create: async (data: { name: string; logo_url?: string; primary_color?: string }) => {
        const response = await apiClient.post('/organizations', data);
        return response.data;
    },
    list: async () => {
        const response = await apiClient.get('/organizations');
        return response.data;
    },
    get: async (orgId: string) => {
        const response = await apiClient.get(`/organizations/${orgId}`);
        return response.data;
    },
    getMembers: async (orgId: string) => {
        const response = await apiClient.get(`/organizations/${orgId}/members`);
        return response.data;
    },
    createTeam: async (orgId: string, data: { name: string; description?: string }) => {
        const response = await apiClient.post(`/organizations/${orgId}/teams`, data);
        return response.data;
    },
};

// ============= Team API Methods =============

export const teamAPI = {
    list: async (orgId: string) => {
        const response = await apiClient.get(`/organizations/${orgId}/teams`);
        return response.data;
    },
    create: async (orgId: string, data: { name: string; description?: string }) => {
        const response = await apiClient.post(`/organizations/${orgId}/teams`, data);
        return response.data;
    },
    get: async (orgId: string, teamId: string) => {
        const response = await apiClient.get(`/organizations/${orgId}/teams/${teamId}`);
        return response.data;
    },
    update: async (orgId: string, teamId: string, data: { name?: string; description?: string }) => {
        const response = await apiClient.put(`/organizations/${orgId}/teams/${teamId}`, data);
        return response.data;
    },
    delete: async (orgId: string, teamId: string) => {
        const response = await apiClient.delete(`/organizations/${orgId}/teams/${teamId}`);
        return response.data;
    },
    // Team member management
    getMembers: async (orgId: string, teamId: string) => {
        const response = await apiClient.get(`/organizations/${orgId}/teams/${teamId}/members`);
        return response.data;
    },
    addMember: async (orgId: string, teamId: string, data: { user_id: string }) => {
        const response = await apiClient.post(`/organizations/${orgId}/teams/${teamId}/members`, data);
        return response.data;
    },
    removeMember: async (orgId: string, teamId: string, userId: string) => {
        const response = await apiClient.delete(`/organizations/${orgId}/teams/${teamId}/members/${userId}`);
        return response.data;
    },
};

// ============= Role API Methods =============

export const roleAPI = {
    list: async (orgId: string) => {
        const response = await apiClient.get(`/organizations/${orgId}/roles`);
        return response.data;
    },
    create: async (orgId: string, data: { name: string; slug?: string; permissions: string[]; priority?: number }) => {
        const response = await apiClient.post(`/organizations/${orgId}/roles`, data);
        return response.data;
    },
    update: async (orgId: string, roleId: string, data: { name?: string; permissions?: string[]; priority?: number }) => {
        const response = await apiClient.put(`/organizations/${orgId}/roles/${roleId}`, data);
        return response.data;
    },
    delete: async (orgId: string, roleId: string) => {
        const response = await apiClient.delete(`/organizations/${orgId}/roles/${roleId}`);
        return response.data;
    },
    // Role assignment management
    getAssignments: async (orgId: string) => {
        const response = await apiClient.get(`/organizations/${orgId}/roles/assignments`);
        return response.data;
    },
    assign: async (orgId: string, data: { role_id: string; accessor_id: string; accessor_type: 'user' | 'team' }) => {
        const response = await apiClient.post(`/organizations/${orgId}/roles/assignments`, data);
        return response.data;
    },
    removeAssignment: async (orgId: string, assignmentId: string) => {
        const response = await apiClient.delete(`/organizations/${orgId}/roles/assignments/${assignmentId}`);
        return response.data;
    },
};

// ============= Project API Methods =============

export const projectAPI = {
    create: async (orgId: string, data: { name: string; description?: string }) => {
        const response = await apiClient.post(`/organizations/${orgId}/projects`, data);
        return response.data;
    },
    list: async (orgId: string) => {
        const response = await apiClient.get(`/organizations/${orgId}/projects`);
        return response.data;
    },
};

// ============= Form API Methods =============

export const formAPI = {
    create: async (projectId: string, data: { title: string; blueprint?: any; is_public?: boolean }) => {
        const response = await apiClient.post(`/projects/${projectId}/forms`, data);
        return response.data;
    },
    updateBlueprint: async (formId: string, blueprint: any) => {
        const response = await apiClient.put(`/forms/${formId}/blueprint`, blueprint);
        return response.data;
    },
    get: async (formId: string) => {
        const response = await apiClient.get(`/forms/${formId}`);
        return response.data;
    },
    publish: async (formId: string) => {
        const response = await apiClient.post(`/forms/${formId}/publish`);
        return response.data;
    },
    list: async (projectId: string) => {
        const response = await apiClient.get(`/projects/${projectId}/forms`);
        return response.data;
    },
};

// ============= Submission API Methods =============

export const submissionAPI = {
    create: async (data: { form_id: string; data: any; metadata?: any }) => {
        const response = await apiClient.post('/submissions', data);
        return response.data;
    },
    getPublicForm: async (slug: string) => {
        const response = await apiClient.get(`/public/forms/${slug}`);
        return response.data;
    },
    submitPublic: async (slug: string, data: { data: any; metadata?: any }) => {
        const response = await apiClient.post(`/public/submissions/${slug}`, data);
        return response.data;
    },
};

export default apiClient;
