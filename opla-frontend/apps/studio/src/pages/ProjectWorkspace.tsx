import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    AlertCircle,
    ChevronRight,
    FileBarChart2,
    FileText,
    MessageSquare,
    Paperclip,
    Play,
    Plus,
    SquareCheckBig,
    Users,
    Database,
} from 'lucide-react';

import StudioLayout from '../components/StudioLayout';
import { useOrg } from '../contexts/OrgContext';
import { formAPI, projectAPI, reportAPI, teamAPI } from '../lib/api';

type ProjectAccessRule = {
    id: string;
    project_id: string;
    accessor_id: string;
    accessor_type: 'user' | 'team';
    role?: 'collector' | 'analyst' | 'editor';
    role_template_id?: string;
    role_name?: string;
    role_slug?: string;
    permissions?: string[];
};

type ProjectRoleTemplate = {
    id: string;
    name: string;
    slug: string;
    description?: string;
    permissions: string[];
    priority: number;
    is_system: boolean;
    assignment_count?: number;
};

type Team = {
    id: string;
    name: string;
    description?: string;
};

type ResponsibilityFields = {
    lead_accessor_id?: string | null;
    lead_accessor_type?: 'user' | 'team' | null;
    assigned_accessor_id?: string | null;
    assigned_accessor_type?: 'user' | 'team' | null;
    guest_accessor_id?: string | null;
    guest_accessor_type?: 'user' | 'team' | null;
};

type WorkspaceForm = ResponsibilityFields & {
    id: string;
    title: string;
    status: string;
    version: number;
    updated_at: string;
};

type WorkspaceDataset = {
    id: string;
    name: string;
    records_count: number;
    updated_at: string;
    status: 'active' | 'archived';
};

type WorkspaceThread = {
    id: string;
    title: string;
    summary: string;
    reply_count: number;
    updated_at: string;
};

type WorkspaceAsset = {
    id: string;
    title: string;
    kind: 'document' | 'image' | 'audio' | 'link';
    summary: string;
    updated_at: string;
};

type ProjectTask = {
    id: string;
    project_id: string;
    title: string;
    description?: string;
    status: 'todo' | 'in_progress' | 'done' | 'blocked' | 'cancelled';
    starts_at?: string;
    due_at?: string;
    assigned_accessor_id?: string;
    assigned_accessor_type?: 'user' | 'team';
    completed_at?: string;
    created_at: string;
    updated_at: string;
};

type ReportArtifact = ResponsibilityFields & {
    id: string;
    title: string;
    description?: string;
    status: 'draft' | 'published' | 'archived';
    updated_at: string;
};

type AccessorOption = {
    id: string;
    type: 'user' | 'team';
    label: string;
};

const statusTone: Record<string, string> = {
    planning: 'bg-amber-500/10 text-amber-300 border border-amber-500/20',
    active: 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20',
    paused: 'bg-orange-500/10 text-orange-300 border border-orange-500/20',
    archived: 'bg-slate-500/10 text-slate-300 border border-slate-500/20',
};



const reportStatusTone: Record<string, string> = {
    draft: 'bg-slate-500/10 text-slate-300 border border-slate-500/20',
    published: 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20',
    archived: 'bg-orange-500/10 text-orange-300 border border-orange-500/20',
};

const formStatusTone: Record<string, string> = {
    draft: 'bg-slate-500/10 text-slate-300 border border-slate-500/20',
    live: 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20',
    archived: 'bg-orange-500/10 text-orange-300 border border-orange-500/20',
};

const businessRoleLabelBySlug: Record<string, string> = {
    'project-manager': 'Owner',
    'field-supervisor': 'Manager',
    analyst: 'Contributor',
    'field-personnel': 'Contributor',
    'stakeholder-viewer': 'Viewer',
};

