import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useOrg } from '../contexts/OrgContext';
import { useToast } from '../contexts/ToastContext';
import { formAPI, projectAPI, reportAPI, teamAPI } from '../lib/api';
import StudioLayout from '../components/StudioLayout';
import MembersManagement from '../components/MembersManagement';
import TeamsManagement from '../components/TeamsManagement';
import RolesManagement from '../components/RolesManagement';
import {
    Plus, Settings, ChevronRight, PlusCircle, FileText, Activity, Play, CheckSquare, FileBarChart2, MessageSquare, Paperclip, Loader2
} from 'lucide-react';
import { AnalyticsHubSkeleton } from '../components/analytics/ui';

const AnalyticsHub = lazy(() => import('../components/analytics/AnalyticsHub'));

type DashboardTask = {
    id: string;
    project_id: string;
    project_name: string;
    title: string;
    description?: string;
    status: 'todo' | 'in_progress' | 'done' | 'blocked' | 'cancelled';
    due_at?: string;
    starts_at?: string;
    updated_at: string;
    assigned_accessor_id?: string;
    assigned_accessor_type?: 'user' | 'team';
};

type DashboardReport = {
    id: string;
    project_id: string;
    project_name: string;
    title: string;
    description?: string;
    status: 'draft' | 'published' | 'archived';
    updated_at: string;
};

type DashboardThread = {
    id: string;
    project_id: string;
    project_name: string;
    title: string;
    summary: string;
    updated_at: string;
    reply_count: number;
};

type DashboardAsset = {
    id: string;
    project_id: string;
    project_name: string;
    title: string;
    kind: 'document' | 'image' | 'audio' | 'link';
    summary: string;
    updated_at: string;
};

const taskTone: Record<DashboardTask['status'], string> = {
    todo: 'bg-slate-500/10 text-slate-300 border border-slate-500/20',
    in_progress: 'bg-sky-500/10 text-sky-300 border border-sky-500/20',
    done: 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20',
    blocked: 'bg-rose-500/10 text-rose-300 border border-rose-500/20',
    cancelled: 'bg-orange-500/10 text-orange-300 border border-orange-500/20',
};

function AnalyticsTabFallback() {
    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin text-emerald-700" />
                Loading analytics workspace...
            </div>
            <AnalyticsHubSkeleton />
        </div>
    );
}

