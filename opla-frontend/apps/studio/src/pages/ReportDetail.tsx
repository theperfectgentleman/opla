import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, FileBarChart2, Save, Trash2 } from 'lucide-react';

import ReportCanvasShell, { type ReportCanvasBlock, type ReportCanvasReferenceSuggestion } from '../components/ReportCanvasShell';
import StudioLayout from '../components/StudioLayout';
import { useOrg } from '../contexts/OrgContext';
import { useToast } from '../contexts/ToastContext';
import { reportAPI, teamAPI } from '../lib/api';

type ReportArtifact = {
    id: string;
    project_id: string;
    title: string;
    description?: string;
    content: ReportCanvasBlock[];
    status: 'draft' | 'published' | 'archived';
    lead_accessor_id?: string | null;
    lead_accessor_type?: 'user' | 'team' | null;
    assigned_accessor_id?: string | null;
    assigned_accessor_type?: 'user' | 'team' | null;
    guest_accessor_id?: string | null;
    guest_accessor_type?: 'user' | 'team' | null;
    updated_at: string;
    created_at: string;
};

type Team = {
    id: string;
    name: string;
};

type AccessorOption = {
    id: string;
    type: 'user' | 'team';
    label: string;
};

type EditorSaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

const serializeEditorFields = (report: Pick<ReportArtifact, 'title' | 'description' | 'content'>) => JSON.stringify({
    title: report.title,
    description: report.description || '',
    content: report.content || [],
});

