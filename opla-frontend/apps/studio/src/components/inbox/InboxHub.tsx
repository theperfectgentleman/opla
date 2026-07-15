import React from 'react';
import {
    CheckSquare,
    ChevronRight,
    Clock3,
    Folder,
    Inbox,
    Loader2,
    UserCheck,
} from 'lucide-react';
import type { InboxAttentionItem, InboxProject, ProjectPulse } from './useInboxAttention';

export type InboxHubProps = {
    projects: InboxProject[];
    loading: boolean;
    totals: {
        openTasks: number;
        pendingReview: number;
        checkedIn: number;
        activeProjects: number;
    };
    attentionItems: InboxAttentionItem[];
    onOpenAttendance: (projectId: string) => void;
    onOpenReview: (projectId: string) => void;
    onOpenProject: (projectId: string) => void;
    onOpenProjects: () => void;
};

function KpiTile({
    icon,
    label,
    value,
    hint,
    onClick,
}: {
    icon: React.ReactNode;
    label: string;
    value: string;
    hint: string;
    onClick?: () => void;
}) {
    const Tag = onClick ? 'button' : 'div';
    return (
        <Tag
            type={onClick ? 'button' : undefined}
            onClick={onClick}
            className={`rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] px-4 py-3 text-left shadow-sm ${
                onClick ? 'transition hover:border-[hsl(var(--primary))]/40 hover:shadow-md' : ''
            }`}
        >
            <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]">
                    {icon}
                </div>
                <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[hsl(var(--text-tertiary))]">
                        {label}
                    </p>
                    <p className="mt-1 text-2xl font-bold tabular-nums text-[hsl(var(--text-primary))]">{value}</p>
                    <p className="mt-0.5 text-xs text-[hsl(var(--text-secondary))]">{hint}</p>
                </div>
            </div>
        </Tag>
    );
}

const InboxHub: React.FC<InboxHubProps> = ({
    projects,
    loading,
    totals,
    attentionItems,
    onOpenAttendance,
    onOpenReview,
    onOpenProject,
    onOpenProjects,
}) => {
    return (
        <div className="space-y-6">
            <div>
                <div className="mb-2 flex items-center gap-2">
                    <Inbox className="h-7 w-7 text-[hsl(var(--primary))]" />
                    <h2 className="text-3xl font-bold">Inbox</h2>
                </div>
                <p className="text-[hsl(var(--text-secondary))]">
                    Your personal hub — notifications and what needs attention across programmes today.
                </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <KpiTile
                    icon={<Clock3 className="h-4 w-4" />}
                    label="Pending review"
                    value={String(totals.pendingReview)}
                    hint={totals.pendingReview ? 'Needs your action' : 'Queues clear'}
                />
                <KpiTile
                    icon={<UserCheck className="h-4 w-4" />}
                    label="Checked in today"
                    value={String(totals.checkedIn)}
                    hint="Across all projects"
                />
                <KpiTile
                    icon={<CheckSquare className="h-4 w-4" />}
                    label="Open tasks"
                    value={String(totals.openTasks)}
                    hint="Not done / cancelled"
                />
                <KpiTile
                    icon={<Folder className="h-4 w-4" />}
                    label="Active programmes"
                    value={String(totals.activeProjects)}
                    hint={`${projects.length} total projects`}
                    onClick={onOpenProjects}
                />
            </div>

            <section className="overflow-hidden rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] shadow-sm">
                <div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-4 py-3">
                    <div>
                        <h3 className="text-sm font-semibold text-[hsl(var(--text-primary))]">Needs attention</h3>
                        <p className="text-xs text-[hsl(var(--text-tertiary))]">
                            Same feed as the header bell — jump into the right project
                        </p>
                    </div>
                    {loading ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-[hsl(var(--text-tertiary))]">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Refreshing…
                        </span>
                    ) : null}
                </div>

                {projects.length === 0 ? (
                    <div className="px-4 py-10 text-center">
                        <p className="text-sm text-[hsl(var(--text-secondary))]">
                            Create a project to start receiving field activity here.
                        </p>
                        <button
                            type="button"
                            onClick={onOpenProjects}
                            className="mt-4 inline-flex items-center gap-1 rounded-lg bg-[hsl(var(--primary))] px-3 py-2 text-xs font-semibold text-white hover:bg-[hsl(var(--primary-hover))]"
                        >
                            Go to Projects
                            <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                    </div>
                ) : attentionItems.length === 0 ? (
                    <p className="px-4 py-10 text-center text-sm text-[hsl(var(--text-secondary))]">
                        You’re clear — nothing needs attention across programmes right now.
                    </p>
                ) : (
                    <div className="divide-y divide-[hsl(var(--border))]/70">
                        {attentionItems.map((item) => (
                            <div
                                key={item.id}
                                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                            >
                                <div className="min-w-0">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--primary))]">
                                        {item.projectName}
                                    </p>
                                    <p className="mt-0.5 font-semibold text-[hsl(var(--text-primary))]">{item.title}</p>
                                    <p className="mt-0.5 text-xs text-[hsl(var(--text-tertiary))]">{item.detail}</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (item.action === 'review') onOpenReview(item.projectId);
                                        else if (item.action === 'attendance') onOpenAttendance(item.projectId);
                                        else onOpenProject(item.projectId);
                                    }}
                                    className="inline-flex items-center gap-1 rounded-lg bg-[hsl(var(--primary))] px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-[hsl(var(--primary-hover))]"
                                >
                                    Open
                                    <ChevronRight className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
};

export type { ProjectPulse };
export default InboxHub;
