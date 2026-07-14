import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    ChevronRight,
    Database,
    ExternalLink,
    FlaskConical,
    Image as ImageIcon,
    Loader2,
    Wrench,
} from 'lucide-react';

import StudioLayout from '../components/StudioLayout';
import SubmissionMediaGrid, { type SubmissionMediaItem } from '../components/hub/SubmissionMediaGrid';
import { useOrg } from '../contexts/OrgContext';
import { formAPI } from '../lib/api';

type MediaFilter = 'all' | 'image' | 'audio' | 'video' | 'signature' | 'file';

function cn(...parts: Array<string | false | null | undefined>) {
    return parts.filter(Boolean).join(' ');
}

const FormHome: React.FC = () => {
    const navigate = useNavigate();
    const { formId = '' } = useParams();
    const { projects, setCurrentProject } = useOrg();

    const [form, setForm] = useState<any>(null);
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [mediaItems, setMediaItems] = useState<SubmissionMediaItem[]>([]);
    const [mediaLoading, setMediaLoading] = useState(false);
    const [mediaFilter, setMediaFilter] = useState<MediaFilter>('all');

    useEffect(() => {
        if (!formId) return;
        let cancelled = false;
        const load = async () => {
            setLoading(true);
            setError(null);
            try {
                const [data, formStats] = await Promise.all([
                    formAPI.get(formId),
                    formAPI.getStats(formId).catch(() => null),
                ]);
                if (cancelled) return;
                setForm(data);
                setStats(formStats);
                const project = projects.find((p) => p.id === data.project_id);
                if (project) setCurrentProject(project);
            } catch (err: any) {
                if (!cancelled) {
                    setError(err?.response?.data?.detail || err?.message || 'Failed to load form');
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        void load();
        return () => {
            cancelled = true;
        };
    }, [formId, projects, setCurrentProject]);

    useEffect(() => {
        if (!formId) return;
        let cancelled = false;
        const load = async () => {
            setMediaLoading(true);
            try {
                const payload = await formAPI.listMedia(formId, { limit: 100 });
                if (!cancelled) setMediaItems(payload?.items || []);
            } catch {
                if (!cancelled) setMediaItems([]);
            } finally {
                if (!cancelled) setMediaLoading(false);
            }
        };
        void load();
        return () => {
            cancelled = true;
        };
    }, [formId]);

    const projectName = useMemo(() => {
        if (!form?.project_id) return null;
        return projects.find((p) => p.id === form.project_id)?.name || form.project_name || null;
    }, [form, projects]);

    const kindCounts = useMemo(() => {
        const counts: Record<string, number> = { all: mediaItems.length };
        for (const item of mediaItems) {
            counts[item.media_kind] = (counts[item.media_kind] || 0) + 1;
        }
        return counts;
    }, [mediaItems]);

    const filteredMedia = useMemo(() => {
        if (mediaFilter === 'all') return mediaItems;
        return mediaItems.filter((item) => item.media_kind === mediaFilter);
    }, [mediaItems, mediaFilter]);

    const submissionCount = stats?.submission_count ?? null;

    return (
        <StudioLayout
            activeNav="forms"
            onSelectNav={(key) => navigate(`/dashboard?tab=${key}`)}
            contentClassName="flex-1 overflow-y-auto bg-[hsl(var(--background))]"
        >
            <div className="relative min-h-full">
                <div
                    className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-gradient-to-b from-[hsl(var(--primary))]/[0.07] to-transparent"
                    aria-hidden
                />

                <div className="relative mx-auto max-w-6xl space-y-8 px-4 py-6 md:px-6 lg:px-8 lg:py-8">
                    {loading ? (
                        <div className="flex h-48 items-center justify-center gap-2 text-[hsl(var(--text-secondary))]">
                            <Loader2 className="h-5 w-5 animate-spin" />
                            Loading form…
                        </div>
                    ) : error ? (
                        <div className="rounded-2xl border border-[hsl(var(--error))]/20 bg-[hsl(var(--error))]/10 p-6 text-sm text-[hsl(var(--error))]">
                            {error}
                        </div>
                    ) : form ? (
                        <>
                            <header className="space-y-5">
                                <nav className="flex flex-wrap items-center gap-2 text-xs font-medium text-[hsl(var(--text-tertiary))]">
                                    <button
                                        type="button"
                                        onClick={() => navigate('/dashboard?tab=forms')}
                                        className="hover:text-[hsl(var(--text-secondary))]"
                                    >
                                        All Forms
                                    </button>
                                    <ChevronRight className="h-3.5 w-3.5" />
                                    {projectName && (
                                        <>
                                            <button
                                                type="button"
                                                onClick={() => navigate(`/projects/${form.project_id}/hub`)}
                                                className="hover:text-[hsl(var(--text-secondary))]"
                                            >
                                                {projectName}
                                            </button>
                                            <ChevronRight className="h-3.5 w-3.5" />
                                        </>
                                    )}
                                    <span className="text-[hsl(var(--text-secondary))]">{form.title}</span>
                                </nav>

                                <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                                    <div className="min-w-0 space-y-3">
                                        <div className="flex flex-wrap items-center gap-3">
                                            <h1 className="font-[family-name:var(--font-heading)] text-3xl font-bold tracking-tight text-[hsl(var(--text-primary))] md:text-4xl">
                                                {form.title}
                                            </h1>
                                            <span
                                                className={cn(
                                                    'rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                                                    form.status === 'live'
                                                        ? 'bg-[hsl(var(--success))]/15 text-[hsl(var(--success))]'
                                                        : 'bg-[hsl(var(--surface-elevated))] text-[hsl(var(--text-tertiary))]',
                                                )}
                                            >
                                                {form.status}
                                            </span>
                                            {form.kind === 'catalog' && (
                                                <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700">
                                                    Catalog
                                                </span>
                                            )}
                                        </div>

                                        <p className="text-sm text-[hsl(var(--text-secondary))]">
                                            v{form.version ?? form.published_version ?? 0}
                                            {form.updated_at
                                                ? ` · Updated ${new Date(form.updated_at).toLocaleDateString()}`
                                                : ''}
                                            {form.slug ? ` · /s/${form.slug}` : ''}
                                        </p>

                                        <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-[hsl(var(--text-secondary))]">
                                            <span>
                                                <span className="font-semibold text-[hsl(var(--text-primary))]">
                                                    {submissionCount != null ? submissionCount.toLocaleString() : '—'}
                                                </span>{' '}
                                                submissions
                                            </span>
                                            <span>
                                                <span className="font-semibold text-[hsl(var(--text-primary))]">
                                                    {mediaItems.length.toLocaleString()}
                                                </span>{' '}
                                                media
                                            </span>
                                            {stats?.last_submitted_at && (
                                                <span>
                                                    Last submission{' '}
                                                    <span className="font-semibold text-[hsl(var(--text-primary))]">
                                                        {new Date(stats.last_submitted_at).toLocaleDateString()}
                                                    </span>
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => navigate(`/builder/${form.id}`)}
                                            className="inline-flex items-center gap-2 rounded-lg bg-[hsl(var(--primary))] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[hsl(var(--primary-hover))]"
                                        >
                                            <Wrench className="h-4 w-4" />
                                            Design
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => navigate(`/simulator/${form.id}`)}
                                            className="inline-flex items-center gap-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface))] px-3.5 py-2.5 text-sm font-semibold text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))]"
                                        >
                                            <FlaskConical className="h-4 w-4" />
                                            Try
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => navigate('/dashboard?tab=datasets')}
                                            className="inline-flex items-center gap-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface))] px-3.5 py-2.5 text-sm font-semibold text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))]"
                                        >
                                            <Database className="h-4 w-4" />
                                            Data
                                        </button>
                                        {form.slug && form.status === 'live' && (
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    window.open(`/s/${form.slug}`, '_blank', 'noopener,noreferrer')
                                                }
                                                className="inline-flex items-center gap-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface))] px-3.5 py-2.5 text-sm font-semibold text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))]"
                                            >
                                                <ExternalLink className="h-4 w-4" />
                                                Public
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </header>

                            <section className="space-y-4">
                                <div className="flex flex-wrap items-end justify-between gap-3">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <ImageIcon className="h-4 w-4 text-[hsl(var(--primary))]" />
                                            <h2 className="text-base font-bold uppercase tracking-wider text-[hsl(var(--text-primary))]">
                                                Media library
                                            </h2>
                                        </div>
                                        <p className="mt-1 text-sm text-[hsl(var(--text-secondary))]">
                                            Photos, audio, video, and signatures collected through this form.
                                        </p>
                                    </div>
                                    {mediaItems.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5">
                                            {(
                                                [
                                                    { id: 'all' as const, label: 'All' },
                                                    { id: 'image' as const, label: 'Images' },
                                                    { id: 'audio' as const, label: 'Audio' },
                                                    { id: 'video' as const, label: 'Video' },
                                                    { id: 'signature' as const, label: 'Signatures' },
                                                    { id: 'file' as const, label: 'Files' },
                                                ] as const
                                            )
                                                .filter((f) => f.id === 'all' || (kindCounts[f.id] || 0) > 0)
                                                .map((f) => (
                                                    <button
                                                        key={f.id}
                                                        type="button"
                                                        onClick={() => setMediaFilter(f.id)}
                                                        className={cn(
                                                            'rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors',
                                                            mediaFilter === f.id
                                                                ? 'bg-[hsl(var(--primary))] text-white'
                                                                : 'bg-[hsl(var(--surface))] text-[hsl(var(--text-secondary))] border border-[hsl(var(--border))] hover:text-[hsl(var(--text-primary))]',
                                                        )}
                                                    >
                                                        {f.label}
                                                        <span className="ml-1 tabular-nums opacity-70">
                                                            {f.id === 'all' ? kindCounts.all : kindCounts[f.id] || 0}
                                                        </span>
                                                    </button>
                                                ))}
                                        </div>
                                    )}
                                </div>

                                {mediaLoading ? (
                                    <div className="flex items-center gap-2 py-12 text-sm text-[hsl(var(--text-secondary))]">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Loading media…
                                    </div>
                                ) : mediaItems.length === 0 ? (
                                    <div className="flex flex-col items-start gap-4 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] px-6 py-8 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="flex gap-4">
                                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]">
                                                <ImageIcon className="h-6 w-6" />
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-sm font-semibold text-[hsl(var(--text-primary))]">
                                                    No captures yet
                                                </p>
                                                <p className="max-w-md text-sm text-[hsl(var(--text-secondary))]">
                                                    When respondents submit photos, audio, video, or signatures, they
                                                    show up here for this form.
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            <button
                                                type="button"
                                                onClick={() => navigate(`/simulator/${form.id}`)}
                                                className="inline-flex items-center gap-1.5 rounded-lg border border-[hsl(var(--border))] px-3 py-2 text-xs font-semibold text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))]"
                                            >
                                                <FlaskConical className="h-3.5 w-3.5" />
                                                Try a submission
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => navigate(`/builder/${form.id}`)}
                                                className="inline-flex items-center gap-1.5 rounded-lg bg-[hsl(var(--primary))] px-3 py-2 text-xs font-semibold text-white hover:bg-[hsl(var(--primary-hover))]"
                                            >
                                                <Wrench className="h-3.5 w-3.5" />
                                                Add media fields
                                            </button>
                                        </div>
                                    </div>
                                ) : filteredMedia.length === 0 ? (
                                    <p className="py-8 text-sm text-[hsl(var(--text-tertiary))]">
                                        No items in this filter.
                                    </p>
                                ) : (
                                    <SubmissionMediaGrid items={filteredMedia} />
                                )}
                            </section>
                        </>
                    ) : null}
                </div>
            </div>
        </StudioLayout>
    );
};

export default FormHome;
