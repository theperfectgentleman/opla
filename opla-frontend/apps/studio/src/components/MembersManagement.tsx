import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Copy, ExternalLink, UserPlus, Users, X } from 'lucide-react';

import { orgAPI, roleAPI } from '../lib/api';
import { buildMobileInvitationAcceptLink, buildStudioInvitationAcceptLink } from '../lib/invitationLinks';

type MemberType = 'internal' | 'contractor';
type GlobalRole = 'admin' | 'member';
type InvitationStatus = 'pending' | 'accepted';
type InvitationDeliveryMode = 'email' | 'short_link' | 'generated_link' | 'pin_code';
type InvitationApprovalMode = 'auto' | 'review';
type InvitationLifecycleStatus = 'pending' | 'approved' | 'accepted' | 'revoked' | 'declined';

interface OrgRole {
    id: string;
    name: string;
    slug: string;
    priority: number;
    is_system: boolean;
}

interface RoleAssignmentView {
    accessor_id: string;
    accessor_type: 'user' | 'team';
    accessor_name?: string | null;
    role: OrgRole;
}

interface OrgMember {
    id: string;
    user_id: string;
    global_role: GlobalRole;
    member_type: MemberType;
    invitation_status: InvitationStatus;
    joined_at: string;
    user: {
        phone?: string;
        email?: string;
        full_name?: string;
    };
    effective_role?: OrgRole | null;
    role_assignments: RoleAssignmentView[];
}

interface Invitation {
    id: string;
    org_id: string;
    team_id?: string | null;
    invitation_type: 'organization' | 'team';
    member_type: MemberType;
    delivery_mode: InvitationDeliveryMode;
    approval_mode: InvitationApprovalMode;
    status: InvitationLifecycleStatus;
    invited_email?: string | null;
    token?: string | null;
    pin_code?: string | null;
    created_by: string;
    claimed_by?: string | null;
    approved_by?: string | null;
    accepted_by?: string | null;
    claimed_at?: string | null;
    approved_at?: string | null;
    accepted_at?: string | null;
    expires_at?: string | null;
    revoked_at?: string | null;
    created_at: string;
    updated_at: string;
}

interface MembersManagementProps {
    orgId: string;
    isAdmin: boolean;
}

const invitationTone: Record<InvitationLifecycleStatus, string> = {
    pending: 'bg-amber-500/10 text-amber-300 border border-amber-500/20',
    approved: 'bg-sky-500/10 text-sky-300 border border-sky-500/20',
    accepted: 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20',
    revoked: 'bg-rose-500/10 text-rose-300 border border-rose-500/20',
    declined: 'bg-slate-500/10 text-slate-300 border border-slate-500/20',
};

const memberTypeTone: Record<MemberType, string> = {
    internal: 'bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] border border-[hsl(var(--primary))]/20',
    contractor: 'bg-amber-500/10 text-amber-300 border border-amber-500/20',
};

const globalRoleTone: Record<GlobalRole, string> = {
    admin: 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20',
    member: 'bg-slate-500/10 text-slate-300 border border-slate-500/20',
};

