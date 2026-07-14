import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { Loader2, RotateCcw, Save } from 'lucide-react';
import { configure } from 'mobx';

try {
	configure({ isolateGlobalState: true });
} catch {
	// MobX may already be configured in this session.
}

import '@kanaries/graphic-walker/dist/style.css';
import './walkerHost.css';
import type { IMutField } from '@kanaries/graphic-walker';

import { analyticsAPI } from '../../lib/api';
import { defaultSource } from './queryUtils';
import type { AnalyticsToolProps, QueryResult } from './types';
import { buildWalkerFields, buildWalkerFieldsFromPrep, buildWalkerRows } from './walkerAdapters';
import { consumePrepSession, type PrepColumn } from './prepSession';
import QuickChart from './QuickChart';
import {
	buildValueLabelMaps,
	remapRowsForDisplay,
	type DisplayMode,
} from './valueLabels';
import { analyticsButtonClass, analyticsGhostButtonClass, analyticsInputClass, analyticsLabelClass } from './ui';

const LOCAL_ROW_LIMIT = 2000;
const SERVER_PREVIEW_ROWS = 25;

type LabMode = 'quick' | 'explore';

type GraphicWalkerProps = {
	data?: Array<Record<string, unknown>>;
	computation?: (payload: unknown) => Promise<Array<Record<string, unknown>>>;
	fields: unknown[];
	appearance?: 'light' | 'dark';
	hideProfiling?: boolean;
	defaultRenderer?: string;
	vizThemeConfig?: string;
	storeRef?: React.MutableRefObject<unknown>;
	chart?: unknown;
};

