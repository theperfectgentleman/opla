import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, ChevronRight, FileText, Lock, Pencil, Play, Plus, Shield, Trash2, Users } from 'lucide-react';

import StudioLayout from '../components/StudioLayout';
import { useOrg } from '../contexts/OrgContext';
import { useAuth } from '../contexts/AuthContext';
import { formAPI, projectAPI, roleAPI, teamAPI } from '../lib/api';

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

type PermissionDefinition = {
    key: string;
    label: string;
    description: string;
    category: string;
};

type OrgMember = {
    user_id: string;
    global_role?: 'admin' | 'member';
    user?: {
        full_name?: string;
        email?: string;
        phone?: string;
    };
};

type Team = {
    id: string;
    name: string;
    description?: string;
};

type WorkspaceForm = {
    id: string;
    title: string;
    status: string;
    version: number;
    updated_at: string;
};

const statusTone: Record<string, string> = {
    planning: 'bg-amber-500/10 text-amber-300 border border-amber-500/20',
    active: 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20',
    paused: 'bg-orange-500/10 text-orange-300 border border-orange-500/20',
    archived: 'bg-slate-500/10 text-slate-300 border border-slate-500/20',
};

const projectStatuses = ['planning', 'active', 'paused', 'archived'] as const;

const ProjectWorkspace: React.FC = () => {
    const navigate = useNavigate();
    const { projectId } = useParams<{ projectId: string }>();
    const { user } = useAuth();
    const {
        currentOrg,
        currentProject,
        members,
        refreshCurrentProject,
        setCurrentProject,
        updateProject,
    } = useOrg();

    const [forms, setForms] = useState<WorkspaceForm[]>([]);
    const [accessRules, setAccessRules] = useState<ProjectAccessRule[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [roleTemplates, setRoleTemplates] = useState<ProjectRoleTemplate[]>([]);
    const [availablePermissions, setAvailablePermissions] = useState<PermissionDefinition[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [accessorType, setAccessorType] = useState<'user' | 'team'>('user');
    const [accessorId, setAccessorId] = useState('');
    const [roleTemplateId, setRoleTemplateId] = useState('');
    const [savingStatus, setSavingStatus] = useState(false);
    const [savingAccess, setSavingAccess] = useState(false);
    const [showRoleModal, setShowRoleModal] = useState(false);
    const [editingRoleTemplateId, setEditingRoleTemplateId] = useState<string | null>(null);
    const [roleName, setRoleName] = useState('');
    const [roleDescription, setRoleDescription] = useState('');
    const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
    const [priority, setPriority] = useState(50);
    const [savingRoleTemplate, setSavingRoleTemplate] = useState(false);

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
                const [project, projectForms, projectAccess, orgTeams, templates, catalog] = await Promise.all([
                    refreshCurrentProject(currentOrg.id, projectId),
                    formAPI.list(projectId),
                    projectAPI.listAccess(currentOrg.id, projectId),
                    teamAPI.list(currentOrg.id),
                    projectAPI.listRoleTemplates(currentOrg.id),
                    roleAPI.getCatalog(currentOrg.id),
                ]);
                setCurrentProject(project);
                setForms(projectForms);
                setAccessRules(projectAccess);
                setTeams(orgTeams);
                setRoleTemplates(templates);
                setAvailablePermissions(catalog.permissions || []);
            } catch (err: any) {
                setError(err?.message || 'Failed to load project workspace');
            } finally {
                setLoading(false);
            }
        };

        loadWorkspace();
    }, [currentOrg, projectId, refreshCurrentProject, setCurrentProject]);

    const selectableAccessors = useMemo(() => {
        if (accessorType === 'team') {
            return teams.map(team => ({ id: team.id, label: team.name }));
        }

        return members.map(member => ({
            id: member.user_id,
            label: member.user?.full_name || member.user?.email || member.user?.phone || member.user_id,
        }));
    }, [accessorType, members, teams]);

    useEffect(() => {
        setAccessorId(selectableAccessors[0]?.id || '');
    }, [selectableAccessors]);

    useEffect(() => {
        setRoleTemplateId(roleTemplates[0]?.id || '');
    }, [roleTemplates]);

    const isOrgAdmin = useMemo(() => {
        if (user?.is_platform_admin) {
            return true;
        }

        const membership = (members as OrgMember[]).find(member => member.user_id === user?.id);
        return membership?.global_role === 'admin';
    }, [members, user]);

    const permissionsByCategory = useMemo(() => (
        availablePermissions.reduce<Record<string, PermissionDefinition[]>>((acc, permission) => {
            acc[permission.category] = acc[permission.category] || [];
            acc[permission.category].push(permission);
            return acc;
        }, {})
    ), [availablePermissions]);

    const labelForPermission = (permissionKey: string) => (
        availablePermissions.find(permission => permission.key === permissionKey)?.label || permissionKey
    );

    const resetRoleTemplateForm = () => {
        setRoleName('');
        setRoleDescription('');
        setSelectedPermissions([]);
        setPriority(50);
        setEditingRoleTemplateId(null);
    };

    const openCreateRoleTemplate = () => {
        resetRoleTemplateForm();
        setShowRoleModal(true);
    };

    const openEditRoleTemplate = (template: ProjectRoleTemplate) => {
        setEditingRoleTemplateId(template.id);
        setRoleName(template.name);
        setRoleDescription(template.description || '');
        setSelectedPermissions(template.permissions || []);
        setPriority(template.priority || 50);
        setShowRoleModal(true);
    };

    const closeRoleTemplateModal = () => {
        setShowRoleModal(false);
        resetRoleTemplateForm();
    };

    const togglePermission = (permission: string) => {
        setSelectedPermissions(prev => (
            prev.includes(permission)
                ? prev.filter(item => item !== permission)
                : [...prev, permission]
        ));
    };

    const resolveAccessorLabel = (rule: ProjectAccessRule) => {
        if (rule.accessor_type === 'team') {
            return teams.find(team => team.id === rule.accessor_id)?.name || 'Unknown team';
        }

        const member = members.find(item => item.user_id === rule.accessor_id);
        return member?.user?.full_name || member?.user?.email || member?.user?.phone || 'Unknown member';
    };

    const handleShellNavSelect = (key: 'projects' | 'forms' | 'members' | 'audience' | 'analysis' | 'reports' | 'settings') => {
        navigate(`/dashboard?tab=${key}`);
    };

    const handleStatusChange = async (status: typeof projectStatuses[number]) => {
        if (!currentProject || !projectId) return;
        try {
            setSavingStatus(true);
            await updateProject(projectId, { status });
        } catch (err: any) {
            setError(err?.message || 'Failed to update project status');
        } finally {
            setSavingStatus(false);
        }
    };

    const handleGrantAccess = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!currentOrg || !projectId || !accessorId || !roleTemplateId) return;

        try {
            setSavingAccess(true);
            const accessRule = await projectAPI.grantAccess(currentOrg.id, projectId, {
                accessor_id: accessorId,
                accessor_type: accessorType,
                role_template_id: roleTemplateId,
            });
            setAccessRules(prev => {
                const previousRule = prev.find(item => item.accessor_id === accessRule.accessor_id && item.accessor_type === accessRule.accessor_type);
                const existing = prev.findIndex(item => item.accessor_id === accessRule.accessor_id && item.accessor_type === accessRule.accessor_type);
                setRoleTemplates(currentTemplates => currentTemplates.map(template => {
                    let nextCount = template.assignment_count || 0;
                    if (previousRule?.role_template_id === template.id && previousRule.role_template_id !== accessRule.role_template_id) {
                        nextCount = Math.max(0, nextCount - 1);
                    }
                    if (accessRule.role_template_id === template.id && previousRule?.role_template_id !== accessRule.role_template_id) {
                        nextCount += 1;
                    }
                    return nextCount === (template.assignment_count || 0)
                        ? template
                        : { ...template, assignment_count: nextCount };
                }));
                if (existing === -1) return [...prev, accessRule];
                const next = [...prev];
                next[existing] = accessRule;
                return next;
            });
        } catch (err: any) {
            setError(err?.response?.data?.detail || err?.message || 'Failed to grant project access');
        } finally {
            setSavingAccess(false);
        }
    };

    const handleRevokeAccess = async (rule: ProjectAccessRule) => {
        if (!currentOrg || !projectId) return;

        try {
            await projectAPI.revokeAccess(currentOrg.id, projectId, rule.accessor_id, rule.accessor_type);
            setAccessRules(prev => prev.filter(item => item.id !== rule.id));
            if (rule.role_template_id) {
                setRoleTemplates(prev => prev.map(template => (
                    template.id === rule.role_template_id
                        ? { ...template, assignment_count: Math.max(0, (template.assignment_count || 0) - 1) }
                        : template
                )));
            }
        } catch (err: any) {
            setError(err?.response?.data?.detail || err?.message || 'Failed to revoke project access');
        }
    };

    const handleSaveRoleTemplate = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!currentOrg || !roleName.trim() || selectedPermissions.length === 0) {
            return;
        }

        try {
            setSavingRoleTemplate(true);
            if (editingRoleTemplateId) {
                const updated = await projectAPI.updateRoleTemplate(currentOrg.id, editingRoleTemplateId, {
                    name: roleName,
                    description: roleDescription,
                    permissions: selectedPermissions,
                    priority,
                });
                setRoleTemplates(prev => prev.map(item => item.id === updated.id ? updated : item));
                if (roleTemplateId === updated.id) {
                    setRoleTemplateId(updated.id);
                }
            } else {
                const created = await projectAPI.createRoleTemplate(currentOrg.id, {
                    name: roleName,
                    description: roleDescription,
                    permissions: selectedPermissions,
                    priority,
                });
                setRoleTemplates(prev => {
                    const next = [...prev, created].sort((left, right) => right.priority - left.priority || left.name.localeCompare(right.name));
                    return next;
                });
                setRoleTemplateId(created.id);
            }
            closeRoleTemplateModal();
        } catch (err: any) {
            setError(err?.response?.data?.detail || err?.message || 'Failed to save project role template');
        } finally {
            setSavingRoleTemplate(false);
        }
    };

    const handleDeleteRoleTemplate = async (template: ProjectRoleTemplate) => {
        if (!currentOrg) return;
        if (!window.confirm(`Delete ${template.name}? This will fail if it still has assignments.`)) {
            return;
        }

        try {
            await projectAPI.deleteRoleTemplate(currentOrg.id, template.id);
            setRoleTemplates(prev => prev.filter(item => item.id !== template.id));
            if (roleTemplateId === template.id) {
                const remaining = roleTemplates.filter(item => item.id !== template.id);
                setRoleTemplateId(remaining[0]?.id || '');
            }
        } catch (err: any) {
            setError(err?.response?.data?.detail || err?.message || 'Failed to delete project role template');
        }
    };

    return (
        <StudioLayout
            activeNav="projects"
            onSelectNav={handleShellNavSelect}
            counts={{ projects: 0, forms: forms.length, members: members?.length || 0 }}
            contentClassName="flex-1 overflow-y-auto p-10"
        >
            {loading ? (
                <div className="flex items-center justify-center py-24">
                    <div className="h-10 w-10 rounded-full border-4 border-[hsl(var(--primary))]/30 border-t-[hsl(var(--primary))] animate-spin" />
                </div>
            ) : error ? (
                <div className="rounded-3xl border border-[hsl(var(--error))]/20 bg-[hsl(var(--error))]/10 p-8 text-[hsl(var(--text-primary))]">
                    <div className="mb-3 flex items-center gap-3 text-[hsl(var(--error))]">
                        <AlertCircle className="h-5 w-5" />
                        <h2 className="text-lg font-semibold">Project workspace unavailable</h2>
                    </div>
                    <p className="text-sm text-[hsl(var(--text-secondary))]">{error}</p>
                </div>
            ) : currentProject ? (
                <div className="space-y-8">
                    <div className="flex items-start justify-between gap-6">
                        <div>
                            <p className="text-xs font-bold uppercase tracking-[0.25em] text-[hsl(var(--text-tertiary))]">Project Workspace</p>
                            <h1 className="mt-3 text-4xl font-bold tracking-tight">{currentProject.name}</h1>
                            <p className="mt-3 max-w-3xl text-sm text-[hsl(var(--text-secondary))]">
                                {currentProject.description || 'Use this workspace to manage the campaign lifecycle, forms, access, and operational activity.'}
                            </p>
                        </div>

                        <div className="rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] p-5 min-w-[280px]">
                            <div className="flex items-center justify-between gap-3">
                                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] ${statusTone[currentProject.status] || statusTone.planning}`}>
                                    {currentProject.status}
                                </span>
                                <select
                                    value={currentProject.status}
                                    onChange={(event) => handleStatusChange(event.target.value as typeof projectStatuses[number])}
                                    disabled={savingStatus}
                                    className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-elevated))] px-3 py-2 text-sm"
                                >
                                    {projectStatuses.map(status => (
                                        <option key={status} value={status}>{status}</option>
                                    ))}
                                </select>
                            </div>
                            <p className="mt-4 text-xs text-[hsl(var(--text-tertiary))]">
                                Created {new Date(currentProject.created_at).toLocaleDateString()}
                            </p>
                            <p className="mt-1 text-xs text-[hsl(var(--text-tertiary))]">
                                Updated {new Date(currentProject.updated_at || currentProject.created_at).toLocaleDateString()}
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-8 xl:grid-cols-[1.6fr_1fr]">
                        <section className="rounded-[28px] border border-[hsl(var(--border))] bg-[hsl(var(--surface))] p-8">
                            <div className="mb-6 flex items-center justify-between">
                                <div>
                                    <h2 className="text-2xl font-semibold">Forms</h2>
                                    <p className="mt-1 text-sm text-[hsl(var(--text-secondary))]">Published and draft forms attached to this workspace.</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                {forms.length === 0 ? (
                                    <div className="rounded-3xl border border-dashed border-[hsl(var(--border))] p-10 text-center text-sm text-[hsl(var(--text-tertiary))]">
                                        No forms in this workspace yet.
                                    </div>
                                ) : forms.map(form => (
                                    <div key={form.id} className="flex items-center justify-between rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-4">
                                        <div className="flex items-center gap-4 overflow-hidden">
                                            <div className="rounded-2xl bg-[hsl(var(--primary))]/10 p-3 text-[hsl(var(--primary))]">
                                                <FileText className="h-5 w-5" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-semibold">{form.title}</p>
                                                <p className="mt-1 text-xs text-[hsl(var(--text-tertiary))]">v{form.version} • {form.status}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => navigate(`/builder/${form.id}`)}
                                                className="inline-flex items-center gap-2 rounded-xl border border-[hsl(var(--border))] px-3 py-2 text-sm hover:bg-[hsl(var(--surface-elevated))]"
                                            >
                                                Open
                                                <ChevronRight className="h-4 w-4" />
                                            </button>
                                            <button
                                                onClick={() => navigate(`/simulator/${form.id}`)}
                                                className="inline-flex items-center gap-2 rounded-xl border border-[hsl(var(--border))] px-3 py-2 text-sm hover:bg-[hsl(var(--surface-elevated))]"
                                            >
                                                <Play className="h-4 w-4 fill-current" />
                                                Preview
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>

                        <div className="space-y-8">
                            <section className="rounded-[28px] border border-[hsl(var(--border))] bg-[hsl(var(--surface))] p-8">
                                <div className="flex items-center gap-3">
                                    <Shield className="h-5 w-5 text-[hsl(var(--primary))]" />
                                    <div>
                                        <h2 className="text-xl font-semibold">Access</h2>
                                        <p className="text-sm text-[hsl(var(--text-secondary))]">Grant project roles to members or teams.</p>
                                    </div>
                                </div>

                                <form onSubmit={handleGrantAccess} className="mt-6 space-y-4">
                                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                        <select
                                            value={accessorType}
                                            onChange={(event) => setAccessorType(event.target.value as 'user' | 'team')}
                                            className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-elevated))] px-3 py-3 text-sm"
                                        >
                                            <option value="user">Member</option>
                                            <option value="team">Team</option>
                                        </select>
                                        <select
                                            value={roleTemplateId}
                                            onChange={(event) => setRoleTemplateId(event.target.value)}
                                            className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-elevated))] px-3 py-3 text-sm"
                                        >
                                            {roleTemplates.map(option => (
                                                <option key={option.id} value={option.id}>{option.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {roleTemplateId ? (
                                        <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-3 text-xs text-[hsl(var(--text-secondary))]">
                                            {roleTemplates.find(item => item.id === roleTemplateId)?.description || 'Project role template'}
                                        </div>
                                    ) : null}

                                    <select
                                        value={accessorId}
                                        onChange={(event) => setAccessorId(event.target.value)}
                                        className="w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-elevated))] px-3 py-3 text-sm"
                                    >
                                        {selectableAccessors.length === 0 ? (
                                            <option value="">No accessors available</option>
                                        ) : selectableAccessors.map(option => (
                                            <option key={option.id} value={option.id}>{option.label}</option>
                                        ))}
                                    </select>

                                    <button
                                        type="submit"
                                        disabled={savingAccess || !accessorId || !roleTemplateId}
                                        className="w-full rounded-2xl bg-[hsl(var(--primary))] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-black/10 disabled:opacity-60"
                                    >
                                        {savingAccess ? 'Saving...' : 'Grant Access'}
                                    </button>
                                </form>

                                <div className="mt-6 space-y-3">
                                    {accessRules.length === 0 ? (
                                        <div className="rounded-2xl border border-dashed border-[hsl(var(--border))] p-4 text-sm text-[hsl(var(--text-tertiary))]">
                                            No explicit access rules yet. Organization admins can still manage this workspace.
                                        </div>
                                    ) : accessRules.map(rule => (
                                        <div key={rule.id} className="flex items-center justify-between rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-3">
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-semibold">{resolveAccessorLabel(rule)}</p>
                                                <p className="mt-1 text-xs uppercase tracking-[0.2em] text-[hsl(var(--text-tertiary))]">{rule.accessor_type} • {rule.role_name || rule.role_slug || rule.role}</p>
                                            </div>
                                            <button
                                                onClick={() => handleRevokeAccess(rule)}
                                                className="rounded-xl border border-[hsl(var(--border))] px-3 py-2 text-xs font-semibold hover:bg-[hsl(var(--surface-elevated))]"
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            <section className="rounded-[28px] border border-[hsl(var(--border))] bg-[hsl(var(--surface))] p-8">
                                <div className="flex items-center gap-3">
                                    <Users className="h-5 w-5 text-[hsl(var(--primary))]" />
                                    <div className="flex-1">
                                        <h2 className="text-xl font-semibold">Role Templates</h2>
                                        <p className="text-sm text-[hsl(var(--text-secondary))]">Define the operational roles this workspace can assign.</p>
                                    </div>
                                    {isOrgAdmin ? (
                                        <button
                                            onClick={openCreateRoleTemplate}
                                            className="inline-flex items-center gap-2 rounded-2xl bg-[hsl(var(--primary))] px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-black/10"
                                        >
                                            <Plus className="h-4 w-4" />
                                            New Role
                                        </button>
                                    ) : null}
                                </div>

                                <div className="mt-6 space-y-4">
                                    {roleTemplates.map(template => (
                                        <div key={template.id} className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-4">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <p className="truncate text-sm font-semibold">{template.name}</p>
                                                        {template.assignment_count ? (
                                                            <span className="inline-flex rounded-full bg-[hsl(var(--primary))]/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[hsl(var(--primary))]">
                                                                {template.assignment_count} assigned
                                                            </span>
                                                        ) : null}
                                                        {template.is_system ? (
                                                            <span className="inline-flex items-center gap-1 rounded-full bg-[hsl(var(--surface-elevated))] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[hsl(var(--text-tertiary))]">
                                                                <Lock className="h-3 w-3" />
                                                                System
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                    <p className="mt-1 text-xs text-[hsl(var(--text-secondary))]">{template.description || 'No description provided.'}</p>
                                                    {template.assignment_count ? (
                                                        <p className="mt-2 text-xs text-[hsl(var(--text-tertiary))]">This role is currently assigned in {template.assignment_count} access rule{template.assignment_count === 1 ? '' : 's'}.</p>
                                                    ) : null}
                                                    <p className="mt-2 text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--text-tertiary))]">Priority {template.priority} • {template.slug}</p>
                                                </div>

                                                {isOrgAdmin ? (
                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            onClick={() => openEditRoleTemplate(template)}
                                                            className="rounded-xl border border-[hsl(var(--border))] px-2 py-2 text-[hsl(var(--text-tertiary))] hover:bg-[hsl(var(--surface-elevated))] hover:text-[hsl(var(--text-primary))]"
                                                            title="Edit role template"
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                        </button>
                                                        {!template.is_system ? (
                                                            <button
                                                                onClick={() => handleDeleteRoleTemplate(template)}
                                                                disabled={(template.assignment_count || 0) > 0}
                                                                className="rounded-xl border border-[hsl(var(--border))] px-2 py-2 text-[hsl(var(--text-tertiary))] hover:border-[hsl(var(--error))]/20 hover:bg-[hsl(var(--error))]/10 hover:text-[hsl(var(--error))] disabled:cursor-not-allowed disabled:opacity-40"
                                                                title="Delete role template"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </button>
                                                        ) : null}
                                                    </div>
                                                ) : null}
                                            </div>

                                            <div className="mt-4 flex flex-wrap gap-2">
                                                {template.permissions.slice(0, 5).map(permission => (
                                                    <span key={permission} className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface-elevated))] px-2 py-1 text-xs text-[hsl(var(--text-secondary))]">
                                                        {labelForPermission(permission)}
                                                    </span>
                                                ))}
                                                {template.permissions.length > 5 ? (
                                                    <span className="px-2 py-1 text-xs text-[hsl(var(--text-tertiary))]">+{template.permissions.length - 5} more</span>
                                                ) : null}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        </div>
                    </div>
                </div>
            ) : null}

            {showRoleModal ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
                    <div className="my-8 w-full max-w-3xl rounded-[32px] border border-[hsl(var(--border))] bg-[hsl(var(--surface))] p-8 shadow-2xl">
                        <h2 className="text-2xl font-bold">{editingRoleTemplateId ? 'Edit Project Role' : 'Create Project Role'}</h2>
                        <p className="mt-2 text-sm text-[hsl(var(--text-secondary))]">
                            {editingRoleTemplateId
                                ? 'Update permissions and defaults for this project role template.'
                                : 'Create a reusable project role template for campaign workspaces.'}
                        </p>

                        <form onSubmit={handleSaveRoleTemplate} className="mt-6 space-y-6">
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <div>
                                    <label className="label">Role Name</label>
                                    <input
                                        value={roleName}
                                        onChange={(event) => setRoleName(event.target.value)}
                                        className="input"
                                        placeholder="e.g. Regional Coordinator"
                                        disabled={savingRoleTemplate}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="label">Priority</label>
                                    <input
                                        type="number"
                                        value={priority}
                                        onChange={(event) => setPriority(parseInt(event.target.value || '50', 10))}
                                        className="input"
                                        min="1"
                                        max="99"
                                        disabled={savingRoleTemplate}
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="label">Description</label>
                                <textarea
                                    value={roleDescription}
                                    onChange={(event) => setRoleDescription(event.target.value)}
                                    className="input min-h-[88px]"
                                    placeholder="Describe what this role is responsible for."
                                    disabled={savingRoleTemplate}
                                />
                            </div>

                            <div>
                                <label className="label mb-3">Permissions</label>
                                <div className="max-h-[340px] space-y-5 overflow-y-auto rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-elevated))] p-4">
                                    {Object.entries(permissionsByCategory).map(([category, permissions]) => (
                                        <div key={category}>
                                            <div className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-[hsl(var(--text-tertiary))]">{category}</div>
                                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                                {permissions.map(permission => (
                                                    <label key={permission.key} className="flex cursor-pointer items-start gap-3 rounded-xl p-3 transition-all hover:bg-[hsl(var(--surface))]">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedPermissions.includes(permission.key)}
                                                            onChange={() => togglePermission(permission.key)}
                                                            className="mt-0.5 h-4 w-4 rounded border-[hsl(var(--border))] text-[hsl(var(--primary))]"
                                                            disabled={savingRoleTemplate}
                                                        />
                                                        <div>
                                                            <div className="text-sm font-medium">{permission.label}</div>
                                                            <div className="mt-1 text-xs text-[hsl(var(--text-tertiary))]">{permission.description}</div>
                                                        </div>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={closeRoleTemplateModal}
                                    className="flex-1 rounded-2xl border border-[hsl(var(--border))] px-6 py-3 text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--surface-elevated))]"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={savingRoleTemplate || selectedPermissions.length === 0 || !roleName.trim()}
                                    className="flex-1 rounded-2xl bg-[hsl(var(--primary))] py-3 font-bold text-white shadow-lg shadow-black/10 disabled:opacity-50"
                                >
                                    {savingRoleTemplate ? 'Saving...' : editingRoleTemplateId ? 'Save Role' : 'Create Role'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            ) : null}
        </StudioLayout>
    );
};

export default ProjectWorkspace;