const MembersManagement: React.FC<MembersManagementProps> = ({ orgId, isAdmin }) => {
    const [members, setMembers] = useState<OrgMember[]>([]);
    const [roles, setRoles] = useState<OrgRole[]>([]);
    const [invitations, setInvitations] = useState<Invitation[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteDeliveryMode, setInviteDeliveryMode] = useState<'email' | 'short_link'>('email');
    const [loading, setLoading] = useState(false);
    const [savingInvite, setSavingInvite] = useState(false);
    const [actingInvitationId, setActingInvitationId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [createdInvitation, setCreatedInvitation] = useState<Invitation | null>(null);

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            setError(null);
            try {
                const [membersData, rolesData, invitationsData] = await Promise.all([
                    orgAPI.getMembers(orgId),
                    roleAPI.list(orgId),
                    orgAPI.listInvitations(orgId),
                ]);
                setMembers(membersData);
                setRoles(rolesData);
                setInvitations(invitationsData.filter((invitation: Invitation) => invitation.invitation_type === 'organization'));
            } catch (err: any) {
                setError(err?.response?.data?.detail || err?.message || 'Failed to load members');
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [orgId]);

    const normalizedSearch = searchTerm.trim().toLowerCase();

    const filteredMembers = useMemo(() => {
        return members.filter(member => {
            if (!normalizedSearch) return true;
            const phone = (member.user?.phone || '').toLowerCase();
            const email = (member.user?.email || '').toLowerCase();
            const fullName = (member.user?.full_name || '').toLowerCase();
            return phone.includes(normalizedSearch) || email.includes(normalizedSearch) || fullName.includes(normalizedSearch);
        });
    }, [members, normalizedSearch]);

    const activeInvitations = useMemo(() => (
        invitations.filter(invitation => invitation.status !== 'accepted' && invitation.status !== 'revoked')
    ), [invitations]);

    const refreshMembersData = async () => {
        const [membersData, invitationsData] = await Promise.all([
            orgAPI.getMembers(orgId),
            orgAPI.listInvitations(orgId),
        ]);
        setMembers(membersData);
        setInvitations(invitationsData.filter((invitation: Invitation) => invitation.invitation_type === 'organization'));
    };

    const handleAssignRole = async (userId: string, roleId: string) => {
        if (!isAdmin || !roleId) return;
        try {
            await roleAPI.assign(orgId, {
                role_id: roleId,
                accessor_id: userId,
                accessor_type: 'user',
            });
            await refreshMembersData();
        } catch (err: any) {
            setError(err?.response?.data?.detail || err?.message || 'Failed to assign role');
        }
    };

    const handleRemoveAssignment = async (userId: string) => {
        if (!isAdmin) return;
        try {
            await roleAPI.removeAssignment(orgId, 'user', userId);
            await refreshMembersData();
        } catch (err: any) {
            setError(err?.response?.data?.detail || err?.message || 'Failed to remove role assignment');
        }
    };

    const handleCreateInternalInvitation = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!isAdmin) return;
        if (inviteDeliveryMode === 'email' && !inviteEmail.trim()) return;

        try {
            setSavingInvite(true);
            setError(null);
            const invitation = await orgAPI.createInternalInvitation(orgId, {
                invited_email: inviteDeliveryMode === 'email' ? inviteEmail.trim() : undefined,
                delivery_mode: inviteDeliveryMode,
            });
            setCreatedInvitation(invitation);
            setInviteEmail('');
            setInviteDeliveryMode('email');
            await refreshMembersData();
        } catch (err: any) {
            setError(err?.response?.data?.detail || err?.message || 'Failed to create internal invitation');
        } finally {
            setSavingInvite(false);
        }
    };

    const closeInviteModal = () => {
        setShowInviteModal(false);
        setCreatedInvitation(null);
        setInviteEmail('');
        setInviteDeliveryMode('email');
    };

    const handleRevokeInvitation = async (invitationId: string) => {
        try {
            setActingInvitationId(invitationId);
            setError(null);
            await orgAPI.revokeInvitation(orgId, invitationId);
            await refreshMembersData();
        } catch (err: any) {
            setError(err?.response?.data?.detail || err?.message || 'Failed to revoke invitation');
        } finally {
            setActingInvitationId(null);
        }
    };

    const handleApproveInvitation = async (invitationId: string) => {
        try {
            setActingInvitationId(invitationId);
            setError(null);
            await orgAPI.approveInvitation(orgId, invitationId);
            await refreshMembersData();
        } catch (err: any) {
            setError(err?.response?.data?.detail || err?.message || 'Failed to approve invitation');
        } finally {
            setActingInvitationId(null);
        }
    };

    const handleCopyValue = async (value: string | null | undefined) => {
        if (!value) return;
        try {
            await navigator.clipboard.writeText(value);
        } catch (err) {
            setError('Clipboard copy failed');
        }
    };

    const handleOpenLink = (value: string) => {
        window.open(value, '_blank', 'noopener,noreferrer');
    };

    return (
        <div className="space-y-8">
            <div className="flex items-end justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold mb-2">Members</h2>
                    <p className="text-[hsl(var(--text-secondary))]">Manage internal staff, organization roles, and internal invitations.</p>
                </div>
                {isAdmin ? (
                    <button
                        onClick={() => setShowInviteModal(true)}
                        className="inline-flex items-center gap-2 rounded-2xl bg-[hsl(var(--primary))] px-6 py-3 font-semibold text-white shadow-lg shadow-black/10 transition-all hover:bg-[hsl(var(--primary-hover))]"
                    >
                        <UserPlus className="h-5 w-5" />
                        Invite Internal Member
                    </button>
                ) : null}
            </div>

            {error ? (
                <div className="rounded-2xl border border-[hsl(var(--error))]/20 bg-[hsl(var(--error))]/10 px-4 py-3 text-sm text-[hsl(var(--error))]">
                    {error}
                </div>
            ) : null}

            <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="rounded-[28px] border border-[hsl(var(--border))] bg-[hsl(var(--surface))] p-6">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-[hsl(var(--text-tertiary))]">Members</p>
                    <p className="mt-2 text-3xl font-semibold">{members.length}</p>
                    <p className="mt-3 text-sm text-[hsl(var(--text-secondary))]">People already inside the organization boundary.</p>
                </div>
                <div className="rounded-[28px] border border-[hsl(var(--border))] bg-[hsl(var(--surface))] p-6">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-[hsl(var(--text-tertiary))]">Contractors</p>
                    <p className="mt-2 text-3xl font-semibold">{members.filter(member => member.member_type === 'contractor').length}</p>
                    <p className="mt-3 text-sm text-[hsl(var(--text-secondary))]">Team-linked external workers already admitted.</p>
                </div>
                <div className="rounded-[28px] border border-[hsl(var(--border))] bg-[hsl(var(--surface))] p-6">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-[hsl(var(--text-tertiary))]">Open Internal Invites</p>
                    <p className="mt-2 text-3xl font-semibold">{activeInvitations.length}</p>
                    <p className="mt-3 text-sm text-[hsl(var(--text-secondary))]">Email or short-link invitations waiting to be accepted or cleared.</p>
                </div>
            </section>

            <section className="rounded-[28px] border border-[hsl(var(--border))] bg-[hsl(var(--surface))] p-8">
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <h3 className="text-2xl font-semibold">Directory</h3>
                        <p className="mt-1 text-sm text-[hsl(var(--text-secondary))]">Current members, member type, and effective organization roles.</p>
                    </div>
                    <div className="relative w-full max-w-sm">
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(event) => setSearchTerm(event.target.value)}
                            placeholder="Search by name, email, or phone"
                            className="w-full rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-3 text-sm"
                        />
                    </div>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-16">
                        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[hsl(var(--primary))] border-t-transparent" />
                    </div>
                ) : filteredMembers.length === 0 ? (
                    <div className="mt-6 rounded-3xl border border-dashed border-[hsl(var(--border))] p-12 text-center text-[hsl(var(--text-tertiary))]">
                        <Users className="mx-auto mb-4 h-12 w-12 opacity-20" />
                        <p>{normalizedSearch ? 'No members match that search.' : 'No members yet.'}</p>
                    </div>
                ) : (
                    <div className="mt-6 overflow-hidden rounded-3xl border border-[hsl(var(--border))]">
                        <table className="w-full">
                            <thead className="bg-[hsl(var(--surface-elevated))] text-left text-xs uppercase tracking-[0.18em] text-[hsl(var(--text-tertiary))]">
                                <tr>
                                    <th className="px-5 py-4">Member</th>
                                    <th className="px-5 py-4">Boundary</th>
                                    <th className="px-5 py-4">Global</th>
                                    <th className="px-5 py-4">Effective Role</th>
                                    {isAdmin ? <th className="px-5 py-4">Assign Role</th> : null}
                                    <th className="px-5 py-4">Joined</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[hsl(var(--border))] bg-[hsl(var(--surface))]">
                                {filteredMembers.map(member => {
                                    const displayName = member.user.full_name || member.user.email || member.user.phone || 'Unnamed member';
                                    const effectiveRole = member.effective_role;
                                    const directUserAssignment = member.role_assignments.find(assignment => assignment.accessor_type === 'user');
                                    return (
                                        <tr key={member.id} className="align-top">
                                            <td className="px-5 py-4">
                                                <div className="flex items-start gap-3">
                                                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[hsl(var(--primary))]/10 text-sm font-semibold text-[hsl(var(--primary))]">
                                                        {(displayName[0] || '?').toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-semibold">{displayName}</p>
                                                        <p className="mt-1 text-xs text-[hsl(var(--text-secondary))]">{member.user.email || 'No email'}</p>
                                                        <p className="mt-1 text-xs text-[hsl(var(--text-tertiary))]">{member.user.phone || 'No phone'}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4">
                                                <span className={`inline-flex rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${memberTypeTone[member.member_type]}`}>
                                                    {member.member_type}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4">
                                                <span className={`inline-flex rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${globalRoleTone[member.global_role]}`}>
                                                    {member.global_role}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4 text-sm text-[hsl(var(--text-secondary))]">
                                                {effectiveRole ? (
                                                    <div>
                                                        <p className="font-medium text-[hsl(var(--text-primary))]">{effectiveRole.name}</p>
                                                        <p className="mt-1 text-xs text-[hsl(var(--text-tertiary))]">{directUserAssignment ? 'Direct assignment' : 'Inherited or unassigned direct role'}</p>
                                                    </div>
                                                ) : (
                                                    <span className="text-[hsl(var(--text-tertiary))]">No role assigned</span>
                                                )}
                                            </td>
                                            {isAdmin ? (
                                                <td className="px-5 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <select
                                                            value={directUserAssignment?.role.id || ''}
                                                            onChange={(event) => {
                                                                const value = event.target.value;
                                                                if (value) {
                                                                    handleAssignRole(member.user_id, value);
                                                                }
                                                            }}
                                                            className="min-w-[180px] rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm"
                                                        >
                                                            <option value="">Select role...</option>
                                                            {roles.map(role => (
                                                                <option key={role.id} value={role.id}>{role.name}</option>
                                                            ))}
                                                        </select>
                                                        {directUserAssignment ? (
                                                            <button
                                                                onClick={() => handleRemoveAssignment(member.user_id)}
                                                                className="rounded-xl border border-[hsl(var(--border))] p-2 text-[hsl(var(--text-tertiary))] hover:bg-[hsl(var(--surface-elevated))] hover:text-[hsl(var(--error))]"
                                                                title="Remove direct role assignment"
                                                            >
                                                                <X className="h-4 w-4" />
                                                            </button>
                                                        ) : null}
                                                    </div>
                                                </td>
                                            ) : null}
                                            <td className="px-5 py-4 text-sm text-[hsl(var(--text-secondary))]">
                                                {new Date(member.joined_at).toLocaleDateString()}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            <section className="rounded-[28px] border border-[hsl(var(--border))] bg-[hsl(var(--surface))] p-8">
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <h3 className="text-2xl font-semibold">Internal Invitations</h3>
                        <p className="mt-1 text-sm text-[hsl(var(--text-secondary))]">Email or short-link invites for internal members. Internal invites auto-approve and expire after 24 hours.</p>
                    </div>
                </div>

                <div className="mt-6 space-y-4">
                    {invitations.length === 0 ? (
                        <div className="rounded-3xl border border-dashed border-[hsl(var(--border))] p-10 text-center text-sm text-[hsl(var(--text-tertiary))]">
                            No internal invitations yet.
                        </div>
                    ) : invitations.map(invitation => (
                        <div key={invitation.id} className="rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-5">
                            <div className="flex flex-wrap items-start justify-between gap-4">
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className={`inline-flex rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${invitationTone[invitation.status]}`}>
                                            {invitation.status}
                                        </span>
                                        <span className="inline-flex rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--surface-elevated))] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[hsl(var(--text-tertiary))]">
                                            {invitation.delivery_mode.replace('_', ' ')}
                                        </span>
                                        <span className="inline-flex rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--surface-elevated))] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[hsl(var(--text-tertiary))]">
                                            {invitation.member_type}
                                        </span>
                                    </div>
                                    <p className="mt-3 text-sm font-semibold text-[hsl(var(--text-primary))]">
                                        {invitation.invited_email || 'Short-link internal invitation'}
                                    </p>
                                    <div className="mt-3 flex flex-wrap gap-4 text-xs text-[hsl(var(--text-tertiary))]">
                                        <span>Created: {new Date(invitation.created_at).toLocaleString()}</span>
                                        <span>Expires: {invitation.expires_at ? new Date(invitation.expires_at).toLocaleString() : 'No expiry'}</span>
                                        <span>Approval: {invitation.approval_mode}</span>
                                    </div>
                                    {invitation.token ? (() => {
                                        const webLink = buildStudioInvitationAcceptLink(invitation.token);
                                        const mobileLink = buildMobileInvitationAcceptLink(invitation.token);
                                        return (
                                        <>
                                            <div className="mt-4 flex items-center gap-2 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] px-3 py-2 text-xs text-[hsl(var(--text-secondary))]">
                                                <span className="font-semibold text-[hsl(var(--text-primary))]">Web link:</span>
                                                <span className="truncate font-mono">{webLink}</span>
                                                <button
                                                    onClick={() => handleCopyValue(webLink)}
                                                    className="ml-auto rounded-lg border border-[hsl(var(--border))] p-1.5 hover:bg-[hsl(var(--surface-elevated))]"
                                                    title="Copy web invite link"
                                                >
                                                    <Copy className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                            <div className="mt-3 flex items-center gap-2 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] px-3 py-2 text-xs text-[hsl(var(--text-secondary))]">
                                                <span className="font-semibold text-[hsl(var(--text-primary))]">Mobile app:</span>
                                                <span className="truncate font-mono">{mobileLink}</span>
                                                <button
                                                    onClick={() => handleCopyValue(mobileLink)}
                                                    className="ml-auto rounded-lg border border-[hsl(var(--border))] p-1.5 hover:bg-[hsl(var(--surface-elevated))]"
                                                    title="Copy mobile invite link"
                                                >
                                                    <Copy className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        </>
                                        );
                                    })() : null}
                                </div>

                                {isAdmin ? (
                                    <div className="flex items-center gap-2">
                                        {invitation.status === 'pending' && invitation.approval_mode === 'review' ? (
                                            <button
                                                onClick={() => handleApproveInvitation(invitation.id)}
                                                disabled={actingInvitationId === invitation.id}
                                                className="rounded-2xl border border-[hsl(var(--border))] px-4 py-2 text-sm font-semibold hover:bg-[hsl(var(--surface-elevated))] disabled:opacity-50"
                                            >
                                                Approve
                                            </button>
                                        ) : null}
                                        {invitation.status !== 'accepted' && invitation.status !== 'revoked' ? (
                                            <button
                                                onClick={() => handleRevokeInvitation(invitation.id)}
                                                disabled={actingInvitationId === invitation.id}
                                                className="rounded-2xl border border-[hsl(var(--border))] px-4 py-2 text-sm font-semibold hover:bg-[hsl(var(--surface-elevated))] disabled:opacity-50"
                                            >
                                                Revoke
                                            </button>
                                        ) : null}
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {showInviteModal ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-lg rounded-[32px] border border-[hsl(var(--border))] bg-[hsl(var(--surface))] p-8 shadow-2xl">
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <h3 className="text-2xl font-bold">Invite Internal Member</h3>
                                <p className="mt-1 text-sm text-[hsl(var(--text-secondary))]">Choose email or short-link delivery. Internal invites auto-approve and expire after 24 hours.</p>
                            </div>
                            <button
                                onClick={closeInviteModal}
                                className="rounded-xl border border-[hsl(var(--border))] p-2 hover:bg-[hsl(var(--surface-elevated))]"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {createdInvitation ? (() => {
                            const webLink = createdInvitation.token ? buildStudioInvitationAcceptLink(createdInvitation.token) : null;
                            const mobileLink = createdInvitation.token ? buildMobileInvitationAcceptLink(createdInvitation.token) : null;
                            return (
                                <div className="mt-6 space-y-5">
                                    <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-5">
                                        <div className="flex items-start gap-3">
                                            <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-300" />
                                            <div>
                                                <p className="font-semibold text-emerald-100">Internal invite created</p>
                                                <p className="mt-1 text-sm text-emerald-50/80">
                                                    {createdInvitation.invited_email
                                                        ? `Ready for ${createdInvitation.invited_email}.`
                                                        : 'Ready to share as a manual invite link.'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {webLink ? (
                                        <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-4 text-sm">
                                            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[hsl(var(--text-tertiary))]">Web invite link</p>
                                            <p className="mt-2 truncate font-mono text-[hsl(var(--text-secondary))]">{webLink}</p>
                                            <div className="mt-4 flex gap-3">
                                                <button
                                                    type="button"
                                                    onClick={() => handleCopyValue(webLink)}
                                                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-[hsl(var(--border))] px-4 py-3 text-sm font-semibold hover:bg-[hsl(var(--surface-elevated))]"
                                                >
                                                    <Copy className="h-4 w-4" />
                                                    Copy Web Link
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleOpenLink(webLink)}
                                                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-[hsl(var(--border))] px-4 py-3 text-sm font-semibold hover:bg-[hsl(var(--surface-elevated))]"
                                                >
                                                    <ExternalLink className="h-4 w-4" />
                                                    Open Web Invite
                                                </button>
                                            </div>
                                        </div>
                                    ) : null}

                                    {mobileLink ? (
                                        <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-4 text-sm">
                                            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[hsl(var(--text-tertiary))]">Mobile app link</p>
                                            <p className="mt-2 truncate font-mono text-[hsl(var(--text-secondary))]">{mobileLink}</p>
                                            <div className="mt-4 flex gap-3">
                                                <button
                                                    type="button"
                                                    onClick={() => handleCopyValue(mobileLink)}
                                                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-[hsl(var(--border))] px-4 py-3 text-sm font-semibold hover:bg-[hsl(var(--surface-elevated))]"
                                                >
                                                    <Copy className="h-4 w-4" />
                                                    Copy App Link
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleOpenLink(mobileLink)}
                                                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-[hsl(var(--border))] px-4 py-3 text-sm font-semibold hover:bg-[hsl(var(--surface-elevated))]"
                                                >
                                                    <ExternalLink className="h-4 w-4" />
                                                    Open In App
                                                </button>
                                            </div>
                                        </div>
                                    ) : null}

                                    <div className="flex gap-3 pt-2">
                                        <button
                                            type="button"
                                            onClick={() => setCreatedInvitation(null)}
                                            className="flex-1 rounded-2xl border border-[hsl(var(--border))] px-4 py-3 text-sm font-semibold hover:bg-[hsl(var(--surface-elevated))]"
                                        >
                                            Create Another Invite
                                        </button>
                                        <button
                                            type="button"
                                            onClick={closeInviteModal}
                                            className="flex-1 rounded-2xl bg-[hsl(var(--primary))] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-black/10"
                                        >
                                            Done
                                        </button>
                                    </div>
                                </div>
                            );
                        })() : (
                        <form onSubmit={handleCreateInternalInvitation} className="mt-6 space-y-5">
                            <div>
                                <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-[hsl(var(--text-tertiary))]">Delivery mode</label>
                                <select
                                    value={inviteDeliveryMode}
                                    onChange={(event) => setInviteDeliveryMode(event.target.value as 'email' | 'short_link')}
                                    className="w-full rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-3 text-sm"
                                >
                                    <option value="email">Email invite</option>
                                    <option value="short_link">24-hour short link</option>
                                </select>
                            </div>

                            <div>
                                <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-[hsl(var(--text-tertiary))]">
                                    Email {inviteDeliveryMode === 'email' ? '*' : '(optional)'}
                                </label>
                                <input
                                    type="email"
                                    value={inviteEmail}
                                    onChange={(event) => setInviteEmail(event.target.value)}
                                    placeholder="person@company.com"
                                    className="w-full rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-3 text-sm"
                                    required={inviteDeliveryMode === 'email'}
                                />
                            </div>

                            <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-4 text-sm text-[hsl(var(--text-secondary))]">
                                <div className="flex items-start gap-3">
                                    <AlertCircle className="mt-0.5 h-4 w-4 text-[hsl(var(--primary))]" />
                                    <div>
                                        <p className="font-medium text-[hsl(var(--text-primary))]">Internal invite behavior</p>
                                        <p className="mt-1">Internal members become organization members when they accept. If you choose a short link, Studio will generate a token you can share manually.</p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={closeInviteModal}
                                    className="flex-1 rounded-2xl border border-[hsl(var(--border))] px-4 py-3 text-sm font-semibold hover:bg-[hsl(var(--surface-elevated))]"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={savingInvite || (inviteDeliveryMode === 'email' && !inviteEmail.trim())}
                                    className="flex-1 rounded-2xl bg-[hsl(var(--primary))] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-black/10 disabled:opacity-50"
                                >
                                    {savingInvite ? 'Creating...' : 'Create Invite'}
                                </button>
                            </div>
                        </form>
                        )}
                    </div>
                </div>
            ) : null}
        </div>
    );
};

export default MembersManagement;
