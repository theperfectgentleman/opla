import React from 'react';
import {
    AlertTriangle,
    FileText,
    MoreHorizontal,
    Paperclip,
    TrendingUp,
} from 'lucide-react';

export type ReportCanvasMockProps = {
    boardTitle: string;
    sourceLabels: string[];
    comments: Array<{ id: string; author: string; body: string; createdAt: string }>;
    commentDraft: string;
    onCommentDraftChange: (value: string) => void;
    onPostComment: (event: React.FormEvent) => void;
};

function WidgetShell({
    title,
    children,
    className = '',
}: {
    title: string;
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <section
            className={`flex flex-col rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] shadow-sm ${className}`}
        >
            <div className="flex items-center justify-between border-b border-[hsl(var(--border))]/70 px-4 py-2.5">
                <h3 className="text-xs font-semibold text-[hsl(var(--text-primary))]">{title}</h3>
                <button
                    type="button"
                    className="rounded p-1 text-[hsl(var(--text-tertiary))] hover:bg-[hsl(var(--surface-elevated))]"
                    aria-label="Widget menu (mock)"
                    title="Widget actions — coming later"
                >
                    <MoreHorizontal className="h-3.5 w-3.5" />
                </button>
            </div>
            <div className="flex-1 p-4">{children}</div>
        </section>
    );
}

function SparkBars({ values, tone = 'primary' }: { values: number[]; tone?: 'primary' | 'amber' | 'sky' }) {
    const color =
        tone === 'amber'
            ? 'bg-amber-400/80'
            : tone === 'sky'
                ? 'bg-sky-400/80'
                : 'bg-[hsl(var(--primary))]/70';
    const max = Math.max(...values, 1);
    return (
        <div className="flex h-10 items-end gap-1">
            {values.map((v, i) => (
                <div
                    key={i}
                    className={`w-full rounded-sm ${color}`}
                    style={{ height: `${Math.max(12, (v / max) * 100)}%` }}
                />
            ))}
        </div>
    );
}

