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
};

// ─── Desk form endpoints (authenticated) ────────────────────────────────────
export const deskFormAPI = {
  get: async (formId: string) => {
    const res = await apiClient.get(`/forms/${formId}/runtime`);
    return res.data;
  },
  submit: async (formId: string, data: Record<string, any>, metadata: Record<string, any>) => {
    const res = await apiClient.post('/submissions', { form_id: formId, data, metadata });
    return res.data;
  },
};

// ─── Project endpoints ───────────────────────────────────────────────────────
export const projectAPI = {
  listByOrg: async (orgId: string) => {
    const res = await apiClient.get(`/organizations/${orgId}/projects`);
    return res.data;
  },
  listForms: async (projectId: string) => {
    const res = await apiClient.get(`/projects/${projectId}/forms`);
    return res.data;
  },
};

// ─── Organization endpoints ──────────────────────────────────────────────────
export const orgAPI = {
  list: async () => {
    const res = await apiClient.get('/organizations');
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
