import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, User, Mail, Phone, Shield } from 'lucide-react';

const Dashboard: React.FC = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    if (!user) {
        return null;
    }

    return (
        <div className="min-h-screen bg-[hsl(var(--background))] p-8">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-4xl font-bold mb-2">Welcome to Opla Studio</h1>
                        <p className="text-[hsl(var(--text-secondary))]">
                            Start building amazing forms
                        </p>
                    </div>
                    <button onClick={handleLogout} className="btn btn-ghost">
                        <LogOut className="w-5 h-5 mr-2" />
                        Logout
                    </button>
                </div>

                {/* User Info Card */}
                <div className="card mb-8">
                    <h2 className="text-2xl font-semibold mb-6">Your Profile</h2>
                    <div className="space-y-4">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-[hsl(var(--primary))] flex items-center justify-center">
                                <User className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <p className="text-sm text-[hsl(var(--text-secondary))]">Full Name</p>
                                <p className="text-lg font-medium">{user.full_name}</p>
                            </div>
                        </div>

                        {user.email && (
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-full bg-[hsl(var(--surface-elevated))] flex items-center justify-center">
                                    <Mail className="w-6 h-6 text-[hsl(var(--text-secondary))]" />
                                </div>
                                <div>
                                    <p className="text-sm text-[hsl(var(--text-secondary))]">Email</p>
                                    <p className="text-lg font-medium">{user.email}</p>
                                </div>
                            </div>
                        )}

                        {user.phone && (
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-full bg-[hsl(var(--surface-elevated))] flex items-center justify-center">
                                    <Phone className="w-6 h-6 text-[hsl(var(--text-secondary))]" />
                                </div>
                                <div>
                                    <p className="text-sm text-[hsl(var(--text-secondary))]">Phone</p>
                                    <p className="text-lg font-medium">{user.phone}</p>
                                </div>
                            </div>
                        )}

                        {user.is_platform_admin && (
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-full bg-[hsl(var(--success))]/20 flex items-center justify-center">
                                    <Shield className="w-6 h-6 text-[hsl(var(--success))]" />
                                </div>
                                <div>
                                    <p className="text-sm text-[hsl(var(--text-secondary))]">Role</p>
                                    <p className="text-lg font-medium text-[hsl(var(--success))]">Platform Admin</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Success Message */}
                <div className="card bg-[hsl(var(--success))]/10 border-[hsl(var(--success))]/30">
                    <div className="text-center">
                        <h3 className="text-2xl font-semibold mb-2 text-[hsl(var(--success))]">
                            🎉 Authentication Complete!
                        </h3>
                        <p className="text-[hsl(var(--text-secondary))]">
                            Phase 1 frontend is now fully functional. You can now proceed to build:
                        </p>
                        <ul className="text-left max-w-md mx-auto mt-4 space-y-2 text-[hsl(var(--text-secondary))]">
                            <li className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-[hsl(var(--success))]"></span>
                                Organization management (Phase 2)
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-[hsl(var(--success))]"></span>
                                Project workspace (Phase 3)
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-[hsl(var(--success))]"></span>
                                Form builder (Phase 4)
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
