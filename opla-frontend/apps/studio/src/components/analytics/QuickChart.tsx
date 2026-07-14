import { useEffect, useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import type { IMutField } from '@kanaries/graphic-walker';

type ChartKind = 'bar' | 'stacked' | 'grouped' | 'hline' | 'pie' | 'line' | 'scatter';
type AggFn = 'count' | 'sum' | 'avg' | 'min' | 'max';

type Point = { category: string; series: string; metric: number; x?: number; y?: number };

const COLORS = ['#0f766e', '#0369a1', '#7c3aed', '#db2777', '#d97706', '#15803d', '#0891b2', '#4f46e5'];

const selectClass =
	'h-8 min-w-[9rem] rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-800 outline-none focus:border-emerald-700';
const labelClass = 'text-[10px] font-bold uppercase tracking-wider text-slate-500';

function coerceLabel(value: unknown) {
	if (value == null || value === '') return '(blank)';
	if (typeof value === 'boolean') return value ? 'True' : 'False';
	if (typeof value === 'object') return JSON.stringify(value);
	return String(value);
}

function toNumber(value: unknown): number | null {
	if (value == null || value === '') return null;
	if (typeof value === 'number' && Number.isFinite(value)) return value;
	if (typeof value === 'boolean') return value ? 1 : 0;
	const parsed = Number(String(value).replace(/,/g, '').trim());
	return Number.isFinite(parsed) ? parsed : null;
}

function isMeasureField(field: IMutField) {
	return field.analyticType === 'measure' || field.semanticType === 'quantitative';
}

function aggLabel(fn: AggFn, fieldName?: string) {
	if (fn === 'count') return 'Count';
	const name = fieldName || 'value';
	return `${fn[0].toUpperCase()}${fn.slice(1)} ${name}`;
}

function aggregateRows(args: {
	rows: Array<Record<string, unknown>>;
	categoryKey: string;
	seriesKey?: string;
	metricKey?: string;
	agg: AggFn;
}): Point[] {
	const { rows, categoryKey, seriesKey, metricKey, agg } = args;
	const buckets = new Map<string, { sum: number; count: number; min: number; max: number }>();

	for (const row of rows) {
		const category = coerceLabel(row[categoryKey]);
		const series = seriesKey ? coerceLabel(row[seriesKey]) : 'Value';
		const key = `${category}||${series}`;
		const numeric = agg === 'count' ? 1 : toNumber(metricKey ? row[metricKey] : null);
		if (agg !== 'count' && numeric == null) continue;

		const current = buckets.get(key) ?? { sum: 0, count: 0, min: Number.POSITIVE_INFINITY, max: Number.NEGATIVE_INFINITY };
		const value = agg === 'count' ? 1 : (numeric as number);
		current.sum += value;
		current.count += 1;
		current.min = Math.min(current.min, value);
		current.max = Math.max(current.max, value);
		buckets.set(key, current);
	}

	const points: Point[] = [];
	for (const [key, stats] of buckets.entries()) {
		const [category, series] = key.split('||');
		let metric = stats.count;
		if (agg === 'sum') metric = stats.sum;
		if (agg === 'avg') metric = stats.count ? stats.sum / stats.count : 0;
		if (agg === 'min') metric = stats.min === Number.POSITIVE_INFINITY ? 0 : stats.min;
		if (agg === 'max') metric = stats.max === Number.NEGATIVE_INFINITY ? 0 : stats.max;
		points.push({ category, series, metric });
	}

	return points.sort((a, b) => b.metric - a.metric);
}

function scatterPoints(
	rows: Array<Record<string, unknown>>,
	xKey: string,
	yKey: string,
	seriesKey?: string,
): Point[] {
	const points: Point[] = [];
	for (const row of rows) {
		const x = toNumber(row[xKey]);
		const y = toNumber(row[yKey]);
		if (x == null || y == null) continue;
		points.push({
			category: coerceLabel(row[xKey]),
			series: seriesKey ? coerceLabel(row[seriesKey]) : 'Points',
			metric: y,
			x,
			y,
		});
	}
	return points.slice(0, 2000);
}

export default function QuickChart({
	rows,
	fields,
}: {
	rows: Array<Record<string, unknown>>;
	fields: IMutField[];
}) {
	const chartableFields = useMemo(
		() => fields.filter(field => field.fid && field.fid !== 'gw_row_id'),
		[fields],
	);
	const dimensions = useMemo(
		() => chartableFields.filter(field => !isMeasureField(field)),
		[chartableFields],
	);
	const measures = useMemo(
		() => chartableFields.filter(field => isMeasureField(field)),
		[chartableFields],
	);

	const defaultCategory = dimensions[0]?.fid || chartableFields[0]?.fid || '';
	const [categoryKey, setCategoryKey] = useState(defaultCategory);
	const [metricMode, setMetricMode] = useState<'count' | string>('count');
	const [agg, setAgg] = useState<AggFn>('count');
	const [seriesKey, setSeriesKey] = useState<string>('');
	const [chartKind, setChartKind] = useState<ChartKind>('bar');
	const [scatterYKey, setScatterYKey] = useState(measures[0]?.fid || measures[1]?.fid || '');

	useEffect(() => {
		if (!categoryKey && defaultCategory) setCategoryKey(defaultCategory);
	}, [categoryKey, defaultCategory]);

	useEffect(() => {
		if (chartKind === 'scatter') {
			if (!scatterYKey && measures[0]?.fid) setScatterYKey(measures[0].fid);
			if (metricMode === 'count' && measures[0]?.fid) setMetricMode(measures[0].fid);
			return;
		}
		if (chartKind === 'pie' && seriesKey) setSeriesKey('');
	}, [chartKind, measures, metricMode, scatterYKey, seriesKey]);

	useEffect(() => {
		if (metricMode === 'count') setAgg('count');
		else if (agg === 'count') setAgg('avg');
	}, [metricMode, agg]);

	const categoryField = chartableFields.find(field => field.fid === categoryKey);
	const metricField = chartableFields.find(field => field.fid === metricMode);
	const seriesField = chartableFields.find(field => field.fid === seriesKey);
	const scatterYField = chartableFields.find(field => field.fid === scatterYKey);

	const points = useMemo(() => {
		if (!categoryKey || rows.length === 0) return [] as Point[];

		if (chartKind === 'scatter') {
			const xKey = categoryKey;
			const yKey = scatterYKey || measures.find(field => field.fid !== xKey)?.fid || xKey;
			return scatterPoints(rows, xKey, yKey, seriesKey || undefined);
		}

		return aggregateRows({
			rows,
			categoryKey,
			seriesKey: seriesKey || undefined,
			metricKey: metricMode === 'count' ? undefined : metricMode,
			agg: metricMode === 'count' ? 'count' : agg,
		}).slice(0, chartKind === 'pie' ? 20 : 60);
	}, [agg, categoryKey, chartKind, measures, metricMode, rows, scatterYKey, seriesKey]);

	const categories = useMemo(() => {
		const ordered = new Map<string, number>();
		for (const point of points) {
			ordered.set(point.category, (ordered.get(point.category) ?? 0) + Math.abs(point.metric));
		}
		return Array.from(ordered.entries())
			.sort((a, b) => b[1] - a[1])
			.map(([category]) => category);
	}, [points]);

	const seriesNames = useMemo(() => {
		const names = Array.from(new Set(points.map(point => point.series)));
		return names.length ? names : ['Value'];
	}, [points]);

	const metricTitle = chartKind === 'scatter'
		? `${categoryField?.name || categoryKey} vs ${scatterYField?.name || scatterYKey}`
		: `${categoryField?.name || categoryKey} · ${aggLabel(metricMode === 'count' ? 'count' : agg, metricField?.name)}`;

	const option = useMemo(() => {
		if (chartKind === 'scatter') {
			return {
				color: COLORS,
				tooltip: {
					trigger: 'item',
					formatter: (params: any) => {
						const value = params.value || [];
						return `${params.seriesName}<br/>X: ${value[0]}<br/>Y: ${value[1]}`;
					},
				},
				legend: seriesNames.length > 1 ? { type: 'scroll', bottom: 0, textStyle: { color: '#475569', fontSize: 11 } } : undefined,
				grid: { left: 56, right: 24, top: 36, bottom: seriesNames.length > 1 ? 56 : 40 },
				title: { text: metricTitle, left: 0, top: 0, textStyle: { fontSize: 13, fontWeight: 600, color: '#0f172a' } },
				xAxis: {
					type: 'value',
					name: categoryField?.name || 'X',
					axisLabel: { color: '#64748b' },
					splitLine: { lineStyle: { color: '#e2e8f0', type: 'dashed' } },
				},
				yAxis: {
					type: 'value',
					name: scatterYField?.name || 'Y',
					axisLabel: { color: '#64748b' },
					splitLine: { lineStyle: { color: '#e2e8f0', type: 'dashed' } },
				},
				series: seriesNames.map(name => ({
					name,
					type: 'scatter',
					symbolSize: 10,
					data: points.filter(point => point.series === name).map(point => [point.x, point.y]),
				})),
			};
		}

		if (chartKind === 'pie') {
			const pieData = categories.map(category => ({
				name: category,
				value: points.filter(point => point.category === category).reduce((sum, point) => sum + point.metric, 0),
			}));
			return {
				color: COLORS,
				tooltip: { trigger: 'item' },
				legend: { type: 'scroll', bottom: 0, textStyle: { color: '#475569', fontSize: 11 } },
				title: { text: metricTitle, left: 0, top: 0, textStyle: { fontSize: 13, fontWeight: 600, color: '#0f172a' } },
				series: [
					{
						type: 'pie',
						radius: ['34%', '66%'],
						center: ['50%', '52%'],
						itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
						label: { formatter: '{b}: {d}%', color: '#334155', fontSize: 11 },
						data: pieData,
					},
				],
			};
		}

		const horizontal = chartKind === 'hline';
		const stacked = chartKind === 'stacked';
		const grouped = chartKind === 'grouped' || (!!seriesKey && chartKind === 'bar');
		const line = chartKind === 'line';
		const categoryAxisData = horizontal ? categories.slice().reverse() : categories;

		const builtSeries = seriesNames.map(name => {
			const data = categoryAxisData.map(category => {
				const match = points.find(point => point.category === category && point.series === name);
				return match?.metric ?? 0;
			});
			return {
				name,
				type: line ? 'line' : 'bar',
				stack: stacked ? 'total' : undefined,
				smooth: line,
				showSymbol: line ? categories.length <= 24 : undefined,
				barMaxWidth: grouped || stacked ? 28 : 42,
				barGap: grouped ? '20%' : undefined,
				emphasis: { focus: 'series' },
				itemStyle: line
					? undefined
					: { borderRadius: horizontal ? [0, 4, 4, 0] : stacked ? 0 : [4, 4, 0, 0] },
				areaStyle: line && stacked ? { opacity: 0.15 } : undefined,
				data,
			};
		});

		return {
			color: COLORS,
			tooltip: { trigger: 'axis', axisPointer: { type: line ? 'line' : 'shadow' } },
			legend: seriesNames.length > 1 ? { type: 'scroll', bottom: 0, textStyle: { color: '#475569', fontSize: 11 } } : undefined,
			grid: {
				left: horizontal ? 128 : 52,
				right: 24,
				top: 36,
				bottom: seriesNames.length > 1 || categories.some(label => label.length > 12) ? 72 : 40,
			},
			title: { text: metricTitle, left: 0, top: 0, textStyle: { fontSize: 13, fontWeight: 600, color: '#0f172a' } },
			xAxis: horizontal
				? {
						type: 'value',
						axisLabel: { color: '#64748b' },
						splitLine: { lineStyle: { color: '#e2e8f0', type: 'dashed' } },
					}
				: {
						type: 'category',
						data: categoryAxisData,
						axisLabel: {
							color: '#64748b',
							rotate: categoryAxisData.length > 8 ? 35 : 0,
							interval: 0,
							fontSize: 11,
						},
						axisLine: { lineStyle: { color: '#cbd5e1' } },
					},
			yAxis: horizontal
				? {
						type: 'category',
						data: categoryAxisData,
						axisLabel: { color: '#64748b', fontSize: 11, width: 114, overflow: 'truncate' },
						axisLine: { show: false },
					}
				: {
						type: 'value',
						name: aggLabel(metricMode === 'count' ? 'count' : agg, metricField?.name),
						axisLabel: { color: '#64748b' },
						splitLine: { lineStyle: { color: '#e2e8f0', type: 'dashed' } },
					},
			series: builtSeries,
		};
	}, [
		agg,
		categories,
		categoryField?.name,
		categoryKey,
		chartKind,
		metricField?.name,
		metricMode,
		metricTitle,
		points,
		scatterYField?.name,
		scatterYKey,
		seriesKey,
		seriesNames,
	]);

	if (chartableFields.length === 0) {
		return <div className="flex h-full items-center justify-center text-sm text-slate-500">No fields available.</div>;
	}

	const chartTypes: Array<{ key: ChartKind; label: string }> = [
		{ key: 'bar', label: 'Bar' },
		{ key: 'grouped', label: 'Grouped' },
		{ key: 'stacked', label: 'Stacked' },
		{ key: 'hline', label: 'H-Bar' },
		{ key: 'line', label: 'Line' },
		{ key: 'pie', label: 'Pie' },
		{ key: 'scatter', label: 'Scatter' },
	];

	return (
		<div className="flex h-full min-h-[28rem] flex-col">
			<div className="space-y-2 border-b border-slate-200 px-3 py-2">
				<div className="flex flex-wrap items-end gap-2">
					<div className="min-w-[10rem] flex-1">
						<label className={labelClass}>{chartKind === 'scatter' ? 'X field' : 'Break down by'}</label>
						<select value={categoryKey} onChange={event => setCategoryKey(event.target.value)} className={`${selectClass} mt-1 w-full`}>
							{chartableFields.map(field => (
								<option key={field.fid} value={field.fid}>
									{field.name || field.fid}
								</option>
							))}
						</select>
					</div>

					{chartKind === 'scatter' ? (
						<div className="min-w-[10rem] flex-1">
							<label className={labelClass}>Y field</label>
							<select
								value={scatterYKey}
								onChange={event => setScatterYKey(event.target.value)}
								className={`${selectClass} mt-1 w-full`}
							>
								{(measures.length ? measures : chartableFields).map(field => (
									<option key={field.fid} value={field.fid}>
										{field.name || field.fid}
									</option>
								))}
							</select>
						</div>
					) : (
						<>
							<div className="min-w-[10rem] flex-1">
								<label className={labelClass}>Show</label>
								<select
									value={metricMode}
									onChange={event => setMetricMode(event.target.value)}
									className={`${selectClass} mt-1 w-full`}
								>
									<option value="count">Row count</option>
									{measures.map(field => (
										<option key={field.fid} value={field.fid}>
											{field.name || field.fid}
										</option>
									))}
									{measures.length === 0
										? chartableFields
												.filter(field => field.fid !== categoryKey)
												.map(field => (
													<option key={field.fid} value={field.fid}>
														{field.name || field.fid}
													</option>
												))
										: null}
								</select>
							</div>

							{metricMode !== 'count' ? (
								<div className="min-w-[7rem]">
									<label className={labelClass}>Aggregate</label>
									<select value={agg} onChange={event => setAgg(event.target.value as AggFn)} className={`${selectClass} mt-1 w-full`}>
										<option value="avg">Average</option>
										<option value="sum">Sum</option>
										<option value="min">Min</option>
										<option value="max">Max</option>
									</select>
								</div>
							) : null}
						</>
					)}

					{chartKind !== 'pie' ? (
						<div className="min-w-[10rem] flex-1">
							<label className={labelClass}>{chartKind === 'scatter' ? 'Color by' : 'Split by (optional)'}</label>
							<select value={seriesKey} onChange={event => setSeriesKey(event.target.value)} className={`${selectClass} mt-1 w-full`}>
								<option value="">None</option>
								{chartableFields
									.filter(field => field.fid !== categoryKey && field.fid !== scatterYKey)
									.map(field => (
										<option key={field.fid} value={field.fid}>
											{field.name || field.fid}
										</option>
									))}
							</select>
						</div>
					) : null}
				</div>

				<div className="flex flex-wrap items-center gap-2">
					<span className={labelClass}>Chart</span>
					<div className="flex flex-wrap items-center gap-1 rounded-md border border-slate-200 bg-slate-50 p-0.5">
						{chartTypes.map(option => (
							<button
								key={option.key}
								type="button"
								onClick={() => setChartKind(option.key)}
								className={`rounded px-2.5 py-1 text-xs font-semibold ${
									chartKind === option.key ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
								}`}
							>
								{option.label}
							</button>
						))}
					</div>
					{seriesField ? (
						<span className="text-xs text-slate-500">
							Colored by <span className="font-medium text-slate-700">{seriesField.name}</span>
						</span>
					) : null}
				</div>
			</div>

			<div className="min-h-0 flex-1 p-3">
				{points.length === 0 ? (
					<div className="flex h-full items-center justify-center text-sm text-slate-500">
						No values to chart for this combination.
					</div>
				) : (
					<ReactECharts option={option} style={{ height: '100%', minHeight: 440 }} notMerge lazyUpdate />
				)}
			</div>
		</div>
	);
}
