import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
    AlertCircle,
    BarChart3,
    CheckCircle2,
    ChevronRight,
    Clock3,
    Database,
    ExternalLink,
    FileBarChart2,
    FileText,
    FlaskConical,
    Gauge,
    Loader2,
    Pin,
    SquareCheckBig,
    Tag,
    UserCheck,
    Users,
    Wrench,
    X,
} from 'lucide-react';

import StudioLayout from '../components/StudioLayout';
import { projectNavHref, projectShellNavHref } from '../lib/vocabulary';
import NeedsAttentionRail, { type AttentionItem } from '../components/hub/NeedsAttentionRail';
import SubmissionMediaGrid, {
    RecentMediaHeaderIcon,
    type SubmissionMediaItem,
} from '../components/hub/SubmissionMediaGrid';
import PinnedAnalyticsCard from '../components/hub/PinnedAnalyticsCard';
import ProjectThreadsPanel from '../components/hub/ProjectThreadsPanel';
import { useOrg } from '../contexts/OrgContext';
import { analyticsAPI, formAPI, projectAPI, submissionAPI, teamAPI } from '../lib/api';
import type { SavedQuestion } from '../components/analytics/types';

function cn(...parts: Array<string | false | null | undefined>) {
    return parts.filter(Boolean).join(' ');
}

type PageTab = 'overview' | 'workspace';
type WorkspaceFilter = 'all' | 'forms' | 'directories' | 'datasets';

type HubForm = {
    id: string;
    title: string;
    status: string;
    kind?: 'standard' | 'directory';
    updated_at?: string;
};

type HubDataset = {
    id: string;
    name: string;
    records_count?: number;
    updated_at?: string;
};

type HubTeam = {
    id: string;
    name: string;
    memberCount: number;
};

const PAGE_TABS: Array<{ id: PageTab; label: string; hint: string }> = [
    { id: 'overview', label: 'Overview', hint: 'Informational command centre' },
    { id: 'workspace', label: 'Forms · Directorys · Datasets', hint: 'Things power users tinker with' },
];

const WORKSPACE_FILTERS: Array<{ id: WorkspaceFilter; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'forms', label: 'Forms' },
    { id: 'directories', label: 'Directories' },
    { id: 'datasets', label: 'Datasets' },
];

function startOfWeek(date: Date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + diff);
    return d;
}

function formatTimeLabel(value?: string | null) {
    if (!value) return '—';
    return value.slice(0, 5);
}

function destinationLabel(kind: Exclude<WorkspaceFilter, 'all'>) {
    if (kind === 'forms') return 'Open form';
    if (kind === 'directories') return 'Open directory';
    return 'Explore dataset';
}