export default function WalkerAnalysisLab({
	orgId,
	projectId,
	sources,
	initialSource,
	initialAnalysis,
}: AnalyticsToolProps) {
	const fallbackSource = defaultSource(sources, initialSource);
	const initialDatasetId =
		(typeof initialAnalysis?.source_config?.dataset_id === 'string'
			? initialAnalysis.source_config.dataset_id
			: Array.isArray(initialAnalysis?.source_config?.dataset_ids)
				? (initialAnalysis.source_config.dataset_ids[0] as string | undefined)
				: undefined) ?? fallbackSource?.dataset_id ?? '';

	const [selectedDatasetId, setSelectedDatasetId] = useState(initialDatasetId);
	const [loadedSource, setLoadedSource] = useState<(typeof sources)[number] | null>(null);
	const [result, setResult] = useState<QueryResult | null>(null);
	const [useServerCompute, setUseServerCompute] = useState(false);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [prepColumns, setPrepColumns] = useState<PrepColumn[] | null>(null);
	const [prepLabel, setPrepLabel] = useState<string | null>(null);

	const [WalkerComponent, setWalkerComponent] = useState<ComponentType<GraphicWalkerProps> | null>(null);
	const [walkerLoading, setWalkerLoading] = useState(false);
	const [walkerLoadError, setWalkerLoadError] = useState<string | null>(null);

	const storeRef = useRef<any>(null);
	const loadGeneration = useRef(0);
	const prepApplied = useRef(false);
	const prepDatasetIdRef = useRef<string | null>(null);
	const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const [analysisName, setAnalysisName] = useState(initialAnalysis?.title ?? '');
	const [labMode, setLabMode] = useState<LabMode>('quick');
	const [displayMode, setDisplayMode] = useState<DisplayMode>('label');
	const quickChartConfigRef = useRef<import('./QuickChart').QuickChartSaveConfig | null>(null);

	const handleQuickChartConfig = useCallback((config: import('./QuickChart').QuickChartSaveConfig | null) => {
		quickChartConfigRef.current = config;
	}, []);

	const selectedSource = useMemo(
		() => sources.find(source => source.dataset_id === selectedDatasetId) ?? null,
		[selectedDatasetId, sources],
	);

	const walkerRows = useMemo(() => {
		if (!result) return [];
		if (prepColumns) return result.rows ?? [];
		if (!loadedSource) return [];
		return buildWalkerRows(loadedSource, result.rows ?? []);
	}, [loadedSource, prepColumns, result]);

	const walkerFields = useMemo(() => {
		if (prepColumns) return buildWalkerFieldsFromPrep(prepColumns);
		if (!loadedSource) return [] as IMutField[];
		return buildWalkerFields(loadedSource);
	}, [loadedSource, prepColumns]);

	const valueLabelMaps = useMemo(() => {
		if (prepColumns) return buildValueLabelMaps(prepColumns);
		if (loadedSource) return buildValueLabelMaps(loadedSource.fields);
		return buildValueLabelMaps([]);
	}, [loadedSource, prepColumns]);

	const hasChoiceFields = valueLabelMaps.size > 0;

	const displayRows = useMemo(
		() => remapRowsForDisplay(walkerRows, valueLabelMaps, displayMode),
		[displayMode, valueLabelMaps, walkerRows],
	);

	const computation = useCallback(
		async (payload: unknown) => {
			if (!loadedSource || prepColumns) return [];
			try {
				const response = await analyticsAPI.walkerCompute(orgId, loadedSource.dataset_id, payload);
				return response.data || [];
			} catch (computeError) {
				console.error('Walker server compute failed:', computeError);
				return [];
			}
		},
		[loadedSource, orgId, prepColumns],
	);

	const loadDataset = useCallback(
		async (source: (typeof sources)[number]) => {
			const generation = ++loadGeneration.current;
			setLoading(true);
			setError(null);
			setWalkerLoadError(null);
			setPrepColumns(null);
			setPrepLabel(null);

			try {
				const needsServer = source.record_count > LOCAL_ROW_LIMIT;
				const response = await analyticsAPI.runQuery(orgId, {
					dataset_id: source.dataset_id,
					select_fields: source.fields.map(field => field.field_key),
					limit: needsServer ? SERVER_PREVIEW_ROWS : LOCAL_ROW_LIMIT,
					offset: 0,
				});

				if (generation !== loadGeneration.current) return;

				setUseServerCompute(needsServer);
				setResult(response);
				setLoadedSource(source);

				if ((response.rows ?? []).length === 0) {
					setError('Dataset has no rows yet.');
				}
			} catch (loadError: any) {
				if (generation !== loadGeneration.current) return;
				setResult(null);
				setLoadedSource(null);
				setUseServerCompute(false);
				setError(loadError?.response?.data?.detail || loadError?.message || 'Could not load dataset.');
			} finally {
				if (generation === loadGeneration.current) setLoading(false);
			}
		},
		[orgId],
	);

	useEffect(() => {
		if (prepApplied.current) return;
		const prep = consumePrepSession(orgId);
		if (!prep) return;
		prepApplied.current = true;
		prepDatasetIdRef.current = prep.datasetId;
		loadGeneration.current += 1;
		setSelectedDatasetId(prep.datasetId);
		setPrepColumns(prep.columns);
		setPrepLabel(prep.datasetLabel);
		if (prep.displayMode === 'value' || prep.displayMode === 'label') {
			setDisplayMode(prep.displayMode);
		}
		setUseServerCompute(false);
		setLoadedSource(sources.find(source => source.dataset_id === prep.datasetId) ?? fallbackSource);
		setResult({
			columns: prep.columns.map(column => ({
				key: column.key,
				label: column.label,
				type: column.calculated ? 'number' : column.field_type || 'string',
			})),
			rows: prep.rows,
			total_count: prep.rows.length,
			truncated: false,
		});
		setError(null);
		setLoading(false);
	}, [fallbackSource, orgId, sources]);

	useEffect(() => {
		if (!selectedDatasetId && fallbackSource) {
			setSelectedDatasetId(fallbackSource.dataset_id);
		}
	}, [fallbackSource, selectedDatasetId]);

	useEffect(() => {
		if (prepApplied.current && selectedDatasetId === prepDatasetIdRef.current) {
			return;
		}
		prepApplied.current = false;
		prepDatasetIdRef.current = null;
		setResult(null);
		setLoadedSource(null);
		setUseServerCompute(false);
		setError(null);
		setWalkerLoadError(null);
		setPrepColumns(null);
		setPrepLabel(null);
	}, [selectedDatasetId]);

	useEffect(() => {
		if (prepApplied.current) return;
		if (!selectedSource) return;
		void loadDataset(selectedSource);
	}, [selectedSource, loadDataset]);

	useEffect(() => {
		if (labMode !== 'explore') return;
		if (walkerRows.length === 0) {
			setWalkerLoading(false);
			return;
		}
		if (WalkerComponent || walkerLoadError) {
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
			} catch (loadError: any) {
				if (!cancelled) {
					setWalkerLoadError(loadError?.message || 'Graphic Walker failed to load.');
				}
			} finally {
				if (!cancelled) setWalkerLoading(false);
			}
		};

		void loadWalker();
		return () => {
			cancelled = true;
		};
	}, [WalkerComponent, labMode, walkerLoadError, walkerRows.length]);

	function handleReset() {
		prepApplied.current = false;
		prepDatasetIdRef.current = null;
		loadGeneration.current += 1;
		setResult(null);
		setLoadedSource(null);
		setUseServerCompute(false);
		setError(null);
		setWalkerLoadError(null);
		setPrepColumns(null);
		setPrepLabel(null);
		if (selectedSource) void loadDataset(selectedSource);
	}

	async function handleSaveAnalysis() {
		if (!analysisName.trim() || !selectedDatasetId) {
			setError('Name this analysis before saving.');
			return;
		}

		setIsSaving(true);
		setError(null);
		try {
			let payload: Record<string, unknown>;

			if (labMode === 'quick') {
				const chartConfig = quickChartConfigRef.current;
				if (!chartConfig) {
					setError('Configure the chart (break down by / show) before saving.');
					setIsSaving(false);
					return;
				}
				payload = {
					title: analysisName.trim(),
					source_config: {
						mode: prepColumns ? 'prep' : useServerCompute ? 'server' : 'local',
						dataset_id: selectedDatasetId,
						dataset_ids: [selectedDatasetId],
						prep_columns: prepColumns ?? undefined,
					},
					query_config: chartConfig.query_config,
					viz_type: 'chart',
					viz_config: chartConfig.viz_config,
				};
			} else {
				let charts: unknown[] = [];
				if (storeRef.current?.vizStore?.exportCode) {
					charts = storeRef.current.vizStore.exportCode();
				} else if (storeRef.current?.exportChartSpec) {
					charts = [storeRef.current.exportChartSpec()];
				}

				payload = {
					title: analysisName.trim(),
					source_config: {
						mode: prepColumns ? 'prep' : useServerCompute ? 'server' : 'local',
						dataset_id: selectedDatasetId,
						dataset_ids: [selectedDatasetId],
						prep_columns: prepColumns ?? undefined,
					},
					query_config: { limit: useServerCompute && !prepColumns ? undefined : LOCAL_ROW_LIMIT },
					viz_type: 'walker',
					viz_config: { charts },
				};
			}

			if (projectId) payload.project_id = projectId;

			if (initialAnalysis?.id) {
				await analyticsAPI.updateQuestion(orgId, initialAnalysis.id, payload);
			} else {
				await analyticsAPI.createQuestion(orgId, payload);
			}
			setIsSaveModalOpen(false);
		} catch (saveError: any) {
			setError(saveError?.response?.data?.detail || saveError?.message || 'Failed to save.');
		} finally {
			setIsSaving(false);
		}
	}

	if (sources.length === 0) {
		return <div className="rounded-md border border-dashed border-slate-200 px-4 py-8 text-sm text-slate-500">No datasets yet.</div>;
	}

	const sessionReady = Boolean(walkerRows.length > 0);
	const statusLabel = loading
		? 'Loading…'
		: sessionReady
			? `${prepColumns ? 'Prep' : useServerCompute ? 'Server' : 'Local'} · ${walkerRows.length.toLocaleString()} rows${prepLabel ? ` · ${prepLabel}` : ''}`
			: 'Idle';

	return (
		<div className="flex min-h-[calc(100vh-11rem)] flex-col gap-2">
			<div className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-1.5 shadow-sm">
				<select
					value={selectedDatasetId}
					onChange={event => setSelectedDatasetId(event.target.value)}
					className="h-8 min-w-[14rem] flex-1 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-800 outline-none focus:border-emerald-700 focus:ring-1 focus:ring-emerald-100 sm:max-w-md"
					aria-label="Dataset"
				>
					{sources.map(source => (
						<option key={source.dataset_id} value={source.dataset_id}>
							{source.form_title} ({source.record_count.toLocaleString()})
						</option>
					))}
				</select>

				<span className="hidden text-xs text-slate-500 sm:inline">{statusLabel}</span>

				{hasChoiceFields ? (
					<div className="flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 p-0.5" title="Toggle choice codes vs readable labels">
						<button
							type="button"
							onClick={() => setDisplayMode('label')}
							className={`rounded px-2 py-1 text-[11px] font-semibold ${displayMode === 'label' ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
						>
							Labels
						</button>
						<button
							type="button"
							onClick={() => setDisplayMode('value')}
							className={`rounded px-2 py-1 text-[11px] font-semibold ${displayMode === 'value' ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
						>
							Values
						</button>
					</div>
				) : (
					<div
						className="flex items-center gap-1 rounded-md border border-dashed border-slate-200 px-2 py-1 text-[11px] text-slate-400"
						title="No choice options found on this dataset yet"
					>
						Labels/Values
					</div>
				)}

				<div className="flex flex-wrap items-center gap-1 rounded-md border border-slate-200 bg-slate-50 p-0.5">
					<button
						type="button"
						onClick={() => setLabMode('quick')}
						className={`rounded px-2.5 py-1 text-xs font-semibold ${labMode === 'quick' ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
					>
						Charts
					</button>
					<button
						type="button"
						onClick={() => setLabMode('explore')}
						className={`rounded px-2.5 py-1 text-xs font-semibold ${labMode === 'explore' ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
					>
						Explore
					</button>
				</div>

				<div className="ml-auto flex items-center gap-1.5">
					{error ? <span className="max-w-[16rem] truncate text-xs text-rose-600" title={error}>{error}</span> : null}
					<button
						type="button"
						onClick={handleReset}
						disabled={loading || !selectedSource}
						className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
						title="Reload"
					>
						{loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
						Reload
					</button>
					<button
						type="button"
						onClick={() => {
						if (labMode === 'quick' && quickChartConfigRef.current?.titleHint && !analysisName.trim()) {
							setAnalysisName(quickChartConfigRef.current.titleHint);
						}
						setIsSaveModalOpen(true);
					}}
						disabled={!sessionReady}
						className="inline-flex h-8 items-center gap-1.5 rounded-md border border-emerald-700 bg-emerald-700 px-2.5 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
						title={labMode === 'quick' ? 'Save as pinnable chart question' : 'Save Walker analysis'}
					>
						<Save className="h-3.5 w-3.5" />
						Save
					</button>
				</div>
			</div>

			<div className="relative min-h-0 flex-1 overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
				{loading && !sessionReady ? (
					<div className="flex h-full min-h-[28rem] items-center justify-center text-sm text-slate-500">
						<Loader2 className="mr-2 h-4 w-4 animate-spin text-emerald-700" />
						Loading data…
					</div>
				) : !sessionReady ? (
					<div className="flex h-full min-h-[28rem] items-center justify-center text-sm text-slate-500">
						Select a dataset to begin.
					</div>
				) : labMode === 'quick' ? (
					<div className="h-[calc(100vh-13rem)] min-h-[28rem] w-full">
						<QuickChart rows={displayRows} fields={walkerFields} onConfigChange={handleQuickChartConfig} />
					</div>
				) : walkerLoadError ? (
					<div className="flex h-full min-h-[28rem] items-center justify-center px-6 text-center text-sm text-rose-600">
						{walkerLoadError}
					</div>
				) : walkerLoading || !WalkerComponent ? (
					<div className="flex h-full min-h-[28rem] items-center justify-center text-sm text-slate-500">
						<Loader2 className="mr-2 h-4 w-4 animate-spin text-emerald-700" />
						Opening Explore…
					</div>
				) : (
					<div className="opla-walker-host h-[calc(100vh-13rem)] min-h-[28rem] w-full">
						<WalkerComponent
							key={`walker-${displayMode}-${displayRows.length}`}
							storeRef={storeRef}
							chart={initialAnalysis?.viz_config?.charts}
							data={useServerCompute && !prepColumns ? undefined : displayRows}
							computation={useServerCompute && !prepColumns ? computation : undefined}
							fields={walkerFields}
							appearance="light"
							hideProfiling
							defaultRenderer="vega-lite"
							vizThemeConfig="g2"
						/>
					</div>
				)}
			</div>

			{isSaveModalOpen ? (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
					<div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
						<h3 className="text-base font-semibold text-slate-800">
							{labMode === 'quick' ? 'Save chart question' : 'Save analysis'}
						</h3>
						<p className="mt-1 text-xs text-slate-500">
							{labMode === 'quick'
								? 'Saves a chart question you can pin on ProjectHub.'
								: 'Saves a Walker exploration (not used for ProjectHub pins yet).'}
						</p>
						<div className="mt-4">
							<label className={analyticsLabelClass}>Title</label>
							<input
								type="text"
								value={analysisName}
								onChange={event => setAnalysisName(event.target.value)}
								placeholder="Analysis name"
								className={`${analyticsInputClass} mt-1`}
								autoFocus
							/>
						</div>
						<div className="mt-5 flex justify-end gap-2">
							<button type="button" onClick={() => setIsSaveModalOpen(false)} className={analyticsGhostButtonClass}>
								Cancel
							</button>
							<button
								type="button"
								onClick={() => void handleSaveAnalysis()}
								disabled={isSaving || !analysisName.trim()}
								className={analyticsButtonClass}
							>
								{isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
								{isSaving ? 'Saving…' : 'Save'}
							</button>
						</div>
					</div>
				</div>
			) : null}
		</div>
	);
}
