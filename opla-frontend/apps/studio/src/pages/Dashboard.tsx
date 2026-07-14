import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useOrg } from '../contexts/OrgContext';
import { useToast } from '../contexts/ToastContext';
import { formAPI, projectAPI, reportAPI, teamAPI, analyticsAPI } from '../lib/api';
import StudioLayout from '../components/StudioLayout';
import MembersManagement from '../components/MembersManagement';
import TeamsManagement from '../components/TeamsManagement';
import RolesManagement from '../components/RolesManagement';
import DatasetsTab from '../components/DatasetsTab';
import type { AnalyticsSource } from '../components/analytics/types';
import {
    Plus, Settings, ChevronRight, ChevronLeft, PlusCircle, FileText, Activity, Play, CheckSquare, FileBarChart2, MessageSquare, Paperclip, Loader2, Database, Search, Folder, List, Grid, Sparkles
} from 'lucide-react';
import FontProfileSelector from '../components/FontProfileSelector';
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

type AnalyticsToolKey = 'lab' | 'prep' | 'dashboard';

const validDashboardTabs = ['projects', 'tasks', 'forms', 'datasets', 'members', 'audience', 'analysis', 'threads', 'assets', 'reports', 'settings'] as const;
const validAnalyticsTools: AnalyticsToolKey[] = ['lab', 'prep', 'dashboard'];

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
    const [activeAnalyticsTool, setActiveAnalyticsTool] = useState<AnalyticsToolKey>('lab');
    const [membersSubTab, setMembersSubTab] = useState<'members' | 'teams' | 'roles'>('members');
    const [formsSubTab, setFormsSubTab] = useState<'standard' | 'catalog'>('standard');

    const [forms, setForms] = useState<any[]>([]);
    const [formSearchQuery, setFormSearchQuery] = useState('');
    const [selectedProjectId, setSelectedProjectId] = useState('all');
    const [projectSearchQuery, setProjectSearchQuery] = useState('');
    const [formsViewMode, setFormsViewMode] = useState<'grid' | 'list'>('grid');
    const [formsPage, setFormsPage] = useState(1);
    const formsPageSize = 24;
    const [isCreatingFormInline, setIsCreatingFormInline] = useState(false);
    const [inlineFormTitle, setInlineFormTitle] = useState('');
    const [inlineFormProjectId, setInlineFormProjectId] = useState('');
    const [tasks, setTasks] = useState<DashboardTask[]>([]);
    const [reports, setReports] = useState<DashboardReport[]>([]);
    const [showCreateProject, setShowCreateProject] = useState(false);
    const [projectName, setProjectName] = useState('');
    const [savingForm, setSavingForm] = useState(false);
    const [teams, setTeams] = useState<{ id: string; name: string }[]>([]);
    const [taskProjectId, setTaskProjectId] = useState('');
    const [taskTitle, setTaskTitle] = useState('');
    const [taskDescription, setTaskDescription] = useState('');
    const [taskContextJson, setTaskContextJson] = useState('');
    const [taskStartsAt, setTaskStartsAt] = useState('');
    const [taskDueAt, setTaskDueAt] = useState('');
    const [taskAssigneeType, setTaskAssigneeType] = useState<'user' | 'team'>('user');
    const [taskAssigneeId, setTaskAssigneeId] = useState('');
    const [savingTask, setSavingTask] = useState(false);
    const [reportProjectId, setReportProjectId] = useState('');
    const [reportTitle, setReportTitle] = useState('');
    const [reportDescription, setReportDescription] = useState('');
    const [savingReport, setSavingReport] = useState(false);
    const [datasetSources, setDatasetSources] = useState<AnalyticsSource[]>([]);
    const [datasetsLoading, setDatasetsLoading] = useState(false);
    const [datasetsError, setDatasetsError] = useState<string | null>(null);

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

    const catalogFormSummaries = useMemo(
        () => forms
            .filter((form) => form.kind === 'catalog')
            .map((form) => ({
                id: form.id,
                title: form.title,
                project_id: form.project_id,
                project_name: form.project_name,
                status: form.status,
            })),
        [forms],
    );

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
                const allForms = await Promise.all(
                    projects.map(async project => {
                        const projectForms = await formAPI.list(project.id);
                        return projectForms.map((form: any) => ({
                            ...form,
                            project_name: project.name,
                        }));
                    })
                );
                setForms(allForms.flat());
            } catch (err) {
                console.error(err);
            }
        };

        fetchForms();
    }, [projects]);

    useEffect(() => {
        const fetchDatasets = async () => {
            if (!currentOrg) {
                setDatasetSources([]);
                return;
            }
            setDatasetsLoading(true);
            setDatasetsError(null);
            try {
                const sources = await analyticsAPI.listSources(currentOrg.id);
                setDatasetSources(Array.isArray(sources) ? sources : []);
            } catch (err: any) {
                console.error(err);
                setDatasetsError(err?.response?.data?.detail || err?.message || 'Failed to load datasets');
                setDatasetSources([]);
            } finally {
                setDatasetsLoading(false);
            }
        };

        fetchDatasets();
    }, [currentOrg]);

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
        setInlineFormProjectId(projects[0]?.id || '');
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
        if (tab && validDashboardTabs.includes(tab as typeof validDashboardTabs[number])) {
            setActiveTab(tab);
            if (tab === 'members') {
                const section = searchParams.get('section');
                if (section === 'members' || section === 'teams' || section === 'roles') {
                    setMembersSubTab(section);
                } else {
                    setMembersSubTab('teams');
                }
            }

            if (tab === 'analysis') {
                const tool = searchParams.get('tool');
                if (tool && validAnalyticsTools.includes(tool as AnalyticsToolKey)) {
                    setActiveAnalyticsTool(tool as AnalyticsToolKey);
                } else {
                    setActiveAnalyticsTool('lab');
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

    const handleAnalyticsToolSelect = (tool: AnalyticsToolKey) => {
        setActiveTab('analysis');
        setActiveAnalyticsTool(tool);
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

        let contextJson: Record<string, unknown> | undefined;
        if (taskContextJson.trim()) {
            try {
                const parsed = JSON.parse(taskContextJson);
                if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
                    alert('Task context must be a JSON object.');
                    return;
                }
                contextJson = parsed as Record<string, unknown>;
            } catch {
                alert('Task context must be valid JSON.');
                return;
            }
        }

        try {
            setSavingTask(true);
            await projectAPI.createTask(currentOrg.id, taskProjectId, {
                title: taskTitle.trim(),
                description: taskDescription.trim() || undefined,
                starts_at: taskStartsAt ? new Date(taskStartsAt).toISOString() : undefined,
                due_at: taskDueAt ? new Date(taskDueAt).toISOString() : undefined,
                context_json: contextJson,
                assigned_accessor_id: taskAssigneeId || undefined,
                assigned_accessor_type: taskAssigneeId ? taskAssigneeType : undefined,
            });
            setTaskTitle('');
            setTaskDescription('');
            setTaskContextJson('');
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

    useEffect(() => {
        setFormsPage(1);
    }, [selectedProjectId, formsSubTab, formSearchQuery]);

    const handleNewFormClick = (projectId?: string) => {
        if (projectId) {
            setSelectedProjectId(projectId);
            setInlineFormProjectId(projectId);
        }
        setIsCreatingFormInline(prev => !prev);
    };

    const handleInlineCreateSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        
        const projectToUse = selectedProjectId !== 'all' ? selectedProjectId : inlineFormProjectId;
        if (!projectToUse) {
            showToast('Select Project', 'Please select a project to create a form.', 'info');
            return;
        }

        if (!inlineFormTitle.trim()) {
            showToast('Enter Title', 'Please enter a title.', 'info');
            return;
        }

        try {
            setSavingForm(true);
            const kindToUse = formsSubTab === 'catalog' ? 'catalog' : 'standard';
            const newForm = await formAPI.create(projectToUse, {
                title: inlineFormTitle.trim(),
                kind: kindToUse,
            });
            showToast('Form Created', `Successfully created ${kindToUse === 'catalog' ? 'catalog' : 'form'}.`, 'success');
            setIsCreatingFormInline(false);
            setInlineFormTitle('');
            navigate(`/builder/${newForm.id}`);
        } catch (err) {
            console.error(err);
            showToast('Creation Failed', 'Failed to create form.', 'error');
        } finally {
            setSavingForm(false);
        }
    };

    useEffect(() => {
        setIsCreatingFormInline(false);
        setInlineFormTitle('');
        if (selectedProjectId !== 'all') {
            setInlineFormProjectId(selectedProjectId);
        } else if (projects.length > 0) {
            setInlineFormProjectId(projects[0].id);
        }
    }, [selectedProjectId, formsSubTab, projects]);

    const sidebarProjects = useMemo(() => {
        if (!projectSearchQuery.trim()) return projects;
        const query = projectSearchQuery.toLowerCase();
        return projects.filter(p => p.name.toLowerCase().includes(query) || p.description?.toLowerCase().includes(query));
    }, [projects, projectSearchQuery]);

    const filteredForms = useMemo(() => {
        return forms.filter(form => {
            // Tab filtering
            const matchesSubTab = formsSubTab === 'catalog' ? form.kind === 'catalog' : form.kind !== 'catalog';
            if (!matchesSubTab) return false;

            // Project filtering
            if (selectedProjectId !== 'all' && form.project_id !== selectedProjectId) return false;

            // Search query filtering
            if (formSearchQuery.trim()) {
                const query = formSearchQuery.toLowerCase();
                const matchesTitle = form.title?.toLowerCase().includes(query);
                const matchesSlug = form.slug?.toLowerCase().includes(query);
                const matchesProject = form.project_name?.toLowerCase().includes(query);
                if (!matchesTitle && !matchesSlug && !matchesProject) return false;
            }

            return true;
        });
    }, [forms, formsSubTab, selectedProjectId, formSearchQuery]);

    const paginatedForms = useMemo(() => {
        const start = (formsPage - 1) * formsPageSize;
        return filteredForms.slice(start, start + formsPageSize);
    }, [filteredForms, formsPage]);

    const totalFormsPages = useMemo(() => {
        return Math.ceil(filteredForms.length / formsPageSize);
    }, [filteredForms]);

    const renderFormCard = (form: any, showProjectBadge = false) => (
        <div
            key={form.id}
            className="bg-[hsl(var(--surface))] border border-[hsl(var(--border))] p-6 rounded-md hover:border-[hsl(var(--border-hover))] transition-all group cursor-pointer shadow-sm relative overflow-hidden flex flex-col justify-between"
            onClick={() => navigate(`/builder/${form.id}`)}
        >
            <div>
                <div className="flex justify-between items-start mb-4">
                    <div className={`p-3 rounded-md transition-all ${
                        formsSubTab === 'catalog'
                            ? 'bg-amber-500/10 text-amber-600 group-hover:bg-amber-500/20'
                            : 'bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] group-hover:bg-[hsl(var(--primary))]/20'
                    }`}>
                        {formsSubTab === 'catalog' ? (
                            <Database className="w-6 h-6" />
                        ) : (
                            <FileText className="w-6 h-6" />
                        )}
                    </div>
                    <div className="flex items-center gap-1.5">
                        {form.kind === 'catalog' && (
                            <span className="text-[8px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 border border-amber-500/20 select-none">
                                Catalog
                            </span>
                        )}
                        <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-lg ${form.status === 'live' ? 'bg-[hsl(var(--success))]/15 text-[hsl(var(--success))]' : 'bg-[hsl(var(--surface-elevated))] text-[hsl(var(--text-tertiary))]'}`}>
                            {form.status}
                        </span>
                    </div>
                </div>

                {showProjectBadge && form.project_name && (
                    <div className="flex items-center gap-1 text-[10px] font-semibold text-[hsl(var(--text-secondary))] mb-2 bg-[hsl(var(--surface-elevated))]/60 px-2 py-1 rounded w-fit border border-[hsl(var(--border))]/40">
                        <Folder className="w-3.5 h-3.5 text-[hsl(var(--primary))]" />
                        <span className="truncate max-w-[150px]">{form.project_name}</span>
                    </div>
                )}

                <h3 className="text-lg font-bold mb-1 group-hover:text-[hsl(var(--primary))] transition-colors">{form.title}</h3>
                <p className="text-xs text-[hsl(var(--text-tertiary))] mb-6">v{form.version} • Updated {new Date(form.updated_at).toLocaleDateString()}</p>
            </div>

            <div className="flex items-center text-[hsl(var(--primary))] text-sm font-semibold opacity-0 group-hover:opacity-100 transition-all mt-auto pt-2">
                <span>Open Builder</span>
                <ChevronRight className="w-4 h-4 ml-1" />
            </div>
        </div>
    );

    const renderFormsTable = (formsList: any[]) => (
        <div className="w-full overflow-x-auto border border-[hsl(var(--border))]/60 rounded-xl bg-[hsl(var(--surface))] shadow-sm">
            <table className="w-full border-collapse text-left text-sm">
                <thead>
                    <tr className="border-b border-[hsl(var(--border))]/60 bg-[hsl(var(--surface-elevated))]/50 text-xs font-semibold text-[hsl(var(--text-tertiary))] uppercase tracking-wider select-none">
                        <th className="px-6 py-4">Title</th>
                        <th className="px-6 py-4">Slug</th>
                        <th className="px-6 py-4">Version</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4">Updated</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-[hsl(var(--border))]/40">
                    {formsList.map(form => (
                        <tr 
                            key={form.id} 
                            className="hover:bg-[hsl(var(--surface-elevated))]/30 transition-colors cursor-pointer group"
                            onClick={() => navigate(`/builder/${form.id}`)}
                        >
                            <td className="px-6 py-4 font-semibold text-[hsl(var(--text-primary))]">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-md ${
                                        form.kind === 'catalog' 
                                            ? 'bg-amber-500/10 text-amber-600' 
                                            : 'bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]'
                                    }`}>
                                        {form.kind === 'catalog' ? <Database className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="group-hover:text-[hsl(var(--primary))] transition-colors">{form.title}</span>
                                        {form.project_name && (
                                            <span className="text-[10px] text-[hsl(var(--text-tertiary))] font-normal flex items-center gap-0.5 mt-0.5">
                                                <Folder className="w-3 h-3 shrink-0" />
                                                {form.project_name}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </td>
                            <td className="px-6 py-4 text-xs font-mono text-[hsl(var(--text-secondary))]">{form.slug}</td>
                            <td className="px-6 py-4 text-[hsl(var(--text-secondary))]">v{form.version}</td>
                            <td className="px-6 py-4">
                                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                    form.status === 'live' 
                                        ? 'bg-[hsl(var(--success))]/10 text-[hsl(var(--success))] border border-[hsl(var(--success))]/20' 
                                        : 'bg-[hsl(var(--surface-elevated))] text-[hsl(var(--text-tertiary))] border border-[hsl(var(--border))]/40'
                                }`}>
                                    {form.status}
                                </span>
                            </td>
                            <td className="px-6 py-4 text-[hsl(var(--text-secondary))]">{new Date(form.updated_at).toLocaleDateString()}</td>
                            <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center justify-end gap-2">
                                    <button 
                                        onClick={() => navigate(`/builder/${form.id}`)}
                                        className="text-xs font-semibold text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/10 px-3 py-1.5 rounded-lg border border-[hsl(var(--primary))]/20 transition-all"
                                    >
                                        Edit
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    return (
        <>
            <StudioLayout
                activeNav={activeTab as 'projects' | 'tasks' | 'forms' | 'datasets' | 'members' | 'audience' | 'analysis' | 'threads' | 'assets' | 'reports' | 'settings'}
                onSelectNav={handleShellNavSelect}
                activeAnalyticsTool={activeAnalyticsTool}
                onSelectAnalyticsTool={handleAnalyticsToolSelect}
                counts={{ projects: projects.length, tasks: tasks.length, forms: forms.length, datasets: datasetSources.length, members: members?.length || 0 }}
                contentClassName={
                    activeTab === 'forms'
                        ? 'flex-1 overflow-hidden flex'
                        : activeTab === 'analysis'
                            ? 'flex-1 overflow-y-auto p-4'
                            : 'flex-1 overflow-y-auto p-10'
                }
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
                    <div className="flex w-full h-[calc(100vh-64px)] overflow-hidden bg-[hsl(var(--background))] select-none">
                        {/* Projects Sidebar */}
                        <div className="w-80 border-r border-[hsl(var(--border))]/70 bg-[hsl(var(--surface))] flex flex-col shrink-0">
                            {/* Sidebar Header */}
                            <div className="h-16 px-6 border-b border-[hsl(var(--border))]/50 flex items-center justify-between shrink-0 bg-[hsl(var(--surface-elevated))]/20">
                                <h3 className="font-bold text-sm text-[hsl(var(--text-primary))] flex items-center gap-2">
                                    <Folder className="w-4 h-4 text-[hsl(var(--primary))]" />
                                    <span>Projects</span>
                                </h3>
                                <span className="text-[10px] font-bold bg-[hsl(var(--surface-elevated))] px-2 py-0.5 rounded-full border border-[hsl(var(--border))]/40 text-[hsl(var(--text-secondary))]">
                                    {projects.length}
                                </span>
                            </div>

                            {/* Sidebar Search */}
                            <div className="p-4 border-b border-[hsl(var(--border))]/30 bg-[hsl(var(--surface-elevated))]/10 shrink-0">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[hsl(var(--text-tertiary))]" />
                                    <input
                                        type="text"
                                        placeholder="Search projects..."
                                        value={projectSearchQuery}
                                        onChange={(e) => setProjectSearchQuery(e.target.value)}
                                        className="w-full bg-[hsl(var(--surface))] border border-[hsl(var(--border))] rounded-lg pl-9 pr-3 py-1.5 text-xs focus:outline-none focus:border-[hsl(var(--primary))] transition-colors"
                                    />
                                </div>
                            </div>

                            {/* Projects List */}
                            <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
                                <button
                                    onClick={() => setSelectedProjectId('all')}
                                    className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                                        selectedProjectId === 'all'
                                            ? 'bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] border border-[hsl(var(--primary))]/20'
                                            : 'text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] hover:bg-[hsl(var(--surface-elevated))]/50 border border-transparent'
                                    }`}
                                >
                                    <span className="truncate">All Projects</span>
                                    <span className="text-[10px] opacity-60">
                                        {forms.filter(f => formsSubTab === 'catalog' ? f.kind === 'catalog' : f.kind !== 'catalog').length}
                                    </span>
                                </button>

                                <div className="h-px bg-[hsl(var(--border))]/40 my-2" />

                                {sidebarProjects.map(project => {
                                    const count = forms.filter(f => f.project_id === project.id && (formsSubTab === 'catalog' ? f.kind === 'catalog' : f.kind !== 'catalog')).length;
                                    const isSelected = selectedProjectId === project.id;
                                    return (
                                        <button
                                            key={project.id}
                                            onClick={() => setSelectedProjectId(project.id)}
                                            className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg text-xs font-medium transition-all text-left ${
                                                isSelected
                                                    ? 'bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] border border-[hsl(var(--primary))]/20 font-semibold'
                                                    : 'text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] hover:bg-[hsl(var(--surface-elevated))]/50 border border-transparent'
                                            }`}
                                        >
                                            <span className="truncate pr-2">{project.name}</span>
                                            {count > 0 && (
                                                <span className="text-[9px] font-bold bg-[hsl(var(--surface-elevated))] px-1.5 py-0.5 rounded text-[hsl(var(--text-secondary))] border border-[hsl(var(--border))]/40 shrink-0">
                                                    {count}
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}

                                {sidebarProjects.length === 0 && (
                                    <div className="text-center py-6 text-xs text-[hsl(var(--text-tertiary))]">
                                        No projects found.
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Forms Main Workspace Area */}
                        <div className="flex-1 flex flex-col overflow-hidden">
                            {/* Workspace Header */}
                            <div className="h-16 px-8 border-b border-[hsl(var(--border))]/50 flex items-center justify-between shrink-0 bg-[hsl(var(--surface))]">
                                <div className="min-w-0">
                                    <h2 className="text-base font-bold text-[hsl(var(--text-primary))] flex items-center gap-2 truncate">
                                        {selectedProjectId === 'all' ? (
                                            'All Projects'
                                        ) : (
                                            projects.find(p => p.id === selectedProjectId)?.name || 'Project forms'
                                        )}
                                        <span className="text-xs font-normal text-[hsl(var(--text-tertiary))] bg-[hsl(var(--surface-elevated))] px-2 py-0.5 rounded border border-[hsl(var(--border))]/45">
                                            {filteredForms.length} {formsSubTab === 'catalog' ? 'Catalog' : 'Standard Forms'}
                                        </span>
                                    </h2>
                                </div>
                            </div>

                            {/* Filters Panel */}
                            <div className="px-8 py-3 border-b border-[hsl(var(--border))]/30 bg-[hsl(var(--surface-elevated))]/10 shrink-0 flex items-center justify-between gap-4">
                                {/* Left Subtabs */}
                                <div className="flex border-b border-[hsl(var(--border))]/30 gap-6 text-xs font-semibold select-none pb-px">
                                    <button
                                        onClick={() => setFormsSubTab('standard')}
                                        className={`pb-2.5 transition-all relative ${
                                            formsSubTab === 'standard'
                                                ? 'text-[hsl(var(--primary))] border-b-2 border-[hsl(var(--primary))] font-bold'
                                                : 'text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--text-primary))]'
                                        }`}
                                    >
                                        Standard
                                    </button>
                                    <button
                                        onClick={() => setFormsSubTab('catalog')}
                                        className={`pb-2.5 transition-all relative ${
                                            formsSubTab === 'catalog'
                                                ? 'text-[hsl(var(--primary))] border-b-2 border-[hsl(var(--primary))] font-bold'
                                                : 'text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--text-primary))]'
                                        }`}
                                    >
                                        Catalog
                                    </button>
                                </div>

                                {/* Right: Form Search, Add, and Layout Select */}
                                <div className="flex items-center gap-4">
                                    {/* Search forms */}
                                    <div className="relative w-56">
                                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[hsl(var(--text-tertiary))]" />
                                        <input
                                            type="text"
                                            placeholder="Search forms..."
                                            value={formSearchQuery}
                                            onChange={(e) => setFormSearchQuery(e.target.value)}
                                            className="w-full bg-[hsl(var(--surface))] border border-[hsl(var(--border))] rounded-lg pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:border-[hsl(var(--primary))] transition-colors"
                                        />
                                    </div>

                                    {/* Add Button */}
                                    <button
                                        onClick={() => handleNewFormClick()}
                                        className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all shrink-0 ${
                                            isCreatingFormInline
                                                ? 'bg-[hsl(var(--primary))]/10 border-[hsl(var(--primary))]/30 text-[hsl(var(--primary))] font-bold'
                                                : 'bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary-hover))] border-transparent text-white shadow-sm'
                                        }`}
                                    >
                                        <Plus className="w-3.5 h-3.5" />
                                        <span>Add {formsSubTab === 'catalog' ? 'Catalog' : 'Standard Form'}</span>
                                    </button>

                                    {/* Grid / List view toggle */}
                                    <div className="flex border border-[hsl(var(--border))] rounded-lg p-0.5 bg-[hsl(var(--surface))] text-xs shrink-0">
                                        <button
                                            onClick={() => setFormsViewMode('grid')}
                                            className={`p-1 rounded-md transition-all ${
                                                formsViewMode === 'grid'
                                                    ? 'bg-[hsl(var(--surface-elevated))] text-[hsl(var(--primary))] shadow-sm border border-[hsl(var(--border))]/40'
                                                    : 'text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] border border-transparent'
                                            }`}
                                            title="Grid View"
                                        >
                                            <Grid className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            onClick={() => setFormsViewMode('list')}
                                            className={`p-1 rounded-md transition-all ${
                                                formsViewMode === 'list'
                                                    ? 'bg-[hsl(var(--surface-elevated))] text-[hsl(var(--primary))] shadow-sm border border-[hsl(var(--border))]/40'
                                                    : 'text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] border border-transparent'
                                            }`}
                                            title="List View"
                                        >
                                            <List className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Inline Create Form Section */}
                            {isCreatingFormInline && (
                                <div className="px-8 py-5 border-b border-[hsl(var(--border))]/40 bg-[hsl(var(--surface-elevated))]/20 flex flex-col gap-3 shrink-0 animate-in slide-in-from-top duration-150">
                                    <h3 className="text-xs font-bold text-[hsl(var(--text-primary))]">
                                        Create New {formsSubTab === 'catalog' ? 'Catalog' : 'Standard Form'}
                                    </h3>
                                    <form onSubmit={handleInlineCreateSubmit} className="flex flex-col md:flex-row items-end gap-4">
                                        {selectedProjectId === 'all' && (
                                            <div className="w-full md:w-60 flex flex-col gap-1">
                                                <label className="text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--text-secondary))]">Project</label>
                                                <select
                                                    value={inlineFormProjectId}
                                                    onChange={(e) => setInlineFormProjectId(e.target.value)}
                                                    className="w-full bg-[hsl(var(--surface))] border border-[hsl(var(--border))] rounded-lg px-3 py-1.5 text-xs text-[hsl(var(--text-primary))] focus:outline-none focus:border-[hsl(var(--primary))]"
                                                    required
                                                >
                                                    <option value="" disabled>Select project...</option>
                                                    {projects.map(p => (
                                                        <option key={p.id} value={p.id}>{p.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}

                                        <div className="flex-1 flex flex-col gap-1 w-full">
                                            <label className="text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--text-secondary))]">
                                                {formsSubTab === 'catalog' ? 'Catalog Title' : 'Standard Form Title'}
                                            </label>
                                            <input
                                                type="text"
                                                value={inlineFormTitle}
                                                onChange={(e) => setInlineFormTitle(e.target.value)}
                                                placeholder={formsSubTab === 'catalog' ? "e.g. Parts Catalog" : "e.g. Customer Feedback"}
                                                className="w-full bg-[hsl(var(--surface))] border border-[hsl(var(--border))] rounded-lg px-3 py-1.5 text-xs text-[hsl(var(--text-primary))] focus:outline-none focus:border-[hsl(var(--primary))]"
                                                required
                                                autoFocus
                                            />
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0 w-full md:w-auto justify-end">
                                            {formsSubTab !== 'catalog' ? (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const projectToUse = selectedProjectId === 'all' ? inlineFormProjectId : selectedProjectId;
                                                        if (!projectToUse) return;
                                                        setIsCreatingFormInline(false);
                                                        setInlineFormTitle('');
                                                        navigate(`/projects/${projectToUse}/ai-survey`);
                                                    }}
                                                    disabled={selectedProjectId === 'all' && !inlineFormProjectId}
                                                    className="inline-flex items-center gap-1.5 px-4 py-1.5 border border-[hsl(var(--border))] rounded-lg text-xs font-semibold text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--surface-elevated))] transition-colors disabled:opacity-50"
                                                >
                                                    <Sparkles className="w-3.5 h-3.5 text-[hsl(var(--primary))]" />
                                                    Create with AI
                                                </button>
                                            ) : null}
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setIsCreatingFormInline(false);
                                                    setInlineFormTitle('');
                                                }}
                                                className="px-4 py-1.5 border border-[hsl(var(--border))] rounded-lg text-xs font-semibold text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--surface-elevated))] transition-colors"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="submit"
                                                disabled={savingForm || (selectedProjectId === 'all' && !inlineFormProjectId)}
                                                className="bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary-hover))] text-white px-4 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
                                            >
                                                {savingForm ? 'Creating...' : 'Create & Open'}
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            )}

                            {/* Scrollable Main content */}
                            <div className="flex-1 overflow-y-auto p-8 flex flex-col justify-between">
                                <div className="space-y-6">
                                    {paginatedForms.length === 0 ? (
                                        <div className="border border-dashed border-[hsl(var(--border))] rounded-xl p-12 text-center text-[hsl(var(--text-tertiary))] bg-[hsl(var(--surface))] max-w-xl mx-auto mt-12">
                                            <Activity className="w-10 h-10 mx-auto mb-4 opacity-20" />
                                            <h4 className="font-bold text-sm text-[hsl(var(--text-primary))] mb-1">No forms found</h4>
                                            <p className="text-xs mb-4">Try adjusting your filters, or click Add to start building.</p>
                                            {selectedProjectId !== 'all' && (
                                                <button
                                                    onClick={() => handleNewFormClick()}
                                                    className="bg-[hsl(var(--primary))]/10 hover:bg-[hsl(var(--primary))]/15 text-[hsl(var(--primary))] text-xs font-semibold px-4 py-2 rounded-lg border border-[hsl(var(--primary))]/20 transition-all"
                                                >
                                                    Create your first form
                                                </button>
                                            )}
                                        </div>
                                    ) : formsViewMode === 'grid' ? (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                            {paginatedForms.map(form => renderFormCard(form, selectedProjectId === 'all'))}
                                        </div>
                                    ) : (
                                        renderFormsTable(paginatedForms)
                                    )}
                                </div>

                                {/* Pagination Controls */}
                                {totalFormsPages > 1 && (
                                    <div className="mt-8 pt-4 border-t border-[hsl(var(--border))]/30 flex items-center justify-between text-xs shrink-0 select-none">
                                        <span className="text-[hsl(var(--text-secondary))] font-medium">
                                            Showing <span className="font-semibold text-[hsl(var(--text-primary))]">{(formsPage - 1) * formsPageSize + 1}</span> to <span className="font-semibold text-[hsl(var(--text-primary))]">{Math.min(formsPage * formsPageSize, filteredForms.length)}</span> of <span className="font-semibold text-[hsl(var(--text-primary))]">{filteredForms.length}</span> {formsSubTab === 'catalog' ? 'catalog' : 'standard forms'}
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <button
                                                disabled={formsPage <= 1}
                                                onClick={() => setFormsPage(prev => Math.max(1, prev - 1))}
                                                className="p-1.5 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface))] text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--surface-elevated))] hover:text-[hsl(var(--text-primary))] disabled:opacity-40 disabled:hover:bg-[hsl(var(--surface))] disabled:hover:text-[hsl(var(--text-secondary))] transition-all"
                                            >
                                                <ChevronLeft className="w-4 h-4" />
                                            </button>
                                            <span className="text-[hsl(var(--text-secondary))] font-medium">
                                                Page <span className="font-semibold text-[hsl(var(--text-primary))]">{formsPage}</span> of <span className="font-semibold text-[hsl(var(--text-primary))]">{totalFormsPages}</span>
                                            </span>
                                            <button
                                                disabled={formsPage >= totalFormsPages}
                                                onClick={() => setFormsPage(prev => Math.min(totalFormsPages, prev + 1))}
                                                className="p-1.5 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface))] text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--surface-elevated))] hover:text-[hsl(var(--text-primary))] disabled:opacity-40 disabled:hover:bg-[hsl(var(--surface))] disabled:hover:text-[hsl(var(--text-secondary))] transition-all"
                                            >
                                                <ChevronRight className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
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

                        <button
                            type="button"
                            onClick={() => navigate('/pdemo')}
                            className="w-full text-left rounded-2xl border border-[hsl(var(--primary))]/30 bg-[hsl(var(--primary))]/8 px-5 py-4 hover:bg-[hsl(var(--primary))]/12 transition-colors"
                        >
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                    <p className="text-sm font-bold text-[hsl(var(--text-primary))]">
                                        PDemo — Project Command Centre
                                    </p>
                                    <p className="mt-1 text-xs text-[hsl(var(--text-secondary))]">
                                        Mock read-only home: KPIs, hub assets, progress, gallery, map, catalogs, activity feed.
                                    </p>
                                </div>
                                <span className="inline-flex items-center gap-1 text-xs font-semibold text-[hsl(var(--primary))]">
                                    Open prototype
                                    <ChevronRight className="w-4 h-4" />
                                </span>
                            </div>
                        </button>

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

                                        <div className="mt-auto space-y-2">
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
                                            <button
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    navigate(`/projects/${project.id}/ai-survey`);
                                                }}
                                                className="w-full bg-[hsl(var(--surface-elevated))] hover:bg-[hsl(var(--primary))]/10 text-[hsl(var(--text-primary))] hover:text-[hsl(var(--primary))] font-semibold py-2.5 rounded-md border border-[hsl(var(--border))] hover:border-[hsl(var(--primary))]/30 transition-all flex items-center justify-center space-x-2 text-sm"
                                            >
                                                <Sparkles className="w-4 h-4 text-[hsl(var(--primary))]" />
                                                <span>Create with AI</span>
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

                                <div className="md:col-span-2">
                                    <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-[hsl(var(--text-tertiary))]">Task Context (JSON)</label>
                                    <textarea
                                        value={taskContextJson}
                                        onChange={(event) => setTaskContextJson(event.target.value)}
                                        className="min-h-[96px] w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--surface-elevated))] px-4 py-3 font-mono text-sm"
                                        placeholder={"{\n  \"source_record_label\": \"Outlet 14\",\n  \"location_label\": \"Tema cluster\"\n}"}
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
                        <AnalyticsHub orgId={currentOrg.id} projectId={undefined} forms={forms} activeTool={activeAnalyticsTool} />
                    </Suspense>
                )}

                {activeTab === 'datasets' && (
                    <DatasetsTab
                        sources={datasetSources}
                        catalogForms={catalogFormSummaries}
                        loading={datasetsLoading}
                        error={datasetsError}
                        projects={projects}
                    />
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
                    <div className="space-y-8 max-w-4xl">
                        <div>
                            <h2 className="text-3xl font-bold mb-2">Organization Settings</h2>
                            <p className="text-[hsl(var(--text-secondary))]">Manage organization-level preferences, branding, and governance options.</p>
                        </div>
                        <div className="card">
                            <div className="space-y-8">
                                <FontProfileSelector />
                                <div className="border-t border-[hsl(var(--border))] pt-6">
                                    <h4 className="text-sm font-bold mb-1 text-[hsl(var(--text-primary))]">Governance Policies</h4>
                                    <p className="text-xs text-[hsl(var(--text-secondary))]">Default workflows, team invite permissions, and organization-wide data retention schedules will be managed here.</p>
                                </div>
                            </div>
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
        </>
    );
};

export default Dashboard;
