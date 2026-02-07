import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useOrg } from '../contexts/OrgContext';
import { formAPI } from '../lib/api';
import ThemeToggle from '../components/ThemeToggle';
import MembersManagement from '../components/MembersManagement';
import TeamsManagement from '../components/TeamsManagement';
import RolesManagement from '../components/RolesManagement';
import { 
    Plus, Layout, Folder, Users, Settings, LogOut, ChevronRight, 
    Search, Bell, PlusCircle, FileText, Activity
} from 'lucide-react';

const Dashboard: React.FC = () => {
    const { user, logout } = useAuth();
    const { currentOrg, organizations, projects, createProject, setCurrentOrg, isLoading } = useOrg();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('forms');
    const [membersSubTab, setMembersSubTab] = useState<'members' | 'teams' | 'roles'>('members');
    const [forms, setForms] = useState<any[]>([]);
    const [showCreateProject, setShowCreateProject] = useState(false);
    const [projectName, setProjectName] = useState('');

    // Check if current user is admin (simplified - in production, fetch from API)
    const isAdmin = true; // TODO: Get from API based on user's role in current org

    useEffect(() => {
        if (!isLoading && organizations.length === 0) {
            navigate('/welcome');
        }
    }, [organizations, currentOrg, isLoading, navigate]);

    const fetchForms = async () => {
        if (projects.length > 0) {
            try {
                const allForms = await Promise.all(
                    projects.map(p => formAPI.list(p.id))
                );
                setForms(allForms.flat());
            } catch (err) {
                console.error(err);
            }
        }
    };

    useEffect(() => {
        fetchForms();
    }, [projects]);

    const handleCreateProject = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!projectName.trim()) return;
        try {
            await createProject(projectName);
            setProjectName('');
            setShowCreateProject(false);
        } catch (err) {
            alert('Failed to create project');
        }
    };

    const handleCreateForm = async (projectId: string) => {
        try {
            const newForm = await formAPI.create(projectId, {
                title: 'New Form'
            });
            navigate(`/builder/${newForm.id}`);
        } catch (err) {
            alert('Failed to create form');
        }
    };

    return (
        <div className="flex h-screen bg-[hsl(var(--background))] text-[hsl(var(--text-primary))] overflow-hidden">
            {/* Sidebar */}
            <aside className="w-64 bg-[hsl(var(--surface))] border-r border-[hsl(var(--border))] flex flex-col">
                <div className="p-6">
                    <div className="flex items-center space-x-3 mb-8">
                        <div className="w-8 h-8 bg-[hsl(var(--primary))] rounded-lg flex items-center justify-center font-bold text-white shadow-lg shadow-black/10">
                            O
                        </div>
                        <span className="font-bold text-xl tracking-tight">Opla Studio</span>
                    </div>

                    {/* Org Switcher */}
                    <div className="mb-8">
                        <label className="text-[10px] font-bold text-[hsl(var(--text-tertiary))] uppercase tracking-widest mb-3 block">Organization</label>
                        <select 
                            value={currentOrg?.id}
                            onChange={(e) => {
                                const org = organizations.find(o => o.id === e.target.value);
                                if (org) setCurrentOrg(org);
                            }}
                            className="w-full bg-[hsl(var(--surface-elevated))] border border-[hsl(var(--border))] rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[hsl(var(--primary))] transition-all cursor-pointer"
                        >
                            {organizations.map(org => (
                                <option key={org.id} value={org.id}>{org.name}</option>
                            ))}
                        </select>
                    </div>

                    <nav className="space-y-1">
                        <button 
                            onClick={() => setActiveTab('forms')}
                            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'forms' ? 'bg-[hsl(var(--primary))] text-white shadow-lg shadow-black/10' : 'hover:bg-[hsl(var(--surface-elevated))] text-[hsl(var(--text-secondary))]'}`}
                        >
                            <Layout className="w-5 h-5" />
                            <span className="font-medium">All Forms</span>
                        </button>
                        <button 
                            onClick={() => setActiveTab('projects')}
                            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'projects' ? 'bg-[hsl(var(--primary))] text-white shadow-lg shadow-black/10' : 'hover:bg-[hsl(var(--surface-elevated))] text-[hsl(var(--text-secondary))]'}`}
                        >
                            <Folder className="w-5 h-5" />
                            <span className="font-medium">Projects</span>
                        </button>
                        <button 
                            onClick={() => setActiveTab('members')}
                            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'members' ? 'bg-[hsl(var(--primary))] text-white shadow-lg shadow-black/10' : 'hover:bg-[hsl(var(--surface-elevated))] text-[hsl(var(--text-secondary))]'}`}
                        >
                            <Users className="w-5 h-5" />
                            <span className="font-medium">Team Members</span>
                        </button>
                    </nav>
                </div>

                <div className="mt-auto p-6 border-t border-[hsl(var(--border))]">
                    <button 
                        onClick={() => { logout(); navigate('/login'); }}
                        className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl hover:bg-[hsl(var(--error))]/10 text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--error))] transition-all"
                    >
                        <LogOut className="w-5 h-5" />
                        <span className="font-medium">Logout</span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col overflow-hidden">
                {/* Top Header */}
                <header className="h-16 border-b border-[hsl(var(--border))] flex items-center justify-between px-8 bg-[hsl(var(--surface))]/70 backdrop-blur-md">
                    <div className="flex items-center bg-[hsl(var(--surface-elevated))] rounded-xl px-4 py-2 w-96 border border-[hsl(var(--border))] focus-within:ring-2 focus-within:ring-[hsl(var(--primary))]/50 transition-all">
                        <Search className="w-4 h-4 text-[hsl(var(--text-tertiary))] mr-2" />
                        <input border-none bg-transparent text-sm focus:outline-none placeholder="Search forms, projects..." className="bg-transparent border-none w-full text-[hsl(var(--text-primary))] placeholder:text-[hsl(var(--text-tertiary))]" />
                    </div>
                    <div className="flex items-center space-x-4">
                        <ThemeToggle />
                        <button className="p-2 text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--text-primary))] transition-all relative">
                            <Bell className="w-5 h-5" />
                            <span className="absolute top-2 right-2 w-2 h-2 bg-[hsl(var(--primary))] rounded-full border-2 border-[hsl(var(--surface))]"></span>
                        </button>
                        <div className="flex items-center space-x-3 pl-4 border-l border-[hsl(var(--border))]">
                            <div className="text-right">
                                <p className="text-sm font-semibold">{user?.full_name}</p>
                                <p className="text-xs text-[hsl(var(--text-tertiary))]">{currentOrg?.name}</p>
                            </div>
                            <div className="w-10 h-10 bg-gradient-to-br from-[hsl(var(--accent-1))] to-[hsl(var(--accent-2))] rounded-xl shadow-lg"></div>
                        </div>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-10">
                    {organizations.length === 0 && !isLoading && (
                        <div className="mb-10 card border-dashed border-2">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-xl font-bold mb-1">Create your first organization</h2>
                                    <p className="text-[hsl(var(--text-secondary))]">Organizations help you manage teams, projects, and forms.</p>
                                </div>
                                <button
                                    onClick={() => navigate('/welcome')}
                                    className="btn btn-primary"
                                >
                                    Create Organization
                                </button>
                            </div>
                        </div>
                    )}
                    {activeTab === 'forms' && (
                        <div className="space-y-8">
                            <div className="flex justify-between items-end">
                                <div>
                                    <h2 className="text-3xl font-bold mb-2">My Forms</h2>
                                    <p className="text-[hsl(var(--text-secondary))]">Manage and publish your forms to collect data.</p>
                                </div>
                                <div className="flex space-x-3">
                                    <button 
                                        onClick={() => setShowCreateProject(true)}
                                        className="flex items-center space-x-2 bg-[hsl(var(--surface-elevated))] hover:bg-[hsl(var(--surface))] text-[hsl(var(--text-primary))] font-semibold px-4 py-2.5 rounded-xl border border-[hsl(var(--border))] transition-all"
                                    >
                                        <PlusCircle className="w-4 h-4" />
                                        <span>New Project</span>
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {forms.length === 0 ? (
                                    <div className="col-span-full border-2 border-dashed border-[hsl(var(--border))] rounded-3xl p-12 text-center text-[hsl(var(--text-tertiary))]">
                                        <Activity className="w-12 h-12 mx-auto mb-4 opacity-20" />
                                        <p>No forms found. Create a project first!</p>
                                    </div>
                                ) : (
                                    forms.map(form => (
                                        <div key={form.id} className="bg-[hsl(var(--surface))] border border-[hsl(var(--border))] p-6 rounded-3xl hover:border-[hsl(var(--border-hover))] transition-all group cursor-pointer shadow-sm" onClick={() => navigate(`/builder/${form.id}`)}>
                                            <div className="flex justify-between items-start mb-6">
                                                <div className="p-3 bg-[hsl(var(--primary))]/10 rounded-2xl group-hover:bg-[hsl(var(--primary))]/20 transition-all">
                                                    <FileText className="w-6 h-6 text-[hsl(var(--primary))]" />
                                                </div>
                                                <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-lg ${form.status === 'live' ? 'bg-[hsl(var(--success))]/15 text-[hsl(var(--success))]' : 'bg-[hsl(var(--surface-elevated))] text-[hsl(var(--text-tertiary))]'}`}>
                                                    {form.status}
                                                </span>
                                            </div>
                                            <h3 className="text-lg font-bold mb-1">{form.title}</h3>
                                            <p className="text-xs text-[hsl(var(--text-tertiary))] mb-6">v{form.version} • Updated {new Date(form.updated_at).toLocaleDateString()}</p>
                                            <div className="flex items-center text-[hsl(var(--primary))] text-sm font-semibold opacity-0 group-hover:opacity-100 transition-all">
                                                <span>Open Builder</span>
                                                <ChevronRight className="w-4 h-4 ml-1" />
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'projects' && (
                        <div className="space-y-8">
                             <div className="flex justify-between items-end">
                                <div>
                                    <h2 className="text-3xl font-bold mb-2">Projects</h2>
                                    <p className="text-[hsl(var(--text-secondary))]">Organize your forms by project workspace.</p>
                                </div>
                                <button 
                                    onClick={() => setShowCreateProject(true)}
                                    className="flex items-center space-x-2 bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary-hover))] text-white font-semibold px-6 py-3 rounded-2xl shadow-lg shadow-black/10 transition-all"
                                >
                                    <Plus className="w-5 h-5" />
                                    <span>Create Project</span>
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {projects.map(project => (
                                    <div key={project.id} className="bg-[hsl(var(--surface))] border border-[hsl(var(--border))] rounded-3xl overflow-hidden hover:border-[hsl(var(--border-hover))] transition-all shadow-sm">
                                        <div className="p-8">
                                            <div className="flex justify-between items-start mb-4">
                                                <h3 className="text-xl font-bold">{project.name}</h3>
                                                <div className="p-2 bg-[hsl(var(--surface-elevated))] rounded-xl">
                                                    <Settings className="w-4 h-4 text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--text-primary))] cursor-pointer" />
                                                </div>
                                            </div>
                                            <p className="text-[hsl(var(--text-secondary))] text-sm mb-8 line-clamp-2">{project.description || 'No description provided.'}</p>
                                            <button 
                                                onClick={() => handleCreateForm(project.id)}
                                                className="w-full bg-[hsl(var(--surface-elevated))] hover:bg-[hsl(var(--surface))] text-[hsl(var(--text-primary))] font-semibold py-3 rounded-2xl border border-[hsl(var(--border))] transition-all flex items-center justify-center space-x-2"
                                            >
                                                <PlusCircle className="w-4 h-4" />
                                                <span>New Form</span>
                                            </button>
                                        </div>
                                        <div className="bg-[hsl(var(--surface-elevated))] px-8 py-4 border-t border-[hsl(var(--border))] flex justify-between text-xs text-[hsl(var(--text-tertiary))]">
                                            <span>{forms.filter(f => f.project_id === project.id).length} Forms</span>
                                            <span>Created {new Date(project.created_at).toLocaleDateString()}</span>
                                        </div>
                                    </div>

                    {activeTab === 'members' && currentOrg && (
                        <div className="space-y-8">
                            {/* Sub-navigation for Members tab */}
                            <div className="flex items-center gap-4 border-b border-[hsl(var(--border))] pb-4">
                                <button
                                    onClick={() => setMembersSubTab('members')}
                                    className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
                                        membersSubTab === 'members'
                                            ? 'bg-[hsl(var(--primary))] text-white shadow-lg'
                                            : 'text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--surface-elevated))]'
                                    }`}
                                >
                                    Members
                                </button>
                                <button
                                    onClick={() => setMembersSubTab('teams')}
                                    className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
                                        membersSubTab === 'teams'
                                            ? 'bg-[hsl(var(--primary))] text-white shadow-lg'
                                            : 'text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--surface-elevated))]'
                                    }`}
                                >
                                    Teams
                                </button>
                                <button
                                    onClick={() => setMembersSubTab('roles')}
                                    className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
                                        membersSubTab === 'roles'
                                            ? 'bg-[hsl(var(--primary))] text-white shadow-lg'
                                            : 'text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--surface-elevated))]'
                                    }`}
                                >
                                    Roles
                                </button>
                            </div>

                            {/* Render appropriate component based on sub-tab */}
                            {membersSubTab === 'members' && (
                                <MembersManagement orgId={currentOrg.id} isAdmin={isAdmin} />
                            )}
                            {membersSubTab === 'teams' && (
                                <TeamsManagement orgId={currentOrg.id} isAdmin={isAdmin} />
                            )}
                            {membersSubTab === 'roles' && (
                                <RolesManagement orgId={currentOrg.id} isAdmin={isAdmin} />
                            )}
                        </div>
                    )}
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </main>

            {/* Create Project Modal */}
            {showCreateProject && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-[hsl(var(--surface))] border border-[hsl(var(--border))] rounded-[32px] p-8 w-full max-w-md shadow-2xl">
                        <h2 className="text-2xl font-bold mb-6">Create New Project</h2>
                        <form onSubmit={handleCreateProject} className="space-y-6">
                            <div>
                                <label className="label">Project Name</label>
                                <input 
                                    value={projectName}
                                    onChange={(e) => setProjectName(e.target.value)}
                                    className="input"
                                    placeholder="e.g. Q1 Customer Survey"
                                    autoFocus
                                />
                            </div>
                            <div className="flex space-x-3">
                                <button 
                                    type="button"
                                    onClick={() => setShowCreateProject(false)}
                                    className="flex-1 px-6 py-3 rounded-2xl border border-[hsl(var(--border))] text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--surface-elevated))] transition-all"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit"
                                    className="flex-1 bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary-hover))] text-white font-bold py-3 rounded-2xl shadow-lg shadow-black/10 transition-all"
                                >
                                    Create
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dashboard;
