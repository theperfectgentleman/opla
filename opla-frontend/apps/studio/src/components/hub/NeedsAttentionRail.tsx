import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, AlertTriangle, ChevronLeft, ChevronRight, ExternalLink, Loader2, X } from 'lucide-react';

export type AttentionItem = {
    id: string;
    severity: 'info' | 'warning' | 'critical' | string;
    kind: string;
    title: string;
    detail?: string | null;
    deep_link?: string | null;
    updated_at?: string;
};

type SeverityFilter = 'all' | 'critical' | 'warning' | 'info';

const PAGE_SIZE = 9;

const SEVERITY_RANK: Record<string, number> = {
    critical: 3,
    warning: 2,
    info: 1,
};

function cn(...parts: Array<string | false | null | undefined>) {
    return parts.filter(Boolean).join(' ');
}

function severityStyles(severity: string) {
    if (severity === 'critical') {
        return {
            border: 'border-[hsl(var(--error))]/25',
            bg: 'bg-[hsl(var(--error))]/8',
            badge: 'bg-[hsl(var(--error))]/15 text-[hsl(var(--error))]',
            icon: 'text-[hsl(var(--error))]',
            accent: 'bg-[hsl(var(--error))]',
        };
    }
    if (severity === 'warning') {
        return {
            border: 'border-amber-500/25',
            bg: 'bg-amber-500/8',
            badge: 'bg-amber-500/15 text-amber-700',
            icon: 'text-amber-600',
            accent: 'bg-amber-500',
        };
    }
    return {
        border: 'border-sky-500/25',
        bg: 'bg-sky-500/8',
        badge: 'bg-sky-500/15 text-sky-700',
        icon: 'text-sky-600',
        accent: 'bg-sky-500',
    };
}

function kindLabel(kind: string) {
    if (kind === 'automation_alert') return 'automation';
    return kind.replaceAll('_', ' ');
}

type Props = {
    items: AttentionItem[];
    canDismiss: boolean;
    dismissingId: string | null;
    onOpen: (item: AttentionItem) => void;
    onDismiss: (itemId: string) => void;
};

