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
import ProjectsPortfolio from '../components/projects/ProjectsPortfolio';
import InboxHub from '../components/inbox/InboxHub';
import ReportsPortfolio from '../components/reports/ReportsPortfolio';
import { useInboxAttention } from '../components/inbox/useInboxAttention';
import type { AnalyticsSource } from '../components/analytics/types';
import {
    Plus, ChevronRight, ChevronLeft, FileText, Activity, CheckSquare, FileBarChart2, MessageSquare, Paperclip, Loader2, Database, Search, Folder, List, Grid, Sparkles
} from 'lucide-react';
import FontProfileSelector from '../components/FontProfileSelector';
import { resolveLegacyDashboardTab, resolveDataSection, resolveDesignSection, buildDashboardSearchParams, type DashboardNavKey as VocabularyDashboardNavKey, type ProjectDataSection, type ProjectDesignSection } from '../lib/vocabulary';

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

type DashboardMediaItem = {
    id: string;
    project_id: string;
    project_name: string;
    title: string;
    kind: 'document' | 'image' | 'audio' | 'link';
    summary: string;
    updated_at: string;
};

type AnalyticsToolKey = 'lab' | 'prep' | 'dashboard' | 'spatial';

const validDashboardTabs = ['projects', 'ops', 'tasks', 'design', 'data', 'members', 'audience', 'messages', 'assets', 'reports', 'settings', 'forms', 'datasets', 'analysis', 'threads'] as const;
type DashboardNavKey = VocabularyDashboardNavKey;
const validAnalyticsTools: AnalyticsToolKey[] = ['lab', 'prep', 'dashboard', 'spatial'];

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
    const [searchParams, setSearchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState<DashboardNavKey>('inbox');
    const [activeAnalyticsTool, setActiveAnalyticsTool] = useState<AnalyticsToolKey>('lab');
    const [dataSection, setDataSection] = useState<ProjectDataSection>('datasets');
    const [membersSubTab, setMembersSubTab] = useState<'members' | 'teams' | 'roles'>('members');
    const [designSection, setDesignSection] = useState<ProjectDesignSection>('forms');

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
    const [projectCollectionStart, setProjectCollectionStart] = useState('');
    const [projectCollectionEnd, setProjectCollectionEnd] = useState('');
    const [projectTimeStart, setProjectTimeStart] = useState('09:00');
    const [projectTimeEnd, setProjectTimeEnd] = useState('17:00');
    const [projectExpectedTotal, setProjectExpectedTotal] = useState('');
    const [projectExpectedWeekly, setProjectExpectedWeekly] = useState('1');
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
    const [messageItems, setMessageItems] = useState<DashboardThread[]>([]);
    const [messagesLoading, setMessagesLoading] = useState(false);

    useEffect(() => {
        const fetchThreads = async () => {
            if (!currentOrg || projects.length === 0 || activeTab !== 'messages') {
                if (activeTab !== 'messages') return;
                setMessageItems([]);
                return;
            }
            setMessagesLoading(true);
            try {
                const batches = await Promise.all(
                    projects.map(async (project) => {
                        try {
                            const rows = await projectAPI.listMessages(currentOrg.id, project.id);
                            return (Array.isArray(rows) ? rows : []).map((thread: any) => ({
                                id: thread.id,
                                project_id: project.id,
                                project_name: project.name,
                                title: thread.title,
                                summary: thread.summary || '',
                                updated_at: thread.updated_at,
                                reply_count: thread.reply_count || 0,
                            }));
                        } catch {
                            return [];
                        }
                    }),
                );
                setMessageItems(
                    batches
                        .flat()
                        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()),
                );
            } catch (err) {
                console.error(err);
                setMessageItems([]);
            } finally {
                setMessagesLoading(false);
            }
        };
        void fetchThreads();
    }, [activeTab, currentOrg, projects]);

    const mediaItems = useMemo<DashboardMediaItem[]>(() => {
        const primaryProject = projects[0];
        const secondaryProject = projects[1] || primaryProject;

        return [
            {
                id: 'media-consent-script',
                project_id: primaryProject?.id || 'mock-project-1',
                project_name: primaryProject?.name || 'Market Entry Survey',
                title: 'Enumerator consent script',
                kind: 'document',
                summary: 'Reference script for in-field consent, opening prompts, and escalation language.',
                updated_at: new Date().toISOString(),
            },
            {
                id: 'media-brand-audio',
                project_id: secondaryProject?.id || 'mock-project-2',
                project_name: secondaryProject?.name || 'Retail Audit',
                title: 'Brand audio prompt',
                kind: 'audio',
                summary: 'Audio clip used during assisted interviews when brand recall needs playback.',
                updated_at: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
            },
        ];
    }, [projects]);

    const directoryFormSummaries = useMemo(
        () => forms
            .filter((form) => form.kind === 'directory')
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
        const section = searchParams.get('section');
        const view = searchParams.get('view');
        const tool = searchParams.get('tool');

        if (!tab) {
            setSearchParams(() => buildDashboardSearchParams('inbox'), { replace: true });
            return;
        }

        const legacyTabs = new Set(['forms', 'threads', 'assets', 'datasets', 'analysis']);
        if (legacyTabs.has(tab)) {
            const resolved = resolveLegacyDashboardTab(tab);
            const params = buildDashboardSearchParams(
                resolved,
                tab === 'assets'
                    ? { section: 'media' }
                    : tab === 'datasets'
                        ? { section: 'datasets' }
                        : tab === 'analysis'
                            ? { section: 'analysis', tool: tool || 'lab' }
                            : undefined,
            );
            setSearchParams(() => params, { replace: true });
            return;
        }

        // Legacy org Ops → Inbox (Ops lives under projects only)
        if (tab === 'ops') {
            if (view === 'tasks') {
                setSearchParams(() => buildDashboardSearchParams('tasks'), { replace: true });
                return;
            }
            setSearchParams(() => buildDashboardSearchParams('inbox'), { replace: true });
            return;
        }

        if (tab === 'members' && !section) {
            setSearchParams(() => buildDashboardSearchParams('members', { section: 'teams' }), { replace: true });
            return;
        }

        if (tab === 'data' && !section) {
            setSearchParams(() => buildDashboardSearchParams('data', { section: 'datasets' }), { replace: true });
            return;
        }

        if (tab === 'data' && section === 'analysis' && !tool) {
            setSearchParams(() => buildDashboardSearchParams('data', { section: 'analysis', tool: 'lab' }), { replace: true });
            return;
        }

        if (tab === 'design' && !section) {
            setSearchParams(() => buildDashboardSearchParams('design', { section: 'forms' }), { replace: true });
            return;
        }

        // Directory lives under Data — redirect legacy Design > Directory links
        if (tab === 'design' && section === 'directory') {
            setSearchParams(() => buildDashboardSearchParams('data', { section: 'directory' }), { replace: true });
            return;
        }

        const resolved = resolveLegacyDashboardTab(tab);
        setActiveTab(resolved);
        if (resolved === 'members') {
            if (section === 'members' || section === 'teams' || section === 'roles') {
                setMembersSubTab(section);
            } else {
                setMembersSubTab('teams');
            }
        }
        if (resolved === 'design') {
            setDesignSection(resolveDesignSection(section));
        }
        if (resolved === 'data') {
            const dataSectionResolved = resolveDataSection(tab, section);
            setDataSection(dataSectionResolved);
            if (dataSectionResolved === 'analysis' || tab === 'analysis' || tool) {
                if (tool && validAnalyticsTools.includes(tool as AnalyticsToolKey)) {
                    setActiveAnalyticsTool(tool as AnalyticsToolKey);
                } else {
                    setActiveAnalyticsTool('lab');
                }
            }
        }
    }, [searchParams, setSearchParams]);

    const navigateDashboardTab = (
        key: DashboardNavKey,
        options?: {
            section?: 'members' | 'teams' | 'roles' | ProjectDataSection | ProjectDesignSection;
            tool?: AnalyticsToolKey;
        },
    ) => {
        setActiveTab(key === 'ops' ? 'inbox' : key);
        if (key === 'members') {
            const membersSection = (options?.section as 'members' | 'teams' | 'roles') || 'teams';
            setMembersSubTab(membersSection);
        }
        if (key === 'design') {
            setDesignSection((options?.section as ProjectDesignSection) || 'forms');
        }
        if (key === 'data') {
            const nextDataSection = (options?.section as ProjectDataSection) || 'datasets';
            setDataSection(nextDataSection);
            if (nextDataSection === 'analysis') {
                setActiveAnalyticsTool(options?.tool || activeAnalyticsTool);
            }
        }
        setSearchParams(
            () => buildDashboardSearchParams(key === 'ops' ? 'inbox' : key, {
                section: options?.section,
                tool: options?.tool || (options?.section === 'analysis' ? activeAnalyticsTool : undefined),
            }),
            { replace: true },
        );
    };

    const handleShellNavSelect = (key: DashboardNavKey) => {
        if (key === 'inbox' || key === 'ops') {
            navigateDashboardTab('inbox');
            return;
        }
        if (key === 'reports') {
            navigateDashboardTab('reports');
            return;
        }
        if (key === 'tasks') {
            navigateDashboardTab('tasks');
            return;
        }
        if (key === 'members') {
            navigateDashboardTab('members', { section: 'teams' });
            return;
        }
        if (key === 'design') {
            navigateDashboardTab('design', { section: 'forms' });
            return;
        }
        if (key === 'data') {
            navigateDashboardTab('data', { section: 'datasets' });
            return;
        }
        navigateDashboardTab(key);
    };

    const handleCreateProject = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!projectName.trim() || !projectCollectionStart || !projectCollectionEnd) return;
        const total = projectExpectedTotal.trim() ? Number(projectExpectedTotal) : null;
        const weekly = projectExpectedWeekly.trim() ? Number(projectExpectedWeekly) : null;
        if (!((total != null && total >= 1) || (weekly != null && weekly >= 1))) {
            alert('Set at least one expected target (total or weekly) to 1 or more.');
            return;
        }

        try {
            const created = await createProject({
                name: projectName.trim(),
                description: '',
                collection_start_date: projectCollectionStart,
                collection_end_date: projectCollectionEnd,
                collection_time_start: `${projectTimeStart}:00`,
                collection_time_end: `${projectTimeEnd}:00`,
                expected_total_count: total,
                expected_weekly_count: weekly,
            });
            setProjectName('');
            setProjectCollectionStart('');
            setProjectCollectionEnd('');
            setProjectTimeStart('09:00');
            setProjectTimeEnd('17:00');
            setProjectExpectedTotal('');
            setProjectExpectedWeekly('1');
            setShowCreateProject(false);
            navigate(`/projects/${created.id}/hub`);
        } catch (err) {
            alert('Failed to create project');
        }
    };



    const handleCreateForm = async (projectId: string) => {
        try {
            const newForm = await formAPI.create(projectId, { title: 'New Form' });
            navigate(`/forms/${newForm.id}`);
        } catch (err) {
            alert('Failed to create form');
        }
    };

    const openProjectWorkspace = (project: typeof projects[number]) => {
        setCurrentProject(project);
        navigate(`/projects/${project.id}`);
    };

    const openProjectHub = (project: typeof projects[number]) => {
        setCurrentProject(project);
        navigate(`/projects/${project.id}/hub`);
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
    }, [selectedProjectId, designSection, formSearchQuery]);

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
            const kindToUse = 'standard';
            const newForm = await formAPI.create(projectToUse, {
                title: inlineFormTitle.trim(),
                kind: kindToUse,
            });
            showToast('Form Created', `Successfully created ${kindToUse === 'directory' ? 'directory' : 'form'}.`, 'success');
            setIsCreatingFormInline(false);
            setInlineFormTitle('');
            navigate(`/forms/${newForm.id}`);
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
    }, [selectedProjectId, designSection, projects]);

    const sidebarProjects = useMemo(() => {
        if (!projectSearchQuery.trim()) return projects;
        const query = projectSearchQuery.toLowerCase();
        return projects.filter(p => p.name.toLowerCase().includes(query) || p.description?.toLowerCase().includes(query));
    }, [projects, projectSearchQuery]);

    const filteredForms = useMemo(() => {
        return forms.filter(form => {
            // Tab filtering
            const matchesSubTab = form.kind !== 'directory';
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
    }, [forms, designSection, selectedProjectId, formSearchQuery]);

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
            onClick={() => navigate(`/forms/${form.id}`)}
        >
            <div>
                <div className="flex justify-between items-start mb-4">
                    <div className="p-3 rounded-md transition-all bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] group-hover:bg-[hsl(var(--primary))]/20">
                        <FileText className="w-6 h-6" />
                    </div>
                    <div className="flex items-center gap-1.5">
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
                <span>Open form</span>
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
                            onClick={() => navigate(`/forms/${form.id}`)}
                        >
                            <td className="px-6 py-4 font-semibold text-[hsl(var(--text-primary))]">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-md ${
                                        form.kind === 'directory' 
                                            ? 'bg-amber-500/10 text-amber-600' 
                                            : 'bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]'
                                    }`}>
                                        {form.kind === 'directory' ? <Database className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
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
                                        onClick={() => navigate(`/forms/${form.id}`)}
                                        className="text-xs font-semibold text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/10 px-3 py-1.5 rounded-lg border border-[hsl(var(--primary))]/20 transition-all"
                                    >
                                        Open
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    const inboxProjects = useMemo(
        () => projects.map((project) => ({
            id: project.id,
            name: project.name,
            status: project.status,
        })),
        [projects],
    );
    const inboxTasks = useMemo(
        () => tasks.map((task) => ({
            id: task.id,
            project_id: task.project_id,
            status: task.status,
        })),
        [tasks],
    );
    const { loading: inboxLoading, totals: inboxTotals, attentionItems, attentionCount } = useInboxAttention(
        currentOrg?.id,
        inboxProjects,
        inboxTasks,
    );

    return (
        <>
            <StudioLayout
                navMode="org"
                activeNav={(
                    activeTab === 'inbox'
                    || activeTab === 'projects'
                    || activeTab === 'reports'
                    || activeTab === 'members'
                    || activeTab === 'audience'
                    || activeTab === 'settings'
                ) ? activeTab : 'inbox'}
                onSelectNav={(key) => {
                    if (key === 'inbox' || key === 'ops') {
                        navigateDashboardTab('inbox');
                        return;
                    }
                    if (key === 'reports') {
                        navigateDashboardTab('reports');
                        return;
                    }
                    if (key === 'hub' || key === 'tasks' || key === 'design' || key === 'data' || key === 'messages') {
                        navigateDashboardTab('inbox');
                        return;
                    }
                    handleShellNavSelect(key as DashboardNavKey);
                }}
                onOpenInbox={() => navigateDashboardTab('inbox')}
                counts={{ projects: projects.length, members: members?.length || 0, inbox: attentionCount }}
                contentClassName={
                    activeTab === 'design' && designSection !== 'automations'
                        ? 'flex-1 overflow-hidden flex'
                        : activeTab === 'data' && activeAnalyticsTool === 'spatial'
                            ? 'flex-1 overflow-hidden p-0'
                            : activeTab === 'data'
                                ? 'flex-1 overflow-y-auto p-4'
                                : activeTab === 'projects' || activeTab === 'inbox' || activeTab === 'reports'
                                    ? 'flex-1 overflow-y-auto p-6'
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

                {activeTab === 'design' && designSection === 'automations' && (
                    <div className="space-y-6">
                        <div>
                            <h2 className="text-3xl font-bold mb-2">Automations</h2>
                            <p className="text-[hsl(var(--text-secondary))]">
                                Configure submission rules that create tasks or Needs Attention alerts. Open a project to design automations for its forms.
                            </p>
                        </div>
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                            {projects.length === 0 ? (
                                <div className="col-span-full rounded-md border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--surface))] p-8 text-center text-sm text-[hsl(var(--text-secondary))]">
                                    Create a project first to configure automations.
                                </div>
                            ) : (
                                projects.map((project) => (
                                    <button
                                        key={project.id}
                                        type="button"
                                        onClick={() => {
                                            setCurrentProject(project);
                                            navigate(`/projects/${project.id}?tab=design&section=automations`);
                                        }}
                                        className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--surface))] p-5 text-left shadow-sm transition hover:border-[hsl(var(--primary))]/40"
                                    >
                                        <p className="text-base font-semibold text-[hsl(var(--text-primary))]">{project.name}</p>
                                        <p className="mt-1 text-xs text-[hsl(var(--text-tertiary))]">
                                            {forms.filter((form) => form.project_id === project.id && form.kind !== 'directory').length} forms
                                        </p>
                                        <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-[hsl(var(--primary))]">
                                            Open automations
                                            <ChevronRight className="h-3.5 w-3.5" />
                                        </span>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'design' && designSection !== 'automations' && (
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
                                        {forms.filter(f => f.kind !== 'directory').length}
                                    </span>
                                </button>

                                <div className="h-px bg-[hsl(var(--border))]/40 my-2" />

                                {sidebarProjects.map(project => {
                                    const count = forms.filter(f => f.project_id === project.id && (f.kind !== 'directory')).length;
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
                                            {filteredForms.length} Forms
                                        </span>
                                    </h2>
                                </div>
                            </div>

                            {/* Filters Panel */}
                            <div className="px-8 py-3 border-b border-[hsl(var(--border))]/30 bg-[hsl(var(--surface-elevated))]/10 shrink-0 flex items-center justify-end gap-4">
                                <div className="flex items-center gap-4">
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

                                    <button
                                        onClick={() => handleNewFormClick()}
                                        className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all shrink-0 ${
                                            isCreatingFormInline
                                                ? 'bg-[hsl(var(--primary))]/10 border-[hsl(var(--primary))]/30 text-[hsl(var(--primary))] font-bold'
                                                : 'bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary-hover))] border-transparent text-white shadow-sm'
                                        }`}
                                    >
                                        <Plus className="w-3.5 h-3.5" />
                                        <span>Add Form</span>
                                    </button>

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
                                        Create New Form
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
                                                Form Title
                                            </label>
                                            <input
                                                type="text"
                                                value={inlineFormTitle}
                                                onChange={(e) => setInlineFormTitle(e.target.value)}
                                                placeholder="e.g. Customer Feedback"
                                                className="w-full bg-[hsl(var(--surface))] border border-[hsl(var(--border))] rounded-lg px-3 py-1.5 text-xs text-[hsl(var(--text-primary))] focus:outline-none focus:border-[hsl(var(--primary))]"
                                                required
                                                autoFocus
                                            />
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0 w-full md:w-auto justify-end">
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
                                            Showing <span className="font-semibold text-[hsl(var(--text-primary))]">{(formsPage - 1) * formsPageSize + 1}</span> to <span className="font-semibold text-[hsl(var(--text-primary))]">{Math.min(formsPage * formsPageSize, filteredForms.length)}</span> of <span className="font-semibold text-[hsl(var(--text-primary))]">{filteredForms.length}</span> forms
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
                    <ProjectsPortfolio
                        projects={projects}
                        forms={forms}
                        datasetSources={datasetSources}
                        tasks={tasks}
                        teamCount={teams.length}
                        onCreateProject={() => setShowCreateProject(true)}
                        onOpenHub={openProjectHub}
                        onOpenWorkspace={openProjectWorkspace}
                    />
                )}

                {activeTab === 'tasks' && (
                    <div className="space-y-6">
                        <div>
                            <h2 className="text-3xl font-bold mb-2">Tasks</h2>
                            <p className="text-[hsl(var(--text-secondary))]">
                                Cross-project task overview. Create tasks here, then manage execution from each project workspace.
                            </p>
                        </div>
                        <div className="space-y-8">
                        <div className="flex justify-between items-end gap-6">
                            <div>
                                <h3 className="text-xl font-semibold mb-1">Tasks</h3>
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
                    </div>
                )}

                {activeTab === 'inbox' && currentOrg && (
                    <InboxHub
                        projects={inboxProjects}
                        loading={inboxLoading}
                        totals={inboxTotals}
                        attentionItems={attentionItems}
                        onOpenAttendance={(projectId) => {
                            const project = projects.find((row) => row.id === projectId);
                            if (project) setCurrentProject(project);
                            navigate(`/projects/${projectId}?tab=ops&section=attendance`);
                        }}
                        onOpenReview={(projectId) => {
                            const project = projects.find((row) => row.id === projectId);
                            if (project) setCurrentProject(project);
                            navigate(`/projects/${projectId}?tab=ops&section=review`);
                        }}
                        onOpenProject={(projectId) => {
                            const project = projects.find((row) => row.id === projectId);
                            if (project) setCurrentProject(project);
                            navigate(`/projects/${projectId}/hub`);
                        }}
                        onOpenProjects={() => navigateDashboardTab('projects')}
                    />
                )}

                {activeTab === 'members' && currentOrg && (
                    <div className="space-y-8">
                        <div className="flex items-center gap-4 border-b border-[hsl(var(--border))] pb-4">
                            <button
                                onClick={() => navigateDashboardTab('members', { section: 'members' })}
                                className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${membersSubTab === 'members'
                                    ? 'bg-[hsl(var(--primary))] text-white shadow-lg'
                                    : 'text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--surface-elevated))]'
                                    }`}
                            >
                                Members
                            </button>
                            <button
                                onClick={() => navigateDashboardTab('members', { section: 'teams' })}
                                className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${membersSubTab === 'teams'
                                    ? 'bg-[hsl(var(--primary))] text-white shadow-lg'
                                    : 'text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--surface-elevated))]'
                                    }`}
                            >
                                Teams
                            </button>
                            <button
                                onClick={() => navigateDashboardTab('members', { section: 'roles' })}
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

                {activeTab === 'data' && dataSection === 'analysis' && currentOrg && (
                    <Suspense fallback={<AnalyticsTabFallback />}>
                        <AnalyticsHub orgId={currentOrg.id} projectId={undefined} forms={forms} activeTool={activeAnalyticsTool} />
                    </Suspense>
                )}

                {activeTab === 'data' && (dataSection === 'datasets' || dataSection === 'directory') && (
                    <DatasetsTab
                        sources={datasetSources}
                        directoryForms={directoryFormSummaries}
                        loading={datasetsLoading}
                        error={datasetsError}
                        projects={projects}
                    />
                )}

                {activeTab === 'data' && dataSection === 'media' && (
                    <div className="space-y-8">
                        <div className="flex justify-between items-end gap-6">
                            <div>
                                <h2 className="text-3xl font-bold mb-2">Media</h2>
                                <p className="text-[hsl(var(--text-secondary))]">Project files, links, images, and audio that field teams can reference without leaving their workflow.</p>
                            </div>
                            <div className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--surface))] px-4 py-3 text-sm text-[hsl(var(--text-secondary))]">
                                {mediaItems.length} items across {Math.max(projects.length, 1)} projects
                            </div>
                        </div>

                        <div className="grid gap-4 lg:grid-cols-2">
                            {mediaItems.map(item => (
                                <div key={item.id} className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--surface))] p-6 shadow-sm">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]">
                                                    <Paperclip className="h-5 w-5" />
                                                </div>
                                                <div>
                                                    <h3 className="text-lg font-semibold">{item.title}</h3>
                                                    <p className="text-xs uppercase tracking-[0.18em] text-[hsl(var(--text-tertiary))]">{item.kind} • {item.project_name}</p>
                                                </div>
                                            </div>
                                            <p className="mt-4 text-sm text-[hsl(var(--text-secondary))]">{item.summary}</p>
                                        </div>
                                    </div>
                                    <div className="mt-4 rounded-md border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--surface-elevated))] px-4 py-3 text-sm text-[hsl(var(--text-secondary))]">
                                        Media library placeholder: uploads, links, previews, and field-ready references will land here.
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'messages' && (
                    <div className="space-y-8">
                        <div className="flex justify-between items-end gap-6">
                            <div>
                                <h2 className="text-3xl font-bold mb-2">Messages</h2>
                                <p className="text-[hsl(var(--text-secondary))]">
                                    General + team channels per project. Open a project hub to read and post.
                                </p>
                            </div>
                            <div className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--surface))] px-4 py-3 text-sm text-[hsl(var(--text-secondary))]">
                                {messagesLoading
                                    ? 'Loading…'
                                    : `${messageItems.length} channels across ${Math.max(projects.length, 0)} projects`}
                            </div>
                        </div>

                        {messagesLoading ? (
                            <div className="flex items-center gap-2 text-sm text-[hsl(var(--text-secondary))]">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Loading channels…
                            </div>
                        ) : messageItems.length === 0 ? (
                            <p className="rounded-md border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--surface))] px-4 py-8 text-center text-sm text-[hsl(var(--text-tertiary))]">
                                No channels yet. Open a project hub to seed General (and team channels when teams are granted).
                            </p>
                        ) : (
                            <div className="grid gap-4 lg:grid-cols-2">
                                {messageItems.map((thread) => (
                                    <button
                                        key={`${thread.project_id}-${thread.id}`}
                                        type="button"
                                        onClick={() =>
                                            navigate(`/projects/${thread.project_id}/hub?channel=${thread.id}`)
                                        }
                                        className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--surface))] p-6 text-left shadow-sm transition-shadow hover:shadow-md"
                                    >
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-3">
                                                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]">
                                                        <MessageSquare className="h-5 w-5" />
                                                    </div>
                                                    <div>
                                                        <h3 className="text-lg font-semibold">{thread.title}</h3>
                                                        <p className="text-xs uppercase tracking-[0.18em] text-[hsl(var(--text-tertiary))]">
                                                            {thread.project_name}
                                                        </p>
                                                    </div>
                                                </div>
                                                <p className="mt-4 text-sm text-[hsl(var(--text-secondary))]">
                                                    {thread.summary || 'Open to view the conversation.'}
                                                </p>
                                            </div>
                                            <span className="rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--surface-elevated))] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[hsl(var(--text-tertiary))]">
                                                {thread.reply_count} replies
                                            </span>
                                        </div>
                                        <p className="mt-4 text-xs font-semibold text-[hsl(var(--primary))]">
                                            Open in ProjectHub →
                                        </p>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}


                {activeTab === 'reports' && currentOrg && (
                    <ReportsPortfolio
                        orgId={currentOrg.id}
                        projects={projects.map((project) => ({ id: project.id, name: project.name }))}
                        teams={teams}
                        legacyReports={reports.map((report) => ({
                            id: report.id,
                            project_id: report.project_id,
                            project_name: report.project_name,
                            title: report.title,
                            description: report.description,
                            status: report.status,
                            updated_at: report.updated_at,
                        }))}
                        onOpenBucket={(bucketId) => navigate(`/reports/${bucketId}`)}
                    />
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
                    <div className="bg-[hsl(var(--surface))] border border-[hsl(var(--border))] rounded-[32px] p-8 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
                        <h2 className="text-2xl font-bold mb-6">Create New Project</h2>
                        <form onSubmit={handleCreateProject} className="space-y-5">
                            <div>
                                <label className="label">Project Name</label>
                                <input
                                    value={projectName}
                                    onChange={(event) => setProjectName(event.target.value)}
                                    className="input"
                                    placeholder="e.g. Q1 Customer Survey"
                                    autoFocus
                                    required
                                />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="label">Collection start</label>
                                    <input
                                        type="date"
                                        value={projectCollectionStart}
                                        onChange={(event) => setProjectCollectionStart(event.target.value)}
                                        className="input"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="label">Collection end</label>
                                    <input
                                        type="date"
                                        value={projectCollectionEnd}
                                        onChange={(event) => setProjectCollectionEnd(event.target.value)}
                                        className="input"
                                        required
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="label">Daily start (default 09:00)</label>
                                    <input
                                        type="time"
                                        value={projectTimeStart}
                                        onChange={(event) => setProjectTimeStart(event.target.value)}
                                        className="input"
                                    />
                                </div>
                                <div>
                                    <label className="label">Daily end (default 17:00)</label>
                                    <input
                                        type="time"
                                        value={projectTimeEnd}
                                        onChange={(event) => setProjectTimeEnd(event.target.value)}
                                        className="input"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="label">Expected total (optional)</label>
                                    <input
                                        type="number"
                                        min={1}
                                        value={projectExpectedTotal}
                                        onChange={(event) => setProjectExpectedTotal(event.target.value)}
                                        className="input"
                                        placeholder="e.g. 500"
                                    />
                                </div>
                                <div>
                                    <label className="label">Expected weekly (optional)</label>
                                    <input
                                        type="number"
                                        min={1}
                                        value={projectExpectedWeekly}
                                        onChange={(event) => setProjectExpectedWeekly(event.target.value)}
                                        className="input"
                                        placeholder="e.g. 40"
                                    />
                                </div>
                            </div>
                            <p className="text-xs text-[hsl(var(--text-tertiary))]">
                                Set at least one expected target (total or weekly) to 1 or more.
                            </p>
                            <div className="flex space-x-3 pt-2">
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
