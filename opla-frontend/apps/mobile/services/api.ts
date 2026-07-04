/**
 * api.ts — Mobile API client
 * Lightweight axios client reusing the same backend as Studio.
 */
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1';

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

apiClient.interceptors.request.use(async (config) => {
  try {
    const raw = await SecureStore.getItemAsync('opla_auth_session');
    if (raw) {
      const session = JSON.parse(raw);
      if (session?.accessToken) {
        config.headers.Authorization = `Bearer ${session.accessToken}`;
      }
    }
  } catch {
    // no-op — request proceeds unauthenticated
  }
  return config;
});

// ─── 401 → auto-refresh interceptor ─────────────────────────────────────────
let _refreshPromise: Promise<string | null> | null = null;

apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error);
    }
    original._retry = true;

    try {
      // Deduplicate concurrent refresh calls
      if (!_refreshPromise) {
        _refreshPromise = (async () => {
          const raw = await SecureStore.getItemAsync('opla_auth_session');
          if (!raw) return null;
          const session = JSON.parse(raw);
          if (!session?.refreshToken) return null;

          const refreshApi = axios.create({ baseURL: API_URL, timeout: 10000 });
          const res = await refreshApi.post('/auth/refresh', { refresh_token: session.refreshToken });
          const { access_token, refresh_token } = res.data;

          // Persist updated tokens back to session
          const updated = { ...session, accessToken: access_token, refreshToken: refresh_token };
          await SecureStore.setItemAsync('opla_auth_session', JSON.stringify(updated));
          return access_token;
        })().finally(() => { _refreshPromise = null; });
      }

      const newToken = await _refreshPromise;
      if (!newToken) return Promise.reject(error);

      original.headers.Authorization = `Bearer ${newToken}`;
      return apiClient(original);
    } catch {
      // Refresh failed — let the original 401 propagate
      return Promise.reject(error);
    }
  },
);

// ─── Auth endpoints ──────────────────────────────────────────────────────────
export const authAPI = {
  loginEmail: async (email: string, password: string) => {
    const res = await apiClient.post('/auth/login', { email, password });
    return res.data as { access_token: string; refresh_token: string; user: any };
  },
  requestOtp: async (phone: string) => {
    const res = await apiClient.post('/auth/otp/request', { phone });
    return res.data;
  },
  verifyOtp: async (phone: string, otp: string) => {
    const res = await apiClient.post('/auth/otp/verify', { phone, otp });
    return res.data as { access_token: string; refresh_token: string; user: any };
  },
  me: async () => {
    const res = await apiClient.get('/auth/me');
    return res.data;
  },
  refresh: async (refreshToken: string) => {
    const res = await apiClient.post('/auth/refresh', { refresh_token: refreshToken });
    return res.data as { access_token: string; refresh_token: string };
  },
};

// ─── Public (Yard) form endpoints ─────────────────────────────────────────────
export const publicFormAPI = {
  getBySlug: async (slug: string) => {
    const res = await apiClient.get(`/public/forms/${slug}`);
    return res.data;
  },
  list: async (params?: { search?: string; category?: string; page?: number }) => {
    const res = await apiClient.get('/public/forms', { params });
    return res.data;
  },
  submit: async (slug: string, data: Record<string, any>, metadata: Record<string, any>) => {
    const res = await apiClient.post(`/public/submissions/${slug}`, { data, metadata });
    return res.data;
  },
  lookupOptions: async (
    slug: string,
    datasetId: string,
    params: { label_field: string; value_field: string; search?: string; limit?: number },
  ) => {
    const res = await apiClient.get(`/public/forms/${slug}/lookup-sources/${datasetId}/options`, { params });
    return res.data;
  },
  catalogLookupOptions: async (
    slug: string,
    catalogFormId: string,
    params?: { search?: string; limit?: number },
  ) => {
    const res = await apiClient.get(`/public/forms/${slug}/catalog-lookup-sources/${catalogFormId}/options`, { params });
    return res.data;
  },
};

// ─── Desk form endpoints (authenticated) ────────────────────────────────────
export const deskFormAPI = {
  get: async (formId: string) => {
    const res = await apiClient.get(`/forms/${formId}/runtime`);
    return res.data;
  },
  /** Fetch all transitively linked child forms for offline pre-loading. */
  getLinkedForms: async (formId: string) => {
    const res = await apiClient.get(`/forms/${formId}/linked-forms`);
    return res.data as Array<{
      id: string;
      project_id: string;
      title: string;
      slug: string;
      blueprint_live: Record<string, any>;
      published_version?: number | null;
      published_at?: string | null;
    }>;
  },
  submit: async (formId: string, data: Record<string, any>, metadata: Record<string, any>) => {
    const res = await apiClient.post('/submissions', { form_id: formId, data, metadata });
    return res.data;
  },
  lookupOptions: async (
    formId: string,
    datasetId: string,
    params: { label_field: string; value_field: string; search?: string; limit?: number },
  ) => {
    const res = await apiClient.get(`/forms/${formId}/lookup-sources/${datasetId}/options`, { params });
    return res.data;
  },
  catalogLookupOptions: async (
    formId: string,
    catalogFormId: string,
    params?: { search?: string; limit?: number },
  ) => {
    const res = await apiClient.get(`/forms/${formId}/catalog-lookup-sources/${catalogFormId}/options`, { params });
    return res.data;
  },
};

