import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    AlertCircle,
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
    SquareCheckBig,
    Tag,
    UserCheck,
    Users,
    Wrench,
} from 'lucide-react';

import StudioLayout from '../components/StudioLayout';
import { useOrg } from '../contexts/OrgContext';
import { analyticsAPI, formAPI, projectAPI, reportAPI, submissionAPI, teamAPI } from '../lib/api';

function cn(...parts: Array<string | false | null | undefined>) {
    return parts.filter(Boolean).join(' ');
}

type PageTab = 'overview' | 'workspace';
type WorkspaceFilter = 'all' | 'forms' | 'catalogs' | 'datasets';

type HubForm = {
    id: string;
    title: string;
    status: string;
    kind?: 'standard' | 'catalog';
    updated_at?: string;
};

type HubDataset = {
    id: string;
    name: string;
    records_count?: number;
    updated_at?: string;
};

type HubReport = {
    id: string;
    title: string;
    status: string;
    updated_at: string;
};

type HubTeam = {
    id: string;
    name: string;
    memberCount: number;
};

const PAGE_TABS: Array<{ id: PageTab; label: string; hint: string }> = [
    { id: 'overview', label: 'Overview', hint: 'Informational command centre' },
    { id: 'workspace', label: 'Forms · Catalogs · Datasets', hint: 'Things power users tinker with' },
];

const WORKSPACE_FILTERS: Array<{ id: WorkspaceFilter; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'forms', label: 'Forms' },
    { id: 'catalogs', label: 'Catalogs' },
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
    if (kind === 'catalogs') return 'Open catalog';
    return 'Explore dataset';
}

