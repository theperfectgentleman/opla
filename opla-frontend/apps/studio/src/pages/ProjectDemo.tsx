import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ChevronLeft,
    ChevronRight,
    Database,
    ExternalLink,
    FileBarChart2,
    FileText,
    FlaskConical,
    Gauge,
    Image as ImageIcon,
    Link2,
    MapPin,
    MessageSquare,
    Star,
    Tag,
    Users,
    SquareCheckBig,
    Wrench,
} from 'lucide-react';

import StudioLayout from '../components/StudioLayout';

function cn(...parts: Array<string | false | null | undefined>) {
    return parts.filter(Boolean).join(' ');
}

type PageTab = 'overview' | 'workspace';
type WorkspaceFilter = 'all' | 'forms' | 'catalogs' | 'datasets';

type WorkspaceAsset = {
    id: string;
    title: string;
    description: string;
    owner: string;
    status: 'active' | 'draft' | 'published';
    kind: Exclude<WorkspaceFilter, 'all'>;
    favorited?: boolean;
    meta?: string;
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

const KPI = [
    {
        label: 'Form Submissions',
        value: '412',
        hint: '+35% since launch',
        hintTone: 'success' as const,
        icon: FileText,
        iconClass: 'bg-sky-500/10 text-sky-600',
    },
    {
        label: 'Hub Resources',
        value: '18',
        hint: 'Last added 2 hours ago',
        hintTone: 'muted' as const,
        icon: Link2,
        iconClass: 'bg-violet-500/10 text-violet-600',
    },
    {
        label: 'Avg Response Rate',
        value: '90.5%',
        hint: 'Target Met (>75%)',
        hintTone: 'success' as const,
        icon: Gauge,
        iconClass: 'bg-emerald-500/10 text-emerald-600',
    },
    {
        label: 'Assigned Members',
        value: '9',
        hint: 'Active across 3 teams',
        hintTone: 'muted' as const,
        icon: Users,
        iconClass: 'bg-amber-500/10 text-amber-600',
    },
];

const WORKSPACE_ASSETS: WorkspaceAsset[] = [
    {
        id: '1',
        title: 'Field Store Audit Form',
        description: 'Weekly shelf & pricing checks captured by collectors on mobile.',
        owner: 'Amina (Field Ops)',
        status: 'active',
        kind: 'forms',
        favorited: true,
        meta: '124 submissions this week',
    },
    {
        id: '2',
        title: 'Mystery Shopper Feedback',
        description: 'Short visit quality form with photo evidence and SLA tags.',
        owner: 'Ken (DevRel)',
        status: 'active',
        kind: 'forms',
        meta: '38 submissions this week',
    },
    {
        id: '3',
        title: 'SKU Reference Catalog',
        description: 'Canonical product list used by catalog-kind forms in the field.',
        owner: 'Priya (Merch)',
        status: 'active',
        kind: 'catalogs',
        favorited: true,
        meta: '2,140 items · 12 unpublished',
    },
    {
        id: '4',
        title: 'Competitor Pack Catalog',
        description: 'Alternate brand packs for side-by-side shelf audits.',
        owner: 'Priya (Merch)',
        status: 'draft',
        kind: 'catalogs',
        meta: '420 items · draft',
    },
    {
        id: '5',
        title: 'Beta Usage Logs Dataset',
        description: 'Synced submission + device telemetry for latency correlation.',
        owner: 'Sanjay (Eng)',
        status: 'active',
        kind: 'datasets',
        meta: '18.4k rows · refreshed hourly',
    },
    {
        id: '6',
        title: 'Approved Visits Dataset',
        description: 'Clean review-queue exports for analytics and reporting.',
        owner: 'Analytics',
        status: 'active',
        kind: 'datasets',
        meta: '6.1k rows · daily sync',
    },
];

const TEAMS = [
    { name: 'Field Ops', members: 4, focus: 'Store visits & attendance' },
    { name: 'Analytics', members: 3, focus: 'Datasets & reports' },
    { name: 'Developer Relations', members: 2, focus: 'Feedback & threads' },
];

const PROGRESS = [
    { label: 'Tasks done', value: 28, total: 40, color: 'bg-[hsl(var(--primary))]' },
    { label: 'Visits completed', value: 16, total: 22, color: 'bg-sky-500' },
    { label: 'Reports published', value: 3, total: 5, color: 'bg-violet-500' },
    { label: 'Catalog coverage', value: 88, total: 100, color: 'bg-amber-500', suffix: '%' },
];

const GALLERY = [
    {
        id: 'g1',
        title: 'Shelf bay A12',
        caption: 'Captured by Ade · today 09:14',
        tone: 'from-emerald-700/80 to-teal-900/90',
    },
    {
        id: 'g2',
        title: 'Entrance check-in',
        caption: 'Attendance photo · yesterday',
        tone: 'from-slate-700/80 to-slate-900/90',
    },
    {
        id: 'g3',
        title: 'Promo end-cap',
        caption: 'Captured by Chioma · 2d ago',
        tone: 'from-amber-700/70 to-orange-950/90',
    },
    {
        id: 'g4',
        title: 'Stock-out evidence',
        caption: 'Linked to task #482',
        tone: 'from-rose-800/70 to-stone-950/90',
    },
    {
        id: 'g5',
        title: 'Route overview',
        caption: 'Drone still · pilot corridor',
        tone: 'from-sky-800/70 to-indigo-950/90',
    },
];

const MAP_PINS = [
    { id: 'p1', label: 'Ikeja City Mall', x: 28, y: 34, status: 'done' as const },
    { id: 'p2', label: 'Maryland Hub', x: 46, y: 48, status: 'active' as const },
    { id: 'p3', label: 'Yaba Market', x: 58, y: 62, status: 'blocked' as const },
    { id: 'p4', label: 'Lekki Phase 1', x: 72, y: 40, status: 'todo' as const },
    { id: 'p5', label: 'Surulere Depot', x: 38, y: 70, status: 'done' as const },
];

const ACTIVITY = [
    {
        id: 'a1',
        author: 'Ken (DevRel)',
        team: 'Developer Relations',
        when: 'Friday',
        body: 'Collectors are reporting high latency on API calls near Maryland. Pin the usage-log dataset here for quick correlation.',
    },
    {
        id: 'a2',
        author: 'Amina',
        team: 'Field Ops',
        when: 'Today · 08:42',
        body: 'Checked in at Ikeja City Mall. 6 shelf photos uploaded to Assets; visit task moved to in progress.',
    },
    {
        id: 'a3',
        author: 'System',
        team: 'Automation',
        when: 'Today · 07:05',
        body: 'Dataset “Beta Usage Logs” refreshed · 312 new rows. Week 28 Ops Pulse report marked ready for review.',
    },
];

const REPORT_LINKS = [
    { title: 'Week 28 Ops Pulse', status: 'Published' },
    { title: 'Coverage heatmap draft', status: 'Draft' },
    { title: 'SKU gap summary', status: 'Published' },
];

function kindIcon(kind: WorkspaceAsset['kind']) {
    switch (kind) {
        case 'forms':
            return FileText;
        case 'datasets':
            return Database;
        case 'catalogs':
            return Tag;
    }
}

function statusTone(status: WorkspaceAsset['status']) {
    if (status === 'published') return 'bg-sky-500/10 text-sky-700 border-sky-500/20';
    if (status === 'draft') return 'bg-slate-500/10 text-slate-600 border-slate-500/20';
    return 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20';
}

const ProjectDemo: React.FC = () => {
    const navigate = useNavigate();
    const [pageTab, setPageTab] = useState<PageTab>('overview');
    const [workspaceFilter, setWorkspaceFilter] = useState<WorkspaceFilter>('all');
    const [galleryIndex, setGalleryIndex] = useState(0);
    const [selectedPin, setSelectedPin] = useState(MAP_PINS[1].id);

    const filteredWorkspace = useMemo(
        () =>
            workspaceFilter === 'all'
                ? WORKSPACE_ASSETS
                : WORKSPACE_ASSETS.filter((item) => item.kind === workspaceFilter),
        [workspaceFilter],
    );

    const activePin = MAP_PINS.find((pin) => pin.id === selectedPin) ?? MAP_PINS[0];

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
                                PDemo — Project Command Centre (mock)
                            </p>
                            <p className="text-xs text-[hsl(var(--text-secondary))]">
                                Overview is informational. Workspace tab is where forms, catalogs, and datasets live.
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => navigate('/dashboard?tab=projects')}
                        className="btn btn-secondary text-xs"
                    >
                        Back to Projects
                    </button>
                </div>

                <div className="flex flex-col gap-4 px-1 lg:flex-row lg:items-end lg:justify-between">
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-xs font-medium text-[hsl(var(--text-tertiary))]">
                            <span>Workspaces</span>
                            <ChevronRight className="h-3.5 w-3.5" />
                            <span className="text-[hsl(var(--text-secondary))]">Coastal Retail Pulse</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                            <h1 className="font-[family-name:var(--font-heading)] text-3xl font-bold tracking-tight text-[hsl(var(--text-primary))]">
                                Coastal Retail Pulse
                            </h1>
                            <span className="inline-flex rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                                Active
                            </span>
                        </div>
                        <p className="max-w-2xl text-sm text-[hsl(var(--text-secondary))]">
                            Stream project signals in on Overview. Jump to Workspace when you need to open forms,
                            catalogs, or datasets.
                        </p>
                    </div>
                    <SearchHint />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {KPI.map((item) => {
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
                        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                            <section className="overflow-hidden rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] shadow-sm">
                                <div className="flex items-center justify-between gap-3 border-b border-[hsl(var(--border))] px-5 py-4">
                                    <div className="flex items-center gap-2">
                                        <ImageIcon className="h-4 w-4 text-[hsl(var(--primary))]" />
                                        <h2 className="text-sm font-bold uppercase tracking-wider text-[hsl(var(--text-primary))]">
                                            Captured Assets
                                        </h2>
                                    </div>
                                    <span className="text-xs text-[hsl(var(--text-tertiary))]">
                                        {galleryIndex + 1} / {GALLERY.length}
                                    </span>
                                </div>
                                <div className="relative">
                                    <div
                                        className={cn(
                                            'flex h-56 items-end bg-gradient-to-br p-5 text-white',
                                            GALLERY[galleryIndex].tone,
                                        )}
                                    >
                                        <div>
                                            <p className="text-lg font-semibold">{GALLERY[galleryIndex].title}</p>
                                            <p className="text-sm text-white/80">{GALLERY[galleryIndex].caption}</p>
                                        </div>
                                    </div>
                                    <div className="absolute inset-y-0 left-0 flex items-center pl-2">
                                        <button
                                            type="button"
                                            aria-label="Previous asset"
                                            onClick={() =>
                                                setGalleryIndex((i) => (i - 1 + GALLERY.length) % GALLERY.length)
                                            }
                                            className="rounded-full bg-black/35 p-2 text-white backdrop-blur hover:bg-black/50"
                                        >
                                            <ChevronLeft className="h-4 w-4" />
                                        </button>
                                    </div>
                                    <div className="absolute inset-y-0 right-0 flex items-center pr-2">
                                        <button
                                            type="button"
                                            aria-label="Next asset"
                                            onClick={() => setGalleryIndex((i) => (i + 1) % GALLERY.length)}
                                            className="rounded-full bg-black/35 p-2 text-white backdrop-blur hover:bg-black/50"
                                        >
                                            <ChevronRight className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                                <div className="flex gap-2 overflow-x-auto p-4">
                                    {GALLERY.map((shot, index) => (
                                        <button
                                            key={shot.id}
                                            type="button"
                                            onClick={() => setGalleryIndex(index)}
                                            className={cn(
                                                'h-14 w-20 shrink-0 rounded-lg bg-gradient-to-br ring-offset-2',
                                                shot.tone,
                                                index === galleryIndex
                                                    ? 'ring-2 ring-[hsl(var(--primary))]'
                                                    : 'opacity-70 hover:opacity-100',
                                            )}
                                            aria-label={shot.title}
                                        />
                                    ))}
                                </div>
                            </section>

                            <section className="overflow-hidden rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] shadow-sm">
                                <div className="flex items-center justify-between gap-3 border-b border-[hsl(var(--border))] px-5 py-4">
                                    <div className="flex items-center gap-2">
                                        <MapPin className="h-4 w-4 text-rose-500" />
                                        <h2 className="text-sm font-bold uppercase tracking-wider text-[hsl(var(--text-primary))]">
                                            Map Coverage
                                        </h2>
                                    </div>
                                    <span className="text-xs text-[hsl(var(--text-tertiary))]">
                                        Attendance + visit pins (mock)
                                    </span>
                                </div>
                                <div className="relative h-64 overflow-hidden bg-[hsl(var(--background))]">
                                    <div
                                        className="absolute inset-0 opacity-70"
                                        style={{
                                            backgroundImage: `
                                                linear-gradient(hsl(var(--border)) 1px, transparent 1px),
                                                linear-gradient(90deg, hsl(var(--border)) 1px, transparent 1px)
                                            `,
                                            backgroundSize: '32px 32px',
                                        }}
                                    />
                                    <div className="absolute left-[12%] top-[18%] h-24 w-40 rounded-[40%] bg-emerald-500/10" />
                                    <div className="absolute bottom-[12%] right-[18%] h-28 w-36 rounded-[45%] bg-sky-500/10" />
                                    <svg className="absolute inset-0 h-full w-full" aria-hidden>
                                        <path
                                            d="M40 180 C 120 120, 200 220, 320 140 S 480 100, 560 160"
                                            fill="none"
                                            stroke="hsl(var(--primary))"
                                            strokeOpacity="0.35"
                                            strokeWidth="3"
                                            strokeDasharray="6 8"
                                        />
                                    </svg>
                                    {MAP_PINS.map((pin) => (
                                        <button
                                            key={pin.id}
                                            type="button"
                                            onClick={() => setSelectedPin(pin.id)}
                                            className="absolute -translate-x-1/2 -translate-y-full"
                                            style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
                                            title={pin.label}
                                        >
                                            <span
                                                className={cn(
                                                    'flex h-7 w-7 items-center justify-center rounded-full border-2 border-white shadow-md',
                                                    pin.status === 'done' && 'bg-emerald-500',
                                                    pin.status === 'active' && 'bg-sky-500',
                                                    pin.status === 'blocked' && 'bg-rose-500',
                                                    pin.status === 'todo' && 'bg-amber-500',
                                                    selectedPin === pin.id &&
                                                        'scale-110 ring-2 ring-[hsl(var(--primary))]',
                                                )}
                                            >
                                                <MapPin className="h-3.5 w-3.5 text-white" />
                                            </span>
                                        </button>
                                    ))}
                                </div>
                                <div className="flex items-start justify-between gap-3 border-t border-[hsl(var(--border))] px-5 py-4">
                                    <div>
                                        <p className="text-sm font-semibold text-[hsl(var(--text-primary))]">
                                            {activePin.label}
                                        </p>
                                        <p className="text-xs capitalize text-[hsl(var(--text-secondary))]">
                                            Visit status: {activePin.status.replace('_', ' ')}
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-wider">
                                        <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-emerald-700">
                                            Done
                                        </span>
                                        <span className="rounded-full bg-sky-500/10 px-2 py-1 text-sky-700">
                                            Active
                                        </span>
                                        <span className="rounded-full bg-rose-500/10 px-2 py-1 text-rose-700">
                                            Blocked
                                        </span>
                                        <span className="rounded-full bg-amber-500/10 px-2 py-1 text-amber-700">
                                            Todo
                                        </span>
                                    </div>
                                </div>
                            </section>
                        </div>

                        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                            <section className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] p-5 shadow-sm">
                                <div className="mb-4 flex items-center gap-2">
                                    <SquareCheckBig className="h-4 w-4 text-[hsl(var(--primary))]" />
                                    <h2 className="text-sm font-bold uppercase tracking-wider text-[hsl(var(--text-primary))]">
                                        Work Progress
                                    </h2>
                                </div>
                                <div className="space-y-4">
                                    {PROGRESS.map((row) => {
                                        const pct = Math.round((row.value / row.total) * 100);
                                        return (
                                            <div key={row.label}>
                                                <div className="mb-1.5 flex items-center justify-between text-xs">
                                                    <span className="font-medium text-[hsl(var(--text-secondary))]">
                                                        {row.label}
                                                    </span>
                                                    <span className="font-semibold text-[hsl(var(--text-primary))]">
                                                        {row.suffix
                                                            ? `${row.value}${row.suffix}`
                                                            : `${row.value}/${row.total}`}
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
                                <ul className="space-y-3">
                                    {TEAMS.map((team) => (
                                        <li
                                            key={team.name}
                                            className="flex items-center justify-between gap-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-3"
                                        >
                                            <div>
                                                <p className="text-sm font-semibold text-[hsl(var(--text-primary))]">
                                                    {team.name}
                                                </p>
                                                <p className="text-xs text-[hsl(var(--text-tertiary))]">{team.focus}</p>
                                            </div>
                                            <span className="rounded-full bg-[hsl(var(--surface))] px-2.5 py-1 text-xs font-bold text-[hsl(var(--text-secondary))]">
                                                {team.members}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </section>

                            <section className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] p-5 shadow-sm">
                                <div className="mb-4 flex items-center gap-2">
                                    <FileBarChart2 className="h-4 w-4 text-violet-600" />
                                    <h2 className="text-sm font-bold uppercase tracking-wider text-[hsl(var(--text-primary))]">
                                        Report Links
                                    </h2>
                                </div>
                                <ul className="space-y-2">
                                    {REPORT_LINKS.map((report) => (
                                        <li key={report.title}>
                                            <button
                                                type="button"
                                                className="flex w-full items-center justify-between gap-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-3 text-left transition hover:border-[hsl(var(--primary))]/40"
                                            >
                                                <div className="min-w-0">
                                                    <p className="truncate text-sm font-semibold text-[hsl(var(--text-primary))]">
                                                        {report.title}
                                                    </p>
                                                    <p className="text-xs text-[hsl(var(--text-tertiary))]">
                                                        {report.status}
                                                    </p>
                                                </div>
                                                <ExternalLink className="h-4 w-4 shrink-0 text-[hsl(var(--text-tertiary))]" />
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        </div>

                        <section className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] shadow-sm">
                            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[hsl(var(--border))] px-5 py-4">
                                <div className="flex items-center gap-2">
                                    <MessageSquare className="h-4 w-4 text-[hsl(var(--primary))]" />
                                    <h2 className="font-mono text-sm font-semibold text-[hsl(var(--text-primary))]">
                                        #project-threads
                                    </h2>
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                        Online
                                    </span>
                                </div>
                                <span className="text-xs text-[hsl(var(--text-tertiary))]">Chat stream</span>
                            </div>
                            <ul className="divide-y divide-[hsl(var(--border))]">
                                {ACTIVITY.map((item) => (
                                    <li key={item.id} className="flex gap-3 px-5 py-4">
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--primary))]/15 text-xs font-bold text-[hsl(var(--primary))]">
                                            {item.author
                                                .split(' ')
                                                .slice(0, 2)
                                                .map((part) => part[0])
                                                .join('')
                                                .slice(0, 2)
                                                .toUpperCase()}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <p className="text-sm font-semibold text-[hsl(var(--text-primary))]">
                                                    {item.author}
                                                </p>
                                                <span className="rounded-full bg-[hsl(var(--background))] px-2 py-0.5 text-[10px] font-medium text-[hsl(var(--text-tertiary))]">
                                                    {item.team}
                                                </span>
                                                <span className="text-xs text-[hsl(var(--text-tertiary))]">
                                                    {item.when}
                                                </span>
                                            </div>
                                            <p className="mt-1 text-sm leading-relaxed text-[hsl(var(--text-secondary))]">
                                                {item.body}
                                            </p>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] px-4 py-3">
                            <div className="flex items-center gap-2 text-sm text-[hsl(var(--text-secondary))]">
                                <Wrench className="h-4 w-4 text-[hsl(var(--primary))]" />
                                <span>
                                    Power-user tools — open a form, catalog, or dataset without leaving the project
                                    home.
                                </span>
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
                            {filteredWorkspace.map((asset) => {
                                const Icon = kindIcon(asset.kind);
                                return (
                                    <article
                                        key={asset.id}
                                        className="flex flex-col gap-4 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] p-5 shadow-sm"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex gap-3">
                                                <div className="rounded-xl bg-[hsl(var(--background))] p-2.5 text-[hsl(var(--primary))]">
                                                    <Icon className="h-5 w-5" />
                                                </div>
                                                <div>
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <h3 className="text-base font-semibold text-[hsl(var(--text-primary))]">
                                                            {asset.title}
                                                        </h3>
                                                        {asset.favorited && (
                                                            <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                                                        )}
                                                    </div>
                                                    <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-[hsl(var(--text-tertiary))]">
                                                        {asset.kind}
                                                    </p>
                                                    <p className="mt-1 text-sm text-[hsl(var(--text-secondary))]">
                                                        {asset.description}
                                                    </p>
                                                </div>
                                            </div>
                                            <span
                                                className={cn(
                                                    'shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                                                    statusTone(asset.status),
                                                )}
                                            >
                                                {asset.status}
                                            </span>
                                        </div>
                                        <div className="mt-auto flex flex-wrap items-center justify-between gap-3">
                                            <div className="text-xs text-[hsl(var(--text-tertiary))]">
                                                <span className="font-semibold text-[hsl(var(--text-secondary))]">
                                                    {asset.owner}
                                                </span>
                                                {asset.meta ? ` · ${asset.meta}` : null}
                                            </div>
                                            <button
                                                type="button"
                                                className="inline-flex items-center gap-1.5 rounded-lg bg-[hsl(var(--primary))] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[hsl(var(--primary-hover))]"
                                                title="Mock launch — would open the resource destination"
                                            >
                                                Launch
                                                <ExternalLink className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </StudioLayout>
    );
};

function SearchHint() {
    return (
        <div className="flex w-full max-w-md items-center gap-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] px-3 py-2.5 text-sm text-[hsl(var(--text-tertiary))] shadow-sm">
            <svg
                className="h-4 w-4 shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden
            >
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3.5-3.5" />
            </svg>
            <span>Search forms, datasets, teams…</span>
        </div>
    );
}

export default ProjectDemo;
