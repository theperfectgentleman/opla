import React, { useState, useEffect } from 'react';
import { Shield, Plus, Edit2, Trash2, Lock } from 'lucide-react';
import { roleAPI } from '../lib/api';

interface OrgRole {
    id: string;
    name: string;
    slug: string;
    description: string;
    permissions: string[];
    priority: number;
    is_system: boolean;
}

interface RolesManagementProps {
    orgId: string;
    isAdmin: boolean;
}

const RolesManagement: React.FC<RolesManagementProps> = ({ orgId, isAdmin }) => {
    const [roles, setRoles] = useState<OrgRole[]>([]);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [roleName, setRoleName] = useState('');
    const [roleSlug, setRoleSlug] = useState '';
    const [roleDescription, setRoleDescription] = useState('');
    const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
    const [priority, setPriority] = useState(50);
    const [loading, setLoading] = useState(false);

    const availablePermissions = [
        { value: 'form.view', label: 'View Forms' },
        { value: 'form.create', label: 'Create Forms' },
        { value: 'form.edit', label: 'Edit Forms' },
        { value: 'form.delete', label: 'Delete Forms' },
        { value: 'submission.view', label: 'View Submissions' },
        { value: 'submission.view_own', label: 'View Own Submissions' },
        { value: 'submission.create', label: 'Create Submissions' },
        { value: 'submission.edit', label: 'Edit Submissions' },
        { value: 'submission.export', label: 'Export Submissions' },
        { value: 'project.view', label: 'View Projects' },
        { value: 'project.edit', label: 'Edit Projects' },
        { value: 'team.view', label: 'View Teams' },
        { value: 'team.manage', label: 'Manage Teams' }
    ];

    useEffect(() => {
        loadRoles();
    }, [orgId]);

    const loadRoles = async () => {
        try {
            const data = await roleAPI.list(orgId);
            setRoles(data);
        } catch (err) {
            console.error('Failed to load roles:', err);
        }
    };

    const handleCreateRole = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!roleName.trim() || !roleSlug.trim()) return;

        setLoading(true);
        try {
            await roleAPI.create(orgId, {
                name: roleName,
                slug: roleSlug,
                description: roleDescription,
                permissions: selectedPermissions,
                priority
            });
            resetForm();
            setShowCreateModal(false);
            loadRoles();
        } catch (err) {
            alert('Failed to create role');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteRole = async (roleId: string) => {
        if (!confirm('Are you sure you want to delete this role?')) return;

        try {
            await roleAPI.delete(orgId, roleId);
            loadRoles();
        } catch (err) {
            alert('Failed to delete role. It may have active assignments.');
        }
    };

    const resetForm = () => {
        setRoleName('');
        setRoleSlug('');
        setRoleDescription('');
        setSelectedPermissions([]);
        setPriority(50);
    };

    const togglePermission = (permission: string) => {
        setSelectedPermissions(prev =>
            prev.includes(permission)
                ? prev.filter(p => p !== permission)
                : [...prev, permission]
        );
    };

    const generateSlug = (name: string) => {
        return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    };

    const handleNameChange = (name: string) => {
        setRoleName(name);
        if (!roleSlug || roleSlug === generateSlug(roleName)) {
            setRoleSlug(generateSlug(name));
        }
    };

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-3xl font-bold mb-2">Role Templates</h2>
                    <p className="text-[hsl(var(--text-secondary))]">Define custom roles with specific permissions for your organization.</p>
                </div>
                {isAdmin && (
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="flex items-center space-x-2 bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary-hover))] text-white font-semibold px-6 py-3 rounded-2xl shadow-lg shadow-black/10 transition-all"
                    >
                        <Plus className="w-5 h-5" />
                        <span>Create Role</span>
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {roles.map(role => (
                    <div key={role.id} className="bg-[hsl(var(--surface))] border border-[hsl(var(--border))] rounded-3xl p-6 hover:border-[hsl(var(--border-hover))] transition-all shadow-sm">
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center space-x-3">
                                <div className={`p-3 rounded-2xl ${role.is_system ? 'bg-[hsl(var(--primary))]/10' : 'bg-[hsl(var(--accent-1))]/10'}`}>
                                    {role.is_system ? (
                                        <Lock className="w-6 h-6 text-[hsl(var(--primary))]" />
                                    ) : (
                                        <Shield className="w-6 h-6 text-[hsl(var(--accent-1))]" />
                                    )}
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold">{role.name}</h3>
                                    {role.is_system && (
                                        <span className="text-xs text-[hsl(var(--text-tertiary))]">System Role</span>
                                    )}
                                </div>
                            </div>
                            {isAdmin && !role.is_system && (
                                <button
                                    onClick={() => handleDeleteRole(role.id)}
                                    className="p-2 hover:bg-[hsl(var(--error))]/10 rounded-xl transition-all"
                                >
                                    <Trash2 className="w-4 h-4 text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--error))]" />
                                </button>
                            )}
                        </div>
                        <p className="text-sm text-[hsl(var(--text-secondary))] mb-4">
                            {role.description || 'No description'}
                        </p>
                        <div className="space-y-2">
                            <div className="text-xs font-semibold text-[hsl(var(--text-tertiary))] uppercase tracking-wider">
                                Permissions ({role.permissions.length})
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {role.permissions.slice(0, 5).map(perm => (
                                    <span key={perm} className="text-xs px-2 py-1 bg-[hsl(var(--surface-elevated))] border border-[hsl(var(--border))] rounded-lg text-[hsl(var(--text-secondary))]">
                                        {perm}
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
                            <span className="text-xs text-[hsl(var(--text-tertiary))]">
                                Priority: {role.priority}
                            </span>
                            <span className="text-xs font-mono text-[hsl(var(--text-tertiary))]">
                                {role.slug}
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Create Role Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-[hsl(var(--surface))] border border-[hsl(var(--border))] rounded-[32px] p-8 w-full max-w-2xl shadow-2xl my-8">
                        <h2 className="text-2xl font-bold mb-6">Create Custom Role</h2>
                        <form onSubmit={handleCreateRole} className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="label">Role Name</label>
                                    <input
                                        value={roleName}
                                        onChange={(e) => handleNameChange(e.target.value)}
                                        className="input"
                                        placeholder="e.g. Data Analyst"
                                        autoFocus
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="label">Slug (URL-friendly)</label>
                                    <input
                                        value={roleSlug}
                                        onChange={(e) => setRoleSlug(e.target.value)}
                                        className="input font-mono text-sm"
                                        placeholder="e.g. data-analyst"
                                        required
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="label">Description</label>
                                <textarea
                                    value={roleDescription}
                                    onChange={(e) => setRoleDescription(e.target.value)}
                                    className="input min-h-[80px]"
                                    placeholder="What can users with this role do?"
                                />
                            </div>
                            <div>
                                <label className="label">Priority (higher = more permissions)</label>
                                <input
                                    type="number"
                                    value={priority}
                                    onChange={(e) => setPriority(parseInt(e.target.value))}
                                    className="input"
                                    min="1"
                                    max="99"
                                    required
                                />
                            </div>
                            <div>
                                <label className="label mb-3">Permissions</label>
                                <div className="grid grid-cols-2 gap-3 max-h-[300px] overflow-y-auto p-4 bg-[hsl(var(--surface-elevated))] rounded-2xl border border-[hsl(var(--border))]">
                                    {availablePermissions.map(perm => (
                                        <label key={perm.value} className="flex items-center space-x-3 p-3 hover:bg-[hsl(var(--surface))] rounded-xl cursor-pointer transition-all">
                                            <input
                                                type="checkbox"
                                                checked={selectedPermissions.includes(perm.value)}
                                                onChange={() => togglePermission(perm.value)}
                                                className="w-4 h-4 rounded border-[hsl(var(--border))] text-[hsl(var(--primary))] focus:ring-2 focus:ring-[hsl(var(--primary))]"
                                            />
                                            <span className="text-sm">{perm.label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div className="flex space-x-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowCreateModal(false);
                                        resetForm();
                                    }}
                                    className="flex-1 px-6 py-3 rounded-2xl border border-[hsl(var(--border))] text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--surface-elevated))] transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading || selectedPermissions.length === 0}
                                    className="flex-1 bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary-hover))] text-white font-bold py-3 rounded-2xl shadow-lg shadow-black/10 transition-all disabled:opacity-50"
                                >
                                    {loading ? 'Creating...' : 'Create Role'}
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
