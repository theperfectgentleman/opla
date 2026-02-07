import React, { useState, useEffect } from 'react';
import { Users, Plus, Edit2, Trash2, UserPlus, X } from 'lucide-react';
import { teamAPI, roleAPI } from '../lib/api';

interface Team {
    id: string;
    name: string;
    description: string;
    member_count: number;
    created_at: string;
}

interface TeamMember {
    id: string;
    user_id: string;
    team_id: string;
}

interface TeamsManagementProps {
    orgId: string;
    isAdmin: boolean;
}

const TeamsManagement: React.FC<TeamsManagementProps> = ({ orgId, isAdmin }) => {
    const [teams, setTeams] = useState<Team[]>([]);
    const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [teamName, setTeamName] = useState('');
    const [teamDescription, setTeamDescription] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadTeams();
    }, [orgId]);

    const loadTeams = async () => {
        try {
            const data = await teamAPI.list(orgId);
            setTeams(data);
        } catch (err) {
            console.error('Failed to load teams:', err);
        }
    };

    const handleCreateTeam = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!teamName.trim()) return;

        setLoading(true);
        try {
            await teamAPI.create(orgId, {
                name: teamName,
                description: teamDescription
            });
            setTeamName('');
            setTeamDescription('');
            setShowCreateModal(false);
            loadTeams();
        } catch (err) {
            alert('Failed to create team');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateTeam = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedTeam || !teamName.trim()) return;

        setLoading(true);
        try {
            await teamAPI.update(orgId, selectedTeam.id, {
                name: teamName,
                description: teamDescription
            });
            setShowEditModal(false);
            setSelectedTeam(null);
            loadTeams();
        } catch (err) {
            alert('Failed to update team');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteTeam = async (teamId: string) => {
        if (!confirm('Are you sure you want to delete this team?')) return;

        try {
            await teamAPI.delete(orgId, teamId);
            loadTeams();
        } catch (err) {
            alert('Failed to delete team');
        }
    };

    const openEditModal = (team: Team) => {
        setSelectedTeam(team);
        setTeamName(team.name);
        setTeamDescription(team.description || '');
        setShowEditModal(true);
    };

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-3xl font-bold mb-2">Teams</h2>
                    <p className="text-[hsl(var(--text-secondary))]">Organize members into teams for better access control.</p>
                </div>
                {isAdmin && (
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="flex items-center space-x-2 bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary-hover))] text-white font-semibold px-6 py-3 rounded-2xl shadow-lg shadow-black/10 transition-all"
                    >
                        <Plus className="w-5 h-5" />
                        <span>Create Team</span>
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {teams.length === 0 ? (
                    <div className="col-span-full border-2 border-dashed border-[hsl(var(--border))] rounded-3xl p-12 text-center text-[hsl(var(--text-tertiary))]">
                        <Users className="w-12 h-12 mx-auto mb-4 opacity-20" />
                        <p>No teams yet. {isAdmin ? 'Create your first team!' : 'Ask an admin to create teams.'}</p>
                    </div>
                ) : (
                    teams.map(team => (
                        <div key={team.id} className="bg-[hsl(var(--surface))] border border-[hsl(var(--border))] rounded-3xl p-6 hover:border-[hsl(var(--border-hover))] transition-all shadow-sm">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-3 bg-[hsl(var(--primary))]/10 rounded-2xl">
                                    <Users className="w-6 h-6 text-[hsl(var(--primary))]" />
                                </div>
                                {isAdmin && (
                                    <div className="flex space-x-2">
                                        <button
                                            onClick={() => openEditModal(team)}
                                            className="p-2 hover:bg-[hsl(var(--surface-elevated))] rounded-xl transition-all"
                                        >
                                            <Edit2 className="w-4 h-4 text-[hsl(var(--text-tertiary))]" />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteTeam(team.id)}
                                            className="p-2 hover:bg-[hsl(var(--error))]/10 rounded-xl transition-all"
                                        >
                                            <Trash2 className="w-4 h-4 text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--error))]" />
                                        </button>
                                    </div>
                                )}
                            </div>
                            <h3 className="text-lg font-bold mb-2">{team.name}</h3>
                            <p className="text-sm text-[hsl(var(--text-secondary))] mb-4 line-clamp-2">
                                {team.description || 'No description'}
                            </p>
                            <div className="flex items-center justify-between mt-4 pt-4 border-t border-[hsl(var(--border))]">
                                <span className="text-xs text-[hsl(var(--text-tertiary))]">
                                    {team.member_count} {team.member_count === 1 ? 'member' : 'members'}
                                </span>
                                {isAdmin && (
                                    <button className="flex items-center space-x-1 text-xs text-[hsl(var(--primary))] hover:underline">
                                        <UserPlus className="w-3 h-3" />
                                        <span>Add Members</span>
                                    </button>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Create Team Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-[hsl(var(--surface))] border border-[hsl(var(--border))] rounded-[32px] p-8 w-full max-w-md shadow-2xl">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-bold">Create New Team</h2>
                            <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-[hsl(var(--surface-elevated))] rounded-xl transition-all">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleCreateTeam} className="space-y-4">
                            <div>
                                <label className="label">Team Name</label>
                                <input
                                    value={teamName}
                                    onChange={(e) => setTeamName(e.target.value)}
                                    className="input"
                                    placeholder="e.g. Field Agents"
                                    autoFocus
                                    required
                                />
                            </div>
                            <div>
                                <label className="label">Description (optional)</label>
                                <textarea
                                    value={teamDescription}
                                    onChange={(e) => setTeamDescription(e.target.value)}
                                    className="input min-h-[100px]"
                                    placeholder="What does this team do?"
                                />
                            </div>
                            <div className="flex space-x-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowCreateModal(false)}
                                    className="flex-1 px-6 py-3 rounded-2xl border border-[hsl(var(--border))] text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--surface-elevated))] transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="flex-1 bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary-hover))] text-white font-bold py-3 rounded-2xl shadow-lg shadow-black/10 transition-all disabled:opacity-50"
                                >
                                    {loading ? 'Creating...' : 'Create Team'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Team Modal */}
            {showEditModal && selectedTeam && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-[hsl(var(--surface))] border border-[hsl(var(--border))] rounded-[32px] p-8 w-full max-w-md shadow-2xl">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-bold">Edit Team</h2>
                            <button onClick={() => setShowEditModal(false)} className="p-2 hover:bg-[hsl(var(--surface-elevated))] rounded-xl transition-all">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleUpdateTeam} className="space-y-4">
                            <div>
                                <label className="label">Team Name</label>
                                <input
                                    value={teamName}
                                    onChange={(e) => setTeamName(e.target.value)}
                                    className="input"
                                    required
                                />
                            </div>
                            <div>
                                <label className="label">Description</label>
                                <textarea
                                    value={teamDescription}
                                    onChange={(e) => setTeamDescription(e.target.value)}
                                    className="input min-h-[100px]"
                                />
                            </div>
                            <div className="flex space-x-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowEditModal(false)}
                                    className="flex-1 px-6 py-3 rounded-2xl border border-[hsl(var(--border))] text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--surface-elevated))] transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="flex-1 bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary-hover))] text-white font-bold py-3 rounded-2xl shadow-lg shadow-black/10 transition-all disabled:opacity-50"
                                >
                                    {loading ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TeamsManagement;
