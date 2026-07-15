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
    listInvitations: async (orgId: string) => {
        const response = await apiClient.get(`/organizations/${orgId}/invitations`);
        return response.data;
    },
    createInternalInvitation: async (
        orgId: string,
        data: { invited_email?: string; delivery_mode: 'email' | 'short_link' },
    ) => {
        const response = await apiClient.post(`/organizations/${orgId}/invitations/internal`, data);
        return response.data;
    },
    approveInvitation: async (orgId: string, invitationId: string) => {
        const response = await apiClient.post(`/organizations/${orgId}/invitations/${invitationId}/approve`);
        return response.data;
    },
    revokeInvitation: async (orgId: string, invitationId: string) => {
        const response = await apiClient.delete(`/organizations/${orgId}/invitations/${invitationId}`);
        return response.data;
    },
    acceptInvitation: async (data: { token?: string; pin_code?: string }) => {
        const response = await apiClient.post('/organizations/invitations/accept', data);
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
    createContractorInvitation: async (
        orgId: string,
        teamId: string,
        data: { delivery_mode: 'generated_link' | 'pin_code'; approval_mode: 'auto' | 'review' },
    ) => {
        const response = await apiClient.post(`/organizations/${orgId}/teams/${teamId}/invitations/contractor`, data);
        return response.data;
    },
};

// ============= Role API Methods =============

