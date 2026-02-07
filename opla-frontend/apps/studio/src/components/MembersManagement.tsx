import React, { useState, useEffect } from 'react';
import { Users, UserPlus, Mail, Shield, X, Search } from 'lucide-react';
import { orgAPI, roleAPI } from '../lib/api';

interface OrgMember {
    id: string;
    user_id: string;
    role: string;
    user: {
        phone: string;
        email?: string;
        full_name?: string;
    };
    joined_at: string;
}

interface OrgRole {
    id: string;
    name: string;
    slug: string;
    priority: number;
    is_system: boolean;
}

interface RoleAssignment {
    id: string;
    role_id: string;
    accessor_id: string;
    accessor_type: 'user' | 'team';
}

interface MembersManagementProps {
    orgId: string;
    isAdmin: boolean;
}

const MembersManagement: React.FC<MembersManagementProps> = ({ orgId, isAdmin }) => {
    const [members, setMembers] = useState<OrgMember[]>([]);
    const [roles, setRoles] = useState<OrgRole[]>([]);
    const [assignments, setAssignments] = useState<RoleAssignment[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(false);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [invitePhone, setInvitePhone] = useState('');
    const [inviteEmail, setInviteEmail] = useState('');

    useEffect(() => {
        loadData();
    }, [orgId]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [membersData, rolesData, assignmentsData] = await Promise.all([
                orgAPI.getMembers(orgId),
                roleAPI.list(orgId),
                roleAPI.getAssignments(orgId)
            ]);
            setMembers(membersData);
            setRoles(rolesData);
            setAssignments(assignmentsData);
        } catch (err) {
            console.error('Failed to load members data:', err);
        } finally {
            setLoading(false);
        }
    };

    const getMemberRole = (userId: string): OrgRole | null => {
        // Find direct user assignment
        const userAssignment = assignments.find(
            a => a.accessor_type === 'user' && a.accessor_id === userId
        );
        
        if (userAssignment) {
            return roles.find(r => r.id === userAssignment.role_id) || null;
        }

        // TODO: Check team-based roles (requires additional API endpoint)
        return null;
    };

    const handleAssignRole = async (userId: string, roleId: string) => {
        if (!isAdmin) return;

        try {
            await roleAPI.assign(orgId, {
                role_id: roleId,
                accessor_id: userId,
                accessor_type: 'user'
            });
            await loadData();
        } catch (err) {
            console.error('Failed to assign role:', err);
        }
    };

    const handleRemoveAssignment = async (userId: string) => {
        if (!isAdmin) return;

        const assignment = assignments.find(
            a => a.accessor_type === 'user' && a.accessor_id === userId
        );
        
        if (!assignment) return;

        try {
            await roleAPI.removeAssignment(orgId, assignment.id);
            await loadData();
        } catch (err) {
            console.error('Failed to remove assignment:', err);
        }
    };

    const filteredMembers = members.filter(member =>
        member.user.phone.toLowerCase().includes(searchTerm.toLowerCase()) ||
        member.user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        member.user.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
                        Organization Members
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        Manage member access and role assignments
                    </p>
                </div>
                {isAdmin && (
                    <button
                        onClick={() => setShowInviteModal(true)}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg shadow-blue-500/30"
                    >
                        <UserPlus className="w-4 h-4" />
                        Invite Member
                    </button>
                )}
            </div>

            {/* Search Bar */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                    type="text"
                    placeholder="Search members by phone, email, or name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white"
                />
            </div>

            {/* Members List */}
            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
            ) : filteredMembers.length === 0 ? (
                <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                    <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 dark:text-gray-400">
                        {searchTerm ? 'No members found matching your search' : 'No members yet'}
                    </p>
                </div>
            ) : (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-gray-50 dark:bg-gray-900/50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    Member
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    Contact
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    Current Role
                                </th>
                                {isAdmin && (
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Assign Role
                                    </th>
                                )}
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    Joined
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {filteredMembers.map((member) => {
                                const memberRole = getMemberRole(member.user_id);
                                return (
                                    <tr key={member.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/30">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold">
                                                    {member.user.full_name?.[0]?.toUpperCase() || member.user.phone[0]}
                                                </div>
                                                <div>
                                                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                                                        {member.user.full_name || 'Unnamed User'}
                                                    </div>
                                                    <div className="text-xs text-gray-500 dark:text-gray-400">
                                                        {member.user.phone}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                                                {member.user.email ? (
                                                    <>
                                                        <Mail className="w-4 h-4" />
                                                        {member.user.email}
                                                    </>
                                                ) : (
                                                    <span className="text-gray-400">No email</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {memberRole ? (
                                                <span className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full text-xs font-medium">
                                                    <Shield className="w-3 h-3" />
                                                    {memberRole.name}
                                                    {memberRole.is_system && <span className="text-[10px]">(System)</span>}
                                                </span>
                                            ) : (
                                                <span className="text-sm text-gray-400">No role assigned</span>
                                            )}
                                        </td>
                                        {isAdmin && (
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-2">
                                                    <select
                                                        value={memberRole?.id || ''}
                                                        onChange={(e) => handleAssignRole(member.user_id, e.target.value)}
                                                        className="text-sm px-3 py-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                                                    >
                                                        <option value="">Select role...</option>
                                                        {roles.map(role => (
                                                            <option key={role.id} value={role.id}>
                                                                {role.name} {role.is_system ? '(System)' : ''}
                                                            </option>
                                                        ))}
                                                    </select>
                                                    {memberRole && (
                                                        <button
                                                            onClick={() => handleRemoveAssignment(member.user_id)}
                                                            className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                                            title="Remove role"
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        )}
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                                            {new Date(member.joined_at).toLocaleDateString()}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Invite Member Modal */}
            {showInviteModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                                Invite Member
                            </h3>
                            <button
                                onClick={() => setShowInviteModal(false)}
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); }}>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Phone Number *
                                </label>
                                <input
                                    type="tel"
                                    value={invitePhone}
                                    onChange={(e) => setInvitePhone(e.target.value)}
                                    placeholder="+1234567890"
                                    required
                                    className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Email (Optional)
                                </label>
                                <input
                                    type="email"
                                    value={inviteEmail}
                                    onChange={(e) => setInviteEmail(e.target.value)}
                                    placeholder="user@example.com"
                                    className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white"
                                />
                            </div>

                            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                                <p className="text-sm text-blue-800 dark:text-blue-300">
                                    👋 An invitation will be sent via SMS to the provided phone number.
                                </p>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowInviteModal(false)}
                                    className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={!invitePhone.trim()}
                                    className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Send Invite
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MembersManagement;
