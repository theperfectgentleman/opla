import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Copy, Edit2, ExternalLink, Plus, Trash2, UserPlus, Users, X } from 'lucide-react';

import { orgAPI, teamAPI } from '../lib/api';
import { buildMobileInvitationAcceptLink, buildMobileJoinTeamLink, buildStudioInvitationAcceptLink } from '../lib/invitationLinks';

type InvitationDeliveryMode = 'email' | 'short_link' | 'generated_link' | 'pin_code';
type InvitationApprovalMode = 'auto' | 'review';
type InvitationLifecycleStatus = 'pending' | 'approved' | 'accepted' | 'revoked' | 'declined';

interface Team {
    id: string;
    name: string;
    description?: string;
    member_count: number;
    created_at: string;
}

interface Invitation {
    id: string;
    org_id: string;
    team_id?: string | null;
    invitation_type: 'organization' | 'team';
    member_type: 'internal' | 'contractor';
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

interface TeamsManagementProps {
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

const TeamsManagement: React.FC<TeamsManagementProps> = ({ orgId, isAdmin }) => {
    const [teams, setTeams] = useState<Team[]>([]);
    const [invitations, setInvitations] = useState<Invitation[]>([]);
    const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [teamName, setTeamName] = useState('');
    const [teamDescription, setTeamDescription] = useState('');
    const [inviteTeamId, setInviteTeamId] = useState('');
    const [inviteDeliveryMode, setInviteDeliveryMode] = useState<'generated_link' | 'pin_code'>('generated_link');
    const [inviteApprovalMode, setInviteApprovalMode] = useState<'auto' | 'review'>('auto');
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
                const [teamsData, invitationsData] = await Promise.all([
                    teamAPI.list(orgId),
                    orgAPI.listInvitations(orgId),
                ]);
                setTeams(teamsData);
                setInvitations(invitationsData.filter((invitation: Invitation) => invitation.invitation_type === 'team'));
            } catch (err: any) {
                setError(err?.response?.data?.detail || err?.message || 'Failed to load teams');
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [orgId]);

    useEffect(() => {
        if (!inviteTeamId && teams.length > 0) {
            setInviteTeamId(teams[0].id);
        }
    }, [inviteTeamId, teams]);

    const refreshData = async () => {
        const [teamsData, invitationsData] = await Promise.all([
            teamAPI.list(orgId),
            orgAPI.listInvitations(orgId),
        ]);
        setTeams(teamsData);
        setInvitations(invitationsData.filter((invitation: Invitation) => invitation.invitation_type === 'team'));
    };

    const invitationsByTeam = useMemo(() => {
        return invitations.reduce<Record<string, Invitation[]>>((accumulator, invitation) => {
            if (!invitation.team_id) {
                return accumulator;
            }
            accumulator[invitation.team_id] = accumulator[invitation.team_id] || [];
            accumulator[invitation.team_id].push(invitation);
            return accumulator;
        }, {});
    }, [invitations]);

    const handleCreateTeam = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!teamName.trim()) return;

        try {
            setLoading(true);
            setError(null);
            await teamAPI.create(orgId, {
                name: teamName.trim(),
                description: teamDescription.trim() || undefined,
            });
            setTeamName('');
            setTeamDescription('');
            setShowCreateModal(false);
            await refreshData();
        } catch (err: any) {
            setError(err?.response?.data?.detail || err?.message || 'Failed to create team');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateTeam = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!selectedTeam || !teamName.trim()) return;

        try {
            setLoading(true);
            setError(null);
            await teamAPI.update(orgId, selectedTeam.id, {
                name: teamName.trim(),
                description: teamDescription.trim() || undefined,
            });
            setShowEditModal(false);
            setSelectedTeam(null);
            setTeamName('');
            setTeamDescription('');
            await refreshData();
        } catch (err: any) {
            setError(err?.response?.data?.detail || err?.message || 'Failed to update team');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteTeam = async (teamId: string) => {
        if (!window.confirm('Delete this team?')) return;
        try {
            setError(null);
            await teamAPI.delete(orgId, teamId);
            await refreshData();
        } catch (err: any) {
            setError(err?.response?.data?.detail || err?.message || 'Failed to delete team');
        }
    };

    const openEditModal = (team: Team) => {
        setSelectedTeam(team);
        setTeamName(team.name);
        setTeamDescription(team.description || '');
        setShowEditModal(true);
    };

    const openInviteModal = (teamId?: string) => {
        setInviteTeamId(teamId || teams[0]?.id || '');
        setInviteDeliveryMode('generated_link');
        setInviteApprovalMode('auto');
        setCreatedInvitation(null);
        setShowInviteModal(true);
    };

    const handleCreateContractorInvitation = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!inviteTeamId) return;

