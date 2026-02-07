import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
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
}

interface OrgContextType {
    organizations: Organization[];
    currentOrg: Organization | null;
    projects: Project[];
    isLoading: boolean;
    error: string | null;
    setCurrentOrg: (org: Organization | null) => void;
    refreshOrganizations: () => Promise<void>;
    refreshProjects: (orgId: string) => Promise<void>;
    createOrganization: (name: string) => Promise<Organization>;
    createProject: (name: string, description?: string) => Promise<Project>;
}

const OrgContext = createContext<OrgContextType | undefined>(undefined);

export const OrgProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { user, isAuthenticated } = useAuth();
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);
    const [projects, setProjects] = useState<Project[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refreshOrganizations = async () => {
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
    };

    const refreshProjects = async (orgId: string) => {
        try {
            const data = await projectAPI.list(orgId);
            setProjects(data);
        } catch (err: any) {
            console.error('Failed to fetch projects', err);
        }
    };

    useEffect(() => {
        if (isAuthenticated) {
            refreshOrganizations();
        } else {
            setOrganizations([]);
            setCurrentOrg(null);
            setProjects([]);
        }
    }, [isAuthenticated]);

    useEffect(() => {
        if (currentOrg) {
            localStorage.setItem('current_org_id', currentOrg.id);
            refreshProjects(currentOrg.id);
        }
    }, [currentOrg]);

    const createOrganization = async (name: string) => {
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
    };

    const createProject = async (name: string, description?: string) => {
        if (!currentOrg) throw new Error('No organization selected');
        try {
            const newProject = await projectAPI.create(currentOrg.id, { name, description });
            setProjects(prev => [...prev, newProject]);
            return newProject;
        } catch (err: any) {
            const msg = err.response?.data?.detail || 'Failed to create project';
            setError(msg);
            throw new Error(msg);
        }
    };

    return (
        <OrgContext.Provider value={{
            organizations,
            currentOrg,
            projects,
            isLoading,
            error,
            setCurrentOrg,
            refreshOrganizations,
            refreshProjects,
            createOrganization,
            createProject
        }}>
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
