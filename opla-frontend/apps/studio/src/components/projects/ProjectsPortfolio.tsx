import React, { useMemo } from 'react';
import {
    ChevronRight,
    FileText,
    Folder,
    Layers,
    Plus,
    Settings,
    Users,
} from 'lucide-react';
import type { AnalyticsSource } from '../analytics/types';

type ProjectStatus = 'planning' | 'active' | 'paused' | 'archived';

export type PortfolioProject = {
    id: string;
    name: string;
    description?: string | null;
    status: ProjectStatus;
    collection_start_date?: string | null;
    collection_end_date?: string | null;
    created_at: string;
};

type PortfolioForm = {
    id: string;
    project_id: string;
    kind?: string;
};

type PortfolioTask = {
    id: string;
    project_id: string;
    status: string;
};

export type ProjectsPortfolioProps<TProject extends PortfolioProject = PortfolioProject> = {
    projects: TProject[];
    forms: PortfolioForm[];
    datasetSources: AnalyticsSource[];
    tasks: PortfolioTask[];
    teamCount: number;
    onCreateProject: () => void;
    onOpenHub: (project: TProject) => void;
    onOpenWorkspace: (project: TProject) => void;
};

const STATUS_LABEL: Record<ProjectStatus, string> = {
    planning: 'Planning',
    active: 'Active',
    paused: 'Paused',
    archived: 'Archived',
};

const STATUS_CLASS: Record<ProjectStatus, string> = {
    planning: 'bg-sky-500/10 text-sky-700 border-sky-500/25',
    active: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/25',
    paused: 'bg-amber-500/10 text-amber-800 border-amber-500/25',
    archived: 'bg-slate-500/10 text-slate-600 border-slate-500/25',
};

function formatCompact(value: number): string {
    if (value >= 1_000_000) {
        return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
    }
    if (value >= 1_000) {
        return `${(value / 1_000).toFixed(1).replace(/\.0$/, '')}k`;
    }
    return value.toLocaleString();
}

function formatDateRange(start?: string | null, end?: string | null): string | null {
    if (!start && !end) return null;
    const fmt = (raw: string) =>
        new Date(raw).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    if (start && end) return `${fmt(start)} – ${fmt(end)}`;
    if (start) return `From ${fmt(start)}`;
    return `Until ${fmt(end!)}`;
}

function KpiCard({
    icon,
    label,
    value,
}: {
    icon: React.ReactNode;
    label: string;
    value: string;
}) {
    return (
        <div className="rounded-xl border border-[hsl(var(--primary))]/20 bg-[hsl(var(--surface))] px-3.5 py-2.5 shadow-sm">
            <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]">
                    {icon}
                </div>
                <div className="min-w-0">
                    <p className="text-xl font-bold leading-none tabular-nums text-[hsl(var(--text-primary))]">{value}</p>
                    <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[hsl(var(--text-tertiary))]">
                        {label}
                    </p>
                </div>
            </div>
        </div>
    );
}

function ProjectStat({
    icon: Icon,
    label,
    value,
}: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    value: string | number;
}) {
    return (
        <div className="flex items-start gap-1.5">
            <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[hsl(var(--primary))]" />
            <div className="min-w-0">
                <p className="text-base font-bold leading-none tabular-nums text-[hsl(var(--text-primary))]">
                    {value}
                </p>
                <p className="mt-0.5 text-[10px] font-semibold uppercase leading-none tracking-wide text-[hsl(var(--text-tertiary))]">
                    {label}
                </p>
            </div>
        </div>
    );
}