const ProjectHub: React.FC = () => {
    const navigate = useNavigate();
    const { projectId = '' } = useParams();
    const [searchParams] = useSearchParams();
    const channelParam = searchParams.get('channel') || searchParams.get('thread');
    const { currentOrg, refreshCurrentProject, setCurrentProject } = useOrg();

    const [pageTab, setPageTab] = useState<PageTab>('overview');
    const [workspaceFilter, setWorkspaceFilter] = useState<WorkspaceFilter>('all');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [project, setProject] = useState<any>(null);
    const [forms, setForms] = useState<HubForm[]>([]);
    const [directoryForms, setDirectoryForms] = useState<HubForm[]>([]);
    const [datasets, setDatasets] = useState<HubDataset[]>([]);
    const [teams, setTeams] = useState<HubTeam[]>([]);
    const [tasks, setTasks] = useState<any[]>([]);
    const [submissions, setSubmissions] = useState<any[]>([]);
    const [attendanceToday, setAttendanceToday] = useState<any[]>([]);
    const [accessRules, setAccessRules] = useState<any[]>([]);
    const [pinnedQuestions, setPinnedQuestions] = useState<SavedQuestion[]>([]);
    const [canEditPins, setCanEditPins] = useState(false);
    const [maxPins, setMaxPins] = useState(4);
    const [showPinPicker, setShowPinPicker] = useState(false);
    const [pinCandidates, setPinCandidates] = useState<SavedQuestion[]>([]);
    const [draftPinIds, setDraftPinIds] = useState<string[]>([]);
    const [savingPins, setSavingPins] = useState(false);
    const [pinError, setPinError] = useState<string | null>(null);
    const [attentionItems, setAttentionItems] = useState<AttentionItem[]>([]);
    const [canDismissAttention, setCanDismissAttention] = useState(false);
    const [dismissingId, setDismissingId] = useState<string | null>(null);
    const [recentMedia, setRecentMedia] = useState<SubmissionMediaItem[]>([]);

    useEffect(() => {
        if (!currentOrg?.id || !projectId) return;

        let cancelled = false;
        const load = async () => {
            setLoading(true);
            setError(null);
            try {
                const today = new Date();
                const todayIso = today.toISOString().slice(0, 10);

                const [
                    projectData,
                    standardForms,
                    directoryKindForms,
                    taskRows,
                    access,
                    orgTeams,
                    sources,
                    attendance,
                    pinnedPayload,
                    attentionPayload,
                    mediaPayload,
                ] = await Promise.all([
                    refreshCurrentProject(currentOrg.id, projectId),
                    formAPI.list(projectId, 'standard').catch(() => formAPI.list(projectId)),
                    formAPI.list(projectId, 'directory').catch(() => []),
                    projectAPI.listTasks(currentOrg.id, projectId),
                    projectAPI.listAccess(currentOrg.id, projectId),
                    teamAPI.list(currentOrg.id),
                    analyticsAPI.listSources(currentOrg.id).catch(() => []),
                    projectAPI.listAttendance(currentOrg.id, projectId, todayIso).catch(() => []),
                    projectAPI.listPinnedAnalytics(currentOrg.id, projectId).catch(() => ({
                        can_edit: false,
                        max_pins: 4,
                        pins: [],
                    })),
                    projectAPI.listAttention(currentOrg.id, projectId).catch(() => ({
                        can_dismiss: false,
                        items: [],
                    })),
                    projectAPI.listMedia(currentOrg.id, projectId, { limit: 12 }).catch(() => ({ items: [] })),
                ]);

                const allForms: HubForm[] = Array.isArray(standardForms) ? standardForms : [];
                const directories: HubForm[] = Array.isArray(directoryKindForms) ? directoryKindForms : [];
                const formIds = [...allForms, ...directories].map((f) => f.id);

                const submissionBatches = await Promise.all(
                    formIds.map((formId) => submissionAPI.listForForm(formId).catch(() => [])),
                );
                const flatSubmissions = submissionBatches.flat();

                const teamAccessIds = new Set(
                    (access || [])
                        .filter((rule: any) => rule.accessor_type === 'team')
                        .map((rule: any) => rule.accessor_id),
                );
                const hubTeams: HubTeam[] = (orgTeams || [])
                    .filter((team: any) => teamAccessIds.has(team.id))
                    .map((team: any) => ({
                        id: team.id,
                        name: team.name,
                        memberCount: Array.isArray(team.members) ? team.members.length : team.member_count || 0,
                    }));

                const projectDatasets = (sources || [])
                    .filter((source: any) => {
                        if (source.project_id && source.project_id === projectId) return true;
                        if (source.form_id && formIds.includes(source.form_id)) return true;
                        return false;
                    })
                    .map((source: any) => ({
                        id: source.id || source.dataset_id || source.form_id,
                        name: source.name || source.title || 'Dataset',
                        records_count: source.record_count ?? source.records_count ?? source.row_count,
                        updated_at: source.updated_at,
                    }));

                if (cancelled) return;
                setProject(projectData);
                setCurrentProject(projectData);
                setForms(allForms.filter((f) => f.kind !== 'directory'));
                setDirectoryForms(directories.length ? directories : allForms.filter((f) => f.kind === 'directory'));
                setTasks(taskRows || []);
                setAccessRules(access || []);
                setTeams(hubTeams);
                setDatasets(projectDatasets);
                setSubmissions(flatSubmissions);
                setAttendanceToday(attendance || []);
                setCanEditPins(Boolean(pinnedPayload?.can_edit));
                setMaxPins(pinnedPayload?.max_pins || 4);
                setPinnedQuestions(
                    (pinnedPayload?.pins || [])
                        .map((pin: any) => pin.question)
                        .filter(Boolean),
                );
                setCanDismissAttention(Boolean(attentionPayload?.can_dismiss));
                setAttentionItems(attentionPayload?.items || []);
                setRecentMedia(mediaPayload?.items || []);
            } catch (err: any) {
                if (!cancelled) {
                    setError(err?.response?.data?.detail || err?.message || 'Failed to load Hub');
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        void load();
        return () => {
            cancelled = true;
        };
    }, [currentOrg?.id, projectId, refreshCurrentProject, setCurrentProject]);

    const weekStart = useMemo(() => startOfWeek(new Date()), []);

    const submissionStats = useMemo(() => {
        const total = submissions.length;
        const pending = submissions.filter((s) => (s.review_status || 'submitted') === 'submitted').length;
        const thisWeek = submissions.filter((s) => {
            const created = new Date(s.created_at);
            return created >= weekStart;
        }).length;
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayCount = submissions.filter((s) => new Date(s.created_at) >= todayStart).length;
        return { total, pending, thisWeek, todayCount };
    }, [submissions, weekStart]);

    const taskStats = useMemo(() => {
        const done = tasks.filter((t) => t.status === 'done').length;
        const open = tasks.filter((t) => t.status !== 'done' && t.status !== 'cancelled').length;
        const todayVisits = tasks.filter((t) => {
            if (t.kind !== 'field_visit' || !t.scheduled_date) return false;
            return t.scheduled_date === new Date().toISOString().slice(0, 10);
        });
        const visitsDone = todayVisits.filter((t) => t.status === 'done').length;
        return { done, open, total: tasks.length, visitsDone, visitsTotal: todayVisits.length };
    }, [tasks]);

    const checkedInToday = attendanceToday.filter((r) => r.status === 'checked_in' || r.status === 'checked_out').length;

    const expectedTotal = project?.expected_total_count ?? null;
    const expectedWeekly = project?.expected_weekly_count ?? null;

    const kpis = [
        {
            label: 'Collected / Expected total',
            value: expectedTotal != null ? `${submissionStats.total}/${expectedTotal}` : `${submissionStats.total}`,
            hint:
                expectedTotal != null
                    ? `${Math.min(100, Math.round((submissionStats.total / Math.max(expectedTotal, 1)) * 100))}% of target`
                    : 'No total target set',
            hintTone: 'muted' as const,
            icon: FileText,
            iconClass: 'bg-sky-500/10 text-sky-600',
        },
        {
            label: 'This week / Expected weekly',
            value: expectedWeekly != null ? `${submissionStats.thisWeek}/${expectedWeekly}` : `${submissionStats.thisWeek}`,
            hint:
                expectedWeekly != null
                    ? `${Math.min(100, Math.round((submissionStats.thisWeek / Math.max(expectedWeekly, 1)) * 100))}% of weekly target`
                    : 'No weekly target set',
            hintTone: 'muted' as const,
            icon: Gauge,
            iconClass: 'bg-emerald-500/10 text-emerald-600',
        },
        {
            label: 'Pending review',
            value: String(submissionStats.pending),
            hint: submissionStats.pending ? 'Awaiting approval' : 'Queue clear',
            hintTone: submissionStats.pending ? ('muted' as const) : ('success' as const),
            icon: Clock3,
            iconClass: 'bg-amber-500/10 text-amber-600',
        },
        {
            label: 'Checked in today',
            value: String(checkedInToday),
            hint: `${accessRules.length} project accessors`,
            hintTone: 'muted' as const,
            icon: UserCheck,
            iconClass: 'bg-violet-500/10 text-violet-600',
        },
    ];

    const todayStrip = [
        { label: 'Checked in', value: String(checkedInToday), detail: 'attendance today', icon: UserCheck },
        {
            label: 'Visits today',
            value: `${taskStats.visitsDone}/${taskStats.visitsTotal || 0}`,
            detail: 'field visits',
            icon: CheckCircle2,
        },
        { label: 'New submissions', value: String(submissionStats.todayCount), detail: 'calendar day', icon: FileText },
        { label: 'Pending review', value: String(submissionStats.pending), detail: 'awaiting approval', icon: Clock3 },
    ];

    const progressRows = [
        {
            label: 'Tasks done',
            value: taskStats.done,
            total: Math.max(taskStats.total, 1),
            display: `${taskStats.done}/${taskStats.total}`,
            color: 'bg-[hsl(var(--primary))]',
        },
        {
            label: 'Weekly collection',
            value: submissionStats.thisWeek,
            total: Math.max(expectedWeekly || submissionStats.thisWeek || 1, 1),
            display:
                expectedWeekly != null
                    ? `${submissionStats.thisWeek}/${expectedWeekly}`
                    : String(submissionStats.thisWeek),
            color: 'bg-sky-500',
        },
        {
            label: 'Open tasks',
            value: taskStats.open,
            total: Math.max(taskStats.total || taskStats.open || 1, 1),
            display: String(taskStats.open),
            color: 'bg-violet-500',
        },
    ];

    const workspaceCards = useMemo(() => {
        const formCards = forms.map((form) => ({
            id: form.id,
            title: form.title,
            description: `Form · ${form.status}`,
            kind: 'forms' as const,
            status: form.status,
            meta: form.updated_at ? `Updated ${new Date(form.updated_at).toLocaleDateString()}` : undefined,
            onLaunch: () => navigate(`/forms/${form.id}`),
        }));
        const directoryCards = directoryForms.map((form) => ({
            id: form.id,
            title: form.title,
            description: 'Directory used by field forms',
            kind: 'directories' as const,
            status: form.status,
            meta: form.updated_at ? `Updated ${new Date(form.updated_at).toLocaleDateString()}` : undefined,
            onLaunch: () => navigate(`/projects/${projectId}?tab=data&section=directory`),
        }));
        const datasetCards = datasets.map((dataset) => ({
            id: dataset.id,
            title: dataset.name,
            description: 'Analytics dataset',
            kind: 'datasets' as const,
            status: 'active',
            meta:
                dataset.records_count != null
                    ? `${dataset.records_count.toLocaleString()} rows`
                    : dataset.updated_at
                      ? `Updated ${new Date(dataset.updated_at).toLocaleDateString()}`
                      : undefined,
            onLaunch: () => navigate(`/projects/${projectId}?tab=data&section=datasets`),
        }));
        const all = [...formCards, ...directoryCards, ...datasetCards];
        if (workspaceFilter === 'all') return all;
        return all.filter((card) => card.kind === workspaceFilter);
    }, [forms, directoryForms, datasets, workspaceFilter, navigate, projectId]);

    const collectionActiveNow = useMemo(() => {
        if (!project?.collection_time_start || !project?.collection_time_end) return null;
        const now = new Date();
        if (project.collection_start_date && now.toISOString().slice(0, 10) < project.collection_start_date) {
            return false;
        }
        if (project.collection_end_date && now.toISOString().slice(0, 10) > project.collection_end_date) {
            return false;
        }
        const [sh, sm] = String(project.collection_time_start).split(':').map(Number);
        const [eh, em] = String(project.collection_time_end).split(':').map(Number);
        const mins = now.getHours() * 60 + now.getMinutes();
        return mins >= sh * 60 + (sm || 0) && mins < eh * 60 + (em || 0);
    }, [project]);

    const openPinPicker = async () => {
        if (!currentOrg?.id) return;
        setPinError(null);
        setDraftPinIds(pinnedQuestions.map((q) => q.id));
        try {
            const [projectQs, orgQs] = await Promise.all([
                analyticsAPI.listQuestions(currentOrg.id, projectId).catch(() => []),
                analyticsAPI.listQuestions(currentOrg.id).catch(() => []),
            ]);
            const merged = [...(projectQs || []), ...(orgQs || [])];
            const byId = new Map<string, SavedQuestion>();
            for (const q of merged) {
                if (!q?.id || q.is_archived) continue;
                if (!['chart', 'kpi', 'goal', 'table'].includes(q.viz_type)) continue;
                if (q.project_id && q.project_id !== projectId) continue;
                byId.set(q.id, q);
            }
            setPinCandidates(Array.from(byId.values()));
            setShowPinPicker(true);
        } catch (err: any) {
            setPinError(err?.response?.data?.detail || err?.message || 'Failed to load charts');
            setShowPinPicker(true);
        }
    };

    const toggleDraftPin = (questionId: string) => {
        setDraftPinIds((prev) => {
            if (prev.includes(questionId)) return prev.filter((id) => id !== questionId);
            if (prev.length >= maxPins) return prev;
            return [...prev, questionId];
        });
    };

    const savePins = async () => {
        if (!currentOrg?.id) return;
        setSavingPins(true);
        setPinError(null);
        try {
            const payload = await projectAPI.replacePinnedAnalytics(currentOrg.id, projectId, draftPinIds);
            setCanEditPins(Boolean(payload?.can_edit));
            setMaxPins(payload?.max_pins || 4);
            setPinnedQuestions((payload?.pins || []).map((pin: any) => pin.question).filter(Boolean));
            setShowPinPicker(false);
        } catch (err: any) {
            setPinError(err?.response?.data?.detail || err?.message || 'Failed to save pins');
        } finally {
            setSavingPins(false);
        }
    };

    const openAttentionLink = (item: AttentionItem) => {
        if (item.deep_link) {
            navigate(item.deep_link);
            return;
        }
        navigate(`/projects/${projectId}`);
    };

    const dismissAttention = async (itemId: string) => {
        if (!currentOrg?.id || !canDismissAttention) return;
        setDismissingId(itemId);
        try {
            await projectAPI.dismissAttention(currentOrg.id, projectId, itemId);
            setAttentionItems((prev) => prev.filter((item) => item.id !== itemId));
        } catch {
            // Keep item visible if dismiss fails
        } finally {
            setDismissingId(null);
        }
    };

    return (
        <StudioLayout
            navMode="project"
            activeNav="hub"
            onSelectNav={(key) => {
                if (!projectId) return;
                navigate(projectShellNavHref(projectId, key));
            }}
            onBackToProjects={() => navigate('/dashboard?tab=projects')}
            activeOpsSection={null}
            onSelectOpsSection={(section) => {
                if (!projectId) return;
                if (section === 'attendance' || section === 'review') {
                    navigate(projectNavHref(projectId, 'ops', { section }));
                }
            }}
            onSelectDesignSection={(section) => {
                if (!projectId) return;
                navigate(projectNavHref(projectId, 'design', { section }));
            }}
            onSelectDataSection={(section) => {
                if (!projectId) return;
                navigate(projectNavHref(projectId, 'data', { section }));
            }}
            contentClassName="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 bg-[hsl(var(--background))]"
        >
            <div className="mx-auto max-w-[1600px] space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[hsl(var(--primary))]/25 bg-[hsl(var(--primary))]/8 px-4 py-3">
                    <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[hsl(var(--primary))] text-white">
                            <FlaskConical className="h-4 w-4" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-[hsl(var(--text-primary))]">
                                Hub — Phase 4 (live)
                            </p>
                            <p className="text-xs text-[hsl(var(--text-secondary))]">
                                Messages are live (General + team channels). Maps stay hidden until a later phase.
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={() => navigate(`/projects/${projectId}?tab=design&section=forms`)}
                            className="btn btn-secondary text-xs"
                        >
                            Open Design
                        </button>
                        <button
                            type="button"
                            onClick={() => navigate('/dashboard?tab=projects')}
                            className="btn btn-secondary text-xs"
                        >
                            Back to Projects
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="flex h-48 items-center justify-center gap-2 text-[hsl(var(--text-secondary))]">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Loading Hub…
                    </div>
                ) : error ? (
                    <div className="rounded-2xl border border-[hsl(var(--error))]/20 bg-[hsl(var(--error))]/10 p-6">
                        <div className="mb-2 flex items-center gap-2 text-[hsl(var(--error))]">
                            <AlertCircle className="h-5 w-5" />
                            <h2 className="font-semibold">Hub unavailable</h2>
                        </div>
                        <p className="text-sm text-[hsl(var(--text-secondary))]">{error}</p>
                    </div>
                ) : project ? (
                    <>
                        <div className="flex flex-col gap-4 px-1 lg:flex-row lg:items-end lg:justify-between">
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 text-xs font-medium text-[hsl(var(--text-tertiary))]">
                                    <span>{currentOrg?.name || 'Workspace'}</span>
                                    <ChevronRight className="h-3.5 w-3.5" />
                                    <span className="text-[hsl(var(--text-secondary))]">{project.name}</span>
                                </div>
                                <div className="flex flex-wrap items-center gap-3">
                                    <h1 className="font-[family-name:var(--font-heading)] text-3xl font-bold tracking-tight text-[hsl(var(--text-primary))]">
                                        {project.name}
                                    </h1>
                                    <span className="inline-flex rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                                        {project.status}
                                    </span>
                                    {collectionActiveNow != null && (
                                        <span
                                            className={cn(
                                                'inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                                                collectionActiveNow
                                                    ? 'border-sky-500/20 bg-sky-500/10 text-sky-700'
                                                    : 'border-slate-500/20 bg-slate-500/10 text-slate-600',
                                            )}
                                        >
                                            {collectionActiveNow ? 'In collection window' : 'Outside collection window'}
                                        </span>
                                    )}
                                </div>
                                <p className="max-w-2xl text-sm text-[hsl(var(--text-secondary))]">
                                    {project.description || 'Project command centre — stream signals in, launch tools out.'}
                                </p>
                                <p className="text-xs text-[hsl(var(--text-tertiary))]">
                                    Collection{' '}
                                    {project.collection_start_date && project.collection_end_date
                                        ? `${project.collection_start_date} → ${project.collection_end_date}`
                                        : 'dates not set'}
                                    {' · '}
                                    {formatTimeLabel(project.collection_time_start)}–
                                    {formatTimeLabel(project.collection_time_end)}
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                            {kpis.map((item) => {
                                const Icon = item.icon;
                                return (
                                    <div
                                        key={item.label}
                                        className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] p-5 shadow-sm"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="text-[11px] font-bold uppercase tracking-wider text-[hsl(var(--text-tertiary))]">
                                                    {item.label}
                                                </p>
                                                <p className="mt-2 text-3xl font-bold tracking-tight text-[hsl(var(--text-primary))]">
                                                    {item.value}
                                                </p>
                                                <p
                                                    className={cn(
                                                        'mt-2 text-xs font-medium',
                                                        item.hintTone === 'success'
                                                            ? 'text-[hsl(var(--success))]'
                                                            : 'text-[hsl(var(--text-secondary))]',
                                                    )}
                                                >
                                                    {item.hint}
                                                </p>
                                            </div>
                                            <div className={cn('rounded-xl p-2.5', item.iconClass)}>
                                                <Icon className="h-5 w-5" />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <section className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] p-4 shadow-sm">
                            <div className="mb-3 flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-[hsl(var(--primary))]" />
                                    <h2 className="text-sm font-bold uppercase tracking-wider text-[hsl(var(--text-primary))]">
                                        Today
                                    </h2>
                                </div>
                                <span className="text-xs text-[hsl(var(--text-tertiary))]">Calendar day</span>
                            </div>
                            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                                {todayStrip.map((item) => {
                                    const Icon = item.icon;
                                    return (
                                        <div
                                            key={item.label}
                                            className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-3"
                                        >
                                            <div className="flex items-center gap-2 text-[hsl(var(--text-tertiary))]">
                                                <Icon className="h-3.5 w-3.5" />
                                                <span className="text-[10px] font-bold uppercase tracking-wider">
                                                    {item.label}
                                                </span>
                                            </div>
                                            <p className="mt-1.5 text-xl font-bold text-[hsl(var(--text-primary))]">
                                                {item.value}
                                            </p>
                                            <p className="text-xs text-[hsl(var(--text-secondary))]">{item.detail}</p>
                                        </div>
                                    );
                                })}
                            </div>
                        </section>

                        <div className="flex flex-wrap items-end gap-2 border-b border-[hsl(var(--border))]">
                            {PAGE_TABS.map((tab) => (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setPageTab(tab.id)}
                                    className={cn(
                                        'rounded-t-xl px-4 py-3 text-left transition-colors',
                                        pageTab === tab.id
                                            ? 'border-b-2 border-[hsl(var(--primary))] text-[hsl(var(--primary))]'
                                            : 'text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--text-secondary))]',
                                    )}
                                >
                                    <span className="block text-sm font-semibold">{tab.label}</span>
                                    <span className="block text-[11px] font-medium opacity-80">{tab.hint}</span>
                                </button>
                            ))}
                        </div>

                        {pageTab === 'overview' ? (
                            <div className="space-y-4">
                                <section className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] p-4 shadow-sm">
                                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                            <BarChart3 className="h-4 w-4 text-[hsl(var(--primary))]" />
                                            <h2 className="text-sm font-bold uppercase tracking-wider text-[hsl(var(--text-primary))]">
                                                Pinned charts
                                            </h2>
                                            <span className="text-xs text-[hsl(var(--text-tertiary))]">
                                                {pinnedQuestions.length}/{maxPins}
                                            </span>
                                        </div>
                                        {canEditPins && (
                                            <button
                                                type="button"
                                                onClick={() => void openPinPicker()}
                                                className="inline-flex items-center gap-1.5 rounded-lg border border-[hsl(var(--border))] px-3 py-1.5 text-xs font-semibold text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))]"
                                            >
                                                <Pin className="h-3.5 w-3.5" />
                                                {pinnedQuestions.length ? 'Manage pins' : 'Pin a chart'}
                                            </button>
                                        )}
                                    </div>
                                    {pinnedQuestions.length === 0 ? (
                                        <div className="rounded-xl border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-8 text-center">
                                            <p className="text-sm text-[hsl(var(--text-secondary))]">
                                                No charts pinned yet. Pin up to {maxPins} chart or KPI cards from
                                                Analytics.
                                            </p>
                                            {canEditPins && (
                                                <button
                                                    type="button"
                                                    onClick={() => void openPinPicker()}
                                                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[hsl(var(--primary))] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[hsl(var(--primary-hover))]"
                                                >
                                                    <Pin className="h-3.5 w-3.5" />
                                                    Pin a chart
                                                </button>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                                            {pinnedQuestions.map((question) => (
                                                <PinnedAnalyticsCard
                                                    key={question.id}
                                                    orgId={currentOrg!.id}
                                                    question={question}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </section>

                                <NeedsAttentionRail
                                    items={attentionItems}
                                    canDismiss={canDismissAttention}
                                    dismissingId={dismissingId}
                                    onOpen={openAttentionLink}
                                    onDismiss={(itemId) => void dismissAttention(itemId)}
                                />

                                <section className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] p-4 shadow-sm">
                                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                            <RecentMediaHeaderIcon />
                                            <h2 className="text-sm font-bold uppercase tracking-wider text-[hsl(var(--text-primary))]">
                                                Recent media
                                            </h2>
                                            <span className="rounded-full bg-[hsl(var(--background))] px-2 py-0.5 text-[10px] font-bold text-[hsl(var(--text-tertiary))]">
                                                {recentMedia.length}
                                            </span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const first = forms[0] || directoryForms[0];
                                                if (first) navigate(`/forms/${first.id}`);
                                                else navigate(`/projects/${projectId}?tab=design`);
                                            }}
                                            className="text-xs font-semibold text-[hsl(var(--primary))] hover:underline"
                                        >
                                            Open form media
                                        </button>
                                    </div>
                                    <SubmissionMediaGrid
                                        items={recentMedia}
                                        compact
                                        emptyLabel="No form media yet. Photos, audio, video, and signatures from submissions will show here."
                                        onOpenItem={(item) => navigate(`/forms/${item.form_id}`)}
                                    />
                                </section>

                                {currentOrg?.id && (
                                    <ProjectThreadsPanel
                                        orgId={currentOrg.id}
                                        projectId={projectId}
                                        canEditProject={canEditPins || canDismissAttention}
                                        initialThreadId={channelParam}
                                    />
                                )}

                                <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                                <section className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] p-5 shadow-sm">
                                    <div className="mb-4 flex items-center gap-2">
                                        <SquareCheckBig className="h-4 w-4 text-[hsl(var(--primary))]" />
                                        <h2 className="text-sm font-bold uppercase tracking-wider text-[hsl(var(--text-primary))]">
                                            Work Progress
                                        </h2>
                                    </div>
                                    <div className="space-y-4">
                                        {progressRows.map((row) => {
                                            const pct = Math.min(100, Math.round((row.value / row.total) * 100));
                                            return (
                                                <div key={row.label}>
                                                    <div className="mb-1.5 flex items-center justify-between text-xs">
                                                        <span className="font-medium text-[hsl(var(--text-secondary))]">
                                                            {row.label}
                                                        </span>
                                                        <span className="font-semibold text-[hsl(var(--text-primary))]">
                                                            {row.display}
                                                        </span>
                                                    </div>
                                                    <div className="h-2 overflow-hidden rounded-full bg-[hsl(var(--background))]">
                                                        <div
                                                            className={cn('h-full rounded-full transition-all', row.color)}
                                                            style={{ width: `${pct}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </section>

                                <section className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] p-5 shadow-sm">
                                    <div className="mb-4 flex items-center gap-2">
                                        <Users className="h-4 w-4 text-amber-600" />
                                        <h2 className="text-sm font-bold uppercase tracking-wider text-[hsl(var(--text-primary))]">
                                            Teams on Project
                                        </h2>
                                    </div>
                                    {teams.length === 0 ? (
                                        <p className="text-sm text-[hsl(var(--text-tertiary))]">
                                            No teams granted access yet.
                                        </p>
                                    ) : (
                                        <ul className="space-y-3">
                                            {teams.map((team) => (
                                                <li
                                                    key={team.id}
                                                    className="flex items-center justify-between gap-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-3"
                                                >
                                                    <p className="text-sm font-semibold text-[hsl(var(--text-primary))]">
                                                        {team.name}
                                                    </p>
                                                    <span className="rounded-full bg-[hsl(var(--surface))] px-2.5 py-1 text-xs font-bold text-[hsl(var(--text-secondary))]">
                                                        {team.memberCount || '—'}
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </section>

                                <section className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] p-5 shadow-sm">
                                    <div className="mb-4 flex items-center gap-2">
                                        <FileBarChart2 className="h-4 w-4 text-violet-600" />
                                        <h2 className="text-sm font-bold uppercase tracking-wider text-[hsl(var(--text-primary))]">
                                            Org Reports
                                        </h2>
                                    </div>
                                    <p className="text-sm text-[hsl(var(--text-secondary))]">
                                        Stakeholder boards live at org level so seniors can watch without field Ops access.
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => navigate('/dashboard?tab=reports')}
                                        className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-3 text-sm font-semibold text-[hsl(var(--text-primary))] transition hover:border-[hsl(var(--primary))]/40"
                                    >
                                        Open Reports
                                        <ExternalLink className="h-4 w-4 text-[hsl(var(--text-tertiary))]" />
                                    </button>
                                </section>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] px-4 py-3">
                                    <div className="flex items-center gap-2 text-sm text-[hsl(var(--text-secondary))]">
                                        <Wrench className="h-4 w-4 text-[hsl(var(--primary))]" />
                                        <span>Open a form, directory, or dataset destination.</span>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {WORKSPACE_FILTERS.map((filter) => (
                                            <button
                                                key={filter.id}
                                                type="button"
                                                onClick={() => setWorkspaceFilter(filter.id)}
                                                className={cn(
                                                    'rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
                                                    workspaceFilter === filter.id
                                                        ? 'bg-[hsl(var(--primary))] text-white'
                                                        : 'bg-[hsl(var(--background))] text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))]',
                                                )}
                                            >
                                                {filter.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                                    {workspaceCards.length === 0 ? (
                                        <div className="col-span-full rounded-2xl border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--surface))] p-10 text-center text-sm text-[hsl(var(--text-secondary))]">
                                            Nothing in this filter yet.
                                        </div>
                                    ) : (
                                        workspaceCards.map((card) => {
                                            const Icon =
                                                card.kind === 'forms'
                                                    ? FileText
                                                    : card.kind === 'directories'
                                                      ? Tag
                                                      : Database;
                                            return (
                                                <article
                                                    key={`${card.kind}-${card.id}`}
                                                    className="flex flex-col gap-4 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] p-5 shadow-sm"
                                                >
                                                    <div className="flex gap-3">
                                                        <div className="rounded-xl bg-[hsl(var(--background))] p-2.5 text-[hsl(var(--primary))]">
                                                            <Icon className="h-5 w-5" />
                                                        </div>
                                                        <div>
                                                            <h3 className="text-base font-semibold text-[hsl(var(--text-primary))]">
                                                                {card.title}
                                                            </h3>
                                                            <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-[hsl(var(--text-tertiary))]">
                                                                {card.kind}
                                                            </p>
                                                            <p className="mt-1 text-sm text-[hsl(var(--text-secondary))]">
                                                                {card.description}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="mt-auto flex flex-wrap items-center justify-between gap-3">
                                                        <span className="text-xs text-[hsl(var(--text-tertiary))]">
                                                            {card.meta}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={card.onLaunch}
                                                            className="inline-flex items-center gap-1.5 rounded-lg bg-[hsl(var(--primary))] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[hsl(var(--primary-hover))]"
                                                        >
                                                            {destinationLabel(card.kind)}
                                                            <ExternalLink className="h-3.5 w-3.5" />
                                                        </button>
                                                    </div>
                                                </article>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        )}
                    </>
                ) : null}
            </div>

            {showPinPicker && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
                    <div className="max-h-[85vh] w-full max-w-lg overflow-hidden rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] shadow-2xl">
                        <div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-5 py-4">
                            <div>
                                <h3 className="text-lg font-bold text-[hsl(var(--text-primary))]">Pin charts</h3>
                                <p className="text-xs text-[hsl(var(--text-tertiary))]">
                                    Select up to {maxPins} chart or KPI cards ({draftPinIds.length}/{maxPins})
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowPinPicker(false)}
                                className="rounded-lg p-2 text-[hsl(var(--text-tertiary))] hover:bg-[hsl(var(--background))]"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="max-h-[50vh] space-y-2 overflow-y-auto px-5 py-4">
                            {pinCandidates.length === 0 ? (
                                <p className="text-sm text-[hsl(var(--text-secondary))]">
                                    No pinnable charts found. Create a chart or KPI question in Analytics first.
                                </p>
                            ) : (
                                pinCandidates.map((question) => {
                                    const selected = draftPinIds.includes(question.id);
                                    const disabled = !selected && draftPinIds.length >= maxPins;
                                    return (
                                        <button
                                            key={question.id}
                                            type="button"
                                            disabled={disabled}
                                            onClick={() => toggleDraftPin(question.id)}
                                            className={cn(
                                                'flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left transition',
                                                selected
                                                    ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/8'
                                                    : 'border-[hsl(var(--border))] bg-[hsl(var(--background))]',
                                                disabled && 'opacity-50',
                                            )}
                                        >
                                            <div>
                                                <p className="text-sm font-semibold text-[hsl(var(--text-primary))]">
                                                    {question.title}
                                                </p>
                                                <p className="text-xs uppercase tracking-wider text-[hsl(var(--text-tertiary))]">
                                                    {question.viz_type}
                                                </p>
                                            </div>
                                            <span className="text-xs font-bold text-[hsl(var(--primary))]">
                                                {selected ? 'Pinned' : 'Pin'}
                                            </span>
                                        </button>
                                    );
                                })
                            )}
                        </div>
                        {pinError && (
                            <p className="px-5 pb-2 text-xs text-[hsl(var(--error))]">{pinError}</p>
                        )}
                        <div className="flex gap-2 border-t border-[hsl(var(--border))] px-5 py-4">
                            <button
                                type="button"
                                onClick={() => setShowPinPicker(false)}
                                className="flex-1 rounded-md border border-[hsl(var(--border))] px-4 py-2 text-sm font-semibold text-[hsl(var(--text-secondary))]"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={savingPins}
                                onClick={() => void savePins()}
                                className="flex-1 rounded-md bg-[hsl(var(--primary))] px-4 py-2 text-sm font-semibold text-white hover:bg-[hsl(var(--primary-hover))] disabled:opacity-60"
                            >
                                {savingPins ? 'Saving…' : 'Save pins'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </StudioLayout>
    );
};

export default ProjectHub;
