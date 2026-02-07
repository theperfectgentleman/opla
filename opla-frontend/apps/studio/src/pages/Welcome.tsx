import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useOrg } from '../contexts/OrgContext';
import ThemeToggle from '../components/ThemeToggle';

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
        <div className="min-h-screen bg-[hsl(var(--background))] flex items-center justify-center p-6">
            <div className="max-w-md w-full space-y-4">
                <div className="flex justify-end">
                    <ThemeToggle />
                </div>
                <div className="card-glass rounded-[28px] p-8">
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-[hsl(var(--primary))]/10 rounded-2xl mb-4 border border-[hsl(var(--primary))]/20">
                            <span className="text-3xl">👋</span>
                        </div>
                        <h1 className="text-3xl font-bold mb-2">Welcome, {user?.full_name}!</h1>
                        <p className="text-[hsl(var(--text-secondary))]">Let's get started by creating your first organization.</p>
                    </div>

                    <form onSubmit={handleCreateOrg} className="space-y-6">
                        <div>
                            <label className="label">Organization Name</label>
                            <input
                                type="text"
                                value={orgName}
                                onChange={(e) => setOrgName(e.target.value)}
                                className="input"
                                placeholder="e.g. Acme Corp"
                                required
                            />
                        </div>

                        {error && (
                            <div className="bg-[hsl(var(--error))]/10 border border-[hsl(var(--error))]/30 text-[hsl(var(--error))] text-sm p-4 rounded-xl">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={orgLoading || !orgName.trim()}
                            className="btn btn-primary w-full"
                        >
                            {orgLoading ? 'Creating...' : 'Create Organization'}
                        </button>

                        <p className="text-center text-xs text-[hsl(var(--text-tertiary))] mt-6">
                            Organizations help you manage teams, projects, and forms in one place.
                        </p>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default Welcome;
