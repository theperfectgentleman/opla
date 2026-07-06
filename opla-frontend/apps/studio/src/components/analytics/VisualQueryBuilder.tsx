import { useState, useMemo } from 'react';
import { Calculator, Play, Save, GripVertical } from 'lucide-react';
import { analyticsAPI } from '../../lib/api';
import type { AnalyticsToolProps, QueryResult } from './types';
import { AnalyticsPageHeader, analyticsButtonClass, analyticsGhostButtonClass, analyticsInputClass, analyticsLabelClass, analyticsPanelClass } from './ui';
import EChartCard from './cards/EChartCard';

type ShelfType = 'x' | 'y' | 'color' | 'size' | 'filters';

interface DragItem {
	key: string;
	label: string;
	type: string;
	bucket?: string;
}

export default function VisualQueryBuilder({ orgId, projectId, sources, initialSource, initialAnalysis }: AnalyticsToolProps) {
	const defaultSrc = initialSource || sources[0];
	const [selectedSourceId, setSelectedSourceId] = useState(initialAnalysis?.source_config?.dataset_id || defaultSrc?.dataset_id || '');
	const [limit, setLimit] = useState(250);

	const [shelves, setShelves] = useState<{
		x: DragItem[];
		y: DragItem[];
		color: DragItem[];
		size: DragItem[];
		filters: DragItem[];
	}>({
		x: [], y: [], color: [], size: [], filters: []
	});

	const [calculatedFields, setCalculatedFields] = useState<DragItem[]>([]);
	const [calcModalOpen, setCalcModalOpen] = useState(false);
	const [calcName, setCalcName] = useState('');
	const [calcExpression, setCalcExpression] = useState('');

	const [result, setResult] = useState<QueryResult | null>(null);
	const [loading, setLoading] = useState(false);
	const [message, setMessage] = useState<string | null>(null);

	const selectedSource = useMemo(() => sources.find(s => s.dataset_id === selectedSourceId), [sources, selectedSourceId]);

	const availableFields = useMemo(() => {
		if (!selectedSource) return [];
		return [
			...selectedSource.fields.map(f => ({ key: f.field_key, label: f.label || f.field_key, type: f.field_type || 'string' })),
			...calculatedFields
		];
	}, [selectedSource, calculatedFields]);

	const handleDragStart = (e: React.DragEvent, item: DragItem, sourceShelf?: ShelfType) => {
		e.dataTransfer.setData('application/json', JSON.stringify({ item, sourceShelf }));
	};

	const handleDrop = (e: React.DragEvent, targetShelf: ShelfType) => {
		e.preventDefault();
		const data = e.dataTransfer.getData('application/json');
		if (!data) return;
		const { item, sourceShelf } = JSON.parse(data);

		if (sourceShelf === targetShelf) return;

		setShelves(prev => {
			const next = { ...prev };
			if (sourceShelf) {
				next[sourceShelf as ShelfType] = next[sourceShelf as ShelfType].filter(i => i.key !== item.key);
			}
			if (!next[targetShelf].find(i => i.key === item.key)) {
				next[targetShelf] = [...next[targetShelf], item];
			}
			return next;
		});
	};

	const handleRemoveFromShelf = (targetShelf: ShelfType, key: string) => {
		setShelves(prev => ({
			...prev,
			[targetShelf]: prev[targetShelf].filter(i => i.key !== key)
		}));
	};

	const handleBucketChange = (targetShelf: ShelfType, key: string, bucket: string) => {
		setShelves(prev => ({
			...prev,
			[targetShelf]: prev[targetShelf].map(i => i.key === key ? { ...i, bucket } : i)
		}));
	};

	const handleAddCalcField = () => {
		if (!calcName || !calcExpression) return;
		setCalculatedFields(prev => [...prev, { key: `calc_${Date.now()}`, label: calcName, type: 'number', expression: calcExpression } as any]);
		setCalcModalOpen(false);
		setCalcName('');
		setCalcExpression('');
	};

	const handleRun = async () => {
		if (!selectedSource) return;
		setLoading(true);
		setMessage(null);
		try {
			// Naive translation of shelves to backend query for Phase 2
			// X is group_by, Y is aggregate (sum)
			const group_by = shelves.x.map(i => i.bucket ? { field: i.key, bucket: i.bucket } : i.key);
			const aggregates = shelves.y.map(i => ({ field: i.key, fn: 'sum' as any }));

			const response = await analyticsAPI.runQuery(orgId, {
				dataset_id: selectedSource.dataset_id,
				group_by: group_by.length > 0 ? (group_by as any) : undefined,
				aggregates: aggregates.length > 0 ? aggregates : undefined,
				limit
			});
			setResult(response);
		} catch (e: any) {
			setMessage(e?.response?.data?.detail || e.message);
		} finally {
			setLoading(false);
		}
	};

	if (!selectedSource) return <div className="p-8 text-center text-slate-500">No datasets available.</div>;

	return (
		<div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)_320px]">
			{/* Left: Field List */}
			<section className={analyticsPanelClass}>
				<AnalyticsPageHeader eyebrow="Data" title="Fields" description="Drag fields into the query builder shelves." />
				<div className="mt-4 space-y-2">
					<div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Available</div>
					<div className="max-h-[60vh] overflow-y-auto space-y-1">
						{availableFields.map(field => (
							<div
								key={field.key}
								draggable
								onDragStart={(e) => handleDragStart(e, field)}
								className="flex cursor-grab items-center rounded-md border border-slate-200 bg-white p-2 text-sm text-slate-700 shadow-sm hover:border-emerald-300"
							>
								<GripVertical className="mr-2 h-4 w-4 text-slate-400" />
								{field.label}
							</div>
						))}
					</div>
					<button onClick={() => setCalcModalOpen(true)} className={`${analyticsGhostButtonClass} mt-4 w-full`}>
						<Calculator className="mr-2 h-4 w-4" /> Add Calculated Field
					</button>
				</div>
			</section>

			{/* Center: Shelves and Canvas */}
			<section className="flex flex-col gap-4">
				<div className={analyticsPanelClass}>
					<div className="space-y-3">
						{(['filters', 'x', 'y', 'color', 'size'] as ShelfType[]).map(shelf => (
							<div
								key={shelf}
								onDragOver={e => e.preventDefault()}
								onDrop={e => handleDrop(e, shelf)}
								className="flex min-h-[44px] items-center gap-2 rounded-md border border-dashed border-slate-300 bg-slate-50 p-2"
							>
								<div className="w-20 text-xs font-semibold uppercase text-slate-500">{shelf}</div>
								<div className="flex flex-wrap gap-2">
									{shelves[shelf].map(item => (
										<div
											key={item.key}
											draggable
											onDragStart={(e) => handleDragStart(e, item, shelf)}
											className="flex cursor-grab items-center rounded-md bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-800"
										>
											{item.label}
											{item.type === 'datetime' || item.key === '_submitted_at' ? (
												<select 
													value={item.bucket || ''} 
													onChange={(e) => handleBucketChange(shelf, item.key, e.target.value)}
													className="ml-2 rounded border border-emerald-300 bg-emerald-50 px-1 py-0.5 text-[10px] text-emerald-800 outline-none"
												>
													<option value="">No bucketing</option>
													<option value="day">Day</option>
													<option value="week">Week</option>
													<option value="month">Month</option>
													<option value="quarter">Quarter</option>
													<option value="year">Year</option>
												</select>
											) : null}
											<button onClick={() => handleRemoveFromShelf(shelf, item.key)} className="ml-2 hover:text-emerald-900">&times;</button>
										</div>
									))}
								</div>
							</div>
						))}
					</div>
					<div className="mt-4 flex items-center justify-between">
						<button onClick={() => void handleRun()} disabled={loading} className={analyticsButtonClass}>
							<Play className="mr-2 h-4 w-4" /> {loading ? 'Running...' : 'Run Query'}
						</button>
						{message && <span className="text-sm text-rose-600">{message}</span>}
					</div>
				</div>

				{/* Visualization */}
				<div className={`${analyticsPanelClass} flex-1`}>
					{result ? (
						<div className="h-[500px]">
							<EChartCard 
								question={{ viz_config: { chart_type: 'bar' } } as any} 
								data={result.rows.map(r => ({ category: String(r[shelves.x[0]?.key] || 'All'), metric: Number(r[shelves.y[0] ? `sum_${shelves.y[0].key}` : '']) || 0 }))} 
							/>
						</div>
					) : (
						<div className="flex h-[500px] items-center justify-center border-2 border-dashed border-slate-200 text-slate-400">
							Drop fields onto shelves and run to see visualization
						</div>
					)}
				</div>
			</section>

			{/* Right: config (optional) */}
			<section className={analyticsPanelClass}>
				<AnalyticsPageHeader eyebrow="Save" title="Properties" description="Save this layout for reuse." />
				<div className="mt-4">
					<button className={`${analyticsButtonClass} w-full`}><Save className="mr-2 h-4 w-4"/> Save Question</button>
				</div>
			</section>

			{/* Calc Modal */}
			{calcModalOpen && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
					<div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
						<h3 className="text-lg font-semibold">New Calculated Field</h3>
						<div className="mt-4 space-y-4">
							<div>
								<label className={analyticsLabelClass}>Field Name</label>
								<input value={calcName} onChange={e => setCalcName(e.target.value)} className={analyticsInputClass} placeholder="e.g. Revenue per click" />
							</div>
							<div>
								<label className={analyticsLabelClass}>Formula</label>
								<input value={calcExpression} onChange={e => setCalcExpression(e.target.value)} className={analyticsInputClass} placeholder="[revenue] / [clicks]" />
								<p className="mt-1 text-xs text-slate-500">Use basic math operators (+, -, *, /) and field keys.</p>
							</div>
							<div className="flex justify-end gap-2 pt-4">
								<button onClick={() => setCalcModalOpen(false)} className={analyticsGhostButtonClass}>Cancel</button>
								<button onClick={handleAddCalcField} className={analyticsButtonClass}>Create Field</button>
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
