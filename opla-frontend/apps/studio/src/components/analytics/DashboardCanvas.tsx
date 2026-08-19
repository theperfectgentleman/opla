import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { BarChart3, Hash, Loader2, Map, PanelsTopLeft, Plus, Table2 } from 'lucide-react';

import { analyticsAPI } from '../../lib/api';
import { defaultSource } from './queryUtils';
import type { AnalyticsDashboard, AnalyticsToolProps, SavedQuestion } from './types';
import { AnalyticsPageHeader, AnalyticsPanelSkeleton, analyticsButtonClass, analyticsGhostButtonClass, analyticsInputClass, analyticsInsetClass, analyticsLabelClass, analyticsPanelClass } from './ui';
import DashboardViewer from './DashboardViewer';
import PinnedAnalyticsCard from '../hub/PinnedAnalyticsCard';

const vizMeta: Record<SavedQuestion['viz_type'], { label: string; icon: ReactNode }> = {
	table: { label: 'Table', icon: <Table2 className="h-4 w-4" /> },
	chart: { label: 'Chart', icon: <BarChart3 className="h-4 w-4" /> },
	kpi: { label: 'KPI', icon: <Hash className="h-4 w-4" /> },
	map: { label: 'Map', icon: <Map className="h-4 w-4" /> },
};

function formatDate(dateString: string) {
	return new Intl.DateTimeFormat('en', {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
	}).format(new Date(dateString));
}

