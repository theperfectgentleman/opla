import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { orgAPI, projectAPI } from '../lib/api';
import { useAuth } from './AuthContext';

interface Organization {
    id: string;
    name: string;
    slug: string;
    owner_id: string;
    logo_url?: string;
    primary_color: string;
}

interface Project {
    id: string;
    name: string;
    description?: string;
    org_id: string;
    status: 'planning' | 'active' | 'paused' | 'archived';
    activated_at?: string | null;
    paused_at?: string | null;
    archived_at?: string | null;
    created_at: string;
    updated_at?: string;
}

interface OrgContextType {
    organizations: Organization[];
    currentOrg: Organization | null;
    currentProject: Project | null;
    projects: Project[];
    members: any[];
    isLoading: boolean;
    error: string | null;
    setCurrentOrg: (org: Organization | null) => void;
    setCurrentProject: (project: Project | null) => void;
    refreshOrganizations: () => Promise<void>;
    refreshProjects: (orgId: string) => Promise<void>;
    refreshMembers: (orgId: string) => Promise<void>;
    refreshCurrentProject: (orgId: string, projectId: string) => Promise<Project>;
    createOrganization: (name: string) => Promise<Organization>;
    createProject: (name: string, description?: string) => Promise<Project>;
    updateProject: (
        projectId: string,
        data: { name?: string; description?: string; status?: 'planning' | 'active' | 'paused' | 'archived' },
    ) => Promise<Project>;
}

const OrgContext = createContext<OrgContextType | undefined>(undefined);

export const OrgProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { isAuthenticated } = useAuth();
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);
    const [currentProject, setCurrentProject] = useState<Project | null>(null);
    const [projects, setProjects] = useState<Project[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [members, setMembers] = useState<any[]>([]);

    const refreshOrganizations = useCallback(async () => {
        if (!isAuthenticated) return;
        try {
            setIsLoading(true);
            const data = await orgAPI.list();
            setOrganizations(data);
            if (data.length > 0 && !currentOrg) {
                // Set first org as default if none selected
                const savedOrgId = localStorage.getItem('current_org_id');
                const savedOrg = data.find((o: Organization) => o.id === savedOrgId);
                setCurrentOrg(savedOrg || data[0]);
            }
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to fetch organizations');
        } finally {
            setIsLoading(false);
        }
    }, [currentOrg, isAuthenticated]);

    const refreshProjects = useCallback(async (orgId: string) => {
        try {
            const data = await projectAPI.list(orgId);
            setProjects(data);

            const savedProjectId = localStorage.getItem('current_project_id');
            if (!savedProjectId) {
                if (currentProject && currentProject.org_id !== orgId) {
                    setCurrentProject(null);
                }
                return;
            }

            const matchingProject = data.find((project: Project) => project.id === savedProjectId) || null;
            setCurrentProject(matchingProject);
        } catch (err: any) {
            console.error('Failed to fetch projects', err);
        }
    }, [currentProject]);

    const refreshMembers = useCallback(async (orgId: string) => {
        try {
            const data = await orgAPI.getMembers(orgId);
            setMembers(data);
        } catch (err: any) {
            console.error('Failed to fetch members', err);
        }
    }, []);

    useEffect(() => {
        if (isAuthenticated) {
            refreshOrganizations();
        } else {
            setOrganizations([]);
            setCurrentOrg(null);
            setProjects([]);
            setMembers([]);
        }
    }, [isAuthenticated]);

    useEffect(() => {
        if (currentOrg) {
            localStorage.setItem('current_org_id', currentOrg.id);
            refreshProjects(currentOrg.id);
            refreshMembers(currentOrg.id);
        } else {
            localStorage.removeItem('current_project_id');
            setCurrentProject(null);
        }
    }, [currentOrg]);

    useEffect(() => {
        if (currentProject) {
            localStorage.setItem('current_project_id', currentProject.id);
        } else {
            localStorage.removeItem('current_project_id');
        }
    }, [currentProject]);

    const createOrganization = useCallback(async (name: string) => {
        try {
            const newOrg = await orgAPI.create({ name });
            setOrganizations(prev => [...prev, newOrg]);
            if (!currentOrg) setCurrentOrg(newOrg);
            return newOrg;
        } catch (err: any) {
            const msg = err.response?.data?.detail || 'Failed to create organization';
            setError(msg);
            throw new Error(msg);
        }
    }, [currentOrg]);

    const createProject = useCallback(async (name: string, description?: string) => {
        if (!currentOrg) throw new Error('No organization selected');
        try {
            const newProject = await projectAPI.create(currentOrg.id, { name, description });
            setProjects(prev => [...prev, newProject]);
            setCurrentProject(newProject);
            return newProject;
        } catch (err: any) {
            const msg = err.response?.data?.detail || 'Failed to create project';
            setError(msg);
            throw new Error(msg);
        }
    }, [currentOrg]);

    const refreshCurrentProject = useCallback(async (orgId: string, projectId: string) => {
        try {
            const project = await projectAPI.get(orgId, projectId);
            setCurrentProject(project);
            setProjects(prev => {
                const existing = prev.find(item => item.id === project.id);
                if (!existing) return [...prev, project];
                return prev.map(item => (item.id === project.id ? project : item));
            });
            return project;
        } catch (err: any) {
            const msg = err.response?.data?.detail || 'Failed to load project';
            setError(msg);
            throw new Error(msg);
        }
    }, []);

    const updateProject = useCallback(async (
        projectId: string,
        data: { name?: string; description?: string; status?: 'planning' | 'active' | 'paused' | 'archived' },
    ) => {
        if (!currentOrg) throw new Error('No organization selected');
        try {
            const updatedProject = await projectAPI.update(currentOrg.id, projectId, data);
            setProjects(prev => prev.map(project => (project.id === updatedProject.id ? updatedProject : project)));
            setCurrentProject(prev => (prev?.id === updatedProject.id ? updatedProject : prev));
            return updatedProject;
        } catch (err: any) {
            const msg = err.response?.data?.detail || 'Failed to update project';
            setError(msg);
            throw new Error(msg);
        }
    }, [currentOrg]);

    const value = useMemo(() => ({
        organizations,
        currentOrg,
        currentProject,
        projects,
        members,
        isLoading,
        error,
        setCurrentOrg,
        setCurrentProject,
        refreshOrganizations,
        refreshProjects,
        refreshMembers,
        refreshCurrentProject,
        createOrganization,
        createProject,
        updateProject,
    }), [
        organizations,
        currentOrg,
        currentProject,
        projects,
        members,
        isLoading,
        error,
        refreshOrganizations,
        refreshProjects,
        refreshMembers,
        refreshCurrentProject,
        createOrganization,
        createProject,
        updateProject,
    ]);

    return (
        <OrgContext.Provider value={value}>
            {children}
        </OrgContext.Provider>
    );
};

export const useOrg = () => {
    const context = useContext(OrgContext);
    if (context === undefined) {
        throw new Error('useOrg must be used within an OrgProvider');
    }
    return context;
};