const ProjectHub: React.FC = () => {
    const navigate = useNavigate();
    const { projectId = '' } = useParams();
    const { currentOrg, refreshCurrentProject, setCurrentProject } = useOrg();

    const [pageTab, setPageTab] = useState<PageTab>('overview');
    const [workspaceFilter, setWorkspaceFilter] = useState<WorkspaceFilter>('all');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [project, setProject] = useState<any>(null);
    const [forms, setForms] = useState<HubForm[]>([]);
    const [catalogForms, setCatalogForms] = useState<HubForm[]>([]);
    const [datasets, setDatasets] = useState<HubDataset[]>([]);
    const [reports, setReports] = useState<HubReport[]>([]);
    const [teams, setTeams] = useState<HubTeam[]>([]);
    const [tasks, setTasks] = useState<any[]>([]);
    const [submissions, setSubmissions] = useState<any[]>([]);
    const [attendanceToday, setAttendanceToday] = useState<any[]>([]);
    const [accessRules, setAccessRules] = useState<any[]>([]);

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
                    catalogKindForms,
                    reportRows,
                    taskRows,
                    access,
                    orgTeams,
                    sources,
                    attendance,
                ] = await Promise.all([
                    refreshCurrentProject(currentOrg.id, projectId),
                    formAPI.list(projectId, 'standard').catch(() => formAPI.list(projectId)),
                    formAPI.list(projectId, 'catalog').catch(() => []),
                    reportAPI.list(currentOrg.id, projectId),
                    projectAPI.listTasks(currentOrg.id, projectId),
                    projectAPI.listAccess(currentOrg.id, projectId),
                    teamAPI.list(currentOrg.id),
                    analyticsAPI.listSources(currentOrg.id).catch(() => []),
                    projectAPI.listAttendance(currentOrg.id, projectId, todayIso).catch(() => []),
                ]);

                const allForms: HubForm[] = Array.isArray(standardForms) ? standardForms : [];
                const catalogs: HubForm[] = Array.isArray(catalogKindForms) ? catalogKindForms : [];
                const formIds = [...allForms, ...catalogs].map((f) => f.id);

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
                setForms(allForms.filter((f) => f.kind !== 'catalog'));
                setCatalogForms(catalogs.length ? catalogs : allForms.filter((f) => f.kind === 'catalog'));
                setReports(reportRows || []);
                setTasks(taskRows || []);
                setAccessRules(access || []);
                setTeams(hubTeams);
                setDatasets(projectDatasets);
                setSubmissions(flatSubmissions);
                setAttendanceToday(attendance || []);
            } catch (err: any) {
                if (!cancelled) {
                    setError(err?.response?.data?.detail || err?.message || 'Failed to load ProjectHub');
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
            if (t.kind !== 'journey_visit' || !t.visit_date) return false;
            return t.visit_date === new Date().toISOString().slice(0, 10);
        });
        const visitsDone = todayVisits.filter((t) => t.status === 'done').length;
        return { done, open, total: tasks.length, visitsDone, visitsTotal: todayVisits.length };
    }, [tasks]);

    const checkedInToday = attendanceToday.filter((r) => r.status === 'checked_in' || r.status === 'checked_out').length;
    const publishedReports = reports.filter((r) => r.status === 'published').length;

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
            detail: 'journey visits',
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
            label: 'Reports published',
            value: publishedReports,
            total: Math.max(reports.length, 1),
            display: `${publishedReports}/${reports.length}`,
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
            onLaunch: () => navigate(`/builder/${form.id}`),
        }));
        const catalogCards = catalogForms.map((form) => ({
            id: form.id,
            title: form.title,
            description: 'Catalog used by field forms',
            kind: 'catalogs' as const,
            status: form.status,
            meta: form.updated_at ? `Updated ${new Date(form.updated_at).toLocaleDateString()}` : undefined,
            onLaunch: () => navigate(`/projects/${projectId}?tab=catalog`),
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
            onLaunch: () => navigate('/dashboard?tab=datasets'),
        }));
        const all = [...formCards, ...catalogCards, ...datasetCards];
        if (workspaceFilter === 'all') return all;
        return all.filter((card) => card.kind === workspaceFilter);
    }, [forms, catalogForms, datasets, workspaceFilter, navigate, projectId]);

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

    return (
        <StudioLayout
            activeNav="projects"
            onSelectNav={(key) => navigate(`/dashboard?tab=${key}`)}
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
                                ProjectHub — Phase 1 (live)
                            </p>
                            <p className="text-xs text-[hsl(var(--text-secondary))]">
                                Alerts, map, threads, and media stay hidden until later phases.
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={() => navigate(`/projects/${projectId}`)}
                            className="btn btn-secondary text-xs"
                        >
                            Open workspace
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
                        Loading ProjectHub…
                    </div>
                ) : error ? (
                    <div className="rounded-2xl border border-[hsl(var(--error))]/20 bg-[hsl(var(--error))]/10 p-6">
                        <div className="mb-2 flex items-center gap-2 text-[hsl(var(--error))]">
                            <AlertCircle className="h-5 w-5" />
                            <h2 className="font-semibold">ProjectHub unavailable</h2>
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
                                            Report Links
                                        </h2>
                                    </div>
                                    {reports.length === 0 ? (
                                        <p className="text-sm text-[hsl(var(--text-tertiary))]">No reports yet.</p>
                                    ) : (
                                        <ul className="space-y-2">
                                            {reports.slice(0, 6).map((report) => (
                                                <li key={report.id}>
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            navigate(`/projects/${projectId}/reports/${report.id}`)
                                                        }
                                                        className="flex w-full items-center justify-between gap-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-3 text-left transition hover:border-[hsl(var(--primary))]/40"
                                                    >
                                                        <div className="min-w-0">
                                                            <p className="truncate text-sm font-semibold text-[hsl(var(--text-primary))]">
                                                                {report.title}
                                                            </p>
                                                            <p className="text-xs capitalize text-[hsl(var(--text-tertiary))]">
                                                                {report.status}
                                                            </p>
                                                        </div>
                                                        <ExternalLink className="h-4 w-4 shrink-0 text-[hsl(var(--text-tertiary))]" />
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </section>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] px-4 py-3">
                                    <div className="flex items-center gap-2 text-sm text-[hsl(var(--text-secondary))]">
                                        <Wrench className="h-4 w-4 text-[hsl(var(--primary))]" />
                                        <span>Open a form, catalog, or dataset destination.</span>
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
                                                    : card.kind === 'catalogs'
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
        </StudioLayout>
    );
};

export default ProjectHub;
