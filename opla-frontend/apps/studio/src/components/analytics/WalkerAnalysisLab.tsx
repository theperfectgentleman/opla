import { useEffect, useMemo, useState, useCallback, useRef, type ComponentType } from 'react';
import { FlaskConical, Loader2, Play, Sparkles, Save } from 'lucide-react';
import { configure } from 'mobx';

try {
	configure({ isolateGlobalState: true });
} catch {
	// Already running reactions – fine, the isolation was likely set earlier.
}

import '@kanaries/graphic-walker/dist/style.css';
import type { IMutField } from '@kanaries/graphic-walker';

import { analyticsAPI } from '../../lib/api';
import { defaultSource } from './queryUtils';
import type { AnalyticsSource, AnalyticsToolProps, QueryResult } from './types';
import { buildWalkerFields, buildWalkerRows } from './walkerAdapters';
import { AnalyticsPageHeader, analyticsButtonClass, analyticsGhostButtonClass, analyticsInputClass, analyticsInsetClass, analyticsLabelClass, analyticsPanelClass } from './ui';

const DEFAULT_LIMIT = 250;
const MAX_LIMIT = 5000;

type GraphicWalkerProps = {
	data?: Array<Record<string, unknown>>;
	computation?: any;
	fields: unknown[];
	appearance?: 'light' | 'dark';
	hideProfiling?: boolean;
	defaultRenderer?: string;
	vizThemeConfig?: string;
	storeRef?: React.MutableRefObject<any>;
	chart?: any;
};