/** Dense stakeholder canvas mock — modular widgets to wire to live sources later. */
const ReportCanvasMock: React.FC<ReportCanvasMockProps> = ({
    boardTitle,
    sourceLabels,
    comments,
    commentDraft,
    onCommentDraftChange,
    onPostComment,
}) => {
    const risks = [
        { level: 'Critical', label: 'Low check-in in Zone B', tone: 'text-rose-600 bg-rose-500/10 border-rose-500/20' },
        { level: 'Medium', label: 'Review backlog growing', tone: 'text-amber-700 bg-amber-500/10 border-amber-500/20' },
        { level: 'Medium', label: 'Two agents offline today', tone: 'text-amber-700 bg-amber-500/10 border-amber-500/20' },
    ];

    const docs = [
        'Field plan — week 28',
        'QA sample pack',
        'Coverage map export',
    ];

    const feed = comments.slice(-4).reverse();

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] px-4 py-3">
                <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[hsl(var(--text-tertiary))]">
                        Report canvas
                    </p>
                    <p className="text-sm font-semibold text-[hsl(var(--text-primary))]">{boardTitle}</p>
                    <p className="text-xs text-[hsl(var(--text-tertiary))]">
                        {sourceLabels.length
                            ? `Sources: ${sourceLabels.join(' · ')}`
                            : 'No project sources linked yet'}
                    </p>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-200">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    Overall status: On track
                </div>
            </div>

            {/* Row 1 — health + timeline + financial mock */}
            <div className="grid gap-4 xl:grid-cols-12">
                <WidgetShell title="Programme health" className="xl:col-span-4">
                    <div className="grid grid-cols-3 gap-3">
                        {[
                            { label: 'Status', value: 'On track', bars: [4, 5, 6, 5, 7, 8], tone: 'primary' as const },
                            { label: 'Coverage', value: '78%', bars: [3, 4, 4, 5, 6, 7], tone: 'sky' as const },
                            { label: 'Timeline', value: '84%', bars: [2, 3, 5, 6, 7, 8], tone: 'amber' as const },
                        ].map((kpi) => (
                            <div key={kpi.label}>
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--text-tertiary))]">
                                    {kpi.label}
                                </p>
                                <p className="mt-1 text-sm font-bold text-[hsl(var(--text-primary))]">{kpi.value}</p>
                                <div className="mt-2">
                                    <SparkBars values={kpi.bars} tone={kpi.tone} />
                                </div>
                            </div>
                        ))}
                    </div>
                    <p className="mt-3 text-[10px] text-[hsl(var(--text-tertiary))]">Mock KPIs — bind to Hub / Ops later</p>
                </WidgetShell>

                <WidgetShell title="Field timeline & milestones" className="xl:col-span-5">
                    <div className="space-y-3">
                        {[
                            { name: 'Enumeration', start: 8, width: 28 },
                            { name: 'Training', start: 22, width: 18 },
                            { name: 'Active capture', start: 36, width: 40 },
                            { name: 'QA / review', start: 55, width: 30 },
                        ].map((row) => (
                            <div key={row.name} className="flex items-center gap-3">
                                <span className="w-24 shrink-0 truncate text-[11px] text-[hsl(var(--text-secondary))]">
                                    {row.name}
                                </span>
                                <div className="relative h-3 flex-1 rounded-full bg-[hsl(var(--background))]">
                                    <div
                                        className="absolute top-0 h-3 rounded-full bg-[hsl(var(--primary))]/50"
                                        style={{ left: `${row.start}%`, width: `${row.width}%` }}
                                    />
                                </div>
                            </div>
                        ))}
                        <div className="flex justify-between text-[10px] text-[hsl(var(--text-tertiary))]">
                            <span>Week 1</span>
                            <span>Week 6</span>
                            <span>Week 12</span>
                        </div>
                    </div>
                </WidgetShell>

                <WidgetShell title="Capture vs target" className="xl:col-span-3">
                    <div className="flex h-28 items-end justify-between gap-2">
                        {[
                            { a: 40, b: 55 },
                            { a: 62, b: 60 },
                            { a: 70, b: 72 },
                            { a: 58, b: 75 },
                        ].map((col, i) => (
                            <div key={i} className="flex flex-1 items-end justify-center gap-0.5">
                                <div className="w-2 rounded-t bg-[hsl(var(--primary))]" style={{ height: `${col.a}%` }} />
                                <div className="w-2 rounded-t bg-amber-400/80" style={{ height: `${col.b}%` }} />
                            </div>
                        ))}
                    </div>
                    <div className="mt-2 flex gap-3 text-[10px] text-[hsl(var(--text-tertiary))]">
                        <span className="inline-flex items-center gap-1">
                            <span className="h-2 w-2 rounded-sm bg-[hsl(var(--primary))]" /> Actual
                        </span>
                        <span className="inline-flex items-center gap-1">
                            <span className="h-2 w-2 rounded-sm bg-amber-400" /> Target
                        </span>
                    </div>
                </WidgetShell>
            </div>

            {/* Row 2 — progress, risks, velocity, docs */}
            <div className="grid gap-4 lg:grid-cols-12">
                <WidgetShell title="Weekly progress summary" className="lg:col-span-4">
                    <p className="text-xs font-semibold text-[hsl(var(--text-primary))]">Supervisor update</p>
                    <ul className="mt-2 space-y-1.5 text-xs text-[hsl(var(--text-secondary))]">
                        <li>• Coverage up 6pts week-over-week</li>
                        <li>• Zone A cleared; Zone B needs follow-up</li>
                        <li>• 14 submissions waiting in Review</li>
                    </ul>
                    <div className="mt-3 flex items-center gap-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2.5 py-2 text-[11px] text-[hsl(var(--text-tertiary))]">
                        <Paperclip className="h-3.5 w-3.5" />
                        Weekly readout.pdf (mock)
                    </div>
                </WidgetShell>

                <WidgetShell title="Key risks & issues" className="lg:col-span-3">
                    <ul className="space-y-2">
                        {risks.map((risk) => (
                            <li
                                key={risk.label}
                                className={`flex items-start gap-2 rounded-lg border px-2.5 py-2 text-xs ${risk.tone}`}
                            >
                                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                <div>
                                    <p className="font-bold uppercase tracking-wider text-[10px]">{risk.level}</p>
                                    <p className="mt-0.5 font-medium">{risk.label}</p>
                                </div>
                            </li>
                        ))}
                    </ul>
                </WidgetShell>

                <WidgetShell title="Submission velocity" className="lg:col-span-2">
                    <SparkBars values={[12, 18, 22, 19, 28, 31]} />
                    <p className="mt-3 text-2xl font-bold tabular-nums text-[hsl(var(--text-primary))]">186</p>
                    <p className="text-[10px] text-[hsl(var(--text-tertiary))]">Records this period (mock)</p>
                </WidgetShell>

                <WidgetShell title="Quick access · documents" className="lg:col-span-3">
                    <ul className="space-y-2">
                        {docs.map((doc) => (
                            <li
                                key={doc}
                                className="flex items-center gap-2 rounded-lg border border-[hsl(var(--border))]/70 bg-[hsl(var(--background))] px-2.5 py-2 text-xs text-[hsl(var(--text-secondary))]"
                            >
                                <FileText className="h-3.5 w-3.5 text-[hsl(var(--primary))]" />
                                {doc}
                            </li>
                        ))}
                    </ul>
                </WidgetShell>
            </div>

            {/* Row 3 — metrics + live comment feeds */}
            <div className="grid gap-4 lg:grid-cols-12">
                <WidgetShell title="Performance snapshots" className="lg:col-span-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-lg border border-[hsl(var(--border))]/70 bg-[hsl(var(--background))] p-3">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--text-tertiary))]">
                                Checked in
                            </p>
                            <p className="mt-1 text-xl font-bold tabular-nums">42</p>
                            <TrendingUp className="mt-2 h-3.5 w-3.5 text-emerald-500" />
                        </div>
                        <div className="rounded-lg border border-[hsl(var(--border))]/70 bg-[hsl(var(--background))] p-3">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--text-tertiary))]">
                                Pending review
                            </p>
                            <p className="mt-1 text-xl font-bold tabular-nums">14</p>
                            <SparkBars values={[8, 10, 12, 14]} tone="amber" />
                        </div>
                    </div>
                    <div className="mt-3">
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--text-tertiary))]">
                            Adoption / uptime (mock lines)
                        </p>
                        <div className="h-16 rounded-lg border border-[hsl(var(--border))]/60 bg-[hsl(var(--background))] p-2">
                            <svg viewBox="0 0 120 40" className="h-full w-full" aria-hidden>
                                <polyline
                                    fill="none"
                                    stroke="hsl(var(--primary))"
                                    strokeWidth="2"
                                    points="0,30 20,28 40,22 60,18 80,12 100,14 120,8"
                                />
                                <polyline
                                    fill="none"
                                    stroke="#fbbf24"
                                    strokeWidth="2"
                                    strokeOpacity="0.85"
                                    points="0,20 20,18 40,19 60,16 80,15 100,14 120,13"
                                />
                            </svg>
                        </div>
                    </div>
                </WidgetShell>

                <WidgetShell title="Recent highlights & questions" className="lg:col-span-8">
                    <div className="grid gap-3 md:grid-cols-2">
                        <div className="space-y-2">
                            {feed.length === 0 ? (
                                <p className="text-xs text-[hsl(var(--text-tertiary))]">No comments yet — ask the first question.</p>
                            ) : (
                                feed.map((row) => (
                                    <div
                                        key={row.id}
                                        className="rounded-lg border border-[hsl(var(--border))]/70 bg-[hsl(var(--background))] p-3"
                                    >
                                        <div className="flex items-center gap-2">
                                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[hsl(var(--primary))]/15 text-[10px] font-bold text-[hsl(var(--primary))]">
                                                {row.author.charAt(0).toUpperCase()}
                                            </div>
                                            <p className="text-xs font-semibold">{row.author}</p>
                                        </div>
                                        <p className="mt-1.5 text-xs text-[hsl(var(--text-secondary))]">{row.body}</p>
                                        <p className="mt-1 text-[10px] text-[hsl(var(--text-tertiary))]">
                                            {new Date(row.createdAt).toLocaleString()}
                                        </p>
                                    </div>
                                ))
                            )}
                        </div>
                        <form onSubmit={onPostComment} className="flex flex-col rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3">
                            <p className="text-xs font-semibold text-[hsl(var(--text-primary))]">Add comment / question</p>
                            <p className="mt-0.5 text-[10px] text-[hsl(var(--text-tertiary))]">
                                Seniors steer here — they don’t open field Ops from this board.
                            </p>
                            <textarea
                                className="input mt-2 min-h-[88px] flex-1 resize-none text-sm"
                                value={commentDraft}
                                onChange={(e) => onCommentDraftChange(e.target.value)}
                                placeholder="e.g. Why is Zone B lagging this week?"
                            />
                            <button type="submit" className="btn btn-primary mt-2 self-end text-xs">
                                Post
                            </button>
                        </form>
                    </div>
                </WidgetShell>
            </div>

            <p className="text-center text-[10px] text-[hsl(var(--text-tertiary))]">
                Mock canvas layout — widgets are placeholders to wire to project sources, Hub pins, and analytics later.
            </p>
        </div>
    );
};

export default ReportCanvasMock;