const ProjectsPortfolio = <TProject extends PortfolioProject = PortfolioProject>({
    projects,
    forms,
    datasetSources,
    tasks,
    teamCount,
    onCreateProject,
    onOpenHub,
    onOpenWorkspace,
}: ProjectsPortfolioProps<TProject>) => {
    const projectStats = useMemo(() => {
        const captureForms = forms.filter((form) => form.kind !== 'directory');
        const recordsByProject = datasetSources.reduce<Record<string, number>>((acc, source) => {
            if (!source.project_id) return acc;
            acc[source.project_id] = (acc[source.project_id] || 0) + (source.record_count || 0);
            return acc;
        }, {});

        const openTasksByProject = tasks.reduce<Record<string, number>>((acc, task) => {
            if (task.status === 'done' || task.status === 'cancelled') return acc;
            acc[task.project_id] = (acc[task.project_id] || 0) + 1;
            return acc;
        }, {});

        return projects.map((project) => ({
            project,
            formCount: captureForms.filter((form) => form.project_id === project.id).length,
            recordCount: recordsByProject[project.id] || 0,
            openTasks: openTasksByProject[project.id] || 0,
        }));
    }, [datasetSources, forms, projects, tasks]);

    const totals = useMemo(() => {
        const captureForms = forms.filter((form) => form.kind !== 'directory');
        const totalRecords = datasetSources.reduce((sum, source) => sum + (source.record_count || 0), 0);
        const activeProjects = projects.filter((project) => project.status === 'active').length;
        return {
            projects: projects.length,
            forms: captureForms.length,
            records: totalRecords,
            activeProjects,
        };
    }, [datasetSources, forms, projects]);

    return (
        <div className="relative min-h-full">
            <div
                className="pointer-events-none absolute inset-0 opacity-[0.35]"
                style={{
                    backgroundImage:
                        'linear-gradient(to right, hsl(var(--border)) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--border)) 1px, transparent 1px)',
                    backgroundSize: '28px 28px',
                }}
            />

            <div className="relative space-y-5">
                <div>
                    <nav className="text-xs font-medium text-[hsl(var(--text-tertiary))]">
                        <span>Dashboard</span>
                        <span className="mx-2 text-[hsl(var(--border))]">/</span>
                        <span className="text-[hsl(var(--text-secondary))]">Project portfolio</span>
                    </nav>
                    <h1 className="mt-1.5 font-serif text-3xl font-bold tracking-tight text-[hsl(var(--text-primary))]">
                        Projects
                    </h1>
                    <p className="mt-1 max-w-2xl text-sm text-[hsl(var(--text-secondary))]">
                        Run field operations from one place — plans, capture, tasks, and performance across every programme.
                    </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <KpiCard icon={<Folder className="h-4 w-4" />} label="Total projects" value={String(totals.projects)} />
                    <KpiCard icon={<FileText className="h-4 w-4" />} label="Capture forms" value={String(totals.forms)} />
                    <KpiCard
                        icon={<Layers className="h-4 w-4" />}
                        label="Records captured"
                        value={formatCompact(totals.records)}
                    />
                    <KpiCard
                        icon={<Users className="h-4 w-4" />}
                        label="Active programmes"
                        value={`${totals.activeProjects}${teamCount > 0 ? ` · ${teamCount} teams` : ''}`}
                    />
                </div>

                <div className="grid grid-cols-[repeat(auto-fill,minmax(327px,399px))] gap-3">
                    {projectStats.map(({ project, formCount, recordCount, openTasks }) => {
                        const dateRange = formatDateRange(project.collection_start_date, project.collection_end_date);
                        return (
                            <article
                                key={project.id}
                                className="group flex w-full flex-col rounded-xl border border-[hsl(var(--primary))]/15 bg-[hsl(var(--surface))] shadow-sm transition-all hover:border-[hsl(var(--primary))]/35 hover:shadow-md"
                            >
                                <div className="flex items-start justify-between gap-2 border-b border-[hsl(var(--border))]/60 px-3.5 py-2.5">
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h2 className="truncate font-serif text-lg font-bold text-[hsl(var(--text-primary))]">
                                                {project.name}
                                            </h2>
                                            <span
                                                className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${STATUS_CLASS[project.status]}`}
                                            >
                                                {STATUS_LABEL[project.status]}
                                            </span>
                                        </div>
                                        {dateRange ? (
                                            <p className="mt-0.5 text-xs text-[hsl(var(--text-tertiary))]">{dateRange}</p>
                                        ) : null}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => onOpenWorkspace(project)}
                                        className="rounded-md p-1 text-[hsl(var(--text-tertiary))] transition-colors hover:bg-[hsl(var(--surface-elevated))] hover:text-[hsl(var(--text-primary))]"
                                        title="Open Design"
                                    >
                                        <Settings className="h-4 w-4" />
                                    </button>
                                </div>

                                <div className="flex flex-col gap-3 px-3.5 py-3">
                                    <p className="line-clamp-2 overflow-hidden text-sm leading-snug text-[hsl(var(--text-secondary))]">
                                        {project.description?.trim() || 'No description yet — add context for your field team in project settings.'}
                                    </p>

                                    <div className="grid grid-cols-3 gap-3 py-1">
                                        <ProjectStat icon={FileText} label="Forms" value={formCount} />
                                        <ProjectStat icon={Layers} label="Records" value={formatCompact(recordCount)} />
                                        <ProjectStat icon={Users} label="Tasks" value={openTasks} />
                                    </div>
                                </div>

                                <div className="mt-auto border-t border-[hsl(var(--border))]/60 px-3.5 py-2.5">
                                    <button
                                        type="button"
                                        onClick={() => onOpenHub(project)}
                                        className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-[hsl(var(--primary))] px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-[hsl(var(--primary-hover))]"
                                    >
                                        Open project
                                        <ChevronRight className="h-4 w-4" />
                                    </button>
                                </div>
                            </article>
                        );
                    })}

                    <button
                        type="button"
                        onClick={onCreateProject}
                        className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[hsl(var(--primary))]/25 bg-[hsl(var(--surface))]/60 px-4 py-5 text-center transition-all hover:border-[hsl(var(--primary))]/45 hover:bg-[hsl(var(--primary))]/5"
                    >
                        <div className="mb-2.5 flex h-9 w-9 items-center justify-center rounded-full border border-[hsl(var(--primary))]/30 bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]">
                            <Plus className="h-4 w-4" />
                        </div>
                        <p className="text-sm font-semibold text-[hsl(var(--text-primary))]">Create new project</p>
                        <p className="mt-1 max-w-[14rem] text-xs text-[hsl(var(--text-secondary))]">
                            Start a field programme with targets, team access, and capture templates.
                        </p>
                    </button>
                </div>

                {projects.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--surface))] px-5 py-8 text-center">
                        <Folder className="mx-auto h-8 w-8 text-[hsl(var(--text-tertiary))] opacity-40" />
                        <h3 className="mt-3 text-base font-semibold">No projects yet</h3>
                        <p className="mt-1 text-sm text-[hsl(var(--text-secondary))]">
                            Create your first programme to assign tasks, design capture, and watch the day from Hub.
                        </p>
                    </div>
                ) : null}
            </div>
        </div>
    );
};

export default ProjectsPortfolio;
