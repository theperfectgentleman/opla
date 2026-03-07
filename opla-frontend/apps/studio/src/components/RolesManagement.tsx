import React, { useEffect, useMemo, useState } from 'react';
import { Lock, Pencil, Plus, Shield, Trash2, Users } from 'lucide-react';
import { projectAPI, roleAPI } from '../lib/api';

interface OrgRole {
    id: string;
    name: string;
    slug: string;
    description: string;
    permissions: string[];
    priority: number;
    is_system: boolean;
}

interface ProjectRoleTemplate {
    id: string;
    name: string;
    slug: string;
    description?: string;
    permissions: string[];
    priority: number;
    is_system: boolean;
    assignment_count?: number;
}

interface PermissionDefinition {
    key: string;
    label: string;
    description: string;
    category: string;
}

interface RolesManagementProps {
    orgId: string;
    isAdmin: boolean;
}

type RoleScope = 'organization' | 'project';

const RolesManagement: React.FC<RolesManagementProps> = ({ orgId, isAdmin }) => {
    const [organizationRoles, setOrganizationRoles] = useState<OrgRole[]>([]);
    const [projectRoles, setProjectRoles] = useState<ProjectRoleTemplate[]>([]);
    const [availablePermissions, setAvailablePermissions] = useState<PermissionDefinition[]>([]);
    const [showRoleModal, setShowRoleModal] = useState(false);
    const [roleScope, setRoleScope] = useState<RoleScope>('organization');
    const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
    const [roleName, setRoleName] = useState('');
    const [roleSlug, setRoleSlug] = useState('');
    const [roleDescription, setRoleDescription] = useState('');
    const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
    const [priority, setPriority] = useState(50);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const loadRoleData = async () => {
            try {
                const [orgRoleData, catalog, projectRoleData] = await Promise.all([
                    roleAPI.list(orgId),
                    roleAPI.getCatalog(orgId),
                    projectAPI.listRoleTemplates(orgId),
                ]);
                setOrganizationRoles(orgRoleData);
                setProjectRoles(projectRoleData);
                setAvailablePermissions(catalog.permissions || []);
            } catch (err) {
                console.error('Failed to load roles:', err);
            }
        };

        loadRoleData();
    }, [orgId]);

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

    const generateSlug = (name: string) => (
        name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    );

    const resetForm = () => {
        setEditingRoleId(null);
        setRoleName('');
        setRoleSlug('');
        setRoleDescription('');
        setSelectedPermissions([]);
        setPriority(50);
    };

    const openCreateModal = (scope: RoleScope) => {
        resetForm();
        setRoleScope(scope);
        setShowRoleModal(true);
    };

    const openEditOrganizationRole = (role: OrgRole) => {
        setRoleScope('organization');
        setEditingRoleId(role.id);
        setRoleName(role.name);
        setRoleSlug(role.slug);
        setRoleDescription(role.description || '');
        setSelectedPermissions(role.permissions || []);
        setPriority(role.priority || 50);
        setShowRoleModal(true);
    };

    const openEditProjectRole = (role: ProjectRoleTemplate) => {
        setRoleScope('project');
        setEditingRoleId(role.id);
        setRoleName(role.name);
        setRoleSlug(role.slug);
        setRoleDescription(role.description || '');
        setSelectedPermissions(role.permissions || []);
        setPriority(role.priority || 50);
        setShowRoleModal(true);
    };

    const closeRoleModal = () => {
        setShowRoleModal(false);
        resetForm();
    };

    const handleNameChange = (name: string) => {
        setRoleName(name);
        if (roleScope === 'organization' && (!roleSlug || roleSlug === generateSlug(roleName))) {
            setRoleSlug(generateSlug(name));
        }
    };

    const togglePermission = (permission: string) => {
        setSelectedPermissions(prev => (
            prev.includes(permission)
                ? prev.filter(item => item !== permission)
                : [...prev, permission]
        ));
    };

    const sortByPriority = <T extends { priority: number; name: string }>(items: T[]) => (
        [...items].sort((left, right) => right.priority - left.priority || left.name.localeCompare(right.name))
    );

    const saveRole = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!roleName.trim() || selectedPermissions.length === 0) {
            return;
        }

        if (roleScope === 'organization' && !editingRoleId && !roleSlug.trim()) {
            return;
        }

        setLoading(true);
        try {
            if (roleScope === 'organization') {
                if (editingRoleId) {
                    const updated = await roleAPI.update(orgId, editingRoleId, {
                        name: roleName,
                        description: roleDescription,
                        permissions: selectedPermissions,
                        priority,
                    });
                    setOrganizationRoles(prev => prev.map(role => role.id === updated.id ? updated : role));
                } else {
                    const created = await roleAPI.create(orgId, {
                        name: roleName,
                        slug: roleSlug,
                        description: roleDescription,
                        permissions: selectedPermissions,
                        priority,
                    });
                    setOrganizationRoles(prev => sortByPriority([...prev, created]));
                }
            } else {
                if (editingRoleId) {
                    const updated = await projectAPI.updateRoleTemplate(orgId, editingRoleId, {
                        name: roleName,
                        description: roleDescription,
                        permissions: selectedPermissions,
                        priority,
                    });
                    setProjectRoles(prev => prev.map(role => role.id === updated.id ? updated : role));
                } else {
                    const created = await projectAPI.createRoleTemplate(orgId, {
                        name: roleName,
                        description: roleDescription,
                        permissions: selectedPermissions,
                        priority,
                    });
                    setProjectRoles(prev => sortByPriority([...prev, created]));
                }
            }
            closeRoleModal();
        } catch (err) {
            alert(roleScope === 'organization' ? 'Failed to save organization role' : 'Failed to save project role');
        } finally {
            setLoading(false);
        }
    };

    const deleteOrganizationRole = async (roleId: string) => {
        if (!window.confirm('Delete this organization role?')) return;

        try {
            await roleAPI.delete(orgId, roleId);
            setOrganizationRoles(prev => prev.filter(role => role.id !== roleId));
        } catch (err) {
            alert('Failed to delete role. It may have active assignments.');
        }
    };

    const deleteProjectRole = async (role: ProjectRoleTemplate) => {
        if (!window.confirm(`Delete ${role.name}? This will fail if it still has assignments.`)) return;

        try {
            await projectAPI.deleteRoleTemplate(orgId, role.id);
            setProjectRoles(prev => prev.filter(item => item.id !== role.id));
        } catch (err) {
            alert('Failed to delete project role. It may have active assignments.');
        }
    };

    const roleSectionTitle = roleScope === 'organization' ? 'Organization Role' : 'Project Role';

    return (
        <div className="space-y-10">
            <div>
                <h2 className="text-3xl font-bold mb-2">Roles</h2>
                <p className="text-[hsl(var(--text-secondary))]">Manage both organization-wide roles and the project role templates used in project workspaces.</p>
            </div>

            <section className="space-y-6">
                <div className="flex justify-between items-end">
                    <div>
                        <h3 className="text-2xl font-semibold">Organization Roles</h3>
                        <p className="text-[hsl(var(--text-secondary))]">Permissions that apply across the organization.</p>
                    </div>
                    {isAdmin && (
                        <button
                            onClick={() => openCreateModal('organization')}
                            className="flex items-center space-x-2 bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary-hover))] text-white font-semibold px-6 py-3 rounded-md shadow-lg shadow-black/10 transition-all"
                        >
                            <Plus className="w-5 h-5" />
                            <span>Create Org Role</span>
                        </button>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {organizationRoles.map(role => (
                        <div key={role.id} className="bg-[hsl(var(--surface))] border border-[hsl(var(--border))] rounded-md p-6 hover:border-[hsl(var(--border-hover))] transition-all shadow-sm">
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center space-x-3">
                                    <div className={`p-3 rounded-md ${role.is_system ? 'bg-[hsl(var(--primary))]/10' : 'bg-[hsl(var(--accent-1))]/10'}`}>
                                        {role.is_system ? (
                                            <Lock className="w-6 h-6 text-[hsl(var(--primary))]" />
                                        ) : (
                                            <Shield className="w-6 h-6 text-[hsl(var(--accent-1))]" />
                                        )}
                                    </div>
                                    <div>
                                        <h4 className="text-lg font-bold">{role.name}</h4>
                                        {role.is_system && (
                                            <span className="text-xs text-[hsl(var(--text-tertiary))]">System Role</span>
                                        )}
                                    </div>
                                </div>
                                {isAdmin && (
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => openEditOrganizationRole(role)}
                                            className="p-2 hover:bg-[hsl(var(--surface-elevated))] rounded-md transition-all"
                                            title="Edit role"
                                        >
                                            <Pencil className="w-4 h-4 text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--text-primary))]" />
                                        </button>
                                        {!role.is_system && (
                                            <button
                                                onClick={() => deleteOrganizationRole(role.id)}
                                                className="p-2 hover:bg-[hsl(var(--error))]/10 rounded-md transition-all"
                                                title="Delete role"
                                            >
                                                <Trash2 className="w-4 h-4 text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--error))]" />
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                            <p className="text-sm text-[hsl(var(--text-secondary))] mb-4">{role.description || 'No description'}</p>
                            <div className="space-y-2">
                                <div className="text-xs font-semibold text-[hsl(var(--text-tertiary))] uppercase tracking-wider">
                                    Permissions ({role.permissions.length})
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {role.permissions.slice(0, 5).map(permission => (
                                        <span key={permission} className="text-xs px-2 py-1 bg-[hsl(var(--surface-elevated))] border border-[hsl(var(--border))] rounded-lg text-[hsl(var(--text-secondary))]">
                                            {labelForPermission(permission)}
                                        </span>
                                    ))}
                                    {role.permissions.length > 5 && (
                                        <span className="text-xs px-2 py-1 text-[hsl(var(--text-tertiary))]">
                                            +{role.permissions.length - 5} more
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="mt-4 pt-4 border-t border-[hsl(var(--border))] flex justify-between items-center">
                                <span className="text-xs text-[hsl(var(--text-tertiary))]">Priority: {role.priority}</span>
                                <span className="text-xs font-mono text-[hsl(var(--text-tertiary))]">{role.slug}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            <section className="space-y-6">
                <div className="flex justify-between items-end">
                    <div>
                        <h3 className="text-2xl font-semibold">Project Roles</h3>
                        <p className="text-[hsl(var(--text-secondary))]">Reusable role templates assigned inside project workspaces.</p>
                    </div>
                    {isAdmin && (
                        <button
                            onClick={() => openCreateModal('project')}
                            className="flex items-center space-x-2 bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary-hover))] text-white font-semibold px-6 py-3 rounded-md shadow-lg shadow-black/10 transition-all"
                        >
                            <Plus className="w-5 h-5" />
                            <span>Create Project Role</span>
                        </button>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {projectRoles.map(role => (
                        <div key={role.id} className="bg-[hsl(var(--surface))] border border-[hsl(var(--border))] rounded-md p-6 hover:border-[hsl(var(--border-hover))] transition-all shadow-sm">
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center space-x-3">
                                    <div className={`p-3 rounded-md ${role.is_system ? 'bg-[hsl(var(--primary))]/10' : 'bg-[hsl(var(--accent-1))]/10'}`}>
                                        {role.is_system ? (
                                            <Lock className="w-6 h-6 text-[hsl(var(--primary))]" />
                                        ) : (
                                            <Users className="w-6 h-6 text-[hsl(var(--accent-1))]" />
                                        )}
                                    </div>
                                    <div>
                                        <h4 className="text-lg font-bold">{role.name}</h4>
                                        <span className="text-xs text-[hsl(var(--text-tertiary))]">
                                            {role.is_system ? 'System Template' : 'Project Template'}
                                        </span>
                                    </div>
                                </div>
                                {isAdmin && (
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => openEditProjectRole(role)}
                                            className="p-2 hover:bg-[hsl(var(--surface-elevated))] rounded-md transition-all"
                                            title="Edit project role"
                                        >
                                            <Pencil className="w-4 h-4 text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--text-primary))]" />
                                        </button>
                                        {!role.is_system && (
                                            <button
                                                onClick={() => deleteProjectRole(role)}
                                                disabled={(role.assignment_count || 0) > 0}
                                                className="p-2 hover:bg-[hsl(var(--error))]/10 rounded-md transition-all disabled:opacity-40"
                                                title="Delete project role"
                                            >
                                                <Trash2 className="w-4 h-4 text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--error))]" />
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                            <p className="text-sm text-[hsl(var(--text-secondary))] mb-4">{role.description || 'No description'}</p>
                            <div className="space-y-2">
                                <div className="text-xs font-semibold text-[hsl(var(--text-tertiary))] uppercase tracking-wider">
                                    Permissions ({role.permissions.length})
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {role.permissions.slice(0, 5).map(permission => (
                                        <span key={permission} className="text-xs px-2 py-1 bg-[hsl(var(--surface-elevated))] border border-[hsl(var(--border))] rounded-lg text-[hsl(var(--text-secondary))]">
                                            {labelForPermission(permission)}
                                        </span>
                                    ))}
                                    {role.permissions.length > 5 && (
                                        <span className="text-xs px-2 py-1 text-[hsl(var(--text-tertiary))]">
                                            +{role.permissions.length - 5} more
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="mt-4 pt-4 border-t border-[hsl(var(--border))] flex justify-between items-center">
                                <span className="text-xs text-[hsl(var(--text-tertiary))]">Priority: {role.priority}</span>
                                <span className="text-xs font-mono text-[hsl(var(--text-tertiary))]">{role.slug}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {showRoleModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-[hsl(var(--surface))] border border-[hsl(var(--border))] rounded-[32px] p-8 w-full max-w-2xl shadow-2xl my-8">
                        <h2 className="text-2xl font-bold mb-2">
                            {editingRoleId ? `Edit ${roleSectionTitle}` : `Create ${roleSectionTitle}`}
                        </h2>
                        <p className="text-sm text-[hsl(var(--text-secondary))] mb-6">
                            {roleScope === 'organization'
                                ? 'Use organization roles for platform-wide permissions and governance.'
                                : 'Use project roles for access templates assigned inside project workspaces.'}
                        </p>
                        <form onSubmit={saveRole} className="space-y-6">
                            <div className={`grid gap-4 ${roleScope === 'organization' ? 'grid-cols-2' : 'grid-cols-1 md:grid-cols-2'}`}>
                                <div>
                                    <label className="label">Role Name</label>
                                    <input
                                        value={roleName}
                                        onChange={(event) => handleNameChange(event.target.value)}
                                        className="input"
                                        placeholder={roleScope === 'organization' ? 'e.g. Data Analyst' : 'e.g. Regional Coordinator'}
                                        autoFocus
                                        required
                                    />
                                </div>
                                {roleScope === 'organization' ? (
                                    <div>
                                        <label className="label">Slug (URL-friendly)</label>
                                        <input
                                            value={roleSlug}
                                            onChange={(event) => setRoleSlug(event.target.value)}
                                            className="input font-mono text-sm"
                                            placeholder="e.g. data-analyst"
                                            required
                                            disabled={!!editingRoleId}
                                        />
                                        {editingRoleId && (
                                            <p className="mt-2 text-xs text-[hsl(var(--text-tertiary))]">
                                                Slug stays fixed after creation so assignments remain stable.
                                            </p>
                                        )}
                                    </div>
                                ) : (
                                    <div>
                                        <label className="label">Priority</label>
                                        <input
                                            type="number"
                                            value={priority}
                                            onChange={(event) => setPriority(parseInt(event.target.value || '50', 10))}
                                            className="input"
                                            min="1"
                                            max="99"
                                            required
                                        />
                                    </div>
                                )}
                            </div>

                            {roleScope === 'organization' && (
                                <div>
                                    <label className="label">Priority (higher = more permissions)</label>
                                    <input
                                        type="number"
                                        value={priority}
                                        onChange={(event) => setPriority(parseInt(event.target.value || '50', 10))}
                                        className="input"
                                        min="1"
                                        max="99"
                                        required
                                    />
                                </div>
                            )}

                            <div>
                                <label className="label">Description</label>
                                <textarea
                                    value={roleDescription}
                                    onChange={(event) => setRoleDescription(event.target.value)}
                                    className="input min-h-[80px]"
                                    placeholder="What can people with this role do?"
                                />
                            </div>

                            <div>
                                <label className="label mb-3">Permissions</label>
                                <div className="max-h-[340px] overflow-y-auto p-4 bg-[hsl(var(--surface-elevated))] rounded-md border border-[hsl(var(--border))] space-y-5">
                                    {Object.entries(permissionsByCategory).map(([category, permissions]) => (
                                        <div key={category}>
                                            <div className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-[hsl(var(--text-tertiary))]">
                                                {category}
                                            </div>
                                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                                {permissions.map(permission => (
                                                    <label key={permission.key} className="flex items-start space-x-3 p-3 hover:bg-[hsl(var(--surface))] rounded-md cursor-pointer transition-all">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedPermissions.includes(permission.key)}
                                                            onChange={() => togglePermission(permission.key)}
                                                            className="mt-0.5 w-4 h-4 rounded border-[hsl(var(--border))] text-[hsl(var(--primary))] focus:ring-2 focus:ring-[hsl(var(--primary))]"
                                                        />
                                                        <div>
                                                            <div className="text-sm font-medium">{permission.label}</div>
                                                            <div className="text-xs text-[hsl(var(--text-tertiary))] mt-1">{permission.description}</div>
                                                        </div>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="flex space-x-3 pt-4">
                                <button
                                    type="button"
                                    onClick={closeRoleModal}
                                    className="flex-1 px-6 py-3 rounded-md border border-[hsl(var(--border))] text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--surface-elevated))] transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading || selectedPermissions.length === 0 || !roleName.trim() || (roleScope === 'organization' && !editingRoleId && !roleSlug.trim())}
                                    className="flex-1 bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary-hover))] text-white font-bold py-3 rounded-md shadow-lg shadow-black/10 transition-all disabled:opacity-50"
                                >
                                    {loading ? (editingRoleId ? 'Saving...' : 'Creating...') : (editingRoleId ? 'Save Role' : 'Create Role')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RolesManagement;