const ReportDetail: React.FC = () => {
    const navigate = useNavigate();
    const { projectId, reportId } = useParams<{ projectId: string; reportId: string }>();
    const { currentOrg, members, projects, setCurrentProject } = useOrg();
    const { showToast } = useToast();

    const [report, setReport] = useState<ReportArtifact | null>(null);
    const [teams, setTeams] = useState<Team[]>([]);
    const [projectReports, setProjectReports] = useState<Array<{ id: string; title: string; description?: string; status: string; updated_at: string }>>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [editorSaveState, setEditorSaveState] = useState<EditorSaveState>('idle');
    const [persistedEditorSnapshot, setPersistedEditorSnapshot] = useState('');
    const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

    useEffect(() => {
        if (!currentOrg || !projectId || !reportId) {
            return;
        }

        const project = projects.find(item => item.id === projectId) || null;
        setCurrentProject(project);

        const load = async () => {
            setLoading(true);
            setError(null);
            try {
                const [loadedReport, loadedTeams, loadedProjectReports] = await Promise.all([
                    reportAPI.get(currentOrg.id, projectId, reportId),
                    teamAPI.list(currentOrg.id),
                    reportAPI.list(currentOrg.id, projectId),
                ]);
                setReport(loadedReport);
                setPersistedEditorSnapshot(serializeEditorFields(loadedReport));
                setLastSavedAt(loadedReport.updated_at);
                setEditorSaveState('idle');
                setTeams(loadedTeams);
                setProjectReports(loadedProjectReports);
            } catch (err: any) {
                setError(err?.response?.data?.detail || err?.message || 'Failed to load report');
            } finally {
                setLoading(false);
            }
        };

        load();
    }, [currentOrg, projectId, projects, reportId, setCurrentProject]);

    const assignmentOptions = useMemo<AccessorOption[]>(() => {
        const userOptions = members.map(member => ({
            id: member.user_id,
            type: 'user' as const,
            label: member.user?.full_name || member.user?.email || member.user?.phone || member.user_id,
        }));
        const teamOptions = teams.map(team => ({ id: team.id, type: 'team' as const, label: team.name }));
        return [...userOptions, ...teamOptions].sort((left, right) => left.label.localeCompare(right.label));
    }, [members, teams]);

    const editorSnapshot = useMemo(() => {
        if (!report) {
            return '';
        }
        return serializeEditorFields(report);
    }, [report]);

    const canvasSuggestions = useMemo<ReportCanvasReferenceSuggestion[]>(() => {
        const userSuggestions = members.map(member => ({
            token: `@${member.user?.full_name || member.user?.email || member.user?.phone || member.user_id}`,
            label: 'User mention',
            kind: 'user' as const,
            title: member.user?.full_name || member.user?.email || member.user?.phone || member.user_id,
            summary: 'Organization member available for mentions and review routing.',
            detail: member.user?.email || member.user?.phone || 'Workspace member',
            icon: <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[hsl(var(--primary))]/10 text-[10px] font-bold text-[hsl(var(--primary))]">@</span>,
        }));

        const teamSuggestions = teams.map(team => ({
            token: `@${team.name}`,
            label: 'Team mention',
            kind: 'team' as const,
            title: team.name,
            summary: team.description || 'Team available for mention targeting and review handoff.',
            detail: 'Team • Live organization lookup',
            icon: <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[hsl(var(--primary))]/10 text-[10px] font-bold text-[hsl(var(--primary))]">@</span>,
        }));

        const reportSuggestions = projectReports
            .filter(item => item.id !== report?.id)
            .map(item => ({
                token: `#${item.title}`,
                label: 'Report link',
                kind: 'report' as const,
                title: item.title,
                summary: item.description || 'Existing project report available for cross-reference.',
                detail: `Report • ${item.status} • Updated ${new Date(item.updated_at).toLocaleDateString()}`,
                icon: <FileBarChart2 className="h-4 w-4" />,
            }));

        return [...userSuggestions, ...teamSuggestions, ...reportSuggestions];
    }, [members, projectReports, report?.id, teams]);

    const isDirty = Boolean(report) && editorSnapshot !== persistedEditorSnapshot;

    const handleShellNavSelect = (key: 'projects' | 'tasks' | 'forms' | 'datasets' | 'members' | 'audience' | 'analysis' | 'threads' | 'assets' | 'reports' | 'settings') => {
        navigate(`/dashboard?tab=${key}`);
    };

    const getAccessorValue = (accessorId?: string | null, accessorType?: 'user' | 'team' | null) => {
        if (!accessorId || !accessorType) return '';
        return `${accessorType}:${accessorId}`;
    };

    const parseAccessorValue = (value: string) => {
        if (!value) return { accessor_id: null, accessor_type: null };
        const [accessor_type, accessor_id] = value.split(':');
        return { accessor_id, accessor_type: accessor_type as 'user' | 'team' };
    };

    const updateReport = async (
        updates: Partial<ReportArtifact>,
        options?: {
            successTitle?: string;
            successMessage?: string;
            silentSuccess?: boolean;
            silentError?: boolean;
        },
    ) => {
        if (!currentOrg || !projectId || !reportId || !report) return;

        try {
            setSaving(true);
            const updated = await reportAPI.update(currentOrg.id, projectId, reportId, {
                title: updates.title ?? report.title,
                description: updates.description ?? report.description ?? null,
                content: updates.content !== undefined ? updates.content : report.content ?? [],
                status: updates.status ?? report.status,
                lead_accessor_id: updates.lead_accessor_id !== undefined ? updates.lead_accessor_id : report.lead_accessor_id ?? null,
                lead_accessor_type: updates.lead_accessor_type !== undefined ? updates.lead_accessor_type : report.lead_accessor_type ?? null,
                assigned_accessor_id: updates.assigned_accessor_id !== undefined ? updates.assigned_accessor_id : report.assigned_accessor_id ?? null,
                assigned_accessor_type: updates.assigned_accessor_type !== undefined ? updates.assigned_accessor_type : report.assigned_accessor_type ?? null,
                guest_accessor_id: updates.guest_accessor_id !== undefined ? updates.guest_accessor_id : report.guest_accessor_id ?? null,
                guest_accessor_type: updates.guest_accessor_type !== undefined ? updates.guest_accessor_type : report.guest_accessor_type ?? null,
            });
            setReport(updated);
            setPersistedEditorSnapshot(serializeEditorFields(updated));
            setLastSavedAt(updated.updated_at);
            if (!options?.silentSuccess) {
                showToast(options?.successTitle || 'Report updated', options?.successMessage || 'The report changes have been saved.', 'success');
            }
            return updated;
        } catch (err: any) {
            if (!options?.silentError) {
                showToast('Update failed', err?.response?.data?.detail || err?.message || 'Could not save report.', 'error');
            }
            return null;
        } finally {
            setSaving(false);
        }
    };

    useEffect(() => {
        if (!report || loading || deleting) {
            return;
        }

        if (isDirty && !saving) {
            setEditorSaveState('dirty');
            return;
        }

        if (!isDirty && editorSaveState === 'dirty' && !saving) {
            setEditorSaveState('idle');
        }
    }, [deleting, editorSaveState, isDirty, loading, report, saving]);

    useEffect(() => {
        if (!report || !isDirty || deleting || loading) {
            return;
        }

        const timeoutId = window.setTimeout(async () => {
            setEditorSaveState('saving');
            const updated = await updateReport(
                {
                    title: report.title,
                    description: report.description ?? '',
                    content: report.content ?? [],
                },
                {
                    silentSuccess: true,
                    silentError: true,
                },
            );

            setEditorSaveState(updated ? 'saved' : 'error');
        }, 1200);

        return () => window.clearTimeout(timeoutId);
    }, [deleting, isDirty, loading, report]);

    useEffect(() => {
        if (editorSaveState !== 'saved') {
            return;
        }

        const timeoutId = window.setTimeout(() => setEditorSaveState('idle'), 1800);
        return () => window.clearTimeout(timeoutId);
    }, [editorSaveState]);

    useEffect(() => {
        if (!isDirty) {
            return;
        }

        const handleBeforeUnload = (event: BeforeUnloadEvent) => {
            event.preventDefault();
            event.returnValue = '';
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [isDirty]);

    const handleResponsibilityChange = async (field: 'lead' | 'assigned' | 'guest', value: string) => {
        const nextAccessor = parseAccessorValue(value);
        await updateReport({
            lead_accessor_id: field === 'lead' ? nextAccessor.accessor_id : report?.lead_accessor_id,
            lead_accessor_type: field === 'lead' ? nextAccessor.accessor_type : report?.lead_accessor_type,
            assigned_accessor_id: field === 'assigned' ? nextAccessor.accessor_id : report?.assigned_accessor_id,
            assigned_accessor_type: field === 'assigned' ? nextAccessor.accessor_type : report?.assigned_accessor_type,
            guest_accessor_id: field === 'guest' ? nextAccessor.accessor_id : report?.guest_accessor_id,
            guest_accessor_type: field === 'guest' ? nextAccessor.accessor_type : report?.guest_accessor_type,
        }, { successTitle: 'Responsibility updated' });
    };

    const handleDelete = async () => {
        if (!currentOrg || !projectId || !reportId) return;
        try {
            setDeleting(true);
            await reportAPI.delete(currentOrg.id, projectId, reportId);
            showToast('Report removed', 'The report has been deleted.', 'success');
            navigate(`/projects/${projectId}`);
        } catch (err: any) {
            showToast('Delete failed', err?.response?.data?.detail || err?.message || 'Could not delete report.', 'error');
        } finally {
            setDeleting(false);
        }
    };

    return (
        <StudioLayout
            activeNav="reports"
            onSelectNav={handleShellNavSelect}
            counts={{ projects: projects.length, members: members?.length || 0 }}
            contentClassName="flex-1 overflow-y-auto p-10"
        >
            {loading ? (
                <div className="flex items-center justify-center py-24">
                    <div className="h-10 w-10 animate-spin rounded-full border-4 border-[hsl(var(--primary))]/30 border-t-[hsl(var(--primary))]" />
                </div>
            ) : error || !report ? (
                <div className="rounded-3xl border border-[hsl(var(--error))]/20 bg-[hsl(var(--error))]/10 p-8 text-[hsl(var(--text-primary))]">
                    <h2 className="text-lg font-semibold text-[hsl(var(--error))]">Report unavailable</h2>
                    <p className="mt-2 text-sm text-[hsl(var(--text-secondary))]">{error || 'Report not found.'}</p>
                </div>
            ) : (
                <div className="space-y-8">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <button
                                onClick={() => navigate('/dashboard?tab=reports')}
                                className="inline-flex items-center gap-2 text-sm font-semibold text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))]"
                            >
                                <ArrowLeft className="h-4 w-4" />
                                Back to Reports
                            </button>
                            <div className="mt-4 flex items-center gap-3">
                                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]">
                                    <FileBarChart2 className="h-5 w-5" />
                                </div>
                                <div>
                                    <h1 className="text-3xl font-bold tracking-tight">{report.title}</h1>
                                    <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-[hsl(var(--text-secondary))]">
                                        <span>Updated {new Date(report.updated_at).toLocaleString()}</span>
                                        <span className={`inline-flex rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] border ${editorSaveState === 'saving'
                                            ? 'border-sky-500/20 bg-sky-500/10 text-sky-300'
                                            : editorSaveState === 'saved'
                                                ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
                                                : editorSaveState === 'error'
                                                    ? 'border-rose-500/20 bg-rose-500/10 text-rose-300'
                                                    : isDirty
                                                        ? 'border-amber-500/20 bg-amber-500/10 text-amber-300'
                                                        : 'border-[hsl(var(--border))] bg-[hsl(var(--surface-elevated))] text-[hsl(var(--text-tertiary))]'
                                        }`}>
                                            {editorSaveState === 'saving'
                                                ? 'Autosaving'
                                                : editorSaveState === 'saved'
                                                    ? 'Saved'
                                                    : editorSaveState === 'error'
                                                        ? 'Save failed'
                                                        : isDirty
                                                            ? 'Unsaved changes'
                                                            : 'Synced'}
                                        </span>
                                        {lastSavedAt ? <span>Last saved {new Date(lastSavedAt).toLocaleTimeString()}</span> : null}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => navigate(`/projects/${projectId}`)}
                                className="rounded-2xl border border-[hsl(var(--border))] px-4 py-2 text-sm font-semibold hover:bg-[hsl(var(--surface-elevated))]"
                            >
                                Open Project
                            </button>
                            <button
                                onClick={handleDelete}
                                disabled={deleting}
                                className="inline-flex items-center gap-2 rounded-2xl border border-[hsl(var(--error))]/20 bg-[hsl(var(--error))]/10 px-4 py-2 text-sm font-semibold text-[hsl(var(--error))] disabled:opacity-60"
                            >
                                <Trash2 className="h-4 w-4" />
                                {deleting ? 'Removing...' : 'Delete'}
                            </button>
                        </div>
                    </div>

                    <section className="grid gap-8 xl:grid-cols-[minmax(0,1.5fr)_420px]">
                        <div className="rounded-[32px] border border-[hsl(var(--border))] bg-[hsl(var(--surface))] p-8 shadow-sm">
                            <div className="space-y-6">
                                <div>
                                    <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-[hsl(var(--text-tertiary))]">Report Title</label>
                                    <input
                                        value={report.title}
                                        onChange={(event) => setReport(prev => prev ? { ...prev, title: event.target.value } : prev)}
                                        className="w-full rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-3 text-sm"
                                    />
                                </div>

                                <div>
                                    <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-[hsl(var(--text-tertiary))]">Description</label>
                                    <textarea
                                        value={report.description || ''}
                                        onChange={(event) => setReport(prev => prev ? { ...prev, description: event.target.value } : prev)}
                                        className="min-h-[220px] w-full rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-3 text-sm"
                                        placeholder="Capture what this report summarizes, who it is for, and the key decisions it should support."
                                    />
                                </div>

                                <div className="flex justify-end">
                                    <button
                                        onClick={async () => {
                                            setEditorSaveState('saving');
                                            const updated = await updateReport(
                                                { title: report.title, description: report.description ?? '', content: report.content ?? [] },
                                                {
                                                    successTitle: 'Report updated',
                                                    successMessage: 'Title, summary, and canvas changes have been saved.',
                                                },
                                            );
                                            setEditorSaveState(updated ? 'saved' : 'error');
                                        }}
                                        disabled={saving || !report.title.trim() || !isDirty}
                                        className="inline-flex items-center gap-2 rounded-2xl bg-[hsl(var(--primary))] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-black/10 disabled:opacity-60"
                                    >
                                        <Save className="h-4 w-4" />
                                        {saving ? 'Saving...' : isDirty ? 'Save Changes' : 'Saved'}
                                    </button>
                                </div>

                                <ReportCanvasShell
                                    reportTitle={report.title}
                                    content={report.content}
                                    suggestions={canvasSuggestions}
                                    onContentChange={(content) => setReport(prev => prev ? { ...prev, content } : prev)}
                                />
                            </div>
                        </div>

                        <div className="space-y-6">
                            <section className="rounded-[32px] border border-[hsl(var(--border))] bg-[hsl(var(--surface))] p-6 shadow-sm">
                                <h2 className="text-lg font-semibold">Status</h2>
                                <p className="mt-1 text-sm text-[hsl(var(--text-secondary))]">Control whether this report is still being prepared, ready to share, or archived.</p>
                                <select
                                    value={report.status}
                                    onChange={(event) => updateReport({ status: event.target.value as ReportArtifact['status'] }, 'Status updated')}
                                    disabled={saving}
                                    className="mt-4 w-full rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-3 text-sm"
                                >
                                    <option value="draft">Draft</option>
                                    <option value="published">Published</option>
                                    <option value="archived">Archived</option>
                                </select>
                            </section>

                            <section className="rounded-[32px] border border-[hsl(var(--border))] bg-[hsl(var(--surface))] p-6 shadow-sm">
                                <h2 className="text-lg font-semibold">Responsibility</h2>
                                <p className="mt-1 text-sm text-[hsl(var(--text-secondary))]">Set the lead, working owner, and guest viewer for this report.</p>
                                <div className="mt-4 space-y-4">
                                    <div>
                                        <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-[hsl(var(--text-tertiary))]">Lead</label>
                                        <select
                                            value={getAccessorValue(report.lead_accessor_id, report.lead_accessor_type)}
                                            onChange={(event) => handleResponsibilityChange('lead', event.target.value)}
                                            disabled={saving}
                                            className="w-full rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-3 text-sm"
                                        >
                                            <option value="">Not set</option>
                                            {assignmentOptions.map(option => (
                                                <option key={`${option.type}:${option.id}`} value={`${option.type}:${option.id}`}>
                                                    {option.label} {option.type === 'team' ? '(Team)' : ''}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-[hsl(var(--text-tertiary))]">Assigned To</label>
                                        <select
                                            value={getAccessorValue(report.assigned_accessor_id, report.assigned_accessor_type)}
                                            onChange={(event) => handleResponsibilityChange('assigned', event.target.value)}
                                            disabled={saving}
                                            className="w-full rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-3 text-sm"
                                        >
                                            <option value="">Not assigned</option>
                                            {assignmentOptions.map(option => (
                                                <option key={`${option.type}:${option.id}`} value={`${option.type}:${option.id}`}>
                                                    {option.label} {option.type === 'team' ? '(Team)' : ''}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-[hsl(var(--text-tertiary))]">Guest</label>
                                        <select
                                            value={getAccessorValue(report.guest_accessor_id, report.guest_accessor_type)}
                                            onChange={(event) => handleResponsibilityChange('guest', event.target.value)}
                                            disabled={saving}
                                            className="w-full rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-3 text-sm"
                                        >
                                            <option value="">No guest</option>
                                            {assignmentOptions.map(option => (
                                                <option key={`${option.type}:${option.id}`} value={`${option.type}:${option.id}`}>
                                                    {option.label} {option.type === 'team' ? '(Team)' : ''}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </section>
                        </div>
                    </section>
                </div>
            )}
        </StudioLayout>
    );
};

export default ReportDetail;