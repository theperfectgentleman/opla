import React, { useEffect, useMemo, useState } from 'react';
import {
    FileText,
    Image as ImageIcon,
    Pencil,
    Play,
    Plus,
} from 'lucide-react';
import { formAPI } from '../../lib/api';

export type FormsDesignForm = {
    id: string;
    title: string;
    status: string;
    version: number;
    updated_at: string;
    kind?: 'standard' | 'directory';
};

export type FormsDesignPanelProps = {
    forms: FormsDesignForm[];
    /** Teams with project access — forms inherit this today. */
    teamsWithAccess: number;
    onCreate: () => void;
    onOpen: (formId: string) => void;
    onSimulate: (formId: string) => void;
    onOpenMedia: (formId: string) => void;
};

const STATUS_TONE: Record<string, string> = {
    draft: 'bg-slate-500/10 text-slate-600 dark:text-slate-300 border border-slate-500/20',
    live: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20',
    archived: 'bg-orange-500/10 text-orange-700 dark:text-orange-300 border border-orange-500/20',
};

function statusLabel(status: string) {
    if (status === 'live') return 'Live';
    if (status === 'archived') return 'Archived';
    return 'Draft';
}

const FormsDesignPanel: React.FC<FormsDesignPanelProps> = ({
    forms,
    teamsWithAccess,
    onCreate,
    onOpen,
    onSimulate,
    onOpenMedia,
}) => {
    const designForms = useMemo(
        () => forms.filter((form) => form.kind !== 'directory'),
        [forms],
    );

    const [submissionCounts, setSubmissionCounts] = useState<Record<string, number>>({});
    const [mediaCounts, setMediaCounts] = useState<Record<string, number>>({});

    useEffect(() => {
        let cancelled = false;
        const ids = designForms.map((f) => f.id);
        if (ids.length === 0) {
            setSubmissionCounts({});
            setMediaCounts({});
            return;
        }

        void Promise.all(
            ids.map(async (id) => {
                try {
                    const [stats, media] = await Promise.all([
                        formAPI.getStats(id),
                        formAPI.listMedia(id, { limit: 500 }),
                    ]);
                    return {
                        id,
                        submissions: Number(stats?.submission_count) || 0,
                        media: Number(media?.total) || (Array.isArray(media?.items) ? media.items.length : 0),
                    };
                } catch {
                    return { id, submissions: 0, media: 0 };
                }
            }),
        ).then((rows) => {
            if (cancelled) return;
            const nextSubmissions: Record<string, number> = {};
            const nextMedia: Record<string, number> = {};
            for (const row of rows) {
                nextSubmissions[row.id] = row.submissions;
                nextMedia[row.id] = row.media;
            }
            setSubmissionCounts(nextSubmissions);
            setMediaCounts(nextMedia);
        });

        return () => {
            cancelled = true;
        };
    }, [designForms]);

    const liveCount = designForms.filter((f) => f.status === 'live').length;
    const draftCount = designForms.filter((f) => f.status === 'draft' || !f.status).length;
    const totalSubmissions = designForms.reduce(
        (sum, form) => sum + (submissionCounts[form.id] || 0),
        0,
    );
    const totalMedia = designForms.reduce(
        (sum, form) => sum + (mediaCounts[form.id] || 0),
        0,
    );

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-[hsl(var(--text-primary))]">Forms</h2>
                    <p className="mt-1 text-sm text-[hsl(var(--text-secondary))]">
                        Design field instruments for this programme. Access comes from project Teams.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={onCreate}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[hsl(var(--primary))] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[hsl(var(--primary-hover))]"
                >
                    <Plus className="h-4 w-4" />
                    New
                </button>
            </div>

            <div className="grid grid-cols-2 gap-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] px-4 py-3 sm:grid-cols-5 sm:px-5">
                <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--text-tertiary))]">
                        Live
                    </p>
                    <p className="mt-1 text-xl font-bold tabular-nums text-[hsl(var(--text-primary))]">{liveCount}</p>
                </div>
                <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--text-tertiary))]">
                        Draft
                    </p>
                    <p className="mt-1 text-xl font-bold tabular-nums text-[hsl(var(--text-primary))]">{draftCount}</p>
                </div>
                <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--text-tertiary))]">
                        Submissions
                    </p>
                    <p className="mt-1 text-xl font-bold tabular-nums text-[hsl(var(--text-primary))]">
                        {totalSubmissions.toLocaleString()}
                    </p>
                </div>
                <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--text-tertiary))]">
                        Media
                    </p>
                    <p className="mt-1 text-xl font-bold tabular-nums text-[hsl(var(--text-primary))]">
                        {totalMedia.toLocaleString()}
                    </p>
                </div>
                <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--text-tertiary))]">
                        Teams with access
                    </p>
                    <p className="mt-1 text-xl font-bold tabular-nums text-[hsl(var(--text-primary))]">
                        {teamsWithAccess}
                    </p>
                </div>
            </div>

            <section className="overflow-hidden rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] shadow-sm">
                <div className="hidden border-b border-[hsl(var(--border))] px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--text-tertiary))] md:grid md:grid-cols-[minmax(0,1.6fr)_7rem_6.5rem_5.5rem_5.5rem_6.5rem] md:gap-3 lg:px-5">
                    <span>Form</span>
                    <span>Status</span>
                    <span>Submissions</span>
                    <span>Media</span>
                    <span>Teams</span>
                    <span className="text-right">Actions</span>
                </div>

                {designForms.length === 0 ? (
                    <p className="m-4 rounded-md border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--background))] py-8 text-center text-sm text-[hsl(var(--text-tertiary))] lg:m-5">
                        No forms yet.
                    </p>
                ) : (
                    <ul className="divide-y divide-[hsl(var(--border))]">
                        {designForms.map((form) => {
                            const submissions = submissionCounts[form.id] ?? 0;
                            const media = mediaCounts[form.id] ?? 0;
                            return (
                                <li
                                    key={form.id}
                                    className="grid gap-3 px-4 py-3 transition-colors hover:bg-[hsl(var(--background))]/60 md:grid-cols-[minmax(0,1.6fr)_7rem_6.5rem_5.5rem_5.5rem_6.5rem] md:items-center md:gap-3 lg:px-5"
                                >
                                    <div className="min-w-0">
                                        <div className="flex items-start gap-2.5">
                                            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]">
                                                <FileText className="h-4 w-4" />
                                            </div>
                                            <div className="min-w-0">
                                                <button
                                                    type="button"
                                                    onClick={() => onOpen(form.id)}
                                                    className="block truncate text-left text-sm font-semibold text-[hsl(var(--text-primary))] hover:text-[hsl(var(--primary))]"
                                                >
                                                    {form.title}
                                                </button>
                                                <p className="mt-0.5 text-[11px] text-[hsl(var(--text-tertiary))]">
                                                    v{form.version} · {new Date(form.updated_at).toLocaleDateString()}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <span
                                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                                                STATUS_TONE[form.status] || STATUS_TONE.draft
                                            }`}
                                        >
                                            {statusLabel(form.status)}
                                        </span>
                                    </div>

                                    <div>
                                        <p className="text-sm font-semibold tabular-nums text-[hsl(var(--text-primary))]">
                                            {submissions.toLocaleString()}
                                        </p>
                                    </div>

                                    <div>
                                        <p className="text-sm font-semibold tabular-nums text-[hsl(var(--text-primary))]">
                                            {media.toLocaleString()}
                                        </p>
                                    </div>

                                    <div>
                                        <span className="text-sm font-semibold tabular-nums text-[hsl(var(--text-primary))]">
                                            {teamsWithAccess}
                                        </span>
                                    </div>

                                    <div className="flex items-center justify-end gap-0.5">
                                        <button
                                            type="button"
                                            onClick={() => onOpen(form.id)}
                                            className="rounded p-1.5 text-[hsl(var(--text-tertiary))] hover:bg-[hsl(var(--primary))]/10 hover:text-[hsl(var(--primary))]"
                                            title="Edit form"
                                        >
                                            <Pencil className="h-3.5 w-3.5" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => onSimulate(form.id)}
                                            className="rounded p-1.5 text-[hsl(var(--text-tertiary))] hover:bg-[hsl(var(--primary))]/10 hover:text-[hsl(var(--primary))]"
                                            title="Simulate"
                                        >
                                            <Play className="h-3.5 w-3.5 fill-current" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => onOpenMedia(form.id)}
                                            className="rounded p-1.5 text-[hsl(var(--text-tertiary))] hover:bg-[hsl(var(--primary))]/10 hover:text-[hsl(var(--primary))]"
                                            title="Form media"
                                        >
                                            <ImageIcon className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </section>
        </div>
    );
};

export default FormsDesignPanel;