const ProjectWorkspace: React.FC = () => {
    const navigate = useNavigate();
    const { projectId } = useParams<{ projectId: string }>();
    const {
        currentOrg,
        currentProject,
        members,
        refreshCurrentProject,
        setCurrentProject,
    } = useOrg();

    const [forms, setForms] = useState<WorkspaceForm[]>([]);
    const [tasks, setTasks] = useState<ProjectTask[]>([]);
    const [reports, setReports] = useState<ReportArtifact[]>([]);
    const [accessRules, setAccessRules] = useState<ProjectAccessRule[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [roleTemplates, setRoleTemplates] = useState<ProjectRoleTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [accessorId, setAccessorId] = useState('');
    const [roleTemplateId, setRoleTemplateId] = useState('');

    const [datasets] = useState<WorkspaceDataset[]>([
        { id: 'ds-1', name: 'Customer Feedback', records_count: 1240, updated_at: new Date().toISOString(), status: 'active' },
        { id: 'ds-2', name: 'Site Inspections 2024', records_count: 85, updated_at: new Date().toISOString(), status: 'active' },
    ]);
    const [threads] = useState<WorkspaceThread[]>([
        {
            id: 'thread-kickoff',
            title: 'Project kickoff channel',
            summary: 'Use this thread for launch notices, @mentions, and decisions that should stay attached to the project.',
            reply_count: 12,
            updated_at: new Date().toISOString(),
        },
        {
            id: 'thread-escalations',
            title: 'Escalations and blockers',
            summary: 'Operational issue lane for field blockers, supervisor escalations, and rapid follow-up.',
            reply_count: 4,
            updated_at: new Date(Date.now() - 1000 * 60 * 65).toISOString(),
        },
    ]);
    const [assets] = useState<WorkspaceAsset[]>([
        {
            id: 'asset-brief',
            title: 'Field briefing deck',
            kind: 'document',
            summary: 'Training and implementation reference shared with supervisors before launch.',
            updated_at: new Date().toISOString(),
        },
        {
            id: 'asset-audio',
            title: 'Stimulus audio clip',
            kind: 'audio',
            summary: 'Audio sample used by field staff during assisted interviews.',
            updated_at: new Date(Date.now() - 1000 * 60 * 125).toISOString(),
        },
    ]);

    useEffect(() => {
        return () => setCurrentProject(null);
    }, [setCurrentProject]);

    useEffect(() => {
        if (!currentOrg || !projectId) {
            return;
        }

        const loadWorkspace = async () => {
            setLoading(true);
            setError(null);
            try {
                const [project, projectForms, projectTasks, projectReports, projectAccess, orgTeams, templates] = await Promise.all([
                    refreshCurrentProject(currentOrg.id, projectId),
                    formAPI.list(projectId),
                    projectAPI.listTasks(currentOrg.id, projectId),
                    reportAPI.list(currentOrg.id, projectId),
                    projectAPI.listAccess(currentOrg.id, projectId),
                    teamAPI.list(currentOrg.id),
                    projectAPI.listRoleTemplates(currentOrg.id),
                ]);
                setCurrentProject(project);
                setForms(projectForms);
                setTasks(projectTasks);
                setReports(projectReports);
                setAccessRules(projectAccess);
                setTeams(orgTeams);
                setRoleTemplates(templates);
            } catch (err: any) {
                setError(err?.message || 'Failed to load project workspace');
            } finally {
                setLoading(false);
            }
        };

        loadWorkspace();
    }, [currentOrg, projectId, refreshCurrentProject, setCurrentProject]);

    const selectableAccessors = useMemo(() => {
        return members.map(member => ({
            id: member.user_id,
            label: member.user?.full_name || member.user?.email || member.user?.phone || member.user_id,
        }));
    }, [members]);

    const assignmentOptions = useMemo<AccessorOption[]>(() => {
        const userOptions = members.map(member => ({
            id: member.user_id,
            type: 'user' as const,
            label: member.user?.full_name || member.user?.email || member.user?.phone || member.user_id,
        }));
        const teamOptions = teams.map(team => ({
            id: team.id,
            type: 'team' as const,
            label: team.name,
        }));

        return [...userOptions, ...teamOptions].sort((left, right) => left.label.localeCompare(right.label));
    }, [members, teams]);

    useEffect(() => {
        setAccessorId(selectableAccessors[0]?.id || '');
    }, [selectableAccessors]);

    useEffect(() => {
        setRoleTemplateId(roleTemplates[0]?.id || '');
    }, [roleTemplates]);


    const getBusinessRoleLabel = (rule: Pick<ProjectAccessRule, 'role_name' | 'role_slug' | 'role'>) => {
        const slug = rule.role_slug || rule.role || '';
        return businessRoleLabelBySlug[slug] || rule.role_name || rule.role_slug || rule.role || 'Project access';
    };

    const resolveAccessorLabel = (accId?: string | null, accType?: 'user' | 'team' | null) => {
        if (!accId || !accType) {
            return 'Not set';
        }
        if (accType === 'team') {
            return teams.find(team => team.id === accId)?.name || 'Unknown team';
        }
        const member = members.find(item => item.user_id === accId);
        return member?.user?.full_name || member?.user?.email || member?.user?.phone || 'Unknown member';
    };

    const resolveRuleLabel = (rule: ProjectAccessRule) => resolveAccessorLabel(rule.accessor_id, rule.accessor_type);
    const resolveTaskAssigneeLabel = (task: ProjectTask) => resolveAccessorLabel(task.assigned_accessor_id, task.assigned_accessor_type);


    const handleShellNavSelect = (key: 'projects' | 'forms' | 'members' | 'audience' | 'analysis' | 'threads' | 'assets' | 'reports' | 'settings' | 'tasks' | string) => {
        navigate(`/dashboard?tab=${key}`);
    };

    const handleGrantAccess = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!currentOrg || !projectId || !accessorId || !roleTemplateId) return;

        try {
            const accessRule = await projectAPI.grantAccess(currentOrg.id, projectId, {
                accessor_id: accessorId,
                accessor_type: 'user',
                role_template_id: roleTemplateId,
            });

            setAccessRules(prev => {
                const existingIndex = prev.findIndex(item => item.accessor_id === accessRule.accessor_id && item.accessor_type === accessRule.accessor_type);
                if (existingIndex === -1) {
                    return [...prev, accessRule];
                }
                const next = [...prev];
                next[existingIndex] = accessRule;
                return next;
            });
        } catch (err: any) {
            setError(err?.response?.data?.detail || err?.message || 'Failed to add project member');
        }
    };

    const handleRevokeAccess = async (rule: ProjectAccessRule) => {
        if (!currentOrg || !projectId) return;

        try {
            await projectAPI.revokeAccess(currentOrg.id, projectId, rule.accessor_id, rule.accessor_type);
            setAccessRules(prev => prev.filter(item => item.id !== rule.id));
        } catch (err: any) {
            setError(err?.response?.data?.detail || err?.message || 'Failed to remove project member');
        }
    };

    const getAccessorValue = (accId?: string | null, accType?: 'user' | 'team' | null) => {
        if (!accId || !accType) {
            return '';
        }
        return `${accType}:${accId}`;
    };

    const parseAccessorValue = (value: string) => {
        if (!value) {
            return { accessor_id: null, accessor_type: null };
        }
        const [accessor_type, accessor_id] = value.split(':');
        return {
            accessor_id,
            accessor_type: accessor_type as 'user' | 'team',
        };
    };

    const getTaskAssignmentValue = (task: ProjectTask) => getAccessorValue(task.assigned_accessor_id, task.assigned_accessor_type);

    const handleTaskStatusChange = async (taskId: string, status: ProjectTask['status']) => {
        if (!currentOrg || !projectId) return;

        try {
            const updated = await projectAPI.updateTask(currentOrg.id, projectId, taskId, { status });
            setTasks(prev => prev.map(task => task.id === updated.id ? updated : task));
        } catch (err: any) {
            setError(err?.response?.data?.detail || err?.message || 'Failed to update task');
        }
    };

    const handleTaskAssignmentChange = async (taskId: string, assignmentValue: string) => {
        if (!currentOrg || !projectId) return;

        try {
            const updated = assignmentValue
                ? await projectAPI.updateTask(currentOrg.id, projectId, taskId, {
                    assigned_accessor_type: assignmentValue.startsWith('team:') ? 'team' : 'user',
                    assigned_accessor_id: assignmentValue.split(':')[1],
                })
                : await projectAPI.updateTask(currentOrg.id, projectId, taskId, { clear_assignment: true });
            setTasks(prev => prev.map(task => task.id === updated.id ? updated : task));
        } catch (err: any) {
            setError(err?.response?.data?.detail || err?.message || 'Failed to update task assignment');
        }
    };

    const handleDeleteTask = async (taskId: string) => {
        if (!currentOrg || !projectId) return;

        try {
            await projectAPI.deleteTask(currentOrg.id, projectId, taskId);
            setTasks(prev => prev.filter(task => task.id !== taskId));
        } catch (err: any) {
            setError(err?.response?.data?.detail || err?.message || 'Failed to delete task');
        }
    };

    const handleCreateForm = async () => {
        if (!projectId) return;
        try {
            const newForm = await formAPI.create(projectId, { title: 'New Form' });
            navigate(`/builder/${newForm.id}`);
        } catch (err: any) {
            setError(err?.response?.data?.detail || err?.message || 'Failed to create form');
        }
    };

    const handleFormResponsibilityChange = async (
        form: WorkspaceForm,
        field: 'lead' | 'assigned' | 'guest',
        value: string,
    ) => {
        const nextAccessor = parseAccessorValue(value);

        try {
            const updated = await formAPI.updateResponsibility(form.id, {
                lead_accessor_id: field === 'lead' ? nextAccessor.accessor_id : form.lead_accessor_id || null,
                lead_accessor_type: field === 'lead' ? nextAccessor.accessor_type : form.lead_accessor_type || null,
                assigned_accessor_id: field === 'assigned' ? nextAccessor.accessor_id : form.assigned_accessor_id || null,
                assigned_accessor_type: field === 'assigned' ? nextAccessor.accessor_type : form.assigned_accessor_type || null,
                guest_accessor_id: field === 'guest' ? nextAccessor.accessor_id : form.guest_accessor_id || null,
                guest_accessor_type: field === 'guest' ? nextAccessor.accessor_type : form.guest_accessor_type || null,
            });
            setForms(prev => prev.map(item => item.id === updated.id ? updated : item));
        } catch (err: any) {
            setError(err?.response?.data?.detail || err?.message || 'Failed to update form responsibility');
        }
    };

    const handleCreateReport = async () => {
        if (!currentOrg || !projectId) return;

        try {
            const created = await reportAPI.create(currentOrg.id, projectId, { title: 'New Report' });
            setReports(prev => [created, ...prev]);
        } catch (err: any) {
            setError(err?.response?.data?.detail || err?.message || 'Failed to create report');
        }
    };

    const handleReportUpdate = async (reportId: string, payload: Partial<ReportArtifact>) => {
        if (!currentOrg || !projectId) return;
        const current = reports.find(report => report.id === reportId);
        if (!current) return;

        try {
            const updated = await reportAPI.update(currentOrg.id, projectId, reportId, {
                title: payload.title ?? current.title,
                description: payload.description ?? current.description ?? null,
                status: payload.status ?? current.status,
                lead_accessor_id: payload.lead_accessor_id !== undefined ? payload.lead_accessor_id : current.lead_accessor_id ?? null,
                lead_accessor_type: payload.lead_accessor_type !== undefined ? payload.lead_accessor_type : current.lead_accessor_type ?? null,
                assigned_accessor_id: payload.assigned_accessor_id !== undefined ? payload.assigned_accessor_id : current.assigned_accessor_id ?? null,
                assigned_accessor_type: payload.assigned_accessor_type !== undefined ? payload.assigned_accessor_type : current.assigned_accessor_type ?? null,
                guest_accessor_id: payload.guest_accessor_id !== undefined ? payload.guest_accessor_id : current.guest_accessor_id ?? null,
                guest_accessor_type: payload.guest_accessor_type !== undefined ? payload.guest_accessor_type : current.guest_accessor_type ?? null,
            });
            setReports(prev => prev.map(report => report.id === updated.id ? updated : report));
        } catch (err: any) {
            setError(err?.response?.data?.detail || err?.message || 'Failed to update report');
        }
    };

    const handleDeleteReport = async (reportId: string) => {
        if (!currentOrg || !projectId) return;

        try {
            await reportAPI.delete(currentOrg.id, projectId, reportId);
            setReports(prev => prev.filter(report => report.id !== reportId));
        } catch (err: any) {
            setError(err?.response?.data?.detail || err?.message || 'Failed to delete report');
        }
    };

    const workspaceStats = [
        { label: 'Forms', value: forms.length },
        { label: 'Datasets', value: datasets.length },
        { label: 'Assets', value: assets.length },
        { label: 'Tasks', value: tasks.length },
        { label: 'Threads', value: threads.length },
        { label: 'Reports', value: reports.length },
        { label: 'Members', value: accessRules.length },
    ];

    return (
        <StudioLayout
            activeNav="projects"
            onSelectNav={handleShellNavSelect as any}
            counts={{ projects: 0, forms: forms.length, datasets: datasets.length, members: members?.length || 0 } as any}
            contentClassName="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 bg-[hsl(var(--background))] md:bg-[#f9fafb] dark:md:bg-[hsl(var(--background))]"
        >
            {loading ? (
                <div className="flex h-64 items-center justify-center">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-[hsl(var(--primary))]/30 border-t-[hsl(var(--primary))]" />
                </div>
            ) : error ? (
                <div className="rounded-md border border-[hsl(var(--error))]/20 bg-[hsl(var(--error))]/10 p-6 text-[hsl(var(--text-primary))]">
                    <div className="mb-2 flex items-center gap-3 text-[hsl(var(--error))]">
                        <AlertCircle className="h-5 w-5" />
                        <h2 className="text-base font-semibold">Workspace unavailable</h2>
                    </div>
                    <p className="text-sm text-[hsl(var(--text-secondary))]">{error}</p>
                </div>
            ) : currentProject ? (
                <div className="mx-auto max-w-[1600px] space-y-6">
                    {/* Header Section */}
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between px-2">
                        <div className="space-y-1">
                            <div className="flex items-center gap-3">
                                <h1 className="text-3xl font-bold tracking-tight text-[hsl(var(--text-primary))]">
                                    {currentProject.name}
                                </h1>
                                <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${statusTone[currentProject.status] || statusTone.planning}`}>
                                    {currentProject.status}
                                </span>
                            </div>
                            <p className="text-sm text-[hsl(var(--text-secondary))] max-w-2xl">
                                {currentProject.description || 'Manage forms, tasks, reports, and team access.'}
                            </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-4">
                            {workspaceStats.map(stat => (
                                <div key={stat.label} className="flex flex-col border-l border-[hsl(var(--border))] pl-4 first:border-l-0 first:pl-0">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--text-tertiary))]">{stat.label}</span>
                                    <span className="text-xl font-semibold text-[hsl(var(--text-primary))]">{stat.value}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* 3-Column Board */}
                    <div className="grid gap-6 lg:grid-cols-3 items-start">

                        {/* COLUMN 1: FORMS */}
                        <div className="space-y-6 flex flex-col">
                            <section className="flex flex-col rounded-[24px] bg-[hsl(var(--surface))] border border-[hsl(var(--border))] shadow-sm overflow-hidden">
                                <div className="flex items-center justify-between border-b border-[hsl(var(--border))] p-4 lg:p-5">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]">
                                            <FileText className="h-4 w-4" />
                                        </div>
                                        <h2 className="text-lg font-semibold text-[hsl(var(--text-primary))]">Forms</h2>
                                    </div>
                                    <button onClick={handleCreateForm} className="flex items-center gap-1 text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--primary))] transition-colors px-2 py-1 rounded-lg hover:bg-[hsl(var(--surface-elevated))]">
                                        <Plus className="h-4 w-4" />
                                        <span className="text-xs font-semibold">New</span>
                                    </button>
                                </div>
                                <div className="flex flex-col gap-3 p-4 lg:p-5">
                                    {forms.length === 0 ? (
                                        <p className="text-sm text-[hsl(var(--text-tertiary))] text-center py-4 bg-[hsl(var(--background))] rounded-md border border-dashed border-[hsl(var(--border))]">No forms yet.</p>
                                    ) : forms.map(form => (
                                        <div key={form.id} className="group relative rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3 transition-shadow hover:shadow-md">
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <h3 className="text-sm font-semibold leading-tight text-[hsl(var(--text-primary))]">{form.title}</h3>
                                                    <p className="mt-1 text-[11px] text-[hsl(var(--text-tertiary))]">v{form.version} • {new Date(form.updated_at).toLocaleDateString()}</p>
                                                </div>
                                                <span className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${formStatusTone[form.status] || formStatusTone.draft}`}>
                                                    {form.status}
                                                </span>
                                            </div>
                                            <div className="mt-3 flex items-center justify-between pt-3 border-t border-[hsl(var(--border))]/50">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-500 shrink-0" title={resolveAccessorLabel(form.lead_accessor_id, form.lead_accessor_type)}>
                                                        {resolveAccessorLabel(form.lead_accessor_id, form.lead_accessor_type).charAt(0).toUpperCase()}
                                                    </div>
                                                    <select
                                                        value={getAccessorValue(form.assigned_accessor_id, form.assigned_accessor_type)}
                                                        onChange={(e) => handleFormResponsibilityChange(form, 'assigned', e.target.value)}
                                                        className="text-xs bg-transparent text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] cursor-pointer outline-none w-24 truncate"
                                                    >
                                                        <option value="">Unassigned</option>
                                                        {assignmentOptions.map(opt => <option key={`form-assign-${form.id}-${opt.type}-${opt.id}`} value={`${opt.type}:${opt.id}`}>{opt.label}</option>)}
                                                    </select>
                                                </div>
                                                <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 flex-wrap justify-end">
                                                    <button onClick={() => navigate(`/simulator/${form.id}`)} className="p-1 px-1.5 text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--primary))] rounded hover:bg-[hsl(var(--primary))]/10 block">
                                                        <Play className="h-3.5 w-3.5 fill-current" />
                                                    </button>
                                                    <button onClick={() => navigate(`/builder/${form.id}`)} className="p-1 px-1.5 text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--primary))] rounded hover:bg-[hsl(var(--primary))]/10 block">
                                                        <ChevronRight className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            {/* DATASETS */}
                            <section className="flex flex-col rounded-[24px] bg-[hsl(var(--surface))] border border-[hsl(var(--border))] shadow-sm overflow-hidden">
                                <div className="flex items-center justify-between border-b border-[hsl(var(--border))] p-4 lg:p-5">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]">
                                            <Database className="h-4 w-4" />
                                        </div>
                                        <h2 className="text-lg font-semibold text-[hsl(var(--text-primary))]">Datasets</h2>
                                    </div>
                                    <button onClick={() => navigate('/dashboard?tab=datasets')} className="flex items-center gap-1 text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--primary))] transition-colors px-2 py-1 rounded-lg hover:bg-[hsl(var(--surface-elevated))]">
                                        <Plus className="h-4 w-4" />
                                        <span className="text-xs font-semibold">New</span>
                                    </button>
                                </div>
                                <div className="flex flex-col gap-3 p-4 lg:p-5">
                                    {datasets.length === 0 ? (
                                        <p className="text-sm text-[hsl(var(--text-tertiary))] text-center py-4 bg-[hsl(var(--background))] rounded-md border border-dashed border-[hsl(var(--border))]">No datasets yet.</p>
                                    ) : datasets.map(dataset => (
                                        <div key={dataset.id} className="group relative rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3 transition-shadow hover:shadow-md">
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <h3 className="text-sm font-semibold leading-tight text-[hsl(var(--text-primary))]">{dataset.name}</h3>
                                                    <p className="mt-1 text-[11px] text-[hsl(var(--text-tertiary))]">{dataset.records_count.toLocaleString()} rows • {new Date(dataset.updated_at).toLocaleDateString()}</p>
                                                </div>
                                                <span className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${dataset.status === 'active' ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20' : 'bg-slate-500/10 text-slate-300 border border-slate-500/20'}`}>
                                                    {dataset.status}
                                                </span>
                                            </div>
                                            <div className="mt-3 flex items-center justify-end pt-3 border-t border-[hsl(var(--border))]/50">
                                                <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 flex-wrap">
                                                    <button className="p-1 px-1.5 text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--primary))] rounded hover:bg-[hsl(var(--primary))]/10 block">
                                                        <ChevronRight className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            <section className="flex flex-col rounded-[24px] bg-[hsl(var(--surface))] border border-[hsl(var(--border))] shadow-sm overflow-hidden">
                                <div className="flex items-center justify-between border-b border-[hsl(var(--border))] p-4 lg:p-5">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]">
                                            <Paperclip className="h-4 w-4" />
                                        </div>
                                        <h2 className="text-lg font-semibold text-[hsl(var(--text-primary))]">Assets</h2>
                                    </div>
                                    <button onClick={() => navigate('/dashboard?tab=assets')} className="flex items-center gap-1 text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--primary))] transition-colors px-2 py-1 rounded-lg hover:bg-[hsl(var(--surface-elevated))]">
                                        <Plus className="h-4 w-4" />
                                        <span className="text-xs font-semibold">New</span>
                                    </button>
                                </div>
                                <div className="flex flex-col gap-3 p-4 lg:p-5">
                                    {assets.length === 0 ? (
                                        <p className="text-sm text-[hsl(var(--text-tertiary))] text-center py-4 bg-[hsl(var(--background))] rounded-md border border-dashed border-[hsl(var(--border))]">No assets yet.</p>
                                    ) : assets.map(asset => (
                                        <div key={asset.id} className="group relative rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3 transition-shadow hover:shadow-md">
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <h3 className="text-sm font-semibold leading-tight text-[hsl(var(--text-primary))]">{asset.title}</h3>
                                                    <p className="mt-1 text-[11px] text-[hsl(var(--text-tertiary))]">{asset.kind} • {new Date(asset.updated_at).toLocaleDateString()}</p>
                                                </div>
                                                <span className="inline-flex rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--surface-elevated))] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--text-tertiary))]">
                                                    {asset.kind}
                                                </span>
                                            </div>
                                            <p className="mt-3 text-xs text-[hsl(var(--text-secondary))]">{asset.summary}</p>
                                            <div className="mt-3 rounded-lg border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--surface-elevated))] px-3 py-2 text-[11px] text-[hsl(var(--text-secondary))]">
                                                Placeholder: previews, uploads, and link attachments will be managed here.
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        </div>

                        {/* COLUMN 2: TASKS */}
                        <div className="space-y-6 flex flex-col">
                            <section className="flex flex-col rounded-[24px] bg-[hsl(var(--surface))] border border-[hsl(var(--border))] shadow-sm overflow-hidden">
                                <div className="flex items-center justify-between border-b border-[hsl(var(--border))] p-4 lg:p-5">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]">
                                            <SquareCheckBig className="h-4 w-4" />
                                        </div>
                                        <h2 className="text-lg font-semibold text-[hsl(var(--text-primary))]">Tasks</h2>
                                    </div>
                                    <button onClick={() => navigate('/dashboard?tab=tasks')} className="flex items-center gap-1 text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--primary))] transition-colors px-2 py-1 rounded-lg hover:bg-[hsl(var(--surface-elevated))]">
                                        <Plus className="h-4 w-4" />
                                        <span className="text-xs font-semibold">New</span>
                                    </button>
                                </div>
                                <div className="flex flex-col gap-3 p-4 lg:p-5">
                                    {tasks.length === 0 ? (
                                        <p className="text-sm text-[hsl(var(--text-tertiary))] text-center py-4 bg-[hsl(var(--background))] rounded-md border border-dashed border-[hsl(var(--border))]">No tasks yet.</p>
                                    ) : tasks.map(task => (
                                        <div key={task.id} className={`group relative rounded-md border p-3 transition-shadow hover:shadow-md block ${task.status === 'done' ? 'border-[hsl(var(--border))] bg-[hsl(var(--background))]/50 opacity-75' : 'border-[hsl(var(--border))] bg-[hsl(var(--background))]'}`}>
                                            <div className="flex items-start gap-3">
                                                <input
                                                    type="checkbox"
                                                    checked={task.status === 'done'}
                                                    onChange={(e) => handleTaskStatusChange(task.id, e.target.checked ? 'done' : 'todo')}
                                                    className="mt-1 h-4 w-4 rounded border-[hsl(var(--border))] bg-[hsl(var(--surface))] text-[hsl(var(--primary))] focus:ring-[hsl(var(--primary))] cursor-pointer shrink-0"
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <h3 className={`text-sm font-semibold leading-tight text-[hsl(var(--text-primary))] ${task.status === 'done' ? 'line-through text-[hsl(var(--text-tertiary))]' : ''}`}>
                                                        {task.title}
                                                    </h3>
                                                    {task.due_at && (
                                                        <p className="mt-1 text-[11px] font-medium text-orange-500/80">
                                                            Due {new Date(task.due_at).toLocaleDateString()}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="mt-3 flex items-center justify-between pt-3 border-t border-[hsl(var(--border))]/50">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-[10px] font-bold text-blue-600 dark:text-blue-400 shrink-0" title={resolveTaskAssigneeLabel(task)}>
                                                        {resolveTaskAssigneeLabel(task).charAt(0).toUpperCase()}
                                                    </div>
                                                    <select
                                                        value={getTaskAssignmentValue(task)}
                                                        onChange={(e) => handleTaskAssignmentChange(task.id, e.target.value)}
                                                        className="text-xs bg-transparent text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] cursor-pointer outline-none w-20 truncate"
                                                    >
                                                        <option value="">Unassigned</option>
                                                        {assignmentOptions.map(opt => <option key={`task-assign-${task.id}-${opt.type}-${opt.id}`} value={`${opt.type}:${opt.id}`}>{opt.label}</option>)}
                                                    </select>
                                                </div>
                                                <button onClick={() => handleDeleteTask(task.id)} className="opacity-0 group-hover:opacity-100 p-1 px-1.5 text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--error))] text-[10px] font-semibold transition-opacity rounded bg-[hsl(var(--error))]/5">
                                                    Del
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            <section className="flex flex-col rounded-[24px] bg-[hsl(var(--surface))] border border-[hsl(var(--border))] shadow-sm overflow-hidden">
                                <div className="flex items-center justify-between border-b border-[hsl(var(--border))] p-4 lg:p-5">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]">
                                            <MessageSquare className="h-4 w-4" />
                                        </div>
                                        <h2 className="text-lg font-semibold text-[hsl(var(--text-primary))]">Threads</h2>
                                    </div>
                                    <button onClick={() => navigate('/dashboard?tab=threads')} className="flex items-center gap-1 text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--primary))] transition-colors px-2 py-1 rounded-lg hover:bg-[hsl(var(--surface-elevated))]">
                                        <Plus className="h-4 w-4" />
                                        <span className="text-xs font-semibold">New</span>
                                    </button>
                                </div>
                                <div className="flex flex-col gap-3 p-4 lg:p-5">
                                    {threads.length === 0 ? (
                                        <p className="text-sm text-[hsl(var(--text-tertiary))] text-center py-4 bg-[hsl(var(--background))] rounded-md border border-dashed border-[hsl(var(--border))]">No threads yet.</p>
                                    ) : threads.map(thread => (
                                        <div key={thread.id} className="group relative rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3 transition-shadow hover:shadow-md">
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <h3 className="text-sm font-semibold leading-tight text-[hsl(var(--text-primary))]">{thread.title}</h3>
                                                    <p className="mt-1 text-[11px] text-[hsl(var(--text-tertiary))]">Updated {new Date(thread.updated_at).toLocaleString()}</p>
                                                </div>
                                                <span className="inline-flex rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--surface-elevated))] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--text-tertiary))]">
                                                    {thread.reply_count} replies
                                                </span>
                                            </div>
                                            <p className="mt-3 text-xs text-[hsl(var(--text-secondary))]">{thread.summary}</p>
                                            <div className="mt-3 rounded-lg border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--surface-elevated))] px-3 py-2 text-[11px] text-[hsl(var(--text-secondary))]">
                                                Placeholder: message feed, composer, mentions, and activity history will land here.
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        </div>

                        {/* COLUMN 3: REPORTS AND MEMBERS */}
                        <div className="space-y-6 flex flex-col">

                            {/* REPORTS */}
                            <section className="flex flex-col rounded-[24px] bg-[hsl(var(--surface))] border border-[hsl(var(--border))] shadow-sm overflow-hidden">
                                <div className="flex items-center justify-between border-b border-[hsl(var(--border))] p-4 lg:p-5">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]">
                                            <FileBarChart2 className="h-4 w-4" />
                                        </div>
                                        <h2 className="text-lg font-semibold text-[hsl(var(--text-primary))]">Reports</h2>
                                    </div>
                                    <button onClick={handleCreateReport} className="flex items-center gap-1 text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--primary))] transition-colors px-2 py-1 rounded-lg hover:bg-[hsl(var(--surface-elevated))]">
                                        <Plus className="h-4 w-4" />
                                        <span className="text-xs font-semibold">New</span>
                                    </button>
                                </div>
                                <div className="flex flex-col gap-3 p-4 lg:p-5">
                                    {reports.length === 0 ? (
                                        <p className="text-sm text-[hsl(var(--text-tertiary))] text-center py-4 bg-[hsl(var(--background))] rounded-md border border-dashed border-[hsl(var(--border))]">No reports yet.</p>
                                    ) : reports.map(report => (
                                        <div key={report.id} className="group relative rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3 transition-shadow hover:shadow-md">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0 pr-2">
                                                    <h3 className="text-sm font-semibold leading-tight text-[hsl(var(--text-primary))] truncate">{report.title}</h3>
                                                    <p className="mt-1 text-[11px] text-[hsl(var(--text-tertiary))] truncate">{report.description || 'No description'}</p>
                                                </div>
                                                <select
                                                    value={report.status}
                                                    onChange={(e) => handleReportUpdate(report.id, { status: e.target.value as ReportArtifact['status'] })}
                                                    className={`shrink-0 appearance-none inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-center cursor-pointer outline-none border-0 ${reportStatusTone[report.status] || reportStatusTone.draft}`}
                                                >
                                                    <option value="draft">Draft</option>
                                                    <option value="published">Published</option>
                                                    <option value="archived">Archived</option>
                                                </select>
                                            </div>
                                            <div className="mt-3 flex items-center justify-between pt-3 border-t border-[hsl(var(--border))]/50">
                                                <div className="flex items-center gap-2 max-w-[50%]">
                                                    <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[9px] font-bold text-slate-500 shrink-0" title={resolveAccessorLabel(report.lead_accessor_id, report.lead_accessor_type)}>
                                                        {resolveAccessorLabel(report.lead_accessor_id, report.lead_accessor_type).charAt(0).toUpperCase()}
                                                    </div>
                                                    <span className="text-[10px] text-[hsl(var(--text-secondary))] uppercase tracking-widest leading-none font-bold truncate">Owner</span>
                                                </div>
                                                <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                                                    <button onClick={() => handleDeleteReport(report.id)} className="p-1 px-1.5 text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--error))] text-[10px] font-semibold rounded bg-[hsl(var(--error))]/5">
                                                        Del
                                                    </button>
                                                    <button onClick={() => navigate(`/projects/${projectId}/reports/${report.id}`)} className="p-1 text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--primary))] rounded-md hover:bg-[hsl(var(--primary))]/10">
                                                        <ChevronRight className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            {/* MEMBERS */}
                            <section className="flex flex-col rounded-[24px] bg-[hsl(var(--surface))] border border-[hsl(var(--border))] shadow-sm overflow-hidden">
                                <div className="flex items-center justify-between border-b border-[hsl(var(--border))] p-4 lg:p-5">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]">
                                            <Users className="h-4 w-4" />
                                        </div>
                                        <h2 className="text-lg font-semibold text-[hsl(var(--text-primary))]">Members</h2>
                                    </div>
                                </div>
                                <div className="p-4 lg:p-5 flex flex-col gap-4">
                                    <form onSubmit={handleGrantAccess} className="flex flex-col sm:flex-row gap-2">
                                        <select
                                            value={accessorId}
                                            onChange={(e) => setAccessorId(e.target.value)}
                                            className="flex-1 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-xs text-[hsl(var(--text-primary))] focus:ring-1 focus:ring-[hsl(var(--primary))]"
                                        >
                                            <option value="">Add member...</option>
                                            {selectableAccessors.map(opt => <option key={`add-mem-${opt.id}`} value={opt.id}>{opt.label}</option>)}
                                        </select>
                                        <div className="flex gap-2">
                                            <select
                                                value={roleTemplateId}
                                                onChange={(e) => setRoleTemplateId(e.target.value)}
                                                className="flex-1 sm:w-20 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 py-2 text-[11px] text-[hsl(var(--text-primary))] focus:ring-1 focus:ring-[hsl(var(--primary))]"
                                            >
                                                {roleTemplates.map(rt => <option key={`add-role-${rt.id}`} value={rt.id}>{businessRoleLabelBySlug[rt.slug] || rt.name}</option>)}
                                            </select>
                                            <button type="submit" disabled={!accessorId || !roleTemplateId} className="w-14 sm:w-auto shrink-0 rounded-md bg-[hsl(var(--primary))] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50 hover:bg-[hsl(var(--primary-hover))] shadow-sm">
                                                Add
                                            </button>
                                        </div>
                                    </form>

                                    <div className="space-y-2">
                                        {accessRules.length === 0 ? (
                                            <p className="text-sm text-[hsl(var(--text-tertiary))] text-center py-2">No members.</p>
                                        ) : accessRules.map(rule => (
                                            <div key={`member-rule-${rule.id}`} className="group flex items-center justify-between rounded-md p-2.5 hover:bg-[hsl(var(--background))] transition-colors border border-transparent hover:border-[hsl(var(--border))]">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-xs font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 shrink-0">
                                                        {resolveRuleLabel(rule).charAt(0).toUpperCase()}
                                                    </div>
                                                    <div className="min-w-0 pr-2">
                                                        <p className="text-sm font-semibold text-[hsl(var(--text-primary))] leading-tight truncate">{resolveRuleLabel(rule)}</p>
                                                        <p className="text-[10px] text-[hsl(var(--text-tertiary))] uppercase tracking-widest mt-0.5">{getBusinessRoleLabel(rule)}</p>
                                                    </div>
                                                </div>
                                                <button onClick={() => handleRevokeAccess(rule)} className="opacity-0 group-hover:opacity-100 py-1.5 px-2.5 rounded bg-[hsl(var(--error))]/5 text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--error))] text-[10px] font-semibold transition-opacity shrink-0">
                                                    Remove
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </section>

                        </div>

                    </div>
                </div>
            ) : null}
        </StudioLayout>
    );
};

export default ProjectWorkspace;