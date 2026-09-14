import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Clock3, Loader2 } from 'lucide-react';

import { submissionAPI } from '../../lib/api';
import {
    apiErrorMessage,
    type ReviewQueueItem,
    type SubmissionReviewStatus,
} from '../../lib/opsApi';
import {
    filterReviewQueue,
    formatReviewWhen,
    mapFormSubmissions,
    resolveSubmitterLabel,
    reviewStatusLabel,
    summariseSubmissionData,
    summarizeReviewQueue,
    type ReviewFilter,
    type ReviewMember,
} from './opsReviewModel';

type CaptureForm = {
    id: string;
    title: string;
    kind?: 'standard' | 'directory';
};

type OpsReviewProps = {
    projectName?: string;
    forms: CaptureForm[];
    members: ReviewMember[];
    onPendingQueueChange?: (items: ReviewQueueItem[]) => void;
};

const FILTERS: Array<{ value: ReviewFilter; label: string }> = [
    { value: 'submitted', label: 'Pending' },
    { value: 'approved', label: 'Approved' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'all', label: 'All' },
];

const statusTone: Record<SubmissionReviewStatus, string> = {
    submitted: 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300',
    approved: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    rejected: 'border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300',
};

const OpsReview: React.FC<OpsReviewProps> = ({
    projectName,
    forms,
    members,
    onPendingQueueChange,
}) => {
    const captureForms = useMemo(
        () => forms.filter((form) => form.kind !== 'directory'),
        [forms],
    );
    const [items, setItems] = useState<ReviewQueueItem[]>([]);
    const [filter, setFilter] = useState<ReviewFilter>('submitted');
    const [comments, setComments] = useState<Record<string, string>>({});
    const [actingId, setActingId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const queues = await Promise.all(
                captureForms.map(async (form) => {
                    try {
                        const submissions = await submissionAPI.listForForm(form.id);
                        return mapFormSubmissions(form, submissions);
                    } catch (err) {
                        const message = apiErrorMessage(err, '');
                        if (message.toLowerCase().includes('permission')) {
                            throw err;
                        }
                        return [];
                    }
                }),
            );
            const next = queues.flat().sort((left, right) => right.created_at.localeCompare(left.created_at));
            setItems(next);
            onPendingQueueChange?.(next.filter((item) => item.review_status === 'submitted'));
        } catch (err) {
            setError(apiErrorMessage(err, 'Could not load the review queue.'));
        } finally {
            setLoading(false);
        }
    }, [captureForms, onPendingQueueChange]);

    useEffect(() => {
        void load();
    }, [load]);

    const summary = useMemo(() => summarizeReviewQueue(items), [items]);
    const visible = useMemo(() => filterReviewQueue(items, filter), [filter, items]);

    const handleReview = async (submissionId: string, reviewStatus: 'approved' | 'rejected') => {
        setActingId(submissionId);
        setError(null);
        try {
            const comment = comments[submissionId]?.trim();
            const updated = await submissionAPI.review(submissionId, {
                review_status: reviewStatus,
                ...(comment ? { review_comment: comment } : {}),
            });
            setItems((prev) => {
                const next = prev.map((item) =>
                    item.id === submissionId
                        ? {
                            ...item,
                            ...updated,
                            form_title: item.form_title,
                        }
                        : item,
                );
                onPendingQueueChange?.(next.filter((item) => item.review_status === 'submitted'));
                return next;
            });
            setComments((prev) => {
                const next = { ...prev };
                delete next[submissionId];
                return next;
            });
        } catch (err) {
            setError(apiErrorMessage(err, 'Failed to update submission review'));
        } finally {
            setActingId(null);
        }
    };

    return (
        <div className="mx-auto max-w-4xl space-y-4">
            <div>
                <h2 className="text-2xl font-bold text-[hsl(var(--text-primary))]">Review</h2>
                <p className="mt-1 text-sm text-[hsl(var(--text-secondary))]">
                    Submission queue{projectName ? ` for ${projectName}` : ''}. Approve or reject capture from the field.
                </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
                {[
                    { label: 'Pending', value: String(summary.pending) },
                    { label: 'Approved today', value: String(summary.approvedToday) },
                    { label: 'Rejected today', value: String(summary.rejectedToday) },
                ].map((kpi) => (
                    <div
                        key={kpi.label}
                        className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] px-4 py-3"
                    >
                        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[hsl(var(--text-tertiary))]">
                            {kpi.label}
                        </p>
                        <p className="mt-1 text-2xl font-bold tabular-nums text-[hsl(var(--text-primary))]">{kpi.value}</p>
                    </div>
                ))}
            </div>

            <div className="flex flex-wrap gap-2">
                {FILTERS.map((option) => (
                    <button
                        key={option.value}
                        type="button"
                        onClick={() => setFilter(option.value)}
                        className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${
                            filter === option.value
                                ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]'
                                : 'border-[hsl(var(--border))] text-[hsl(var(--text-secondary))]'
                        }`}
                    >
                        {option.label}
                    </button>
                ))}
            </div>

            {error && (
                <p className="rounded-md border border-[hsl(var(--error))]/20 bg-[hsl(var(--error))]/10 px-3 py-2 text-sm text-[hsl(var(--error))]">
                    {error}
                </p>
            )}

            <section className="overflow-hidden rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))]">
                <div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-4 py-3">
                    <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]">
                            <Clock3 className="h-4 w-4" />
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold text-[hsl(var(--text-primary))]">Queue</h3>
                            <p className="text-xs text-[hsl(var(--text-tertiary))]">
                                {loading ? 'Loading live submissions…' : 'Live submissions from this project'}
                            </p>
                        </div>
                    </div>
                    <span className="rounded-full border border-[hsl(var(--border))] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--text-tertiary))]">
                        {visible.length}
                    </span>
                </div>
                {loading ? (
                    <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-[hsl(var(--text-secondary))]">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading review queue
                    </div>
                ) : visible.length === 0 ? (
                    <p className="px-4 py-8 text-center text-sm text-[hsl(var(--text-tertiary))]">
                        {filter === 'submitted' ? 'No submissions awaiting review.' : 'No submissions in this filter.'}
                    </p>
                ) : (
                    <div className="divide-y divide-[hsl(var(--border))]/70">
                        {visible.map((entry) => (
                            <div key={entry.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
                                <div className="min-w-0">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--primary))]">
                                        {entry.form_title}
                                    </p>
                                    <p className="mt-0.5 text-sm font-semibold text-[hsl(var(--text-primary))]">
                                        {summariseSubmissionData(entry.data)}
                                    </p>
                                    <p className="mt-0.5 text-xs text-[hsl(var(--text-tertiary))]">
                                        {resolveSubmitterLabel(entry, members)} · {formatReviewWhen(entry.created_at)}
                                    </p>
                                    {entry.review_comment && (
                                        <p className="mt-1 text-xs text-[hsl(var(--text-secondary))]">
                                            Comment: {entry.review_comment}
                                        </p>
                                    )}
                                </div>
                                <div className="flex min-w-[220px] flex-1 flex-col items-end gap-2 sm:max-w-xs">
                                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${statusTone[entry.review_status]}`}>
                                        {reviewStatusLabel(entry.review_status)}
                                    </span>
                                    {entry.review_status === 'submitted' && (
                                        <>
                                            <input
                                                value={comments[entry.id] || ''}
                                                onChange={(event) =>
                                                    setComments((prev) => ({ ...prev, [entry.id]: event.target.value }))
                                                }
                                                placeholder="Optional review comment"
                                                className="input w-full text-xs"
                                            />
                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    disabled={actingId === entry.id}
                                                    onClick={() => void handleReview(entry.id, 'rejected')}
                                                    className="rounded-md border border-[hsl(var(--border))] px-2.5 py-1.5 text-xs font-semibold text-[hsl(var(--text-secondary))] disabled:opacity-40"
                                                >
                                                    Reject
                                                </button>
                                                <button
                                                    type="button"
                                                    disabled={actingId === entry.id}
                                                    onClick={() => void handleReview(entry.id, 'approved')}
                                                    className="rounded-md bg-[hsl(var(--primary))] px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
                                                >
                                                    Approve
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
};

export default OpsReview;