const NeedsAttentionRail: React.FC<Props> = ({ items, canDismiss, dismissingId, onOpen, onDismiss }) => {
    const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
    const [page, setPage] = useState(0);

    const counts = useMemo(() => {
        const next = { all: items.length, critical: 0, warning: 0, info: 0 };
        for (const item of items) {
            if (item.severity === 'critical') next.critical += 1;
            else if (item.severity === 'warning') next.warning += 1;
            else next.info += 1;
        }
        return next;
    }, [items]);

    const filtered = useMemo(() => {
        const next = severityFilter === 'all' ? [...items] : items.filter((item) => item.severity === severityFilter);
        next.sort((a, b) => {
            const rankDiff = (SEVERITY_RANK[b.severity] || 0) - (SEVERITY_RANK[a.severity] || 0);
            if (rankDiff !== 0) return rankDiff;
            const aTime = a.updated_at ? Date.parse(a.updated_at) : 0;
            const bTime = b.updated_at ? Date.parse(b.updated_at) : 0;
            return bTime - aTime;
        });
        return next;
    }, [items, severityFilter]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

    useEffect(() => {
        setPage(0);
    }, [severityFilter, items.length]);

    useEffect(() => {
        if (page > totalPages - 1) setPage(Math.max(0, totalPages - 1));
    }, [page, totalPages]);

    const pageItems = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
    const rangeStart = filtered.length === 0 ? 0 : page * PAGE_SIZE + 1;
    const rangeEnd = Math.min(filtered.length, page * PAGE_SIZE + pageItems.length);

    const filters: Array<{ id: SeverityFilter; label: string; count: number }> = [
        { id: 'all', label: 'All', count: counts.all },
        { id: 'critical', label: 'Critical', count: counts.critical },
        { id: 'warning', label: 'Warning', count: counts.warning },
    ];
    if (counts.info > 0) {
        filters.push({ id: 'info', label: 'Info', count: counts.info });
    }

    return (
        <section className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] p-4 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <h2 className="text-sm font-bold uppercase tracking-wider text-[hsl(var(--text-primary))]">
                        Needs Attention
                    </h2>
                    <span className="rounded-full bg-[hsl(var(--background))] px-2 py-0.5 text-[10px] font-bold text-[hsl(var(--text-tertiary))]">
                        {items.length}
                    </span>
                </div>
                <span className="text-xs text-[hsl(var(--text-tertiary))]">Derived from project hooks</span>
            </div>

            {items.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-6 text-center">
                    <p className="text-sm text-[hsl(var(--text-secondary))]">Nothing needs attention right now.</p>
                </div>
            ) : (
                <>
                    <div className="mb-3 flex flex-wrap items-center gap-1.5">
                        {filters.map((filter) => (
                            <button
                                key={filter.id}
                                type="button"
                                onClick={() => setSeverityFilter(filter.id)}
                                className={cn(
                                    'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors',
                                    severityFilter === filter.id
                                        ? 'border-[hsl(var(--primary))]/30 bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]'
                                        : 'border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))]',
                                )}
                            >
                                {filter.label}
                                <span className="tabular-nums opacity-70">{filter.count}</span>
                            </button>
                        ))}
                    </div>

                    {filtered.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-6 text-center">
                            <p className="text-sm text-[hsl(var(--text-secondary))]">
                                No {severityFilter} items in this feed.
                            </p>
                        </div>
                    ) : (
                        <>
                            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                                {pageItems.map((item) => {
                                    const styles = severityStyles(item.severity);
                                    return (
                                        <li
                                            key={item.id}
                                            className={cn(
                                                'relative flex min-h-[7.5rem] flex-col overflow-hidden rounded-xl border',
                                                styles.border,
                                                styles.bg,
                                            )}
                                        >
                                            <div className={cn('absolute inset-y-0 left-0 w-1', styles.accent)} />
                                            <div className="flex items-start justify-between gap-2 px-3 pb-1 pt-2.5 pl-3.5">
                                                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                                                    <AlertCircle className={cn('h-3.5 w-3.5 shrink-0', styles.icon)} />
                                                    <span
                                                        className={cn(
                                                            'rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider',
                                                            styles.badge,
                                                        )}
                                                    >
                                                        {item.severity}
                                                    </span>
                                                    <span className="truncate text-[9px] font-medium uppercase tracking-wider text-[hsl(var(--text-tertiary))]">
                                                        {kindLabel(item.kind)}
                                                    </span>
                                                </div>
                                                <div className="flex shrink-0 items-center gap-0.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => onOpen(item)}
                                                        className="rounded-md p-1 text-[hsl(var(--text-tertiary))] hover:bg-[hsl(var(--surface))] hover:text-[hsl(var(--text-primary))]"
                                                        title="Open"
                                                    >
                                                        <ExternalLink className="h-3.5 w-3.5" />
                                                    </button>
                                                    {canDismiss && (
                                                        <button
                                                            type="button"
                                                            onClick={() => onDismiss(item.id)}
                                                            disabled={dismissingId === item.id}
                                                            className="rounded-md p-1 text-[hsl(var(--text-tertiary))] hover:bg-[hsl(var(--surface))] hover:text-[hsl(var(--text-primary))] disabled:opacity-50"
                                                            title="Dismiss"
                                                        >
                                                            {dismissingId === item.id ? (
                                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                            ) : (
                                                                <X className="h-3.5 w-3.5" />
                                                            )}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => onOpen(item)}
                                                className="flex flex-1 flex-col px-3.5 pb-3 text-left"
                                            >
                                                <p className="line-clamp-2 text-sm font-semibold leading-snug text-[hsl(var(--text-primary))]">
                                                    {item.title}
                                                </p>
                                                {item.detail && (
                                                    <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-[hsl(var(--text-secondary))]">
                                                        {item.detail}
                                                    </p>
                                                )}
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>

                            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[hsl(var(--border))] pt-3">
                                <p className="text-xs text-[hsl(var(--text-tertiary))]">
                                    Showing{' '}
                                    <span className="font-semibold text-[hsl(var(--text-secondary))]">
                                        {rangeStart}–{rangeEnd}
                                    </span>{' '}
                                    of {filtered.length}
                                    {severityFilter !== 'all' ? ` · ${severityFilter}` : ''}
                                </p>
                                <div className="flex items-center gap-1.5">
                                    <button
                                        type="button"
                                        onClick={() => setPage((p) => Math.max(0, p - 1))}
                                        disabled={page === 0}
                                        className="inline-flex items-center gap-1 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2.5 py-1.5 text-xs font-semibold text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                        <ChevronLeft className="h-3.5 w-3.5" />
                                        Prev
                                    </button>
                                    <span className="min-w-[4.5rem] text-center text-xs font-semibold tabular-nums text-[hsl(var(--text-secondary))]">
                                        {page + 1} / {totalPages}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                                        disabled={page >= totalPages - 1}
                                        className="inline-flex items-center gap-1 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2.5 py-1.5 text-xs font-semibold text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                        Next
                                        <ChevronRight className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </>
            )}
        </section>
    );
};

export default NeedsAttentionRail;
