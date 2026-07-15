import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    ArrowLeft,
    BarChart3,
    LayoutDashboard,
    MessageSquare,
    Plus,
    Users,
} from 'lucide-react';
import StudioLayout from '../components/StudioLayout';
import ReportCanvasMock from '../components/reports/ReportCanvasMock';
import { useOrg } from '../contexts/OrgContext';
import { teamAPI } from '../lib/api';
import {
    getReportBucket,
    REPORT_GRANT_ROLE_LABELS,
    updateReportBucket,
    type ReportBucket,
    type ReportGrantRole,
    type ReportTeamGrant,
} from '../lib/reportBuckets';
import { dashboardNavHref } from '../lib/vocabulary';

const MOCK_ANALYTICS = [
    { id: 'cov', title: 'Coverage this week', value: '78%', hint: 'Curated view — explore only' },
    { id: 'rev', title: 'Pending review (sources)', value: '14', hint: 'Read-only snapshot' },
    { id: 'att', title: 'Checked in today', value: '42', hint: 'Across linked programmes' },
    { id: 'vel', title: 'Submission velocity', value: '186', hint: 'Period total (mock)' },
];

const ReportBoard: React.FC = () => {
    const navigate = useNavigate();
    const { reportId = '' } = useParams();
    const { currentOrg, projects } = useOrg();
    const [bucket, setBucket] = useState<ReportBucket | null>(null);
    const [teams, setTeams] = useState<Array<{ id: string; name: string }>>([]);
    const [comment, setComment] = useState('');
    const [grantTeamId, setGrantTeamId] = useState('');
    const [grantRole, setGrantRole] = useState<ReportGrantRole>('commenter');
    const [activePanel, setActivePanel] = useState<'canvas' | 'comments' | 'explore' | 'access'>('canvas');

    const reload = () => {
        if (!currentOrg || !reportId) return;
        setBucket(getReportBucket(currentOrg.id, reportId));
    };

    useEffect(() => {
        reload();
    }, [currentOrg?.id, reportId]);

    useEffect(() => {
        if (!currentOrg) return;
        void teamAPI.list(currentOrg.id).then((rows: any[]) => {
            setTeams((rows || []).map((t) => ({ id: t.id, name: t.name })));
        }).catch(() => setTeams([]));
    }, [currentOrg?.id]);

    const sourceNames = useMemo(() => {
        if (!bucket) return [];
        return bucket.sourceProjectIds.map(
            (id) => projects.find((p) => p.id === id)?.name || 'Unknown project',
        );
    }, [bucket, projects]);

    const postComment = (event: React.FormEvent) => {
        event.preventDefault();
        if (!currentOrg || !bucket || !comment.trim()) return;
        const next = updateReportBucket(currentOrg.id, bucket.id, {
            comments: [
                ...bucket.comments,
                {
                    id: `c_${crypto.randomUUID()}`,
                    author: 'You',
                    body: comment.trim(),
                    createdAt: new Date().toISOString(),
                },
            ],
        });
        setComment('');
        if (next) setBucket(next);
    };

    const addGrant = () => {
        if (!currentOrg || !bucket || !grantTeamId) return;
        const team = teams.find((t) => t.id === grantTeamId);
        if (!team) return;
        const grants: ReportTeamGrant[] = [
            ...bucket.teamGrants.filter((g) => g.teamId !== team.id),
            { teamId: team.id, teamName: team.name, role: grantRole },
        ];
        const next = updateReportBucket(currentOrg.id, bucket.id, { teamGrants: grants });
        setGrantTeamId('');
        if (next) setBucket(next);
    };

    return (
        <StudioLayout
            navMode="org"
            activeNav="reports"
            onSelectNav={(key) => {
                if (key === 'reports') {
                    navigate(dashboardNavHref('reports'));
                    return;
                }
                if (key === 'inbox') {
                    navigate(dashboardNavHref('inbox'));
                    return;
                }
                if (key === 'projects') {
                    navigate(dashboardNavHref('projects'));
                    return;
                }
                if (key === 'members') {
                    navigate(dashboardNavHref('members', { section: 'teams' }));
                    return;
                }
                navigate(dashboardNavHref('inbox'));
            }}
            onOpenInbox={() => navigate(dashboardNavHref('inbox'))}
            contentClassName="flex-1 overflow-y-auto p-6 md:p-10"
        >
            {!bucket ? (
                <div className="mx-auto max-w-lg rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] p-8 text-center">
                    <p className="text-sm text-[hsl(var(--text-secondary))]">Report board not found.</p>
                    <button
                        type="button"
                        className="mt-4 text-sm font-semibold text-[hsl(var(--primary))]"
                        onClick={() => navigate(dashboardNavHref('reports'))}
                    >
                        Back to Reports
                    </button>
                </div>
            ) : (
                <div className="mx-auto max-w-7xl space-y-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                            <button
                                type="button"
                                onClick={() => navigate(dashboardNavHref('reports'))}
                                className="mb-3 inline-flex items-center gap-1 text-xs font-semibold text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--text-primary))]"
                            >
                                <ArrowLeft className="h-3.5 w-3.5" />
                                Reports
                            </button>
                            <div className="flex flex-wrap items-center gap-2">
                                <h1 className="text-3xl font-bold tracking-tight">{bucket.title}</h1>
                                <span className="rounded-full border border-[hsl(var(--border))] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--text-tertiary))]">
                                    {bucket.status}
                                </span>
                            </div>
                            <p className="mt-2 max-w-2xl text-sm text-[hsl(var(--text-secondary))]">
                                {bucket.description || 'Stakeholder window — see, comment, explore. Do not operate field work from here.'}
                            </p>
                            <p className="mt-2 text-xs text-[hsl(var(--text-tertiary))]">
                                Sources: {sourceNames.length ? sourceNames.join(' · ') : 'None linked yet'}
                            </p>
                        </div>
                        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-800 dark:text-emerald-200">
                            <p className="font-semibold">Observe mode</p>
                            <p className="mt-1 opacity-90">Seniors watch and steer. Operators work in Projects.</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2 border-b border-[hsl(var(--border))] pb-2">
                        {([
                            { key: 'canvas', label: 'Canvas', icon: LayoutDashboard },
                            { key: 'comments', label: 'Comments', icon: MessageSquare },
                            { key: 'explore', label: 'Explore', icon: BarChart3 },
                            { key: 'access', label: 'Team access', icon: Users },
                        ] as const).map((tab) => {
                            const Icon = tab.icon;
                            const active = activePanel === tab.key;
                            return (
                                <button
                                    key={tab.key}
                                    type="button"
                                    onClick={() => setActivePanel(tab.key)}
                                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${
                                        active
                                            ? 'bg-[hsl(var(--primary))] text-white'
                                            : 'text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--surface-elevated))]'
                                    }`}
                                >
                                    <Icon className="h-3.5 w-3.5" />
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>

                    {activePanel === 'canvas' ? (
                        <ReportCanvasMock
                            boardTitle={bucket.title}
                            sourceLabels={sourceNames}
                            comments={bucket.comments}
                            commentDraft={comment}
                            onCommentDraftChange={setComment}
                            onPostComment={postComment}
                        />
                    ) : null}

                    {activePanel === 'comments' ? (
                        <section className="mx-auto max-w-2xl space-y-4 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] p-5">
                            <h2 className="text-sm font-semibold">Questions & comments</h2>
                            <div className="space-y-3">
                                {bucket.comments.map((row) => (
                                    <div key={row.id} className="rounded-lg border border-[hsl(var(--border))]/70 bg-[hsl(var(--background))] p-3">
                                        <p className="text-xs font-semibold text-[hsl(var(--text-primary))]">{row.author}</p>
                                        <p className="mt-1 text-sm text-[hsl(var(--text-secondary))]">{row.body}</p>
                                        <p className="mt-1 text-[10px] text-[hsl(var(--text-tertiary))]">
                                            {new Date(row.createdAt).toLocaleString()}
                                        </p>
                                    </div>
                                ))}
                            </div>
                            <form onSubmit={postComment} className="flex gap-2">
                                <input
                                    className="input flex-1"
                                    value={comment}
                                    onChange={(e) => setComment(e.target.value)}
                                    placeholder="Ask a question or leave a note for the programme team"
                                />
                                <button type="submit" className="btn btn-primary shrink-0">
                                    Post
                                </button>
                            </form>
                        </section>
                    ) : null}

                    {activePanel === 'explore' ? (
                        <section className="space-y-4 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] p-5">
                            <h2 className="text-sm font-semibold">Explore curated analytics (mock)</h2>
                            <p className="text-sm text-[hsl(var(--text-secondary))]">
                                Seniors can play with views prepared for this board — not the full Design / Data admin
                                of source projects.
                            </p>
                            <div className="grid gap-3 md:grid-cols-3">
                                {MOCK_ANALYTICS.map((card) => (
                                    <button
                                        key={card.id}
                                        type="button"
                                        className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-4 text-left transition hover:border-[hsl(var(--primary))]/40"
                                    >
                                        <BarChart3 className="h-4 w-4 text-[hsl(var(--primary))]" />
                                        <p className="mt-2 text-sm font-semibold">{card.title}</p>
                                        <p className="mt-1 text-xs text-[hsl(var(--text-tertiary))]">{card.hint}</p>
                                    </button>
                                ))}
                            </div>
                        </section>
                    ) : null}

                    {activePanel === 'access' ? (
                        <section className="mx-auto max-w-xl space-y-4 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] p-5">
                            <h2 className="text-sm font-semibold">Team grants (mock)</h2>
                            <p className="text-sm text-[hsl(var(--text-secondary))]">
                                Same pattern as Projects: Teams get report-related permissions on this bucket.
                            </p>
                            <ul className="space-y-2">
                                {bucket.teamGrants.length === 0 ? (
                                    <li className="text-sm text-[hsl(var(--text-tertiary))]">No teams on this board yet.</li>
                                ) : (
                                    bucket.teamGrants.map((grant) => (
                                        <li
                                            key={grant.teamId}
                                            className="flex items-center justify-between rounded-lg border border-[hsl(var(--border))] px-3 py-2 text-sm"
                                        >
                                            <span className="font-medium">{grant.teamName}</span>
                                            <span className="text-xs text-[hsl(var(--text-tertiary))]">
                                                {REPORT_GRANT_ROLE_LABELS[grant.role]}
                                            </span>
                                        </li>
                                    ))
                                )}
                            </ul>
                            <div className="flex flex-wrap items-end gap-2 border-t border-[hsl(var(--border))] pt-4">
                                <div className="min-w-[140px] flex-1">
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
                                <div className="min-w-[120px]">
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
                                    className="inline-flex items-center gap-1 rounded-lg bg-[hsl(var(--primary))] px-3 py-2 text-xs font-semibold text-white"
                                >
                                    <Plus className="h-3.5 w-3.5" />
                                    Grant
                                </button>
                            </div>
                        </section>
                    ) : null}
                </div>
            )}
        </StudioLayout>
    );
};

export default ReportBoard;
