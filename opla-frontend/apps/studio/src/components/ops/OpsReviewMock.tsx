import React from 'react';
import { Clock3 } from 'lucide-react';

type OpsReviewMockProps = {
    projectName?: string;
};

const MOCK_QUEUE = [
    { form: 'School visit form', title: 'Submission from Zone B', when: 'Today · 10:24', status: 'Submitted' },
    { form: 'Outlet audit', title: 'Photo set pending QA', when: 'Today · 09:51', status: 'Submitted' },
    { form: 'School visit form', title: 'Incomplete GPS pin', when: 'Yesterday · 17:02', status: 'Submitted' },
];

const OpsReviewMock: React.FC<OpsReviewMockProps> = ({ projectName }) => {
    return (
        <div className="mx-auto max-w-4xl space-y-4">
            <div>
                <h2 className="text-2xl font-bold text-[hsl(var(--text-primary))]">Review</h2>
                <p className="mt-1 text-sm text-[hsl(var(--text-secondary))]">
                    Submission queue{projectName ? ` for ${projectName}` : ''}. Mock layout — approve/reject wiring comes next.
                </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
                {[
                    { label: 'Pending', value: '14' },
                    { label: 'Approved today', value: '6' },
                    { label: 'Rejected today', value: '1' },
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

            <section className="overflow-hidden rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))]">
                <div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-4 py-3">
                    <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]">
                            <Clock3 className="h-4 w-4" />
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold text-[hsl(var(--text-primary))]">Queue</h3>
                            <p className="text-xs text-[hsl(var(--text-tertiary))]">Sample items — not live data</p>
                        </div>
                    </div>
                    <span className="rounded-full border border-[hsl(var(--border))] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--text-tertiary))]">
                        {MOCK_QUEUE.length}
                    </span>
                </div>
                <div className="divide-y divide-[hsl(var(--border))]/70">
                    {MOCK_QUEUE.map((item) => (
                        <div key={`${item.form}-${item.title}`} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                            <div className="min-w-0">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--primary))]">
                                    {item.form}
                                </p>
                                <p className="mt-0.5 text-sm font-semibold text-[hsl(var(--text-primary))]">{item.title}</p>
                                <p className="mt-0.5 text-xs text-[hsl(var(--text-tertiary))]">{item.when}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                                    {item.status}
                                </span>
                                <button
                                    type="button"
                                    disabled
                                    className="rounded-md border border-[hsl(var(--border))] px-2.5 py-1.5 text-xs font-semibold text-[hsl(var(--text-tertiary))]"
                                >
                                    Reject
                                </button>
                                <button
                                    type="button"
                                    disabled
                                    className="rounded-md bg-[hsl(var(--primary))]/15 px-2.5 py-1.5 text-xs font-semibold text-[hsl(var(--primary))]"
                                >
                                    Approve
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
};

export default OpsReviewMock;