// ─── Project endpoints ───────────────────────────────────────────────────────
export const projectAPI = {
  listByOrg: async (orgId: string) => {
    const res = await apiClient.get(`/organizations/${orgId}/projects`);
    return res.data;
  },
  get: async (orgId: string, projectId: string) => {
    const res = await apiClient.get(`/organizations/${orgId}/projects/${projectId}`);
    return res.data;
  },
  update: async (
    orgId: string,
    projectId: string,
    data: { name?: string; description?: string; status?: 'planning' | 'active' | 'paused' | 'archived' },
  ) => {
    const res = await apiClient.patch(`/organizations/${orgId}/projects/${projectId}`, data);
    return res.data;
  },
  listAccess: async (orgId: string, projectId: string) => {
    const res = await apiClient.get(`/organizations/${orgId}/projects/${projectId}/access`);
    return res.data;
  },
  listRoleTemplates: async (orgId: string) => {
    const res = await apiClient.get(`/organizations/${orgId}/projects/role-templates`);
    return res.data;
  },
  grantAccess: async (
    orgId: string,
    projectId: string,
    data: { accessor_id: string; accessor_type: 'user' | 'team'; role_template_id?: string; role?: 'collector' | 'analyst' | 'editor' },
  ) => {
    const res = await apiClient.post(`/organizations/${orgId}/projects/${projectId}/access`, data);
    return res.data;
  },
  revokeAccess: async (orgId: string, projectId: string, accessorId: string, accessorType: 'user' | 'team') => {
    const res = await apiClient.delete(
      `/organizations/${orgId}/projects/${projectId}/access/${accessorId}?accessor_type=${accessorType}`,
    );
    return res.data;
  },
  /** Pass liveOnly=true on mobile to show only published (live) forms. */
  listForms: async (projectId: string, liveOnly = false) => {
    const res = await apiClient.get(`/projects/${projectId}/forms`, {
      params: liveOnly ? { live_only: true } : undefined,
    });
    return res.data;
  },
  listTasks: async (orgId: string, projectId: string) => {
    const res = await apiClient.get(`/organizations/${orgId}/projects/${projectId}/tasks`);
    return res.data;
  },
  listMyDayTasks: async (orgId: string, projectId: string, date: string) => {
    const res = await apiClient.get(`/organizations/${orgId}/projects/${projectId}/tasks/my-day`, {
      params: { date },
    });
    return res.data;
  },
  listAttendance: async (orgId: string, projectId: string, date?: string) => {
    const res = await apiClient.get(`/organizations/${orgId}/projects/${projectId}/attendance`, {
      params: date ? { date } : undefined,
    });
    return res.data;
  },
  getMyAttendanceStatus: async (orgId: string, projectId: string, date: string) => {
    const res = await apiClient.get(`/organizations/${orgId}/projects/${projectId}/attendance/my-status`, {
      params: { date },
    });
    return res.data;
  },
  checkInAttendance: async (
    orgId: string,
    projectId: string,
    data: {
      timestamp?: string;
      location: { latitude: number; longitude: number; accuracy_meters?: number; label?: string };
      note?: string;
      image_uri?: string;
      signature?: string;
    },
  ) => {
    const res = await apiClient.post(`/organizations/${orgId}/projects/${projectId}/attendance/check-in`, data);
    return res.data;
  },
  checkOutAttendance: async (
    orgId: string,
    projectId: string,
    data: {
      timestamp?: string;
      location: { latitude: number; longitude: number; accuracy_meters?: number; label?: string };
      note?: string;
      image_uri?: string;
      signature?: string;
    },
  ) => {
    const res = await apiClient.post(`/organizations/${orgId}/projects/${projectId}/attendance/check-out`, data);
    return res.data;
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
      visit_date?: string;
      assigned_accessor_id?: string;
      assigned_accessor_type?: 'user' | 'team';
      clear_assignment?: boolean;
    },
  ) => {
    const res = await apiClient.patch(`/organizations/${orgId}/projects/${projectId}/tasks/${taskId}`, data);
    return res.data;
  },
};

// ─── Form metadata + stats endpoints (authenticated) ────────────────────────
export const formAPI = {
  /** Get full form metadata (title, status, version, blueprint_live, etc.). */
  getMeta: async (formId: string) => {
    const res = await apiClient.get(`/forms/${formId}`);
    return res.data;
  },
  /** Get submission stats for a form: total, mine, last submitted. */
  getStats: async (formId: string) => {
    const res = await apiClient.get(`/forms/${formId}/stats`);
    return res.data as {
      form_id: string;
      title: string;
      status: string;
      version: number;
      submission_count: number;
      my_submission_count: number;
      last_submitted_at: string | null;
    };
  },
};

// ─── Asset endpoints ─────────────────────────────────────────────────────────
export const assetsAPI = {
  list: async (orgId: string, projectId: string) => {
    const res = await apiClient.get(`/organizations/${orgId}/projects/${projectId}/assets`);
    return res.data;
  },
};

// ─── Report endpoints ─────────────────────────────────────────────────────────
export const reportsAPI = {
  list: async (orgId: string, projectId: string) => {
    const res = await apiClient.get(`/organizations/${orgId}/projects/${projectId}/reports`);
    return res.data;
  },
};

// ─── Organization endpoints ──────────────────────────────────────────────────
export const orgAPI = {
  list: async () => {
    const res = await apiClient.get('/organizations');
    return res.data;
  },
  acceptInvitation: async (data: { token?: string; pin_code?: string }) => {
    const res = await apiClient.post('/organizations/invitations/accept', data);
    return res.data;
  },
  getTeams: async (orgId: string) => {
    const res = await apiClient.get(`/organizations/${orgId}/teams`);
    return res.data;
  },
  getMembers: async (orgId: string) => {
    const res = await apiClient.get(`/organizations/${orgId}/members`);
    return res.data;
  },
  getTeamMembers: async (orgId: string, teamId: string) => {
    const res = await apiClient.get(`/organizations/${orgId}/teams/${teamId}/members`);
    return res.data;
  },
};
