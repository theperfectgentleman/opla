import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { BarChart3, FileSpreadsheet, LayoutDashboard, Loader2, PanelsTopLeft, Plus, Table2 } from 'lucide-react';

import { analyticsAPI } from '../../lib/api';
import { defaultSource } from './queryUtils';
import type { AnalyticsDashboard, AnalyticsToolProps, SavedQuestion } from './types';
import { AnalyticsPageHeader, AnalyticsPanelSkeleton, analyticsButtonClass, analyticsGhostButtonClass, analyticsInputClass, analyticsInsetClass, analyticsLabelClass, analyticsPanelClass } from './ui';

const vizMeta: Record<SavedQuestion['viz_type'], { label: string; icon: ReactNode }> = {
	table: { label: 'Table', icon: <Table2 className="h-4 w-4" /> },
	chart: { label: 'Chart', icon: <BarChart3 className="h-4 w-4" /> },
	spreadsheet: { label: 'Spreadsheet', icon: <FileSpreadsheet className="h-4 w-4" /> },
	pivot: { label: 'Pivot', icon: <LayoutDashboard className="h-4 w-4" /> },
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
	const [composerMode, setComposerMode] = useState<'question' | 'dashboard' | null>(null);
	const [questionTitle, setQuestionTitle] = useState('');
	const [questionDescription, setQuestionDescription] = useState('');
	const [questionVizType, setQuestionVizType] = useState<SavedQuestion['viz_type']>('table');
	const [questionSourceId, setQuestionSourceId] = useState('');
	const [dashboardTitle, setDashboardTitle] = useState('');
	const [dashboardDescription, setDashboardDescription] = useState('');
	const [submitLoading, setSubmitLoading] = useState(false);
	const [submitMessage, setSubmitMessage] = useState<string | null>(null);

	const defaultAnalyticsSource = useMemo(() => defaultSource(sources, undefined), [sources]);

	useEffect(() => {
		if (!questionSourceId && defaultAnalyticsSource) {
			setQuestionSourceId(defaultAnalyticsSource.dataset_id);
		}
	}, [defaultAnalyticsSource, questionSourceId]);

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

	const orphanQuestions = useMemo(() => {
		const questionIds = new Set(dashboards.flatMap(dashboard => dashboard.cards.map(card => card.question_id)));
		return questions.filter(question => !questionIds.has(question.id)).slice(0, 8);
	}, [dashboards, questions]);

	const selectedSource = useMemo(
		() => sources.find(source => source.dataset_id === questionSourceId) ?? defaultAnalyticsSource ?? null,
		[defaultAnalyticsSource, questionSourceId, sources],
	);

	async function handleCreateQuestion() {
		if (!selectedSource || !questionTitle.trim()) {
			setSubmitMessage('Choose a dataset and enter a question title before saving.');
			return;
		}

		setSubmitLoading(true);
		setSubmitMessage(null);
		try {
			const selectFields = selectedSource.fields.slice(0, 6).map(field => field.field_key);
			const payload = {
				title: questionTitle.trim(),
				description: questionDescription.trim() || null,
				project_id: selectedSource.project_id ?? projectId ?? null,
				source_config: {
					dataset_id: selectedSource.dataset_id,
					dataset_slug: selectedSource.dataset_slug,
					form_id: selectedSource.form_id,
					form_title: selectedSource.form_title,
				},
				query_config: {
					select_fields: selectFields,
					filters: null,
					group_by: [],
					aggregates: [],
					order_by: [],
					limit: 50,
					offset: 0,
				},
				viz_type: questionVizType,
				viz_config: questionVizType === 'chart' ? { chart_type: 'bar' } : null,
			};

			await analyticsAPI.createQuestion(orgId, payload);
			setQuestionTitle('');
			setQuestionDescription('');
			setQuestionVizType('table');
			setComposerMode(null);
			setReloadToken(current => current + 1);
		} catch (submitError: any) {
			setSubmitMessage(submitError?.response?.data?.detail || submitError?.message || 'Could not create saved question.');
		} finally {
			setSubmitLoading(false);
		}
	}

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
				project_id: projectId ?? selectedSource?.project_id ?? null,
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

	if (dashboards.length === 0 && questions.length === 0) {
		return (
			<div className={analyticsPanelClass}>
				<AnalyticsPageHeader
					eyebrow="Saved Assets"
					title="No Dashboards Or Saved Questions Yet"
					description="Create a reusable question or an empty dashboard from here to start building out saved analytics assets."
					actions={
						<>
							<button type="button" className={analyticsGhostButtonClass} onClick={() => { setComposerMode('question'); setSubmitMessage(null); }}>
								<Plus className="h-4 w-4" />
								New Question
							</button>
							<button type="button" className={analyticsGhostButtonClass} onClick={() => { setComposerMode('dashboard'); setSubmitMessage(null); }}>
								<Plus className="h-4 w-4" />
								New Dashboard
							</button>
						</>
					}
				/>

				{composerMode === 'question' ? (
					<div className={`${analyticsInsetClass} mt-4 p-4`}>
						<div className="grid gap-4 md:grid-cols-2">
							<div>
								<label className={analyticsLabelClass}>Question title</label>
								<input value={questionTitle} onChange={event => setQuestionTitle(event.target.value)} className={analyticsInputClass} placeholder="Submission table snapshot" />
							</div>
							<div>
								<label className={analyticsLabelClass}>View type</label>
								<select value={questionVizType} onChange={event => setQuestionVizType(event.target.value as SavedQuestion['viz_type'])} className={analyticsInputClass}>
									<option value="table">Table</option>
									<option value="chart">Chart</option>
									<option value="spreadsheet">Spreadsheet</option>
									<option value="pivot">Pivot</option>
								</select>
							</div>
						</div>
						<div className="mt-4 grid gap-4 md:grid-cols-2">
							<div>
								<label className={analyticsLabelClass}>Description</label>
								<input value={questionDescription} onChange={event => setQuestionDescription(event.target.value)} className={analyticsInputClass} placeholder="Reusable starting point for analytics teams" />
							</div>
							<div>
								<label className={analyticsLabelClass}>Dataset</label>
								<select value={questionSourceId} onChange={event => setQuestionSourceId(event.target.value)} className={analyticsInputClass} disabled={sources.length === 0}>
									{sources.map(source => (
										<option key={source.dataset_id} value={source.dataset_id}>{source.form_title}</option>
									))}
								</select>
							</div>
						</div>
						<div className="mt-4 flex flex-wrap gap-2">
							<button type="button" disabled={submitLoading || sources.length === 0} onClick={() => void handleCreateQuestion()} className={analyticsButtonClass}>
								{submitLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Table2 className="h-4 w-4" />}
								{submitLoading ? 'Saving...' : 'Create question'}
							</button>
							<button type="button" className={analyticsGhostButtonClass} onClick={() => setComposerMode(null)}>Cancel</button>
						</div>
						{sources.length === 0 ? <p className="mt-3 text-sm text-slate-500">Publish a dataset before creating a saved question.</p> : null}
						{submitMessage ? <p className="mt-3 text-sm text-rose-600">{submitMessage}</p> : null}
					</div>
				) : null}

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
									<h4 className="text-base font-bold text-slate-800">{dashboard.title}</h4>
									<p className="mt-1 text-sm text-slate-500">{dashboard.description || 'No dashboard description yet.'}</p>
								</div>
								<span className={analyticsGhostButtonClass}>{dashboard.cards.length} card{dashboard.cards.length === 1 ? '' : 's'}</span>
							</div>

							<div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
								<span className="rounded-md bg-slate-100 px-2 py-1">Updated {formatDate(dashboard.updated_at)}</span>
								{dashboard.project_id ? <span className="rounded-md bg-slate-100 px-2 py-1">Project scoped</span> : <span className="rounded-md bg-slate-100 px-2 py-1">Org level</span>}
							</div>

							{dashboard.cards.length > 0 ? (
								<div className={`${analyticsInsetClass} mt-3 grid gap-3 p-3 md:grid-cols-2`}>
									{dashboard.cards.slice(0, 4).map(card => {
										const question = card.question;
										const meta = vizMeta[question?.viz_type ?? 'table'];
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
					description={`${questions.length} saved question${questions.length === 1 ? '' : 's'} available for reuse.`}
					actions={
						<button type="button" className={analyticsGhostButtonClass} onClick={() => { setComposerMode('question'); setSubmitMessage(null); }}>
							<Plus className="h-4 w-4" />
							New Question
						</button>
					}
				/>

				{composerMode === 'question' ? (
					<div className={`${analyticsInsetClass} mt-4 p-4`}>
						<div className="space-y-4">
							<div>
								<label className={analyticsLabelClass}>Question title</label>
								<input value={questionTitle} onChange={event => setQuestionTitle(event.target.value)} className={analyticsInputClass} placeholder="Submission table snapshot" />
							</div>
							<div>
								<label className={analyticsLabelClass}>Description</label>
								<input value={questionDescription} onChange={event => setQuestionDescription(event.target.value)} className={analyticsInputClass} placeholder="Reusable starting point for analytics teams" />
							</div>
							<div>
								<label className={analyticsLabelClass}>Dataset</label>
								<select value={questionSourceId} onChange={event => setQuestionSourceId(event.target.value)} className={analyticsInputClass}>
									{sources.map(source => (
										<option key={source.dataset_id} value={source.dataset_id}>{source.form_title}</option>
									))}
								</select>
							</div>
							<div>
								<label className={analyticsLabelClass}>View type</label>
								<select value={questionVizType} onChange={event => setQuestionVizType(event.target.value as SavedQuestion['viz_type'])} className={analyticsInputClass}>
									<option value="table">Table</option>
									<option value="chart">Chart</option>
									<option value="spreadsheet">Spreadsheet</option>
									<option value="pivot">Pivot</option>
								</select>
							</div>
						</div>
						<div className="mt-4 flex flex-wrap gap-2">
							<button type="button" disabled={submitLoading} onClick={() => void handleCreateQuestion()} className={analyticsButtonClass}>
								{submitLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Table2 className="h-4 w-4" />}
								{submitLoading ? 'Saving...' : 'Create question'}
							</button>
							<button type="button" className={analyticsGhostButtonClass} onClick={() => setComposerMode(null)}>Cancel</button>
						</div>
						{submitMessage ? <p className="mt-3 text-sm text-rose-600">{submitMessage}</p> : null}
					</div>
				) : null}

				<div className="mt-4 space-y-3">
					{orphanQuestions.length > 0 ? (
						orphanQuestions.map(question => {
							const meta = vizMeta[question.viz_type];
							return (
								<article key={question.id} className="rounded-md border border-slate-200 bg-white p-3">
									<div className="flex items-center gap-2 text-emerald-700">
										{meta.icon}
										<span className="text-[10px] font-bold uppercase tracking-[0.18em]">{meta.label}</span>
									</div>
									<h4 className="mt-2 text-sm font-semibold text-slate-800">{question.title}</h4>
									<p className="mt-1 text-sm text-slate-500">{question.description || 'No description provided.'}</p>
									<p className="mt-3 text-xs text-slate-500">Updated {formatDate(question.updated_at)}</p>
								</article>
							);
						})
					) : (
						<div className="rounded-md border border-dashed border-slate-200 px-4 py-8 text-sm text-slate-500">
							Every saved question in this workspace is already attached to a dashboard card.
						</div>
					)}
				</div>
			</section>
		</div>
	);
}