export const roleAPI = {
    list: async (orgId: string) => {
        const response = await apiClient.get(`/organizations/${orgId}/roles`);
        return response.data;
    },
    getCatalog: async (orgId: string) => {
        const response = await apiClient.get(`/organizations/${orgId}/roles/catalog`);
        return response.data;
    },
    create: async (orgId: string, data: { name: string; slug?: string; description?: string; permissions: string[]; priority?: number }) => {
        const response = await apiClient.post(`/organizations/${orgId}/roles`, data);
        return response.data;
    },
    update: async (orgId: string, roleId: string, data: { name?: string; description?: string; permissions?: string[]; priority?: number }) => {
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
    removeAssignment: async (orgId: string, accessorType: 'user' | 'team', accessorId: string) => {
        const response = await apiClient.delete(`/organizations/${orgId}/roles/assignments/${accessorType}/${accessorId}`);
        return response.data;
    },
};

// ============= Project API Methods =============

export const projectAPI = {
    create: async (
        orgId: string,
        data: {
            name: string;
            description?: string;
            collection_start_date: string;
            collection_end_date: string;
            collection_time_start?: string;
            collection_time_end?: string;
            expected_total_count?: number | null;
            expected_weekly_count?: number | null;
        },
    ) => {
        const response = await apiClient.post(`/organizations/${orgId}/projects`, data);
        return response.data;
    },
    list: async (orgId: string) => {
        const response = await apiClient.get(`/organizations/${orgId}/projects`);
        return response.data;
    },
    get: async (orgId: string, projectId: string) => {
        const response = await apiClient.get(`/organizations/${orgId}/projects/${projectId}`);
        return response.data;
    },
    update: async (
        orgId: string,
        projectId: string,
        data: {
            name?: string;
            description?: string;
            status?: 'planning' | 'active' | 'paused' | 'archived';
            collection_start_date?: string;
            collection_end_date?: string;
            collection_time_start?: string;
            collection_time_end?: string;
            expected_total_count?: number | null;
            expected_weekly_count?: number | null;
        },
    ) => {
        const response = await apiClient.patch(`/organizations/${orgId}/projects/${projectId}`, data);
        return response.data;
    },
    listAccess: async (orgId: string, projectId: string) => {
        const response = await apiClient.get(`/organizations/${orgId}/projects/${projectId}/access`);
        return response.data;
    },
    listRoleTemplates: async (orgId: string) => {
        const response = await apiClient.get(`/organizations/${orgId}/projects/role-templates`);
        return response.data;
    },
    createRoleTemplate: async (
        orgId: string,
        data: { name: string; description?: string; permissions: string[]; priority?: number },
    ) => {
        const response = await apiClient.post(`/organizations/${orgId}/projects/role-templates`, data);
        return response.data;
    },
    updateRoleTemplate: async (
        orgId: string,
        roleTemplateId: string,
        data: { name?: string; description?: string; permissions?: string[]; priority?: number },
    ) => {
        const response = await apiClient.patch(`/organizations/${orgId}/projects/role-templates/${roleTemplateId}`, data);
        return response.data;
    },
    deleteRoleTemplate: async (orgId: string, roleTemplateId: string) => {
        const response = await apiClient.delete(`/organizations/${orgId}/projects/role-templates/${roleTemplateId}`);
        return response.data;
    },
    grantAccess: async (
        orgId: string,
        projectId: string,
        data: { accessor_id: string; accessor_type: 'user' | 'team'; role_template_id?: string; role?: 'collector' | 'analyst' | 'editor' },
    ) => {
        const response = await apiClient.post(`/organizations/${orgId}/projects/${projectId}/access`, data);
        return response.data;
    },
    revokeAccess: async (orgId: string, projectId: string, accessorId: string, accessorType: 'user' | 'team') => {
        const response = await apiClient.delete(
            `/organizations/${orgId}/projects/${projectId}/access/${accessorId}?accessor_type=${accessorType}`,
        );
        return response.data;
    },
    listTasks: async (orgId: string, projectId: string) => {
        const response = await apiClient.get(`/organizations/${orgId}/projects/${projectId}/tasks`);
        return response.data;
    },
    listAttendance: async (orgId: string, projectId: string, date?: string) => {
        const response = await apiClient.get(`/organizations/${orgId}/projects/${projectId}/attendance`, {
            params: date ? { date } : undefined,
        });
        return response.data;
    },
    listPinnedAnalytics: async (orgId: string, projectId: string) => {
        const response = await apiClient.get(`/organizations/${orgId}/projects/${projectId}/pinned-analytics`);
        return response.data;
    },
    replacePinnedAnalytics: async (orgId: string, projectId: string, questionIds: string[]) => {
        const response = await apiClient.put(`/organizations/${orgId}/projects/${projectId}/pinned-analytics`, {
            question_ids: questionIds,
        });
        return response.data;
    },
    listAttention: async (orgId: string, projectId: string) => {
        const response = await apiClient.get(`/organizations/${orgId}/projects/${projectId}/attention`);
        return response.data;
    },
    dismissAttention: async (orgId: string, projectId: string, itemId: string) => {
        const response = await apiClient.post(
            `/organizations/${orgId}/projects/${projectId}/attention/${itemId}/dismiss`,
        );
        return response.data;
    },
    listAttentionHooks: async (orgId: string, projectId: string) => {
        const response = await apiClient.get(`/organizations/${orgId}/projects/${projectId}/attention/hooks`);
        return response.data;
    },
    createAttentionHook: async (
        orgId: string,
        projectId: string,
        data: { kind: string; severity_default?: string; enabled?: boolean; config_json?: Record<string, unknown> },
    ) => {
        const response = await apiClient.post(`/organizations/${orgId}/projects/${projectId}/attention/hooks`, data);
        return response.data;
    },
    listMedia: async (orgId: string, projectId: string, params?: { limit?: number; media_kind?: string }) => {
        const response = await apiClient.get(`/organizations/${orgId}/projects/${projectId}/media`, { params });
        return response.data;
    },
    listMessages: async (orgId: string, projectId: string) => {
        const response = await apiClient.get(`/organizations/${orgId}/projects/${projectId}/messages`);
        return response.data;
    },
    getMessageChannel: async (orgId: string, projectId: string, channelId: string) => {
        const response = await apiClient.get(`/organizations/${orgId}/projects/${projectId}/message-channels/${channelId}`);
        return response.data;
    },
    listChannelMessages: async (
        orgId: string,
        projectId: string,
        channelId: string,
        params?: { limit?: number; before?: string },
    ) => {
        const response = await apiClient.get(
            `/organizations/${orgId}/projects/${projectId}/message-channels/${channelId}/messages`,
            { params },
        );
        return response.data;
    },
    postChannelMessage: async (
        orgId: string,
        projectId: string,
        channelId: string,
        data: { body: string; mentioned_user_ids?: string[] },
    ) => {
        const response = await apiClient.post(
            `/organizations/${orgId}/projects/${projectId}/message-channels/${channelId}/messages`,
            data,
        );
        return response.data;
    },
    editMessage: async (
        orgId: string,
        projectId: string,
        messageId: string,
        data: { body: string; mentioned_user_ids?: string[] },
    ) => {
        const response = await apiClient.patch(
            `/organizations/${orgId}/projects/${projectId}/messages/${messageId}`,
            data,
        );
        return response.data;
    },
    deleteMessage: async (orgId: string, projectId: string, messageId: string) => {
        const response = await apiClient.delete(
            `/organizations/${orgId}/projects/${projectId}/messages/${messageId}`,
        );
        return response.data;
    },
    listMessageNotifications: async (orgId: string, params?: { unread_only?: boolean; limit?: number }) => {
        const response = await apiClient.get(`/organizations/${orgId}/message-notifications`, { params });
        return response.data;
    },
    markMessageNotificationRead: async (orgId: string, notificationId: string) => {
        const response = await apiClient.post(
            `/organizations/${orgId}/message-notifications/${notificationId}/read`,
        );
        return response.data;
    },
    listDirectoryItems: async (orgId: string, projectId: string) => {
        const response = await apiClient.get(`/organizations/${orgId}/projects/${projectId}/directory-items`);
        return response.data;
    },
    createDirectoryItem: async (
        orgId: string,
        projectId: string,
        data: {
            sku_code: string;
            label: string;
            default_price?: number;
            unit?: string;
            brand?: string;
            is_active?: boolean;
            price_editable?: boolean;
            metadata_json?: Record<string, any>;
        },
    ) => {
        const response = await apiClient.post(`/organizations/${orgId}/projects/${projectId}/directory-items`, data);
        return response.data;
    },
    updateDirectoryItem: async (
        orgId: string,
        projectId: string,
        itemId: string,
        data: {
            sku_code?: string;
            label?: string;
            default_price?: number;
            unit?: string;
            brand?: string;
            is_active?: boolean;
            price_editable?: boolean;
            metadata_json?: Record<string, any>;
        },
    ) => {
        const response = await apiClient.patch(`/organizations/${orgId}/projects/${projectId}/directory-items/${itemId}`, data);
        return response.data;
    },
    deleteDirectoryItem: async (orgId: string, projectId: string, itemId: string) => {
        const response = await apiClient.delete(`/organizations/${orgId}/projects/${projectId}/directory-items/${itemId}`);
        return response.data;
    },
    createTask: async (
        orgId: string,
        projectId: string,
        data: {
            title: string;
            description?: string;
            starts_at?: string;
            due_at?: string;
            context_json?: Record<string, unknown>;
            assigned_accessor_id?: string;
            assigned_accessor_type?: 'user' | 'team';
        },
    ) => {
        const response = await apiClient.post(`/organizations/${orgId}/projects/${projectId}/tasks`, data);
        return response.data;
    },
    updateTask: async (
        orgId: string,
        projectId: string,
        taskId: string,
        data: {
            title?: string;
            description?: string;
            status?: 'todo' | 'in_progress' | 'done' | 'blocked' | 'cancelled';
            starts_at?: string;
            due_at?: string;
            assigned_accessor_id?: string;
            assigned_accessor_type?: 'user' | 'team';
            clear_assignment?: boolean;
        },
    ) => {
        const response = await apiClient.patch(`/organizations/${orgId}/projects/${projectId}/tasks/${taskId}`, data);
        return response.data;
    },
    deleteTask: async (orgId: string, projectId: string, taskId: string) => {
        const response = await apiClient.delete(`/organizations/${orgId}/projects/${projectId}/tasks/${taskId}`);
        return response.data;
    },
};

// ============= Form API Methods =============

export const formAPI = {
    create: async (projectId: string, data: { title: string; blueprint?: any; is_public?: boolean; kind?: 'standard' | 'directory' }) => {
        const response = await apiClient.post(`/projects/${projectId}/forms`, data);
        return response.data;
    },
    listAutomationRules: async (formId: string) => {
        const response = await apiClient.get(`/forms/${formId}/automation-rules`);
        return response.data;
    },
    createAutomationRule: async (
        formId: string,
        data: {
            name: string;
            description?: string;
            event_type: 'submission_created' | 'submission_reviewed' | 'submission_approved';
            action_type: 'create_task' | 'create_alert';
            is_active?: boolean;
            conditions_json?: Record<string, any> | null;
            action_config_json: Record<string, any>;
        },
    ) => {
        const response = await apiClient.post(`/forms/${formId}/automation-rules`, data);
        return response.data;
    },
    updateAutomationRule: async (
        formId: string,
        ruleId: string,
        data: {
            name?: string;
            description?: string;
            event_type?: 'submission_created' | 'submission_reviewed' | 'submission_approved';
            action_type?: 'create_task' | 'create_alert';
            is_active?: boolean;
            conditions_json?: Record<string, any> | null;
            action_config_json?: Record<string, any>;
        },
    ) => {
        const response = await apiClient.patch(`/forms/${formId}/automation-rules/${ruleId}`, data);
        return response.data;
    },
    deleteAutomationRule: async (formId: string, ruleId: string) => {
        const response = await apiClient.delete(`/forms/${formId}/automation-rules/${ruleId}`);
        return response.data;
    },
    updateResponsibility: async (
        formId: string,
        data: {
            lead_accessor_id?: string | null;
            lead_accessor_type?: 'user' | 'team' | null;
            assigned_accessor_id?: string | null;
            assigned_accessor_type?: 'user' | 'team' | null;
            guest_accessor_id?: string | null;
            guest_accessor_type?: 'user' | 'team' | null;
        },
    ) => {
        const response = await apiClient.put(`/forms/${formId}/responsibility`, data);
        return response.data;
    },
    updateBlueprint: async (formId: string, blueprint: any, targetSlot: number = 1) => {
        const response = await apiClient.put(`/forms/${formId}/blueprint?target_slot=${targetSlot}`, blueprint);
        return response.data;
    },
    get: async (formId: string) => {
        const response = await apiClient.get(`/forms/${formId}`);
        return response.data;
    },
    getStats: async (formId: string) => {
        const response = await apiClient.get(`/forms/${formId}/stats`);
        return response.data;
    },
    publish: async (formId: string, payload?: { draft_version_id?: string; draft_slot?: number; changelog?: string }) => {
        const response = await apiClient.post(`/forms/${formId}/publish`, payload || {});
        return response.data;
    },
    listVersions: async (formId: string) => {
        const response = await apiClient.get(`/forms/${formId}/versions`);
        return response.data;
    },
    getRuntime: async (formId: string) => {
        const response = await apiClient.get(`/forms/${formId}/runtime`);
        return response.data;
    },
    getDataset: async (formId: string) => {
        const response = await apiClient.get(`/forms/${formId}/dataset`);
        return response.data;
    },
    listMedia: async (formId: string, params?: { limit?: number; media_kind?: string }) => {
        const response = await apiClient.get(`/forms/${formId}/media`, { params });
        return response.data;
    },
    list: async (projectId: string, kind?: 'standard' | 'directory') => {
        const params = kind ? `?kind=${kind}` : '';
        const response = await apiClient.get(`/projects/${projectId}/forms${params}`);
        return response.data;
    },
    // --------------- Directory-specific methods ---------------
    updateDirectoryDesignations: async (
        formId: string,
        data: { directory_key_field_id?: string | null; directory_label_field_id?: string | null },
    ) => {
        const response = await apiClient.patch(`/forms/${formId}/directory-designations`, data);
        return response.data;
    },
    getDirectoryEntries: async (formId: string) => {
        const response = await apiClient.get(`/forms/${formId}/directory-entries`);
        return response.data;
    },
    upsertDirectoryEntry: async (formId: string, data: Record<string, any>) => {
        const response = await apiClient.post(`/forms/${formId}/directory-entries`, { data });
        return response.data;
    },
    setDirectoryEntryActive: async (formId: string, submissionId: string, active: boolean) => {
        const response = await apiClient.patch(`/forms/${formId}/directory-entries/${submissionId}/active`, { active });
        return response.data;
    },
    deleteDirectoryEntry: async (formId: string, submissionId: string) => {
        const response = await apiClient.delete(`/forms/${formId}/directory-entries/${submissionId}`);
        return response.data;
    },
    listDirectoryLookupSources: async (formId: string) => {
        const response = await apiClient.get(`/forms/${formId}/directory-lookup-sources`);
        return response.data;
    },
    getDirectoryLookupOptions: async (formId: string, directoryFormId: string, params?: { search?: string; limit?: number }) => {
        const response = await apiClient.get(`/forms/${formId}/directory-lookup-sources/${directoryFormId}/options`, {
            params: { limit: 500, ...params },
        });
        return response.data;
    },
};

export type AiSurveyInterviewQuestion = {
    id: string;
    prompt: string;
    kind: 'text' | 'choice' | string;
    options?: string[] | null;
};

export const aiSurveyAPI = {
    interview: async (brief: string): Promise<{ questions: AiSurveyInterviewQuestion[] }> => {
        const response = await apiClient.post('/ai/survey/interview', { brief }, { timeout: 60000 });
        return response.data;
    },
    draft: async (brief: string, answers?: Record<string, string>): Promise<{ title: string; markdown: string }> => {
        // Chunked drafts (e.g. ~50 questions) call the LLM many times.
        const response = await apiClient.post('/ai/survey/draft', { brief, answers }, { timeout: 300000 });
        return response.data;
    },
    revise: async (markdown: string, instruction: string): Promise<{ markdown: string }> => {
        const response = await apiClient.post('/ai/survey/revise', { markdown, instruction }, { timeout: 180000 });
        return response.data;
    },
    compile: async (markdown: string): Promise<{ title: string; blueprint: any; warnings: string[] }> => {
        const response = await apiClient.post('/ai/survey/compile', { markdown }, { timeout: 30000 });
        return response.data;
    },
    generate: async (projectId: string, data: { markdown: string; title?: string }) => {
        const response = await apiClient.post(`/projects/${projectId}/ai-survey/generate`, data, { timeout: 60000 });
        return response.data;
    },
};

export const reportAPI = {
    list: async (orgId: string, projectId: string) => {
        const response = await apiClient.get(`/organizations/${orgId}/projects/${projectId}/reports`);
        return response.data;
    },
    get: async (orgId: string, projectId: string, reportId: string) => {
        const response = await apiClient.get(`/organizations/${orgId}/projects/${projectId}/reports/${reportId}`);
        return response.data;
    },
    create: async (orgId: string, projectId: string, data: { title: string; description?: string; content?: Array<Record<string, any>> }) => {
        const response = await apiClient.post(`/organizations/${orgId}/projects/${projectId}/reports`, data);
        return response.data;
    },
    update: async (
        orgId: string,
        projectId: string,
        reportId: string,
        data: {
            title?: string;
            description?: string | null;
            content?: Array<Record<string, any>>;
            status?: 'draft' | 'published' | 'archived';
            lead_accessor_id?: string | null;
            lead_accessor_type?: 'user' | 'team' | null;
            assigned_accessor_id?: string | null;
            assigned_accessor_type?: 'user' | 'team' | null;
            guest_accessor_id?: string | null;
            guest_accessor_type?: 'user' | 'team' | null;
        },
    ) => {
        const response = await apiClient.patch(`/organizations/${orgId}/projects/${projectId}/reports/${reportId}`, data);
        return response.data;
    },
    delete: async (orgId: string, projectId: string, reportId: string) => {
        const response = await apiClient.delete(`/organizations/${orgId}/projects/${projectId}/reports/${reportId}`);
        return response.data;
    },
};

// ============= Submission API Methods =============

export const submissionAPI = {
    create: async (data: { form_id: string; data: any; metadata?: any }) => {
        const response = await apiClient.post('/submissions', data);
        return response.data;
    },
    listForForm: async (formId: string, reviewStatus?: 'submitted' | 'approved' | 'rejected') => {
        const response = await apiClient.get(`/forms/${formId}/submissions`, {
            params: reviewStatus ? { review_status: reviewStatus } : undefined,
        });
        return response.data;
    },
    review: async (submissionId: string, data: { review_status: 'submitted' | 'approved' | 'rejected'; review_comment?: string }) => {
        const response = await apiClient.patch(`/submissions/${submissionId}/review`, data);
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

// ============= Section Template API Methods =============

export const sectionTemplateAPI = {
    create: async (orgId: string, data: { name: string; description?: string; blueprint: any; visibility: 'organization' | 'team'; team_ids?: string[] }) => {
        const response = await apiClient.post(`/organizations/${orgId}/templates/section`, data);
        return response.data;
    },
    list: async (orgId: string) => {
        const response = await apiClient.get(`/organizations/${orgId}/templates/section`);
        return response.data;
    },
    update: async (orgId: string, templateId: string, data: { name?: string; description?: string; blueprint?: any; visibility?: 'organization' | 'team'; team_ids?: string[] }) => {
        const response = await apiClient.put(`/organizations/${orgId}/templates/section/${templateId}`, data);
        return response.data;
    },
    delete: async (orgId: string, templateId: string) => {
        const response = await apiClient.delete(`/organizations/${orgId}/templates/section/${templateId}`);
        return response.data;
    },
};

export const analyticsAPI = {
    listSources: async (orgId: string) => {
        const response = await apiClient.get(`/organizations/${orgId}/analytics/sources`);
        return response.data;
    },
    runQuery: async (
        orgId: string,
        data: {
            dataset_id: string;
            select_fields?: string[];
            filters?: unknown;
            group_by?: string[];
            aggregates?: Array<{ field: string; fn: string; alias?: string }>;
            order_by?: Array<{ field: string; direction?: 'asc' | 'desc' }>;
            limit?: number;
            offset?: number;
        },
    ) => {
        const response = await apiClient.post(`/organizations/${orgId}/analytics/query`, data);
        return response.data;
    },
    walkerCompute: async (orgId: string, datasetId: string, payload: any) => {
        const response = await apiClient.post(`/analytics/walker/${datasetId}/compute`, payload, {
            params: { org_id: orgId }
        });
        return response.data;
    },
    listQuestions: async (orgId: string, projectId?: string) => {
        const response = await apiClient.get(`/organizations/${orgId}/analytics/questions`, {
            params: projectId ? { project_id: projectId } : undefined,
        });
        return response.data;
    },
    createQuestion: async (orgId: string, data: Record<string, unknown>) => {
        const response = await apiClient.post(`/organizations/${orgId}/analytics/questions`, data);
        return response.data;
    },
    updateQuestion: async (orgId: string, questionId: string, data: Record<string, unknown>) => {
        const response = await apiClient.patch(`/organizations/${orgId}/analytics/questions/${questionId}`, data);
        return response.data;
    },
    deleteQuestion: async (orgId: string, questionId: string) => {
        const response = await apiClient.delete(`/organizations/${orgId}/analytics/questions/${questionId}`);
        return response.data;
    },
    listDashboards: async (orgId: string, projectId?: string) => {
        const response = await apiClient.get(`/organizations/${orgId}/analytics/dashboards`, {
            params: projectId ? { project_id: projectId } : undefined,
        });
        return response.data;
    },
    createDashboard: async (orgId: string, data: Record<string, unknown>) => {
        const response = await apiClient.post(`/organizations/${orgId}/analytics/dashboards`, data);
        return response.data;
    },
    updateDashboard: async (orgId: string, dashboardId: string, data: Record<string, unknown>) => {
        const response = await apiClient.patch(`/organizations/${orgId}/analytics/dashboards/${dashboardId}`, data);
        return response.data;
    },
    deleteDashboard: async (orgId: string, dashboardId: string) => {
        const response = await apiClient.delete(`/organizations/${orgId}/analytics/dashboards/${dashboardId}`);
        return response.data;
    },
    comparePeriod: async (
        orgId: string,
        data: {
            dataset_id: string;
            measure_field: string;
            agg_fn?: string;
            date_field?: string;
            period?: string;
            filters?: unknown;
        },
    ) => {
        const response = await apiClient.post(`/organizations/${orgId}/analytics/compare`, data);
        return response.data;
    },
    saveDerivedDataset: async (
        orgId: string,
        data: {
            name: string;
            mode: 'snapshot' | 'linked';
            parent_dataset_id: string;
            project_id?: string | null;
            columns: Array<{
                key: string;
                label: string;
                field_type?: string | null;
                calculated?: boolean;
                formula?: string | null;
            }>;
            rows?: Array<Record<string, unknown>>;
        },
    ) => {
        const response = await apiClient.post(`/organizations/${orgId}/analytics/derived-datasets`, data);
        return response.data as {
            dataset_id: string;
            form_id: string;
            name: string;
            mode: string;
            parent_dataset_id?: string;
            row_count: number;
            record_count: number;
        };
    },
};

export default apiClient;