export default function DashboardCanvas({ orgId, projectId, sources }: AnalyticsToolProps) {
	const [dashboards, setDashboards] = useState<AnalyticsDashboard[]>([]);
	const [questions, setQuestions] = useState<SavedQuestion[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [reloadToken, setReloadToken] = useState(0);
	const [composerMode, setComposerMode] = useState<'dashboard' | null>(null);
	const [dashboardTitle, setDashboardTitle] = useState('');
	const [dashboardDescription, setDashboardDescription] = useState('');
	const [submitLoading, setSubmitLoading] = useState(false);
	const [submitMessage, setSubmitMessage] = useState<string | null>(null);
	const [viewingDashboard, setViewingDashboard] = useState<AnalyticsDashboard | null>(null);
	const [viewingQuestion, setViewingQuestion] = useState<SavedQuestion | null>(null);

	async function handleAttachQuestion(questionId: string, dashboardId: string) {
		const dashboard = dashboards.find(d => d.id === dashboardId);
		if (!dashboard) return;

		setSubmitLoading(true);
		try {
			await analyticsAPI.updateDashboard(orgId, dashboardId, {
				cards: [
					...dashboard.cards.map(c => ({
						question_id: c.question_id,
						position: c.position,
						viz_override: c.viz_override
					})),
					{
						question_id: questionId,
						position: { x: 0, y: 0, w: 12, h: 8 }
					}
				] // preserves existing cards while appending the new one
			});
			setReloadToken(current => current + 1);
		} catch (attachError: any) {
			setError(attachError?.response?.data?.detail || attachError?.message || 'Could not attach question to dashboard.');
		} finally {
			setSubmitLoading(false);
		}
	}

	const defaultAnalyticsSource = useMemo(() => defaultSource(sources, undefined), [sources]);

	useEffect(() => {
		let cancelled = false;

		const loadWorkspace = async () => {
			setLoading(true);
			setError(null);
			try {
				const [dashboardResponse, questionResponse] = await Promise.all([
					analyticsAPI.listDashboards(orgId, projectId),
					analyticsAPI.listQuestions(orgId, projectId),
				]);

				if (!cancelled) {
					setDashboards((dashboardResponse ?? []).filter((dashboard: AnalyticsDashboard) => !dashboard.is_archived));
					setQuestions((questionResponse ?? []).filter((question: SavedQuestion) => !question.is_archived));
				}
			} catch (loadError: any) {
				if (!cancelled) {
					setError(loadError?.response?.data?.detail || loadError?.message || 'Could not load saved analytics assets.');
				}
			} finally {
				if (!cancelled) {
					setLoading(false);
				}
			}
		};

		void loadWorkspace();
		return () => {
			cancelled = true;
		};
	}, [orgId, projectId, reloadToken]);

	async function handleCreateDashboard() {
		if (!dashboardTitle.trim()) {
			setSubmitMessage('Enter a dashboard title before saving.');
			return;
		}

		setSubmitLoading(true);
		setSubmitMessage(null);
		try {
			await analyticsAPI.createDashboard(orgId, {
				title: dashboardTitle.trim(),
				description: dashboardDescription.trim() || null,
				project_id: projectId ?? defaultAnalyticsSource?.project_id ?? null,
				layout_config: [],
				cards: [],
			});
			setDashboardTitle('');
			setDashboardDescription('');
			setComposerMode(null);
			setReloadToken(current => current + 1);
		} catch (submitError: any) {
			setSubmitMessage(submitError?.response?.data?.detail || submitError?.message || 'Could not create dashboard.');
		} finally {
			setSubmitLoading(false);
		}
	}

	if (loading) {
		return (
			<div className="space-y-3">
				<div className="flex items-center gap-2 text-sm font-medium text-slate-500">
					<Loader2 className="h-4 w-4 animate-spin text-emerald-700" />
					Loading saved dashboards...
				</div>
				<AnalyticsPanelSkeleton rows={5} />
			</div>
		);
	}

	if (error) {
		return <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700 shadow-sm">{error}</div>;
	}

	if (viewingQuestion) {
		return (
			<div className={analyticsPanelClass}>
				<div className="mb-4 flex flex-wrap items-start justify-between gap-3">
					<div>
						<p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Saved question</p>
						<h2 className="mt-1 text-xl font-bold text-slate-800">{viewingQuestion.title}</h2>
						<p className="mt-1 text-sm text-slate-500">
							{viewingQuestion.description || `${viewingQuestion.viz_type} · read-only preview`}
						</p>
					</div>
					<button type="button" className={analyticsGhostButtonClass} onClick={() => setViewingQuestion(null)}>
						Back
					</button>
				</div>
				{['chart', 'kpi', 'table', 'map'].includes(viewingQuestion.viz_type) ? (
					<div className="min-h-[280px]">
						<PinnedAnalyticsCard orgId={orgId} question={viewingQuestion} />
					</div>
				) : (
					<div className="rounded-md border border-dashed border-slate-200 px-4 py-8 text-sm text-slate-500">
						This question type ({viewingQuestion.viz_type}) cannot preview here.
					</div>
				)}
				<p className="mt-4 text-xs text-slate-500">
					Save charts from Chart, then pin them here.
				</p>
			</div>
		);
	}

	if (viewingDashboard) {
		return (
			<div className={analyticsPanelClass}>
				<DashboardViewer dashboard={viewingDashboard} onClose={() => setViewingDashboard(null)} orgId={orgId} />
			</div>
		);
	}

	if (dashboards.length === 0 && questions.length === 0) {
		return (
			<div className={analyticsPanelClass}>
				<AnalyticsPageHeader
					eyebrow="Saved Assets"
					title="No boards or saved questions yet"
					description="Save a chart from Chart, then create a board and attach it."
					actions={
						<button type="button" className={analyticsGhostButtonClass} onClick={() => { setComposerMode('dashboard'); setSubmitMessage(null); }}>
							<Plus className="h-4 w-4" />
							New board
						</button>
					}
				/>

				{composerMode === 'dashboard' ? (
					<div className={`${analyticsInsetClass} mt-4 p-4`}>
						<div className="grid gap-4 md:grid-cols-2">
							<div>
								<label className={analyticsLabelClass}>Dashboard title</label>
								<input value={dashboardTitle} onChange={event => setDashboardTitle(event.target.value)} className={analyticsInputClass} placeholder="Weekly field performance" />
							</div>
							<div>
								<label className={analyticsLabelClass}>Description</label>
								<input value={dashboardDescription} onChange={event => setDashboardDescription(event.target.value)} className={analyticsInputClass} placeholder="Operational scorecard for supervisors" />
							</div>
						</div>
						<div className="mt-4 flex flex-wrap gap-2">
							<button type="button" disabled={submitLoading} onClick={() => void handleCreateDashboard()} className={analyticsButtonClass}>
								{submitLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <PanelsTopLeft className="h-4 w-4" />}
								{submitLoading ? 'Saving...' : 'Create dashboard'}
							</button>
							<button type="button" className={analyticsGhostButtonClass} onClick={() => setComposerMode(null)}>Cancel</button>
						</div>
						{submitMessage ? <p className="mt-3 text-sm text-rose-600">{submitMessage}</p> : null}
					</div>
				) : null}

				<div className={`${analyticsInsetClass} mt-4 grid gap-3 p-4 md:grid-cols-3`}>
					<div className="rounded-md border border-slate-200 bg-white p-3">
						<p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Start In Data Explorer</p>
						<p className="mt-2 text-sm text-slate-600">Use ad hoc tabular queries to validate fields and build your first reusable question shape.</p>
					</div>
					<div className="rounded-md border border-slate-200 bg-white p-3">
						<p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Refine In Chart Builder</p>
						<p className="mt-2 text-sm text-slate-600">Test grouped metrics and decide which views are worth preserving as report-ready assets.</p>
					</div>
					<div className="rounded-md border border-slate-200 bg-white p-3">
						<p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Publish To Dashboards</p>
						<p className="mt-2 text-sm text-slate-600">Create an empty dashboard now, then attach saved questions as dashboard cards in the next pass.</p>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_360px]">
			<section className={analyticsPanelClass}>
				<AnalyticsPageHeader
					eyebrow="Saved Assets"
					title="Dashboards"
					description={`${dashboards.length} dashboard${dashboards.length === 1 ? '' : 's'} currently available in this workspace.`}
					actions={
						<button type="button" className={analyticsGhostButtonClass} onClick={() => { setComposerMode('dashboard'); setSubmitMessage(null); }}>
							<Plus className="h-4 w-4" />
							New Dashboard
						</button>
					}
				/>

				{composerMode === 'dashboard' ? (
					<div className={`${analyticsInsetClass} mt-4 p-4`}>
						<div className="grid gap-4 md:grid-cols-2">
							<div>
								<label className={analyticsLabelClass}>Dashboard title</label>
								<input value={dashboardTitle} onChange={event => setDashboardTitle(event.target.value)} className={analyticsInputClass} placeholder="Weekly field performance" />
							</div>
							<div>
								<label className={analyticsLabelClass}>Description</label>
								<input value={dashboardDescription} onChange={event => setDashboardDescription(event.target.value)} className={analyticsInputClass} placeholder="Operational scorecard for supervisors" />
							</div>
						</div>
						<div className="mt-4 flex flex-wrap gap-2">
							<button type="button" disabled={submitLoading} onClick={() => void handleCreateDashboard()} className={analyticsButtonClass}>
								{submitLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <PanelsTopLeft className="h-4 w-4" />}
								{submitLoading ? 'Saving...' : 'Create dashboard'}
							</button>
							<button type="button" className={analyticsGhostButtonClass} onClick={() => setComposerMode(null)}>Cancel</button>
						</div>
						{submitMessage ? <p className="mt-3 text-sm text-rose-600">{submitMessage}</p> : null}
					</div>
				) : null}

				<div className="mt-4 space-y-3">
					{dashboards.map(dashboard => (
						<article key={dashboard.id} className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
							<div className="flex items-start justify-between gap-4">
								<div>
									<h4 className="text-base font-bold text-slate-800 cursor-pointer hover:text-emerald-700 transition-colors" onClick={() => setViewingDashboard(dashboard)}>{dashboard.title}</h4>
									<p className="mt-1 text-sm text-slate-500">{dashboard.description || 'No dashboard description yet.'}</p>
								</div>
								<div className="flex gap-2">
									<span className={analyticsGhostButtonClass}>{dashboard.cards.length} card{dashboard.cards.length === 1 ? '' : 's'}</span>
									<button className={analyticsButtonClass} onClick={() => setViewingDashboard(dashboard)}>View</button>
								</div>
							</div>

							<div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
								<span className="rounded-md bg-slate-100 px-2 py-1">Updated {formatDate(dashboard.updated_at)}</span>
								{dashboard.project_id ? <span className="rounded-md bg-slate-100 px-2 py-1">Project scoped</span> : <span className="rounded-md bg-slate-100 px-2 py-1">Org level</span>}
							</div>

							{dashboard.cards.length > 0 ? (
								<div className={`${analyticsInsetClass} mt-3 grid gap-3 p-3 md:grid-cols-2`}>
									{dashboard.cards.slice(0, 4).map(card => {
										const question = card.question;
										const meta = question && question.viz_type in vizMeta
											? vizMeta[question.viz_type]
											: vizMeta.table;
										return (
											<div key={card.id} className="rounded-md border border-slate-200 bg-white p-3">
												<div className="flex items-center gap-2 text-emerald-700">
													{meta.icon}
													<span className="text-[10px] font-bold uppercase tracking-[0.18em]">{meta.label}</span>
												</div>
												<p className="mt-2 text-sm font-semibold text-slate-800">{question?.title || 'Untitled card'}</p>
												<p className="mt-1 text-sm text-slate-500">{question?.description || 'No question description for this card yet.'}</p>
											</div>
										);
									})}
								</div>
							) : (
								<div className="mt-3 rounded-md border border-dashed border-slate-200 px-4 py-8 text-sm text-slate-500">
									This dashboard exists but does not have any cards attached yet.
								</div>
							)}
						</article>
					))}
				</div>
			</section>

			<section className={analyticsPanelClass}>
				<AnalyticsPageHeader
					eyebrow="Saved Assets"
					title="Reusable Questions"
					description={`${questions.length} saved question${questions.length === 1 ? '' : 's'} from Chart.`}
				/>

				<div className="mt-4 space-y-3">
					{questions.length > 0 ? (
						questions.map(question => {
							const meta = vizMeta[question.viz_type] ?? vizMeta.table;
							return (
								<article
									key={question.id}
									className="cursor-pointer rounded-md border border-slate-200 bg-white p-3 transition hover:border-emerald-700/40"
									onClick={() => setViewingQuestion(question)}
								>
									<div className="flex items-center gap-2 text-emerald-700">
										{meta.icon}
										<span className="text-[10px] font-bold uppercase tracking-[0.18em]">{meta.label}</span>
									</div>
									<h4 className="mt-2 text-sm font-semibold text-slate-800">{question.title}</h4>
									<p className="mt-1 text-sm text-slate-500">{question.description || 'No description provided.'}</p>
									<p className="mt-3 text-xs text-slate-500">Updated {formatDate(question.updated_at)} · Click to preview</p>
									{dashboards.length > 0 && (
										<div
											className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-4"
											onClick={event => event.stopPropagation()}
										>
											<span className="text-xs font-medium uppercase tracking-widest text-slate-500">Dashboards</span>
											<select
												className="ml-auto block w-56 rounded-md border-0 py-1.5 pl-3 pr-10 text-sm text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-emerald-600 sm:leading-6"
												onChange={(e) => {
													if (e.target.value) void handleAttachQuestion(question.id, e.target.value);
													e.target.value = '';
												}}
												defaultValue=""
											>
												<option value="" disabled>Add to dashboard...</option>
												{dashboards.map(d => (
													<option key={d.id} value={d.id}>{d.title}</option>
												))}
											</select>
										</div>
									)}
								</article>
							);
						})
					) : (
						<div className="rounded-md border border-dashed border-slate-200 px-4 py-8 text-sm text-slate-500">
							No saved questions yet. Save a chart from Chart, then attach it to a board.
						</div>
					)}
				</div>
			</section>
		</div>
	);
}
