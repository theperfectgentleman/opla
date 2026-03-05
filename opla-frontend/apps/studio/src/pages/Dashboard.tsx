import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useOrg } from '../contexts/OrgContext';
import { formAPI } from '../lib/api';
import StudioLayout from '../components/StudioLayout';
import MembersManagement from '../components/MembersManagement';
import TeamsManagement from '../components/TeamsManagement';
import RolesManagement from '../components/RolesManagement';
import {
    Plus, Settings, ChevronRight, PlusCircle, FileText, Activity, Play
} from 'lucide-react';

const Dashboard: React.FC = () => {
    const { currentOrg, organizations, projects, members, createProject, isLoading } = useOrg();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
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

    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab && ['projects', 'forms', 'members', 'audience', 'analysis', 'reports', 'settings'].includes(tab)) {
            setActiveTab(tab);
            if (tab === 'members') {
                setMembersSubTab('teams');
            }
        }
    }, [searchParams]);

    const handleShellNavSelect = (key: 'projects' | 'forms' | 'members' | 'audience' | 'analysis' | 'reports' | 'settings') => {
        setActiveTab(key);
        if (key === 'members') {
            setMembersSubTab('teams');
        }
    };

    const handleCreateProject = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!projectName.trim()) return;
        try {
            await createProject(projectName, ""); // Using empty string explicitly instead of undefined
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
        <>
            <StudioLayout
                activeNav={activeTab as 'projects' | 'forms' | 'members' | 'audience' | 'analysis' | 'reports' | 'settings'}
                onSelectNav={handleShellNavSelect}
                counts={{ projects: projects.length, forms: forms.length, members: members?.length || 0 }}
                contentClassName="flex-1 overflow-y-auto p-10"
            >
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
                                    <div key={project.id} className="bg-[hsl(var(--surface))] border border-[hsl(var(--border))] rounded-3xl overflow-hidden hover:border-[hsl(var(--border-hover))] transition-all shadow-sm flex flex-col">
                                        <div className="p-8 flex-1 flex flex-col">
                                            <div className="flex justify-between items-start mb-4">
                                                <h3 className="text-xl font-bold">{project.name}</h3>
                                                <div className="p-2 bg-[hsl(var(--surface-elevated))] rounded-xl">
                                                    <Settings className="w-4 h-4 text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--text-primary))] cursor-pointer" />
                                                </div>
                                            </div>
                                            <p className="text-[hsl(var(--text-secondary))] text-sm mb-6 line-clamp-2">{project.description || 'No description provided.'}</p>

                                            {forms.filter(f => f.project_id === project.id).length > 0 && (
                                                <div className="space-y-3 mb-6">
                                                    {forms.filter(f => f.project_id === project.id).map(form => (
                                                        <div
                                                            key={form.id}
                                                            onClick={() => navigate(`/builder/${form.id}`)}
                                                            className="flex items-center justify-between p-3 bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-2xl hover:border-[hsl(var(--primary))] transition-all cursor-pointer group"
                                                        >
                                                            <div className="flex items-center space-x-3 overflow-hidden">
                                                                <div className="p-2 bg-[hsl(var(--primary))]/10 rounded-xl">
                                                                    <FileText className="w-4 h-4 text-[hsl(var(--primary))]" />
                                                                </div>
                                                                <span className="text-sm font-semibold truncate">{form.title}</span>
                                                            </div>
                                                            <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-all">
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); navigate(`/simulator/${form.id}`); }}
                                                                    className="p-1.5 hover:bg-[hsl(var(--surface-elevated))] rounded-lg text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--primary))] transition-colors"
                                                                    title="Simulator"
                                                                >
                                                                    <Play className="w-4 h-4 fill-current" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            <div className="mt-auto">
                                                <button
                                                    onClick={() => handleCreateForm(project.id)}
                                                    className="w-full bg-[hsl(var(--surface-elevated))] hover:bg-[hsl(var(--primary))]/10 text-[hsl(var(--text-primary))] hover:text-[hsl(var(--primary))] font-semibold py-3 rounded-2xl border border-[hsl(var(--border))] hover:border-[hsl(var(--primary))]/30 transition-all flex items-center justify-center space-x-2"
                                                >
                                                    <PlusCircle className="w-4 h-4" />
                                                    <span>New Form</span>
                                                </button>
                                            </div>
                                        </div>
                                        <div className="bg-[hsl(var(--surface-elevated))] px-8 py-4 border-t border-[hsl(var(--border))] flex justify-between text-xs text-[hsl(var(--text-tertiary))]">
                                            <span>{forms.filter(f => f.project_id === project.id).length} Forms</span>
                                            <span>Created {new Date(project.created_at).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === 'members' && currentOrg && (
                        <div className="space-y-8">
                            {/* Sub-navigation for Members tab */}
                            <div className="flex items-center gap-4 border-b border-[hsl(var(--border))] pb-4">
                                <button
                                    onClick={() => setMembersSubTab('members')}
                                    className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${membersSubTab === 'members'
                                        ? 'bg-[hsl(var(--primary))] text-white shadow-lg'
                                        : 'text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--surface-elevated))]'
                                        }`}
                                >
                                    Members
                                </button>
                                <button
                                    onClick={() => setMembersSubTab('teams')}
                                    className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${membersSubTab === 'teams'
                                        ? 'bg-[hsl(var(--primary))] text-white shadow-lg'
                                        : 'text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--surface-elevated))]'
                                        }`}
                                >
                                    Teams
                                </button>
                                <button
                                    onClick={() => setMembersSubTab('roles')}
                                    className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${membersSubTab === 'roles'
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

                    {activeTab === 'audience' && (
                        <div className="space-y-8">
                            <div>
                                <h2 className="text-3xl font-bold mb-2">Audience</h2>
                                <p className="text-[hsl(var(--text-secondary))]">Create reusable sampling pools and segments for survey deployment.</p>
                            </div>
                            <div className="card border-dashed border-2">
                                <h3 className="text-lg font-bold mb-2">Audience Pool Management</h3>
                                <p className="text-[hsl(var(--text-secondary))]">Start by creating your first audience pool and saved filters.</p>
                            </div>
                        </div>
                    )}

                    {activeTab === 'analysis' && (
                        <div className="space-y-8">
                            <div>
                                <h2 className="text-3xl font-bold mb-2">Analysis</h2>
                                <p className="text-[hsl(var(--text-secondary))]">Run analysis views across submissions, teams, and time windows.</p>
                            </div>
                            <div className="card border-dashed border-2">
                                <h3 className="text-lg font-bold mb-2">Analysis Sections</h3>
                                <p className="text-[hsl(var(--text-secondary))]">Configure descriptive, comparative, and trend analysis blocks for this organization.</p>
                            </div>
                        </div>
                    )}

                    {activeTab === 'reports' && (
                        <div className="space-y-8">
                            <div>
                                <h2 className="text-3xl font-bold mb-2">Reports</h2>
                                <p className="text-[hsl(var(--text-secondary))]">Store, schedule, and export report outputs from your analysis views.</p>
                            </div>
                            <div className="card border-dashed border-2">
                                <h3 className="text-lg font-bold mb-2">Report Store</h3>
                                <p className="text-[hsl(var(--text-secondary))]">Saved reports and export history will appear here once reporting is enabled.</p>
                            </div>
                        </div>
                    )}

                    {activeTab === 'settings' && (
                        <div className="space-y-8">
                            <div>
                                <h2 className="text-3xl font-bold mb-2">Organization Settings</h2>
                                <p className="text-[hsl(var(--text-secondary))]">Manage organization-level preferences, branding, and governance options.</p>
                            </div>
                            <div className="card border-dashed border-2">
                                <h3 className="text-lg font-bold mb-2">Configuration</h3>
                                <p className="text-[hsl(var(--text-secondary))]">Branding, default workflows, and policy controls will be surfaced in this section.</p>
                            </div>
                        </div>
                    )}
            </StudioLayout>

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
        </>
    );
};

export default Dashboard;
