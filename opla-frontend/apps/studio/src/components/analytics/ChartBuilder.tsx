import { useEffect, useMemo, useState } from 'react';
import { BarChart3, Loader2, Play } from 'lucide-react';
import ReactECharts from 'echarts-for-react';

import { analyticsAPI } from '../../lib/api';
import { defaultAggregateAlias, defaultSource, extractMetricSeries, prettifyLabel } from './queryUtils';
import type { AggregateFn, AnalyticsToolProps, QueryResult } from './types';
import { AnalyticsChartSkeleton, AnalyticsPageHeader, analyticsButtonClass, analyticsInputClass, analyticsLabelClass, analyticsPanelClass } from './ui';

type ChartType = 'bar' | 'line' | 'pie';

export default function ChartBuilder({ orgId, sources, initialSource }: AnalyticsToolProps) {
	const [selectedSourceId, setSelectedSourceId] = useState(defaultSource(sources, initialSource)?.dataset_id ?? '');
	const [chartType, setChartType] = useState<ChartType>('bar');
	const [groupField, setGroupField] = useState('');
	const [valueField, setValueField] = useState('');
	const [aggregateFn, setAggregateFn] = useState<AggregateFn>('count');
	const [result, setResult] = useState<QueryResult | null>(null);
	const [runLoading, setRunLoading] = useState(false);
	const [message, setMessage] = useState<string | null>(null);

	const selectedSource = useMemo(
		() => sources.find(source => source.dataset_id === selectedSourceId) ?? null,
		[selectedSourceId, sources],
	);

	useEffect(() => {
		const source = defaultSource(sources, initialSource);
		if (!selectedSourceId && source) {
			setSelectedSourceId(source.dataset_id);
		}
	}, [initialSource, selectedSourceId, sources]);

	useEffect(() => {
		if (!selectedSource) {
			setGroupField('');
			setValueField('');
			return;
		}
		setGroupField(selectedSource.fields[0]?.field_key ?? '');
		setValueField(selectedSource.fields[1]?.field_key ?? selectedSource.fields[0]?.field_key ?? '');
		setResult(null);
		setMessage(null);
	}, [selectedSource]);

	async function handleRun() {
		if (!selectedSource || !groupField || !valueField) {
			setMessage('Choose a dataset, group field, and value field before building a chart.');
			return;
		}

		setRunLoading(true);
		setMessage(null);
		try {
			const alias = defaultAggregateAlias(aggregateFn, valueField);
			const response = await analyticsAPI.runQuery(orgId, {
				dataset_id: selectedSource.dataset_id,
				group_by: [groupField],
				aggregates: [{ field: valueField, fn: aggregateFn, alias }],
				order_by: [{ field: alias, direction: 'desc' }],
				limit: 25,
				offset: 0,
			});
			setResult(response);
		} catch (error: any) {
			setMessage(error?.response?.data?.detail || error?.message || 'Could not build chart.');
		} finally {
			setRunLoading(false);
		}
	}

	const chartOption = useMemo(() => {
		if (!result || !groupField || !valueField) {
			return null;
		}
		const metricKey = defaultAggregateAlias(aggregateFn, valueField);
		const seriesData = extractMetricSeries(result, groupField, metricKey);

		if (chartType === 'pie') {
			return {
				tooltip: { trigger: 'item' },
				legend: { bottom: 0 },
				series: [
					{
						type: 'pie',
						radius: ['32%', '70%'],
						data: seriesData.map(item => ({ name: item.category, value: item.metric })),
					},
				],
			};
		}

		return {
			tooltip: { trigger: 'axis' },
			xAxis: {
				type: 'category',
				data: seriesData.map(item => item.category),
				axisLabel: { rotate: 25 },
			},
			yAxis: { type: 'value' },
			series: [
				{
					type: chartType,
					smooth: chartType === 'line',
					data: seriesData.map(item => item.metric),
					itemStyle: { color: '#0f8b8d' },
				},
			],
			grid: { left: 40, right: 24, top: 24, bottom: 64 },
		};
	}, [aggregateFn, chartType, groupField, result, valueField]);

	if (!selectedSource) {
		return (
			<div className="rounded-lg border border-dashed border-slate-200 p-8 text-sm text-slate-500">
				No analytics datasets are available yet. Publish a form dataset first, then reopen Analysis.
			</div>
		);
	}

	return (
		<div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
			<section className={analyticsPanelClass}>
				<AnalyticsPageHeader
					eyebrow="Analysis"
					title="Chart Builder"
					description="Group dataset records and preview chart-ready summaries."
					actions={<span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-emerald-50 text-emerald-700"><BarChart3 className="h-4 w-4" /></span>}
				/>

				<div className="mt-4 space-y-4">
					<div>
						<label className={analyticsLabelClass}>Dataset</label>
						<select value={selectedSourceId} onChange={event => setSelectedSourceId(event.target.value)} className={analyticsInputClass}>
							{sources.map(source => (
								<option key={source.dataset_id} value={source.dataset_id}>{source.form_title}</option>
							))}
						</select>
					</div>

					<div>
						<label className={analyticsLabelClass}>Chart type</label>
						<select value={chartType} onChange={event => setChartType(event.target.value as ChartType)} className={analyticsInputClass}>
							<option value="bar">Bar</option>
							<option value="line">Line</option>
							<option value="pie">Pie</option>
						</select>
					</div>

					<div>
						<label className={analyticsLabelClass}>Dimension</label>
						<select value={groupField} onChange={event => setGroupField(event.target.value)} className={analyticsInputClass}>
							{selectedSource.fields.map(field => (
								<option key={field.field_identifier} value={field.field_key}>{field.label || prettifyLabel(field.field_key)}</option>
							))}
						</select>
					</div>

					<div>
						<label className={analyticsLabelClass}>Metric field</label>
						<select value={valueField} onChange={event => setValueField(event.target.value)} className={analyticsInputClass}>
							{selectedSource.fields.map(field => (
								<option key={field.field_identifier} value={field.field_key}>{field.label || prettifyLabel(field.field_key)}</option>
							))}
						</select>
					</div>

					<div>
						<label className={analyticsLabelClass}>Aggregation</label>
						<select value={aggregateFn} onChange={event => setAggregateFn(event.target.value as AggregateFn)} className={analyticsInputClass}>
							<option value="count">Count</option>
							<option value="sum">Sum</option>
							<option value="avg">Average</option>
							<option value="min">Minimum</option>
							<option value="max">Maximum</option>
						</select>
					</div>

					<button type="button" onClick={() => void handleRun()} disabled={runLoading} className={`w-full ${analyticsButtonClass}`}>
						{runLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
						{runLoading ? 'Building chart...' : 'Build chart'}
					</button>
					{message ? <p className="text-sm text-rose-600">{message}</p> : null}
				</div>
			</section>

			<section className={analyticsPanelClass}>
				<AnalyticsPageHeader
					eyebrow="Visualization"
					title="Preview"
					description={result ? `${result.total_count.toLocaleString()} grouped rows` : 'Run a grouped query to preview the chart.'}
				/>

				{runLoading ? (
					<AnalyticsChartSkeleton />
				) : chartOption ? (
					<div className="mt-4 rounded-md border border-slate-200 bg-white p-3">
						<ReactECharts option={chartOption} style={{ height: 520 }} />
					</div>
				) : (
					<div className="mt-4 rounded-md border border-dashed border-slate-200 px-4 py-16 text-center text-sm text-slate-500">
						Chart preview will appear here.
					</div>
				)}
			</section>
		</div>
	);
}