export default function WalkerAnalysisLab({ orgId, projectId, sources, initialSource, initialAnalysis }: AnalyticsToolProps) {
	const initialS = defaultSource(sources, initialSource);
	const defaultDatasetIds = Array.isArray(initialAnalysis?.source_config?.dataset_ids) 
		? (initialAnalysis.source_config.dataset_ids as string[]) 
		: (initialS ? [initialS.dataset_id] : []);
		
	const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>(defaultDatasetIds);
	const [limit, setLimit] = useState(
		(initialAnalysis?.query_config?.limit as number) || DEFAULT_LIMIT
	);
	
	const [results, setResults] = useState<{ source: AnalyticsSource; response: QueryResult }[]>([]);
	const [loading, setLoading] = useState(false);
	const [message, setMessage] = useState<string | null>(null);
	const [loadedSources, setLoadedSources] = useState<AnalyticsSource[]>([]);
	const [walkerLoadError, setWalkerLoadError] = useState<string | null>(null);
	const [walkerLoading, setWalkerLoading] = useState(false);
	const [WalkerComponent, setWalkerComponent] = useState<ComponentType<GraphicWalkerProps> | null>(null);
	const [useServerCompute, setUseServerCompute] = useState(false);

	// Phase 4 Save State
	const storeRef = useRef<any>(null);
	const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const [analysisName, setAnalysisName] = useState(initialAnalysis?.title ?? '');

	const computation = useCallback(async (payload: any) => {
		if (loadedSources.length !== 1) return [];
		try {
			const response = await analyticsAPI.walkerCompute(orgId, loadedSources[0].dataset_id, payload);
			return response.data || [];
		} catch (e: any) {
			console.error('Computation failed:', e);
			return [];
		}
	}, [orgId, loadedSources]);

	const selectedSources = useMemo(
		() => sources.filter(source => selectedSourceIds.includes(source.dataset_id)),
		[selectedSourceIds, sources],
	);

	useEffect(() => {
		const nextSource = defaultSource(sources, initialSource);
		// If no ids selected, fallback to default
		if (selectedSourceIds.length === 0 && nextSource && !initialAnalysis) {
			setSelectedSourceIds([nextSource.dataset_id]);
		}
	}, [initialSource, selectedSourceIds.length, sources, initialAnalysis]);

	useEffect(() => {
		setResults([]);
		setLoadedSources([]);
		setMessage(null);
		setWalkerLoadError(null);
	}, [selectedSourceIds]);

	const walkerRows = useMemo(() => {
		if (loadedSources.length === 0 || results.length === 0) {
			return [];
		}
		return results.flatMap(r => buildWalkerRows(r.source, r.response.rows ?? []));
	}, [loadedSources, results]);

	const walkerFields = useMemo(() => {
		if (loadedSources.length === 0) {
			return [];
		}
		const fieldsMap = new Map<string, IMutField>();
		loadedSources.forEach(source => {
			const srcFields = buildWalkerFields(source);
			srcFields.forEach(f => {
				if (!fieldsMap.has(f.fid)) {
					fieldsMap.set(f.fid, f);
				}
			});
		});
		return Array.from(fieldsMap.values());
	}, [loadedSources]);

	useEffect(() => {
		if (walkerRows.length === 0 || WalkerComponent || walkerLoading || walkerLoadError) {
			return;
		}

		let cancelled = false;
		const loadWalker = async () => {
			setWalkerLoading(true);
			try {
				const module = await import('@kanaries/graphic-walker');
				if (!cancelled) {
					setWalkerComponent(() => module.GraphicWalker as ComponentType<GraphicWalkerProps>);
					setWalkerLoadError(null);
				}
			} catch (error: any) {
				if (!cancelled) {
					setWalkerLoadError(error?.message || 'Graphic Walker could not be loaded in this browser session.');
				}
			} finally {
				if (!cancelled) {
					setWalkerLoading(false);
				}
			}
		};
		void loadWalker();
		return () => {
			cancelled = true;
		};
	}, [WalkerComponent, walkerLoadError, walkerLoading, walkerRows.length]);

	const totalLoadedRows = results.reduce((acc, r) => acc + (r.response.rows?.length ?? 0), 0);
	const anyTruncated = results.some(r => r.response.truncated || r.source.record_count > (r.response.rows?.length ?? 0));
	const isCapped = !!results.length && anyTruncated;

	// Initial load trigger when restoring from a saved analysis
	useEffect(() => {
		if (initialAnalysis && selectedSources.length > 0 && loadedSources.length === 0) {
			void handleLoad();
		}
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [initialAnalysis]); // Intentionally triggers only once on mount payload matching

	async function handleLoad() {
		if (selectedSources.length === 0) {
			setMessage('Choose at least one published dataset before opening the analysis lab.');
			return;
		}

		setLoading(true);
		setMessage(null);
		try {
			const useServer = selectedSources.length === 1 && selectedSources[0].record_count > limit;
			setUseServerCompute(useServer);

			if (useServer) {
				const source = selectedSources[0];
				const response = await analyticsAPI.runQuery(orgId, {
					dataset_id: source.dataset_id,
					select_fields: source.fields.map(field => field.field_key),
					limit: 10,
					offset: 0,
				});
				setResults([{ source, response }]);
				setLoadedSources([source]);
				setMessage(`Using server-side computation via Opla Backend. Found ${source.record_count.toLocaleString()} rows.`);
			} else {
				const limitPerSource = Math.max(10, Math.floor(limit / selectedSources.length));
				const allResults = await Promise.all(
					selectedSources.map(async source => {
						const response = await analyticsAPI.runQuery(orgId, {
							dataset_id: source.dataset_id,
							select_fields: source.fields.map(field => field.field_key),
							limit: limitPerSource,
							offset: 0,
						});
						return { source, response };
					})
				);

				setResults(allResults);
				setLoadedSources(selectedSources);

				const totalFetched = allResults.reduce((acc, r) => acc + (r.response.rows ?? []).length, 0);
				const someTruncated = allResults.some(r => r.response.truncated || r.source.record_count > (r.response.rows ?? []).length);
				
				if (totalFetched === 0) {
					setMessage('The selected datasets have no rows yet. Publish and collect submissions, then reopen the lab.');
				} else if (someTruncated) {
					setMessage(`Loaded the first ${totalFetched.toLocaleString()} rows across ${selectedSources.length} forms for local exploration. Run a single large dataset to use server compute.`);
				}
			}
		} catch (error: any) {
			setResults([]);
			setLoadedSources([]);
			setMessage(error?.response?.data?.detail || error?.message || 'Could not load dataset rows into the analysis lab.');
		} finally {
			setLoading(false);
		}
	}

	function handleReset() {
		setResults([]);
		setLoadedSources([]);
		setMessage(null);
	}

	async function handleSaveAnalysis() {
		if (!analysisName.trim()) {
			setMessage('Please provide a name for this analysis.');
			return;
		}

		setIsSaving(true);
		setMessage(null);
		try {
			// Extract Visual Specifications straight from Walker's component internal store ref
			let charts = [];
			if (storeRef.current?.vizStore?.exportCode) {
				charts = storeRef.current.vizStore.exportCode();
			} else if (storeRef.current?.exportChartSpec) {
				charts = [storeRef.current.exportChartSpec()];
			}
			
			const payload: any = {
				title: analysisName,
				source_config: {
					mode: useServerCompute ? 'server' : 'local',
					dataset_ids: selectedSourceIds,
				},
				query_config: { limit },
				viz_type: 'walker',
				viz_config: { charts },
			};
			if (projectId) {
				payload.project_id = projectId;
			}

			if (initialAnalysis?.id) {
				await analyticsAPI.updateQuestion(orgId, initialAnalysis.id, payload);
				setMessage('Analysis updated safely to the database.');
			} else {
				await analyticsAPI.createQuestion(orgId, payload);
				setMessage('Analysis saved as a new database question successfully!');
			}
			setIsSaveModalOpen(false);
		} catch (error: any) {
			console.error('Failed to save analysis', error);
			setMessage(error?.response?.data?.detail || error?.message || 'Failed to save analysis properties.');
		} finally {
			setIsSaving(false);
		}
	}

	if (selectedSources.length === 0 && sources.length === 0) {
		return (
			<div className="rounded-lg border border-dashed border-slate-200 p-8 text-sm text-slate-500">
				No analytics datasets are available yet. Publish a form dataset first, then reopen Analysis Lab.
			</div>
		);
	}

	return (
		<div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
			<section className={analyticsPanelClass}>
				<AnalyticsPageHeader
					eyebrow="Phase 1 & 3"
					title="Analysis Lab"
					description="Explore datasets naturally in Graphic Walker. Single large forms map to the database natively for scale; multiple forms union records locally."
					actions={<span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-[hsl(var(--primary-light))] text-[hsl(var(--primary))]"><FlaskConical className="h-4 w-4" /></span>}
				/>

				<div className="mt-4 space-y-4">
					<div className="space-y-2">
						<label className={analyticsLabelClass}>Datasets (Multi-Select Union)</label>
						<div className="max-h-48 overflow-y-auto rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--surface-elevated))] p-2 shadow-sm">
							{sources.map(source => (
								<label key={source.dataset_id} className="flex cursor-pointer items-center space-x-3 rounded p-2 hover:bg-[hsl(var(--surface))]">
									<input 
										type="checkbox" 
										checked={selectedSourceIds.includes(source.dataset_id)}
										onChange={(e) => {
											if (e.target.checked) setSelectedSourceIds(prev => [...prev, source.dataset_id]);
											else setSelectedSourceIds(prev => prev.filter(id => id !== source.dataset_id));
										}}
										className="rounded border-[hsl(var(--border))] text-[hsl(var(--primary))] focus:ring-[hsl(var(--primary))]"
									/>
									<span className="text-sm font-medium text-[hsl(var(--text-primary))]">{source.form_title}</span>
								</label>
							))}
						</div>
					</div>

					<div>
						<label className={analyticsLabelClass}>Local Row Limit</label>
						<input type="number" min={25} max={MAX_LIMIT} value={limit} onChange={event => setLimit(Math.max(25, Math.min(MAX_LIMIT, Number(event.target.value) || DEFAULT_LIMIT)))} className={analyticsInputClass} />
						<p className="mt-2 text-xs leading-5 text-slate-500">
							Controls how many rows fit into standard client-side memory. Ignored for single-form server compute mode.
						</p>
					</div>

					<div className="flex flex-wrap gap-2 pt-2">
						<button type="button" onClick={() => void handleLoad()} disabled={loading} className={analyticsButtonClass}>
							{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
							{loading ? 'Preparing analysis...' : 'Analyze'}
						</button>
						<button type="button" onClick={handleReset} className={analyticsGhostButtonClass} disabled={loading || totalLoadedRows === 0}>
							Reset
						</button>
					</div>

					{message ? <p className="text-sm font-medium text-rose-600">{message}</p> : null}
				</div>
			</section>

			<section className={analyticsPanelClass}>
				<AnalyticsPageHeader
					eyebrow={useServerCompute ? "Server-Side Engine" : "Local Walker Engine"}
					title={loadedSources.length > 0 && walkerRows.length > 0 ? `${totalLoadedRows.toLocaleString()} rows ready` : 'Awaiting dataset load'}
					description={useServerCompute ? "Opla backend handles queries natively because dataset scale exceeds local bounds." : "Multi-dataset union mode processes rows entirely in your local browser sandbox."}
					actions={walkerRows.length > 0 ? (
						<div className="flex items-center space-x-2">
							<span className={analyticsGhostButtonClass}><Sparkles className="h-4 w-4 text-[hsl(var(--primary))]" /> Beta</span>
							<button onClick={() => setIsSaveModalOpen(true)} className={`${analyticsButtonClass} bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary-dark))] text-white`}>
								<Save className="h-4 w-4 mr-2" />
								Save
							</button>
						</div>
					) : null}
				/>

				{loadedSources.length > 0 && walkerRows.length > 0 ? (
					<div className={`${analyticsInsetClass} mt-4 flex flex-wrap items-center justify-between gap-3 p-3 text-sm text-[hsl(var(--text-secondary))]`}>
						<div>
							<p><span className="font-semibold text-[hsl(var(--text-primary))]">Used sources:</span> {loadedSources.map(s => s.form_title).join(', ')}</p>
							<p className="mt-1"><span className="font-semibold text-[hsl(var(--text-primary))]">Rows fetched:</span> {totalLoadedRows.toLocaleString()}</p>
						</div>
						{isCapped && !useServerCompute ? (
							<p className="max-w-md text-xs leading-5 text-amber-700">
								This session is using a capped local sample.
							</p>
						) : !useServerCompute ? (
							<p className="max-w-md text-xs leading-5 text-[hsl(var(--text-secondary))]">
								Full datasets safely fit in browser memory.
							</p>
						) : null}
					</div>
				) : null}

				{loading ? (
					<div className="mt-4 flex min-h-[680px] items-center justify-center rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--surface-elevated))] text-sm text-[hsl(var(--text-secondary))]">
						<Loader2 className="mr-2 h-4 w-4 animate-spin text-[hsl(var(--primary))]" />
						Preparing Walker session...
					</div>
				) : walkerRows.length > 0 ? (
					<div className="mt-4 overflow-hidden rounded-md border border-[hsl(var(--border))] bg-white shadow-sm ring-1 ring-[hsl(var(--border))]">
						{walkerLoading ? (
							<div className="flex h-[720px] min-h-[720px] items-center justify-center text-sm text-[hsl(var(--text-secondary))]">
								<Loader2 className="mr-2 h-4 w-4 animate-spin text-[hsl(var(--primary))]" />
								Loading Walker canvas...
							</div>
						) : walkerLoadError ? (
							<div className="flex h-[720px] min-h-[720px] flex-col items-center justify-center gap-3 px-6 text-center text-sm text-[hsl(var(--text-secondary))]">
								<p className="font-semibold text-[hsl(var(--text-primary))]">Walker canvas is unavailable in this browser session</p>
								<p className="max-w-2xl leading-6">{walkerLoadError}</p>
								<p className="max-w-2xl leading-6">The selected dataset is still loaded, so the rest of the dashboard remains usable while the browser-incompatible module is isolated.</p>
							</div>
						) : WalkerComponent ? (
							<div className="h-[720px] min-h-[720px] w-full">
								<WalkerComponent
									storeRef={storeRef}
									chart={initialAnalysis?.viz_config?.charts}
									data={useServerCompute ? undefined : walkerRows}
									computation={useServerCompute ? computation : undefined}
									fields={walkerFields}
									appearance="light"
									hideProfiling
									defaultRenderer="vega-lite"
									vizThemeConfig="g2"
								/>
							</div>
						) : null}
					</div>
				) : (
					<div className="mt-4 flex min-h-[680px] flex-col items-center justify-center rounded-md border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--surface-elevated))] px-6 text-center text-sm text-[hsl(var(--text-secondary))]">
						<p className="font-semibold text-[hsl(var(--text-primary))]">No Walker session yet</p>
						<p className="mt-2 max-w-xl leading-6">
							Choose one or more datasets and click Analyze to start a session.
						</p>
					</div>
				)}

				{isSaveModalOpen && (
					<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
						<div className="w-full max-w-md rounded-xl border border-[hsl(var(--border))] bg-white p-6 shadow-xl">
							<h3 className="text-lg font-semibold text-[hsl(var(--text-primary))]">Save Analysis</h3>
							<p className="mt-2 text-sm text-[hsl(var(--text-secondary))]">
								This fully saves the Walker canvas state (configurations, layers, dragged fields) back to Opla. You or your team can revisit this exact query layout anytime.
							</p>

							<div className="mt-6">
								<label className={analyticsLabelClass}>Analysis Title</label>
								<input
									type="text"
									value={analysisName}
									onChange={(e) => setAnalysisName(e.target.value)}
									placeholder="e.g., Client Responses over Q3"
									className={`${analyticsInputClass} mt-1`}
									autoFocus
								/>
							</div>

							<div className="mt-8 flex justify-end gap-3">
								<button
									type="button"
									onClick={() => setIsSaveModalOpen(false)}
									className={analyticsGhostButtonClass}
								>
									Cancel
								</button>
								<button
									type="button"
									onClick={() => void handleSaveAnalysis()}
									disabled={isSaving || !analysisName.trim()}
									className={`${analyticsButtonClass} bg-[hsl(var(--primary))] text-white hover:bg-[hsl(var(--primary-dark))]`}
								>
									{isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
									{isSaving ? 'Saving...' : 'Confirm Save'}
								</button>
							</div>
						</div>
					</div>
				)}
			</section>
		</div>
	);
}