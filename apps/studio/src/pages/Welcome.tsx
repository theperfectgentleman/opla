import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useOrg } from '../contexts/OrgContext';

const Welcome: React.FC = () => {
    const { user } = useAuth();
    const { createOrganization, isLoading: orgLoading } = useOrg();
    const [orgName, setOrgName] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleCreateOrg = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!orgName.trim()) return;

        try {
            await createOrganization(orgName);
            navigate('/dashboard');
        } catch (err: any) {
            setError(err.message);
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-8 shadow-2xl">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-500/10 rounded-2xl mb-4 border border-indigo-500/20">
                        <span className="text-3xl">👋</span>
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-2">Welcome, {user?.full_name}!</h1>
                    <p className="text-slate-400">Let's get started by creating your first organization.</p>
                </div>

                <form onSubmit={handleCreateOrg} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            Organization Name
                        </label>
                        <input
                            type="text"
                            value={orgName}
                            onChange={(e) => setOrgName(e.target.value)}
                            className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                            placeholder="e.g. Acme Corp"
                            required
                        />
                    </div>

                    {error && (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-4 rounded-xl">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={orgLoading || !orgName.trim()}
                        className="w-full bg-indigo-600 hover:bg-indigo-550 text-white font-semibold py-3 rounded-xl shadow-lg shadow-indigo-600/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {orgLoading ? 'Creating...' : 'Create Organization'}
                    </button>

                    <p className="text-center text-xs text-slate-500 mt-6">
                        Organizations help you manage teams, projects, and forms in one place.
                    </p>
                </form>
            </div>
        </div>
    );
};

export default Welcome;
