import React, { useMemo, useState } from 'react';
import { ChevronRight, FileBarChart2, Plus, Users } from 'lucide-react';
import {
    createReportBucket,
    listReportBuckets,
    REPORT_GRANT_ROLE_LABELS,
    type ReportBucket,
    type ReportGrantRole,
    type ReportTeamGrant,
} from '../../lib/reportBuckets';

type PortfolioProject = { id: string; name: string };
type PortfolioTeam = { id: string; name: string };

export type ReportsPortfolioProps = {
    orgId: string;
    projects: PortfolioProject[];
    teams: PortfolioTeam[];
    /** Legacy project-scoped reports synced into buckets */
    legacyReports: Array<{
        id: string;
        project_id: string;
        project_name: string;
        title: string;
        description?: string;
        status: 'draft' | 'published' | 'archived';
        updated_at: string;
    }>;
    onOpenBucket: (bucketId: string) => void;
    onRefresh?: () => void;
};

const ReportsPortfolio: React.FC<ReportsPortfolioProps> = ({
    orgId,
    projects,
    teams,
    legacyReports,
    onOpenBucket,
}) => {
    const [tick, setTick] = useState(0);
    const [showCreate, setShowCreate] = useState(false);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [sourceIds, setSourceIds] = useState<string[]>([]);
    const [grantTeamId, setGrantTeamId] = useState('');
    const [grantRole, setGrantRole] = useState<ReportGrantRole>('viewer');
    const [pendingGrants, setPendingGrants] = useState<ReportTeamGrant[]>([]);

    const buckets = useMemo(() => {
        void tick;
        return listReportBuckets(orgId);
    }, [orgId, tick, legacyReports.length]);

    const projectName = (id: string) => projects.find((p) => p.id === id)?.name || 'Unknown project';

    const toggleSource = (projectId: string) => {
        setSourceIds((prev) =>
            prev.includes(projectId) ? prev.filter((id) => id !== projectId) : [...prev, projectId],
        );
    };

    const addGrant = () => {
        if (!grantTeamId) return;
        const team = teams.find((row) => row.id === grantTeamId);
        if (!team) return;
        setPendingGrants((prev) => {
            const without = prev.filter((g) => g.teamId !== team.id);
            return [...without, { teamId: team.id, teamName: team.name, role: grantRole }];
        });
        setGrantTeamId('');
    };

    const handleCreate = (event: React.FormEvent) => {
        event.preventDefault();
        if (!title.trim()) return;
        const created = createReportBucket(orgId, {
            title: title.trim(),
            description: description.trim(),
            sourceProjectIds: sourceIds,
            teamGrants: pendingGrants,
        });
        setTitle('');
        setDescription('');
        setSourceIds([]);
        setPendingGrants([]);
        setShowCreate(false);
        setTick((n) => n + 1);
        onOpenBucket(created.id);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold mb-2">Reports</h2>
                    <p className="text-[hsl(var(--text-secondary))] max-w-2xl">
                        Stakeholder boards — combine programme sources, grant Teams access, and let seniors
                        see / comment / explore without touching field Ops.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => setShowCreate(true)}
                    className="inline-flex items-center gap-2 rounded-lg bg-[hsl(var(--primary))] px-4 py-2 text-sm font-semibold text-white hover:bg-[hsl(var(--primary-hover))]"
                >
                    <Plus className="h-4 w-4" />
                    New report board
                </button>
            </div>

            {showCreate ? (
                <form
                    onSubmit={handleCreate}
                    className="space-y-4 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] p-5 shadow-sm"
                >
                    <div className="grid gap-4 md:grid-cols-2">
                        <div>
                            <label className="label">Title</label>
                            <input
                                className="input"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="e.g. School Outreach — Q3 board"
                                required
                            />
                        </div>
                        <div>
                            <label className="label">Description</label>
                            <input
                                className="input"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="What seniors should understand here"
                            />
                        </div>
                    </div>

                    <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[hsl(var(--text-tertiary))]">
                            Source projects
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {projects.length === 0 ? (
                                <p className="text-sm text-[hsl(var(--text-secondary))]">No projects yet.</p>
                            ) : (
                                projects.map((project) => {
                                    const on = sourceIds.includes(project.id);
                                    return (
                                        <button
                                            key={project.id}
                                            type="button"
                                            onClick={() => toggleSource(project.id)}
                                            className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                                                on
                                                    ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]'
                                                    : 'border-[hsl(var(--border))] text-[hsl(var(--text-secondary))]'
                                            }`}
                                        >
                                            {project.name}
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[hsl(var(--text-tertiary))]">
                            Team access (mock)
                        </p>
                        <div className="flex flex-wrap items-end gap-2">
                            <div className="min-w-[160px]">
                                <label className="label">Team</label>
                                <select
                                    className="input py-2"
                                    value={grantTeamId}
                                    onChange={(e) => setGrantTeamId(e.target.value)}
                                >
                                    <option value="">Select team</option>
                                    {teams.map((team) => (
                                        <option key={team.id} value={team.id}>{team.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="min-w-[140px]">
                                <label className="label">Role</label>
                                <select
                                    className="input py-2"
                                    value={grantRole}
                                    onChange={(e) => setGrantRole(e.target.value as ReportGrantRole)}
                                >
                                    {(Object.keys(REPORT_GRANT_ROLE_LABELS) as ReportGrantRole[]).map((role) => (
                                        <option key={role} value={role}>{REPORT_GRANT_ROLE_LABELS[role]}</option>
                                    ))}
                                </select>
                            </div>
                            <button
                                type="button"
                                onClick={addGrant}
                                className="rounded-lg border border-[hsl(var(--border))] px-3 py-2 text-xs font-semibold"
                            >
                                Add grant
                            </button>
                        </div>
                        {pendingGrants.length > 0 ? (
                            <ul className="mt-2 space-y-1 text-xs text-[hsl(var(--text-secondary))]">
                                {pendingGrants.map((grant) => (
                                    <li key={grant.teamId}>
                                        <Users className="mr-1 inline h-3 w-3" />
                                        {grant.teamName} · {REPORT_GRANT_ROLE_LABELS[grant.role]}
                                    </li>
                                ))}
                            </ul>
                        ) : null}
                    </div>

                    <div className="flex justify-end gap-2">
                        <button
                            type="button"
                            onClick={() => setShowCreate(false)}
                            className="rounded-lg border border-[hsl(var(--border))] px-3 py-2 text-sm font-semibold"
                        >
                            Cancel
                        </button>
                        <button type="submit" className="btn btn-primary">
                            Create board
                        </button>
                    </div>
                </form>
            ) : null}

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {buckets.length === 0 ? (
                    <div className="col-span-full rounded-xl border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--surface))] p-10 text-center text-sm text-[hsl(var(--text-secondary))]">
                        No report boards yet. Create one to pull seniors into a read-only window on the work.
                    </div>
                ) : (
                    buckets.map((bucket) => (
                        <BucketCard
                            key={bucket.id}
                            bucket={bucket}
                            projectName={projectName}
                            onOpen={() => onOpenBucket(bucket.id)}
                        />
                    ))
                )}
            </div>

            {legacyReports.length > 0 ? (
                <p className="text-xs text-[hsl(var(--text-tertiary))]">
                    {legacyReports.length} legacy project report
                    {legacyReports.length === 1 ? '' : 's'} still exist in the API — open a board or create a new
                    one to use the stakeholder model. Sync from project workspace is coming.
                </p>
            ) : null}
        </div>
    );
};

function BucketCard({
    bucket,
    projectName,
    onOpen,
}: {
    bucket: ReportBucket;
    projectName: (id: string) => string;
    onOpen: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onOpen}
            className="flex flex-col rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] p-5 text-left shadow-sm transition hover:border-[hsl(var(--primary))]/40"
        >
            <div className="flex items-start justify-between gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]">
                    <FileBarChart2 className="h-4 w-4" />
                </div>
                <span className="rounded-full border border-[hsl(var(--border))] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--text-tertiary))]">
                    {bucket.status}
                </span>
            </div>
            <h3 className="mt-3 text-base font-semibold text-[hsl(var(--text-primary))]">{bucket.title}</h3>
            <p className="mt-1 line-clamp-2 text-sm text-[hsl(var(--text-secondary))]">
                {bucket.description || 'Stakeholder board'}
            </p>
            <p className="mt-3 text-xs text-[hsl(var(--text-tertiary))]">
                Sources:{' '}
                {bucket.sourceProjectIds.length
                    ? bucket.sourceProjectIds.map(projectName).join(', ')
                    : 'None yet'}
            </p>
            <p className="mt-1 text-xs text-[hsl(var(--text-tertiary))]">
                Teams: {bucket.teamGrants.length
                    ? bucket.teamGrants.map((g) => `${g.teamName} (${REPORT_GRANT_ROLE_LABELS[g.role]})`).join(', ')
                    : 'No grants yet'}
            </p>
            <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-[hsl(var(--primary))]">
                Open board
                <ChevronRight className="h-3.5 w-3.5" />
            </span>
        </button>
    );
}

export default ReportsPortfolio;