const Dashboard: React.FC = () => {
    const { currentOrg, organizations, projects, members, createProject, isLoading, setCurrentProject } = useOrg();
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [searchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState('forms');
    const [membersSubTab, setMembersSubTab] = useState<'members' | 'teams' | 'roles'>('members');
    const [forms, setForms] = useState<any[]>([]);
    const [tasks, setTasks] = useState<DashboardTask[]>([]);
    const [reports, setReports] = useState<DashboardReport[]>([]);
    const [showCreateProject, setShowCreateProject] = useState(false);
    const [projectName, setProjectName] = useState('');
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [formProjectId, setFormProjectId] = useState('');
    const [formTitle, setFormTitle] = useState('');
    const [savingForm, setSavingForm] = useState(false);
    const [teams, setTeams] = useState<{ id: string; name: string }[]>([]);
    const [taskProjectId, setTaskProjectId] = useState('');
    const [taskTitle, setTaskTitle] = useState('');
    const [taskDescription, setTaskDescription] = useState('');
    const [taskStartsAt, setTaskStartsAt] = useState('');
    const [taskDueAt, setTaskDueAt] = useState('');
    const [taskAssigneeType, setTaskAssigneeType] = useState<'user' | 'team'>('user');
    const [taskAssigneeId, setTaskAssigneeId] = useState('');
    const [savingTask, setSavingTask] = useState(false);
    const [reportProjectId, setReportProjectId] = useState('');
    const [reportTitle, setReportTitle] = useState('');
    const [reportDescription, setReportDescription] = useState('');
    const [savingReport, setSavingReport] = useState(false);

    const threadItems = useMemo<DashboardThread[]>(() => {
        const primaryProject = projects[0];
        const secondaryProject = projects[1] || primaryProject;

        return [
            {
                id: 'thread-launch-briefing',
                project_id: primaryProject?.id || 'mock-project-1',
                project_name: primaryProject?.name || 'Market Entry Survey',
                title: 'Field launch briefing',
                summary: 'Kickoff thread for team-wide notices, @mentions, and launch-day clarifications.',
                updated_at: new Date().toISOString(),
                reply_count: 12,
            },
            {
                id: 'thread-data-quality',
                project_id: secondaryProject?.id || 'mock-project-2',
                project_name: secondaryProject?.name || 'Retail Audit',
                title: 'Data quality review lane',
                summary: 'Operational discussion for supervisor notes, flagged submissions, and issue triage.',
                updated_at: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
                reply_count: 7,
            },
        ];
    }, [projects]);

    const assetItems = useMemo<DashboardAsset[]>(() => {
        const primaryProject = projects[0];
        const secondaryProject = projects[1] || primaryProject;

        return [
            {
                id: 'asset-consent-script',
                project_id: primaryProject?.id || 'mock-project-1',
                project_name: primaryProject?.name || 'Market Entry Survey',
                title: 'Enumerator consent script',
                kind: 'document',
                summary: 'Reference script for in-field consent, opening prompts, and escalation language.',
                updated_at: new Date().toISOString(),
            },
            {
                id: 'asset-brand-audio',
                project_id: secondaryProject?.id || 'mock-project-2',
                project_name: secondaryProject?.name || 'Retail Audit',
                title: 'Brand audio prompt',
                kind: 'audio',
                summary: 'Audio clip used during assisted interviews when brand recall needs playback.',
                updated_at: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
            },
        ];
    }, [projects]);

    const isAdmin = true;

    useEffect(() => {
        setCurrentProject(null);
    }, [setCurrentProject]);

    useEffect(() => {
        if (!isLoading && organizations.length === 0) {
            navigate('/welcome');
        }
    }, [organizations, currentOrg, isLoading, navigate]);

    useEffect(() => {
        const fetchForms = async () => {
            if (projects.length === 0) {
                setForms([]);
                return;
            }

            try {
                const allForms = await Promise.all(projects.map(project => formAPI.list(project.id)));
                setForms(allForms.flat());
            } catch (err) {
                console.error(err);
            }
        };

        fetchForms();
    }, [projects]);

    useEffect(() => {
        const fetchTasks = async () => {
            if (!currentOrg || projects.length === 0) {
                setTasks([]);
                return;
            }

            try {
                const allTasks = await Promise.all(
                    projects.map(async project => {
                        const projectTasks = await projectAPI.listTasks(currentOrg.id, project.id);
                        return projectTasks.map((task: any) => ({
                            ...task,
                            project_name: project.name,
                        }));
                    })
                );
                setTasks(
                    allTasks
                        .flat()
                        .sort((left, right) => {
                            const leftTime = new Date(left.due_at || left.updated_at).getTime();
                            const rightTime = new Date(right.due_at || right.updated_at).getTime();
                            return rightTime - leftTime;
                        })
                );
            } catch (err) {
                console.error(err);
            }
        };

        fetchTasks();
    }, [currentOrg, projects]);

    useEffect(() => {
        const fetchReports = async () => {
            if (!currentOrg || projects.length === 0) {
                setReports([]);
                return;
            }

            try {
                const allReports = await Promise.all(
                    projects.map(async project => {
                        const projectReports = await reportAPI.list(currentOrg.id, project.id);
                        return projectReports.map((report: any) => ({
                            ...report,
                            project_name: project.name,
                        }));
                    })
                );
                setReports(
                    allReports
                        .flat()
                        .sort((left, right) => new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime())
                );
            } catch (err) {
                console.error(err);
            }
        };

        fetchReports();
    }, [currentOrg, projects]);

    useEffect(() => {
        const fetchTeams = async () => {
            if (!currentOrg) {
                setTeams([]);
                return;
            }

            try {
                const teamList = await teamAPI.list(currentOrg.id);
                setTeams(teamList);
            } catch (err) {
                console.error(err);
            }
        };

        fetchTeams();
    }, [currentOrg]);

    useEffect(() => {
        setTaskProjectId(projects[0]?.id || '');
        setReportProjectId(projects[0]?.id || '');
        setFormProjectId(projects[0]?.id || '');
    }, [projects]);

    useEffect(() => {
        if (taskAssigneeType === 'team') {
            setTaskAssigneeId(teams[0]?.id || '');
            return;
        }
        setTaskAssigneeId(members[0]?.user_id || '');
    }, [members, taskAssigneeType, teams]);

    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab && ['projects', 'tasks', 'forms', 'datasets', 'members', 'audience', 'analysis', 'threads', 'assets', 'reports', 'settings'].includes(tab)) {
            setActiveTab(tab);
            if (tab === 'members') {
                const section = searchParams.get('section');
                if (section === 'members' || section === 'teams' || section === 'roles') {
                    setMembersSubTab(section);
                } else {
                    setMembersSubTab('teams');
                }
            }
        }
    }, [searchParams]);

    const handleShellNavSelect = (key: 'projects' | 'tasks' | 'forms' | 'datasets' | 'members' | 'audience' | 'analysis' | 'threads' | 'assets' | 'reports' | 'settings') => {
        setActiveTab(key);
        if (key === 'members') {
            setMembersSubTab('teams');
        }
    };

    const handleCreateProject = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!projectName.trim()) return;

        try {
            await createProject(projectName, '');
            setProjectName('');
            setShowCreateProject(false);
        } catch (err) {
            alert('Failed to create project');
        }
    };

    const handleCreateFormSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!formProjectId) return;

        try {
            setSavingForm(true);
            const titleToUse = formTitle.trim() || 'New Form';
            const newForm = await formAPI.create(formProjectId, { title: titleToUse });
            setShowCreateForm(false);
            setFormTitle('');
            navigate(`/builder/${newForm.id}`);
        } catch (err) {
            alert('Failed to create form');
        } finally {
            setSavingForm(false);
        }
    };

    const handleCreateForm = async (projectId: string) => {
        try {
            const newForm = await formAPI.create(projectId, { title: 'New Form' });
            navigate(`/builder/${newForm.id}`);
        } catch (err) {
            alert('Failed to create form');
        }
    };

    const openProjectWorkspace = (project: typeof projects[number]) => {
        setCurrentProject(project);
        navigate(`/projects/${project.id}`);
    };

    const taskAssignableAccessors = taskAssigneeType === 'team'
        ? teams.map(team => ({ id: team.id, label: team.name }))
        : members.map(member => ({
            id: member.user_id,
            label: member.user?.full_name || member.user?.email || member.user?.phone || member.user_id,
        }));

    const refreshTasks = async () => {
        if (!currentOrg || projects.length === 0) {
            setTasks([]);
            return;
        }

        const allTasks = await Promise.all(
            projects.map(async project => {
                const projectTasks = await projectAPI.listTasks(currentOrg.id, project.id);
                return projectTasks.map((task: any) => ({
                    ...task,
                    project_name: project.name,
                }));
            })
        );

        setTasks(
            allTasks
                .flat()
                .sort((left, right) => {
                    const leftTime = new Date(left.due_at || left.updated_at).getTime();
                    const rightTime = new Date(right.due_at || right.updated_at).getTime();
                    return rightTime - leftTime;
                })
        );
    };

    const refreshReports = async () => {
        if (!currentOrg || projects.length === 0) {
            setReports([]);
            return;
        }

        const allReports = await Promise.all(
            projects.map(async project => {
                const projectReports = await reportAPI.list(currentOrg.id, project.id);
                return projectReports.map((report: any) => ({
                    ...report,
                    project_name: project.name,
                }));
            })
        );

        setReports(
            allReports
                .flat()
                .sort((left, right) => new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime())
        );
    };

    const handleCreateTask = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!currentOrg || !taskProjectId || !taskTitle.trim()) return;

        try {
            setSavingTask(true);
            await projectAPI.createTask(currentOrg.id, taskProjectId, {
                title: taskTitle.trim(),
                description: taskDescription.trim() || undefined,
                starts_at: taskStartsAt ? new Date(taskStartsAt).toISOString() : undefined,
                due_at: taskDueAt ? new Date(taskDueAt).toISOString() : undefined,
                assigned_accessor_id: taskAssigneeId || undefined,
                assigned_accessor_type: taskAssigneeId ? taskAssigneeType : undefined,
            });
            setTaskTitle('');
            setTaskDescription('');
            setTaskStartsAt('');
            setTaskDueAt('');
            await refreshTasks();
        } catch (err) {
            alert('Failed to create task');
        } finally {
            setSavingTask(false);
        }
    };

    const handleCreateReport = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!currentOrg || !reportProjectId || !reportTitle.trim()) return;

        try {
            setSavingReport(true);
            const created = await reportAPI.create(currentOrg.id, reportProjectId, {
                title: reportTitle.trim(),
                description: reportDescription.trim() || undefined,
            });
            setReportTitle('');
            setReportDescription('');
            await refreshReports();
            showToast('Report created', 'The report is ready to edit.', 'success');
            navigate(`/projects/${reportProjectId}/reports/${created.id}`);
        } catch (err: any) {
            showToast('Create failed', err?.response?.data?.detail || 'Failed to create report.', 'error');
        } finally {
            setSavingReport(false);
        }
    };

    return (
        <>
            <StudioLayout
                activeNav={activeTab as 'projects' | 'tasks' | 'forms' | 'datasets' | 'members' | 'audience' | 'analysis' | 'threads' | 'assets' | 'reports' | 'settings'}
                onSelectNav={handleShellNavSelect}
                counts={{ projects: projects.length, tasks: tasks.length, forms: forms.length, members: members?.length || 0 }}
                contentClassName="flex-1 overflow-y-auto p-10"
            >
                {organizations.length === 0 && !isLoading && (
                    <div className="mb-10 card border-dashed border-2">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-bold mb-1">Create your first organization</h2>
                                <p className="text-[hsl(var(--text-secondary))]">Organizations help you manage teams, projects, and forms.</p>
                            </div>
                            <button onClick={() => navigate('/welcome')} className="btn btn-primary">
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
                            <button
                                onClick={() => setShowCreateForm(true)}
                                className="flex items-center space-x-2 bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary-hover))] text-white font-semibold px-4 py-2.5 rounded-md shadow-lg shadow-black/10 transition-all"
                            >
                                <Plus className="w-4 h-4" />
                                <span>New Form</span>
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {forms.length === 0 ? (
                                <div className="col-span-full border-2 border-dashed border-[hsl(var(--border))] rounded-md p-12 text-center text-[hsl(var(--text-tertiary))]">
                                    <Activity className="w-12 h-12 mx-auto mb-4 opacity-20" />
                                    <p>No forms found. Create a project first.</p>
                                </div>
                            ) : (
                                forms.map(form => (
                                    <div
                                        key={form.id}
                                        className="bg-[hsl(var(--surface))] border border-[hsl(var(--border))] p-6 rounded-md hover:border-[hsl(var(--border-hover))] transition-all group cursor-pointer shadow-sm"
                                        onClick={() => navigate(`/builder/${form.id}`)}
                                    >
                                        <div className="flex justify-between items-start mb-6">
                                            <div className="p-3 bg-[hsl(var(--primary))]/10 rounded-md group-hover:bg-[hsl(var(--primary))]/20 transition-all">
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
                                <p className="text-[hsl(var(--text-secondary))]">Open a project workspace to manage its forms, teams, tasks, and reporting in one place.</p>
                            </div>
                            <button
                                onClick={() => setShowCreateProject(true)}
                                className="flex items-center space-x-2 bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary-hover))] text-white font-semibold px-6 py-3 rounded-md shadow-lg shadow-black/10 transition-all"
                            >
                                <Plus className="w-5 h-5" />
                                <span>Create Project</span>
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {projects.map(project => (
                                <div
                                    key={project.id}
                                    onClick={() => openProjectWorkspace(project)}
                                    className="bg-[hsl(var(--surface))] border border-[hsl(var(--border))] rounded-md overflow-hidden hover:border-[hsl(var(--border-hover))] transition-all shadow-sm flex flex-col cursor-pointer"
                                >
                                    <div className="p-8 flex-1 flex flex-col">
                                        <div className="flex justify-between items-start mb-4">
                                            <h3 className="text-xl font-bold">{project.name}</h3>
                                            <div
                                                className="p-2 bg-[hsl(var(--surface-elevated))] rounded-md"
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    openProjectWorkspace(project);
                                                }}
                                            >
                                                <Settings className="w-4 h-4 text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--text-primary))] cursor-pointer" />
                                            </div>
                                        </div>
                                        <p className="text-[hsl(var(--text-secondary))] text-sm mb-6 line-clamp-2">{project.description || 'No description provided.'}</p>

                                        {forms.filter(form => form.project_id === project.id).length > 0 && (
                                            <div className="space-y-3 mb-6">
                                                {forms.filter(form => form.project_id === project.id).map(form => (
                                                    <div
                                                        key={form.id}
                                                        onClick={() => navigate(`/builder/${form.id}`)}
                                                        className="flex items-center justify-between p-3 bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-md hover:border-[hsl(var(--primary))] transition-all cursor-pointer group"
                                                    >
                                                        <div className="flex items-center space-x-3 overflow-hidden">
                                                            <div className="p-2 bg-[hsl(var(--primary))]/10 rounded-md">
                                                                <FileText className="w-4 h-4 text-[hsl(var(--primary))]" />
                                                            </div>
                                                            <span className="text-sm font-semibold truncate">{form.title}</span>
                                                        </div>
                                                        <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-all">
                                                            <button
                                                                onClick={(event) => {
                                                                    event.stopPropagation();
                                                                    navigate(`/simulator/${form.id}`);
                                                                }}
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
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    handleCreateForm(project.id);
                                                }}
                                                className="w-full bg-[hsl(var(--surface-elevated))] hover:bg-[hsl(var(--primary))]/10 text-[hsl(var(--text-primary))] hover:text-[hsl(var(--primary))] font-semibold py-3 rounded-md border border-[hsl(var(--border))] hover:border-[hsl(var(--primary))]/30 transition-all flex items-center justify-center space-x-2"
                                            >
                                                <PlusCircle className="w-4 h-4" />
                                                <span>New Form</span>
                                            </button>
                                        </div>
                                    </div>
                                    <div className="bg-[hsl(var(--surface-elevated))] px-8 py-4 border-t border-[hsl(var(--border))] flex justify-between text-xs text-[hsl(var(--text-tertiary))]">
                                        <span>{forms.filter(form => form.project_id === project.id).length} Forms</span>
                                        <span>Created {new Date(project.created_at).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'tasks' && (
                    <div className="space-y-8">
                        <div className="flex justify-between items-end gap-6">
                            <div>
                                <h2 className="text-3xl font-bold mb-2">Tasks</h2>
                                <p className="text-[hsl(var(--text-secondary))]">Cross-project task overview. Create new tasks here and then manage execution from the relevant project workspace.</p>
                            </div>
                            <div className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--surface))] px-4 py-3 text-sm text-[hsl(var(--text-secondary))]">
                                {tasks.length} tracked across {projects.length} projects
                            </div>
                        </div>

                        <form onSubmit={handleCreateTask} className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--surface))] p-6 shadow-sm">
                            <div className="flex items-center justify-between gap-4">
                                <div>
                                    <h3 className="text-xl font-semibold">Create Task</h3>
                                    <p className="mt-1 text-sm text-[hsl(var(--text-secondary))]">Choose the project, then add the task details and timing from the main Tasks section.</p>
                                </div>
                            </div>

                            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                                <div>
                                    <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-[hsl(var(--text-tertiary))]">Project</label>
                                    <select
                                        value={taskProjectId}
                                        onChange={(event) => setTaskProjectId(event.target.value)}
                                        className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--surface-elevated))] px-4 py-3 text-sm"
                                    >
                                        {projects.map(project => (
                                            <option key={project.id} value={project.id}>{project.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-[hsl(var(--text-tertiary))]">Assign to type</label>
                                    <select
                                        value={taskAssigneeType}
                                        onChange={(event) => setTaskAssigneeType(event.target.value as 'user' | 'team')}
                                        className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--surface-elevated))] px-4 py-3 text-sm"
                                    >
                                        <option value="user">Member</option>
                                        <option value="team">Team</option>
                                    </select>
                                </div>

                                <div className="md:col-span-2">
                                    <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-[hsl(var(--text-tertiary))]">Task title</label>
                                    <input
                                        value={taskTitle}
                                        onChange={(event) => setTaskTitle(event.target.value)}
                                        className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--surface-elevated))] px-4 py-3 text-sm"
                                        placeholder="Coordinate briefing for field supervisors"
                                    />
                                </div>

                                <div className="md:col-span-2">
                                    <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-[hsl(var(--text-tertiary))]">Description</label>
                                    <textarea
                                        value={taskDescription}
                                        onChange={(event) => setTaskDescription(event.target.value)}
                                        className="min-h-[96px] w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--surface-elevated))] px-4 py-3 text-sm"
                                        placeholder="Capture the deliverable, owner notes, or dependency"
                                    />
                                </div>

                                <div>
                                    <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-[hsl(var(--text-tertiary))]">Starts</label>
                                    <input
                                        type="datetime-local"
                                        value={taskStartsAt}
                                        onChange={(event) => setTaskStartsAt(event.target.value)}
                                        className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--surface-elevated))] px-4 py-3 text-sm"
                                    />
                                </div>

                                <div>
                                    <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-[hsl(var(--text-tertiary))]">Due</label>
                                    <input
                                        type="datetime-local"
                                        value={taskDueAt}
                                        onChange={(event) => setTaskDueAt(event.target.value)}
                                        className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--surface-elevated))] px-4 py-3 text-sm"
                                    />
                                </div>

                                <div className="md:col-span-2">
                                    <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-[hsl(var(--text-tertiary))]">Assignee</label>
                                    <select
                                        value={taskAssigneeId}
                                        onChange={(event) => setTaskAssigneeId(event.target.value)}
                                        className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--surface-elevated))] px-4 py-3 text-sm"
                                    >
                                        <option value="">Unassigned</option>
                                        {taskAssignableAccessors.map(option => (
                                            <option key={option.id} value={option.id}>{option.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="mt-5 flex justify-end">
                                <button
                                    type="submit"
                                    disabled={savingTask || !taskProjectId || !taskTitle.trim()}
                                    className="inline-flex items-center gap-2 rounded-md bg-[hsl(var(--primary))] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-black/10 transition-all hover:bg-[hsl(var(--primary-hover))] disabled:opacity-60"
                                >
                                    <Plus className="h-4 w-4" />
                                    {savingTask ? 'Creating...' : 'Create Task'}
                                </button>
                            </div>
                        </form>

                        <div className="space-y-4">
                            {tasks.length === 0 ? (
                                <div className="rounded-md border-2 border-dashed border-[hsl(var(--border))] p-12 text-center text-[hsl(var(--text-tertiary))]">
                                    <CheckSquare className="mx-auto mb-4 h-12 w-12 opacity-20" />
                                    <p>No tasks found yet. Create the first one from this Tasks section.</p>
                                </div>
                            ) : tasks.map(task => (
                                <div key={task.id} className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--surface))] p-6 shadow-sm">
                                    <div className="flex flex-wrap items-start justify-between gap-4">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-3">
                                                <h3 className="text-lg font-semibold">{task.title}</h3>
                                                <span className={`inline-flex rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${taskTone[task.status]}`}>
                                                    {task.status.replace('_', ' ')}
                                                </span>
                                                <span className="inline-flex rounded-full bg-[hsl(var(--surface-elevated))] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[hsl(var(--text-tertiary))] border border-[hsl(var(--border))]">
                                                    {task.project_name}
                                                </span>
                                            </div>
                                            {task.description ? (
                                                <p className="mt-2 text-sm text-[hsl(var(--text-secondary))]">{task.description}</p>
                                            ) : null}
                                            <div className="mt-3 flex flex-wrap gap-4 text-xs text-[hsl(var(--text-tertiary))]">
                                                <span>Start: {task.starts_at ? new Date(task.starts_at).toLocaleString() : 'Not set'}</span>
                                                <span>Due: {task.due_at ? new Date(task.due_at).toLocaleString() : 'Not set'}</span>
                                                <span>Updated: {new Date(task.updated_at).toLocaleString()}</span>
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => {
                                                const project = projects.find(item => item.id === task.project_id);
                                                if (project) {
                                                    setCurrentProject(project);
                                                }
                                                navigate(`/projects/${task.project_id}`);
                                            }}
                                            className="inline-flex items-center gap-2 rounded-md border border-[hsl(var(--border))] px-4 py-2 text-sm font-semibold hover:bg-[hsl(var(--surface-elevated))]"
                                        >
                                            Open Project
                                            <ChevronRight className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'members' && currentOrg && (
                    <div className="space-y-8">
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

                        {membersSubTab === 'members' && <MembersManagement orgId={currentOrg.id} isAdmin={isAdmin} />}
                        {membersSubTab === 'teams' && <TeamsManagement orgId={currentOrg.id} isAdmin={isAdmin} />}
                        {membersSubTab === 'roles' && <RolesManagement orgId={currentOrg.id} isAdmin={isAdmin} />}
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

                {activeTab === 'analysis' && currentOrg && (
                    <Suspense fallback={<AnalyticsTabFallback />}>
                        <AnalyticsHub orgId={currentOrg.id} projectId={undefined} forms={forms} />
                    </Suspense>
                )}

                {activeTab === 'threads' && (
                    <div className="space-y-8">
                        <div className="flex justify-between items-end gap-6">
                            <div>
                                <h2 className="text-3xl font-bold mb-2">Threads</h2>
                                <p className="text-[hsl(var(--text-secondary))]">Project communication lanes for announcements, clarifications, and decision follow-up across teams.</p>
                            </div>
                            <div className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--surface))] px-4 py-3 text-sm text-[hsl(var(--text-secondary))]">
                                {threadItems.length} starter threads across {Math.max(projects.length, 1)} projects
                            </div>
                        </div>

                        <div className="grid gap-4 lg:grid-cols-2">
                            {threadItems.map(thread => (
                                <div key={thread.id} className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--surface))] p-6 shadow-sm">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]">
                                                    <MessageSquare className="h-5 w-5" />
                                                </div>
                                                <div>
                                                    <h3 className="text-lg font-semibold">{thread.title}</h3>
                                                    <p className="text-xs uppercase tracking-[0.18em] text-[hsl(var(--text-tertiary))]">{thread.project_name}</p>
                                                </div>
                                            </div>
                                            <p className="mt-4 text-sm text-[hsl(var(--text-secondary))]">{thread.summary}</p>
                                        </div>
                                        <span className="rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--surface-elevated))] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[hsl(var(--text-tertiary))]">
                                            {thread.reply_count} replies
                                        </span>
                                    </div>
                                    <div className="mt-4 rounded-md border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--surface-elevated))] px-4 py-3 text-sm text-[hsl(var(--text-secondary))]">
                                        Thread UI placeholder: header, message feed, composer, and @mentions will live here.
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'assets' && (
                    <div className="space-y-8">
                        <div className="flex justify-between items-end gap-6">
                            <div>
                                <h2 className="text-3xl font-bold mb-2">Assets</h2>
                                <p className="text-[hsl(var(--text-secondary))]">Project-ready files, links, images, and audio that field teams can reference without leaving their workflow.</p>
                            </div>
                            <div className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--surface))] px-4 py-3 text-sm text-[hsl(var(--text-secondary))]">
                                {assetItems.length} starter assets across {Math.max(projects.length, 1)} projects
                            </div>
                        </div>

                        <div className="grid gap-4 lg:grid-cols-2">
                            {assetItems.map(asset => (
                                <div key={asset.id} className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--surface))] p-6 shadow-sm">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]">
                                                    <Paperclip className="h-5 w-5" />
                                                </div>
                                                <div>
                                                    <h3 className="text-lg font-semibold">{asset.title}</h3>
                                                    <p className="text-xs uppercase tracking-[0.18em] text-[hsl(var(--text-tertiary))]">{asset.kind} • {asset.project_name}</p>
                                                </div>
                                            </div>
                                            <p className="mt-4 text-sm text-[hsl(var(--text-secondary))]">{asset.summary}</p>
                                        </div>
                                    </div>
                                    <div className="mt-4 rounded-md border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--surface-elevated))] px-4 py-3 text-sm text-[hsl(var(--text-secondary))]">
                                        Asset browser placeholder: uploads, links, previews, and field-ready references will land here.
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'reports' && (
                    <div className="space-y-8">
                        <div className="flex justify-between items-end gap-6">
                            <div>
                                <h2 className="text-3xl font-bold mb-2">Reports</h2>
                                <p className="text-[hsl(var(--text-secondary))]">Curated narrative outputs that package analytics, assets, and operational context for review, sharing, and decisions.</p>
                            </div>
                            <div className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--surface))] px-4 py-3 text-sm text-[hsl(var(--text-secondary))]">
                                {reports.length} saved across {projects.length} projects
                            </div>
                        </div>

                        <form onSubmit={handleCreateReport} className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--surface))] p-6 shadow-sm">
                            <div className="flex items-center justify-between gap-4">
                                <div>
                                    <h3 className="text-xl font-semibold">Create Report</h3>
                                    <p className="mt-1 text-sm text-[hsl(var(--text-secondary))]">Choose the project, create the report, then continue into the narrative canvas for linked artifacts, mentions, and publishing.</p>
                                </div>
                            </div>

                            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                                <div>
                                    <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-[hsl(var(--text-tertiary))]">Project</label>
                                    <select
                                        value={reportProjectId}
                                        onChange={(event) => setReportProjectId(event.target.value)}
                                        className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--surface-elevated))] px-4 py-3 text-sm"
                                    >
                                        {projects.map(project => (
                                            <option key={project.id} value={project.id}>{project.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-[hsl(var(--text-tertiary))]">Title</label>
                                    <input
                                        value={reportTitle}
                                        onChange={(event) => setReportTitle(event.target.value)}
                                        className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--surface-elevated))] px-4 py-3 text-sm"
                                        placeholder="Weekly field readout"
                                    />
                                </div>

                                <div className="md:col-span-2">
                                    <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-[hsl(var(--text-tertiary))]">Description</label>
                                    <textarea
                                        value={reportDescription}
                                        onChange={(event) => setReportDescription(event.target.value)}
                                        className="min-h-[96px] w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--surface-elevated))] px-4 py-3 text-sm"
                                        placeholder="What this report is meant to summarize and who it serves."
                                    />
                                </div>
                            </div>

                            <div className="mt-5 flex justify-end">
                                <button
                                    type="submit"
                                    disabled={savingReport || !reportProjectId || !reportTitle.trim()}
                                    className="inline-flex items-center gap-2 rounded-md bg-[hsl(var(--primary))] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-black/10 transition-all hover:bg-[hsl(var(--primary-hover))] disabled:opacity-60"
                                >
                                    <Plus className="h-4 w-4" />
                                    {savingReport ? 'Creating...' : 'Create Report'}
                                </button>
                            </div>
                        </form>

                        <div className="space-y-4">
                            {reports.length === 0 ? (
                                <div className="rounded-md border-2 border-dashed border-[hsl(var(--border))] p-12 text-center text-[hsl(var(--text-tertiary))]">
                                    <FileBarChart2 className="mx-auto mb-4 h-12 w-12 opacity-20" />
                                    <p>No reports found yet. Create the first one from this Reports section.</p>
                                </div>
                            ) : reports.map(report => (
                                <div key={report.id} className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--surface))] p-6 shadow-sm">
                                    <div className="flex flex-wrap items-start justify-between gap-4">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-3">
                                                <h3 className="text-lg font-semibold">{report.title}</h3>
                                                <span className="inline-flex rounded-full bg-[hsl(var(--surface-elevated))] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[hsl(var(--text-tertiary))] border border-[hsl(var(--border))]">
                                                    {report.status}
                                                </span>
                                                <span className="inline-flex rounded-full bg-[hsl(var(--surface-elevated))] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[hsl(var(--text-tertiary))] border border-[hsl(var(--border))]">
                                                    {report.project_name}
                                                </span>
                                            </div>
                                            {report.description ? (
                                                <p className="mt-2 text-sm text-[hsl(var(--text-secondary))]">{report.description}</p>
                                            ) : null}
                                            <div className="mt-3 flex flex-wrap gap-4 text-xs text-[hsl(var(--text-tertiary))]">
                                                <span>Updated: {new Date(report.updated_at).toLocaleString()}</span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={() => {
                                                    const project = projects.find(item => item.id === report.project_id);
                                                    if (project) {
                                                        setCurrentProject(project);
                                                    }
                                                    navigate(`/projects/${report.project_id}`);
                                                }}
                                                className="inline-flex items-center gap-2 rounded-md border border-[hsl(var(--border))] px-4 py-2 text-sm font-semibold hover:bg-[hsl(var(--surface-elevated))]"
                                            >
                                                Open Project
                                            </button>
                                            <button
                                                onClick={() => navigate(`/projects/${report.project_id}/reports/${report.id}`)}
                                                className="inline-flex items-center gap-2 rounded-md border border-[hsl(var(--border))] px-4 py-2 text-sm font-semibold hover:bg-[hsl(var(--surface-elevated))]"
                                            >
                                                Open Report
                                                <ChevronRight className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
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

            {showCreateProject && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-[hsl(var(--surface))] border border-[hsl(var(--border))] rounded-[32px] p-8 w-full max-w-md shadow-2xl">
                        <h2 className="text-2xl font-bold mb-6">Create New Project</h2>
                        <form onSubmit={handleCreateProject} className="space-y-6">
                            <div>
                                <label className="label">Project Name</label>
                                <input
                                    value={projectName}
                                    onChange={(event) => setProjectName(event.target.value)}
                                    className="input"
                                    placeholder="e.g. Q1 Customer Survey"
                                    autoFocus
                                />
                            </div>
                            <div className="flex space-x-3">
                                <button
                                    type="button"
                                    onClick={() => setShowCreateProject(false)}
                                    className="flex-1 px-6 py-3 rounded-md border border-[hsl(var(--border))] text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--surface-elevated))] transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary-hover))] text-white font-bold py-3 rounded-md shadow-lg shadow-black/10 transition-all"
                                >
                                    Create
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showCreateForm && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-[hsl(var(--surface))] border border-[hsl(var(--border))] rounded-[32px] p-8 w-full max-w-md shadow-2xl">
                        <h2 className="text-2xl font-bold mb-6">Create New Form</h2>
                        <form onSubmit={handleCreateFormSubmit} className="space-y-6">
                            <div>
                                <label className="label">Project</label>
                                <select
                                    value={formProjectId}
                                    onChange={(event) => setFormProjectId(event.target.value)}
                                    className="input"
                                    required
                                >
                                    {projects.length === 0 && <option value="" disabled>No projects available</option>}
                                    {projects.map(project => (
                                        <option key={project.id} value={project.id}>{project.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="label">Form Title</label>
                                <input
                                    value={formTitle}
                                    onChange={(event) => setFormTitle(event.target.value)}
                                    className="input"
                                    placeholder="e.g. Customer Satisfaction Survey"
                                    autoFocus
                                />
                            </div>
                            <div className="flex space-x-3 mt-8">
                                <button
                                    type="button"
                                    onClick={() => setShowCreateForm(false)}
                                    className="flex-1 px-6 py-3 rounded-md border border-[hsl(var(--border))] text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--surface-elevated))] transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={savingForm || projects.length === 0}
                                    className="flex-1 bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary-hover))] text-white font-bold py-3 rounded-md shadow-lg shadow-black/10 transition-all disabled:opacity-50 flex items-center justify-center"
                                >
                                    {savingForm ? 'Creating...' : 'Create Form'}
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