        try {
            setSavingInvite(true);
            setError(null);
            const invitation = await teamAPI.createContractorInvitation(orgId, inviteTeamId, {
                delivery_mode: inviteDeliveryMode,
                approval_mode: inviteApprovalMode,
            });
            setCreatedInvitation(invitation);
            await refreshData();
        } catch (err: any) {
            setError(err?.response?.data?.detail || err?.message || 'Failed to create contractor invitation');
        } finally {
            setSavingInvite(false);
        }
    };

    const closeInviteModal = () => {
        setShowInviteModal(false);
        setCreatedInvitation(null);
        setInviteDeliveryMode('generated_link');
        setInviteApprovalMode('auto');
        setInviteTeamId(teams[0]?.id || '');
    };

    const handleApproveInvitation = async (invitationId: string) => {
        try {
            setActingInvitationId(invitationId);
            setError(null);
            await orgAPI.approveInvitation(orgId, invitationId);
            await refreshData();
        } catch (err: any) {
            setError(err?.response?.data?.detail || err?.message || 'Failed to approve invitation');
        } finally {
            setActingInvitationId(null);
        }
    };

    const handleRevokeInvitation = async (invitationId: string) => {
        try {
            setActingInvitationId(invitationId);
            setError(null);
            await orgAPI.revokeInvitation(orgId, invitationId);
            await refreshData();
        } catch (err: any) {
            setError(err?.response?.data?.detail || err?.message || 'Failed to revoke invitation');
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
            <div className="flex justify-between items-end gap-4">
                <div>
                    <h2 className="text-3xl font-bold mb-2">Teams</h2>
                    <p className="text-[hsl(var(--text-secondary))]">Operational teams, inherited project access, and contractor onboarding live here.</p>
                </div>
                {isAdmin ? (
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => openInviteModal()}
                            className="flex items-center gap-2 rounded-md border border-[hsl(var(--border))] px-5 py-3 font-semibold hover:bg-[hsl(var(--surface-elevated))]"
                        >
                            <UserPlus className="h-4 w-4" />
                            Invite Contractor
                        </button>
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="flex items-center gap-2 rounded-md bg-[hsl(var(--primary))] px-6 py-3 font-semibold text-white shadow-lg shadow-black/10 transition-all hover:bg-[hsl(var(--primary-hover))]"
                        >
                            <Plus className="h-5 w-5" />
                            Create Team
                        </button>
                    </div>
                ) : null}
            </div>

            {error ? (
                <div className="rounded-md border border-[hsl(var(--error))]/20 bg-[hsl(var(--error))]/10 px-4 py-3 text-sm text-[hsl(var(--error))]">
                    {error}
                </div>
            ) : null}

            {loading ? (
                <div className="flex items-center justify-center py-16">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-[hsl(var(--primary))] border-t-transparent" />
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    {teams.length === 0 ? (
                        <div className="col-span-full rounded-md border-2 border-dashed border-[hsl(var(--border))] p-12 text-center text-[hsl(var(--text-tertiary))]">
                            <Users className="mx-auto mb-4 h-12 w-12 opacity-20" />
                            <p>No teams yet. {isAdmin ? 'Create the first team to start contractor onboarding.' : 'Ask an admin to create teams.'}</p>
                        </div>
                    ) : teams.map(team => {
                        const teamInvitations = invitationsByTeam[team.id] || [];
                        return (
                            <div key={team.id} className="rounded-[28px] border border-[hsl(var(--border))] bg-[hsl(var(--surface))] p-6 shadow-sm">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <div className="flex h-12 w-12 items-center justify-center rounded-md bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]">
                                            <Users className="h-6 w-6" />
                                        </div>
                                        <h3 className="mt-4 text-xl font-semibold">{team.name}</h3>
                                        <p className="mt-2 text-sm text-[hsl(var(--text-secondary))]">{team.description || 'No description yet.'}</p>
                                    </div>
                                    {isAdmin ? (
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => openEditModal(team)}
                                                className="rounded-md border border-[hsl(var(--border))] p-2 hover:bg-[hsl(var(--surface-elevated))]"
                                                title="Edit team"
                                            >
                                                <Edit2 className="h-4 w-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteTeam(team.id)}
                                                className="rounded-md border border-[hsl(var(--border))] p-2 hover:bg-[hsl(var(--surface-elevated))]"
                                                title="Delete team"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    ) : null}
                                </div>

                                <div className="mt-5 flex items-center justify-between rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-3 text-sm text-[hsl(var(--text-secondary))]">
                                    <span>{team.member_count} {team.member_count === 1 ? 'member' : 'members'}</span>
                                    <span>{teamInvitations.filter(invitation => invitation.status !== 'accepted' && invitation.status !== 'revoked').length} open contractor invites</span>
                                </div>

                                {isAdmin ? (
                                    <div className="mt-4 flex justify-end">
                                        <button
                                            onClick={() => openInviteModal(team.id)}
                                            className="inline-flex items-center gap-2 rounded-md border border-[hsl(var(--border))] px-4 py-2 text-sm font-semibold hover:bg-[hsl(var(--surface-elevated))]"
                                        >
                                            <UserPlus className="h-4 w-4" />
                                            Invite Contractor
                                        </button>
                                    </div>
                                ) : null}

                                <div className="mt-6 space-y-3">
                                    {teamInvitations.length === 0 ? (
                                        <div className="rounded-md border border-dashed border-[hsl(var(--border))] p-4 text-sm text-[hsl(var(--text-tertiary))]">
                                            No contractor invitations for this team yet.
                                        </div>
                                    ) : teamInvitations.map(invitation => (
                                        <div key={invitation.id} className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-4">
                                            <div className="flex flex-wrap items-start justify-between gap-3">
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span className={`inline-flex rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${invitationTone[invitation.status]}`}>
                                                            {invitation.status}
                                                        </span>
                                                        <span className="inline-flex rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--surface-elevated))] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[hsl(var(--text-tertiary))]">
                                                            {invitation.delivery_mode.replace('_', ' ')}
                                                        </span>
                                                        <span className="inline-flex rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--surface-elevated))] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[hsl(var(--text-tertiary))]">
                                                            {invitation.approval_mode}
                                                        </span>
                                                    </div>
                                                    <div className="mt-3 flex flex-wrap gap-4 text-xs text-[hsl(var(--text-tertiary))]">
                                                        <span>Created: {new Date(invitation.created_at).toLocaleString()}</span>
                                                        <span>Claimed: {invitation.claimed_at ? new Date(invitation.claimed_at).toLocaleString() : 'Not yet'}</span>
                                                    </div>
                                                    {invitation.pin_code ? (() => {
                                                        const mobileJoinLink = buildMobileJoinTeamLink(invitation.pin_code);
                                                        return (
                                                        <>
                                                            <div className="mt-3 flex items-center gap-2 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--surface))] px-3 py-2 text-xs text-[hsl(var(--text-secondary))]">
                                                                <span className="font-semibold text-[hsl(var(--text-primary))]">PIN:</span>
                                                                <span className="font-mono tracking-[0.18em]">{invitation.pin_code}</span>
                                                                <button
                                                                    onClick={() => handleCopyValue(invitation.pin_code)}
                                                                    className="ml-auto rounded-lg border border-[hsl(var(--border))] p-1.5 hover:bg-[hsl(var(--surface-elevated))]"
                                                                    title="Copy pin"
                                                                >
                                                                    <Copy className="h-3.5 w-3.5" />
                                                                </button>
                                                            </div>
                                                            <div className="mt-3 flex items-center gap-2 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--surface))] px-3 py-2 text-xs text-[hsl(var(--text-secondary))]">
                                                                <span className="font-semibold text-[hsl(var(--text-primary))]">Mobile join:</span>
                                                                <span className="truncate font-mono">{mobileJoinLink}</span>
                                                                <button
                                                                    onClick={() => handleCopyValue(mobileJoinLink)}
                                                                    className="ml-auto rounded-lg border border-[hsl(var(--border))] p-1.5 hover:bg-[hsl(var(--surface-elevated))]"
                                                                    title="Copy mobile join link"
                                                                >
                                                                    <Copy className="h-3.5 w-3.5" />
                                                                </button>
                                                            </div>
                                                        </>
                                                        );
                                                    })() : null}
                                                    {invitation.token ? (() => {
                                                        const webLink = buildStudioInvitationAcceptLink(invitation.token);
                                                        const mobileLink = buildMobileInvitationAcceptLink(invitation.token);
                                                        return (
                                                        <>
                                                            <div className="mt-3 flex items-center gap-2 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--surface))] px-3 py-2 text-xs text-[hsl(var(--text-secondary))]">
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
                                                            <div className="mt-3 flex items-center gap-2 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--surface))] px-3 py-2 text-xs text-[hsl(var(--text-secondary))]">
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
                                                                className="rounded-md border border-[hsl(var(--border))] px-3 py-2 text-sm font-semibold hover:bg-[hsl(var(--surface-elevated))] disabled:opacity-50"
                                                            >
                                                                Approve
                                                            </button>
                                                        ) : null}
                                                        {invitation.status !== 'accepted' && invitation.status !== 'revoked' ? (
                                                            <button
                                                                onClick={() => handleRevokeInvitation(invitation.id)}
                                                                disabled={actingInvitationId === invitation.id}
                                                                className="rounded-md border border-[hsl(var(--border))] px-3 py-2 text-sm font-semibold hover:bg-[hsl(var(--surface-elevated))] disabled:opacity-50"
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
                            </div>
                        );
                    })}
                </div>
            )}

            {showCreateModal ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-md rounded-[32px] border border-[hsl(var(--border))] bg-[hsl(var(--surface))] p-8 shadow-2xl">
                        <div className="mb-6 flex items-center justify-between gap-4">
                            <h3 className="text-2xl font-bold">Create Team</h3>
                            <button onClick={() => setShowCreateModal(false)} className="rounded-md border border-[hsl(var(--border))] p-2 hover:bg-[hsl(var(--surface-elevated))]">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <form onSubmit={handleCreateTeam} className="space-y-4">
                            <div>
                                <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-[hsl(var(--text-tertiary))]">Team name</label>
                                <input
                                    value={teamName}
                                    onChange={(event) => setTeamName(event.target.value)}
                                    className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-3 text-sm"
                                    placeholder="e.g. Field Agents"
                                    required
                                />
                            </div>
                            <div>
                                <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-[hsl(var(--text-tertiary))]">Description</label>
                                <textarea
                                    value={teamDescription}
                                    onChange={(event) => setTeamDescription(event.target.value)}
                                    className="min-h-[110px] w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-3 text-sm"
                                    placeholder="What is this team responsible for?"
                                />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setShowCreateModal(false)} className="flex-1 rounded-md border border-[hsl(var(--border))] px-4 py-3 text-sm font-semibold hover:bg-[hsl(var(--surface-elevated))]">
                                    Cancel
                                </button>
                                <button type="submit" disabled={loading} className="flex-1 rounded-md bg-[hsl(var(--primary))] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-black/10 disabled:opacity-50">
                                    {loading ? 'Creating...' : 'Create Team'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            ) : null}

            {showEditModal && selectedTeam ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-md rounded-[32px] border border-[hsl(var(--border))] bg-[hsl(var(--surface))] p-8 shadow-2xl">
                        <div className="mb-6 flex items-center justify-between gap-4">
                            <h3 className="text-2xl font-bold">Edit Team</h3>
                            <button onClick={() => setShowEditModal(false)} className="rounded-md border border-[hsl(var(--border))] p-2 hover:bg-[hsl(var(--surface-elevated))]">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <form onSubmit={handleUpdateTeam} className="space-y-4">
                            <div>
                                <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-[hsl(var(--text-tertiary))]">Team name</label>
                                <input
                                    value={teamName}
                                    onChange={(event) => setTeamName(event.target.value)}
                                    className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-3 text-sm"
                                    required
                                />
                            </div>
                            <div>
                                <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-[hsl(var(--text-tertiary))]">Description</label>
                                <textarea
                                    value={teamDescription}
                                    onChange={(event) => setTeamDescription(event.target.value)}
                                    className="min-h-[110px] w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-3 text-sm"
                                />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setShowEditModal(false)} className="flex-1 rounded-md border border-[hsl(var(--border))] px-4 py-3 text-sm font-semibold hover:bg-[hsl(var(--surface-elevated))]">
                                    Cancel
                                </button>
                                <button type="submit" disabled={loading} className="flex-1 rounded-md bg-[hsl(var(--primary))] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-black/10 disabled:opacity-50">
                                    {loading ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            ) : null}

            {showInviteModal ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-lg rounded-[32px] border border-[hsl(var(--border))] bg-[hsl(var(--surface))] p-8 shadow-2xl">
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <h3 className="text-2xl font-bold">Invite Contractor</h3>
                                <p className="mt-1 text-sm text-[hsl(var(--text-secondary))]">Contractors always join through a team. Choose how they receive access and whether the join requires review.</p>
                            </div>
                            <button onClick={closeInviteModal} className="rounded-md border border-[hsl(var(--border))] p-2 hover:bg-[hsl(var(--surface-elevated))]">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {createdInvitation ? (() => {
                            const teamNameForInvite = teams.find(team => team.id === createdInvitation.team_id)?.name || 'Selected team';
                            const webLink = createdInvitation.token ? buildStudioInvitationAcceptLink(createdInvitation.token) : null;
                            const mobileLink = createdInvitation.token ? buildMobileInvitationAcceptLink(createdInvitation.token) : null;
                            const mobileJoinLink = createdInvitation.pin_code ? buildMobileJoinTeamLink(createdInvitation.pin_code) : null;
                            return (
                                <div className="mt-6 space-y-5">
                                    <div className="rounded-md border border-emerald-500/20 bg-emerald-500/10 p-5">
                                        <div className="flex items-start gap-3">
                                            <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-300" />
                                            <div>
                                                <p className="font-semibold text-emerald-100">Contractor invite created</p>
                                                <p className="mt-1 text-sm text-emerald-50/80">Ready for {teamNameForInvite} with {createdInvitation.approval_mode.replace('_', ' ')} approval.</p>
                                            </div>
                                        </div>
                                    </div>

                                    {createdInvitation.pin_code ? (
                                        <div className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-4 text-sm">
                                            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[hsl(var(--text-tertiary))]">PIN code</p>
                                            <p className="mt-2 font-mono text-lg tracking-[0.18em] text-[hsl(var(--text-primary))]">{createdInvitation.pin_code}</p>
                                            <div className="mt-4 flex gap-3">
                                                <button
                                                    type="button"
                                                    onClick={() => handleCopyValue(createdInvitation.pin_code)}
                                                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-md border border-[hsl(var(--border))] px-4 py-3 text-sm font-semibold hover:bg-[hsl(var(--surface-elevated))]"
                                                >
                                                    <Copy className="h-4 w-4" />
                                                    Copy PIN
                                                </button>
                                                {mobileJoinLink ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenLink(mobileJoinLink)}
                                                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-md border border-[hsl(var(--border))] px-4 py-3 text-sm font-semibold hover:bg-[hsl(var(--surface-elevated))]"
                                                    >
                                                        <ExternalLink className="h-4 w-4" />
                                                        Open In App
                                                    </button>
                                                ) : null}
                                            </div>
                                            {mobileJoinLink ? (
                                                <div className="mt-3 flex items-center gap-2 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--surface))] px-3 py-2 text-xs text-[hsl(var(--text-secondary))]">
                                                    <span className="font-semibold text-[hsl(var(--text-primary))]">Mobile join:</span>
                                                    <span className="truncate font-mono">{mobileJoinLink}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleCopyValue(mobileJoinLink)}
                                                        className="ml-auto rounded-lg border border-[hsl(var(--border))] p-1.5 hover:bg-[hsl(var(--surface-elevated))]"
                                                    >
                                                        <Copy className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            ) : null}
                                        </div>
                                    ) : null}

                                    {webLink ? (
                                        <div className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-4 text-sm">
                                            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[hsl(var(--text-tertiary))]">Web invite link</p>
                                            <p className="mt-2 truncate font-mono text-[hsl(var(--text-secondary))]">{webLink}</p>
                                            <div className="mt-4 flex gap-3">
                                                <button
                                                    type="button"
                                                    onClick={() => handleCopyValue(webLink)}
                                                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-md border border-[hsl(var(--border))] px-4 py-3 text-sm font-semibold hover:bg-[hsl(var(--surface-elevated))]"
                                                >
                                                    <Copy className="h-4 w-4" />
                                                    Copy Web Link
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleOpenLink(webLink)}
                                                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-md border border-[hsl(var(--border))] px-4 py-3 text-sm font-semibold hover:bg-[hsl(var(--surface-elevated))]"
                                                >
                                                    <ExternalLink className="h-4 w-4" />
                                                    Open Web Invite
                                                </button>
                                            </div>
                                        </div>
                                    ) : null}

                                    {mobileLink ? (
                                        <div className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-4 text-sm">
                                            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[hsl(var(--text-tertiary))]">Mobile app link</p>
                                            <p className="mt-2 truncate font-mono text-[hsl(var(--text-secondary))]">{mobileLink}</p>
                                            <div className="mt-4 flex gap-3">
                                                <button
                                                    type="button"
                                                    onClick={() => handleCopyValue(mobileLink)}
                                                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-md border border-[hsl(var(--border))] px-4 py-3 text-sm font-semibold hover:bg-[hsl(var(--surface-elevated))]"
                                                >
                                                    <Copy className="h-4 w-4" />
                                                    Copy App Link
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleOpenLink(mobileLink)}
                                                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-md border border-[hsl(var(--border))] px-4 py-3 text-sm font-semibold hover:bg-[hsl(var(--surface-elevated))]"
                                                >
                                                    <ExternalLink className="h-4 w-4" />
                                                    Open In App
                                                </button>
                                            </div>
                                        </div>
                                    ) : null}

                                    <div className="flex gap-3 pt-2">
                                        <button type="button" onClick={() => setCreatedInvitation(null)} className="flex-1 rounded-md border border-[hsl(var(--border))] px-4 py-3 text-sm font-semibold hover:bg-[hsl(var(--surface-elevated))]">
                                            Create Another Invite
                                        </button>
                                        <button type="button" onClick={closeInviteModal} className="flex-1 rounded-md bg-[hsl(var(--primary))] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-black/10">
                                            Done
                                        </button>
                                    </div>
                                </div>
                            );
                        })() : (
                        <form onSubmit={handleCreateContractorInvitation} className="mt-6 space-y-5">
                            <div>
                                <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-[hsl(var(--text-tertiary))]">Team</label>
                                <select
                                    value={inviteTeamId}
                                    onChange={(event) => setInviteTeamId(event.target.value)}
                                    className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-3 text-sm"
                                    required
                                >
                                    {teams.map(team => (
                                        <option key={team.id} value={team.id}>{team.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <div>
                                    <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-[hsl(var(--text-tertiary))]">Delivery mode</label>
                                    <select
                                        value={inviteDeliveryMode}
                                        onChange={(event) => setInviteDeliveryMode(event.target.value as 'generated_link' | 'pin_code')}
                                        className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-3 text-sm"
                                    >
                                        <option value="generated_link">Generated link</option>
                                        <option value="pin_code">PIN code</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-[hsl(var(--text-tertiary))]">Approval mode</label>
                                    <select
                                        value={inviteApprovalMode}
                                        onChange={(event) => setInviteApprovalMode(event.target.value as 'auto' | 'review')}
                                        className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-3 text-sm"
                                    >
                                        <option value="auto">Auto approve</option>
                                        <option value="review">Admin review</option>
                                    </select>
                                </div>
                            </div>

                            <div className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-4 text-sm text-[hsl(var(--text-secondary))]">
                                <div className="flex items-start gap-3">
                                    <AlertCircle className="mt-0.5 h-4 w-4 text-[hsl(var(--primary))]" />
                                    <div>
                                        <p className="font-medium text-[hsl(var(--text-primary))]">Contractor invite behavior</p>
                                        <p className="mt-1">Contractor invites do not expire automatically. PINs are for the mobile join flow. Generated links issue a reusable token until the invite is revoked.</p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={closeInviteModal} className="flex-1 rounded-md border border-[hsl(var(--border))] px-4 py-3 text-sm font-semibold hover:bg-[hsl(var(--surface-elevated))]">
                                    Cancel
                                </button>
                                <button type="submit" disabled={savingInvite || !inviteTeamId} className="flex-1 rounded-md bg-[hsl(var(--primary))] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-black/10 disabled:opacity-50">
                                    {savingInvite ? 'Creating...' : 'Create Contractor Invite'}
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

export default TeamsManagement;
