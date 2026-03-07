import { useEffect, useMemo, useState } from 'react';
import { LayoutDashboard, Loader2, Play } from 'lucide-react';
import { PivotViewComponent, Inject, FieldList, CalculatedField, GroupingBar } from '@syncfusion/ej2-react-pivotview';
import type { IDataSet, SummaryTypes } from '@syncfusion/ej2-react-pivotview';

import { analyticsAPI } from '../../lib/api';
import { defaultSource, prettifyLabel } from './queryUtils';
import type { AggregateFn, AnalyticsToolProps, QueryResult } from './types';
import { ensureSyncfusionLicense } from './syncfusionLicense';
import { AnalyticsPageHeader, AnalyticsPivotSkeleton, analyticsButtonClass, analyticsInputClass, analyticsLabelClass, analyticsPanelClass } from './ui';

import '@syncfusion/ej2-react-pivotview/styles/material.css';

function toPivotSummaryType(aggregateFn: AggregateFn): SummaryTypes {
	switch (aggregateFn) {
		case 'avg':
			return 'Avg';
		case 'min':
			return 'Min';
		case 'max':
			return 'Max';
		case 'count':
			return 'Count';
		case 'count_distinct':
			return 'DistinctCount';
		case 'sum':
		default:
			return 'Sum';
	}
}

function toPivotDataSet(rows: QueryResult['rows']): IDataSet[] {
	return rows.map(row => {
		const normalized: IDataSet = {};
		for (const [key, value] of Object.entries(row)) {
			if (typeof value === 'string' || typeof value === 'number' || value instanceof Date) {
				normalized[key] = value;
			} else if (typeof value === 'boolean') {
				normalized[key] = value ? 1 : 0;
			} else if (value == null) {
				normalized[key] = '';
			} else {
				normalized[key] = String(value);
			}
		}
		return normalized;
	});
}

export default function AnalyticsPivot({ orgId, sources, initialSource }: AnalyticsToolProps) {
	const [selectedSourceId, setSelectedSourceId] = useState(defaultSource(sources, initialSource)?.dataset_id ?? '');
	const [rowField, setRowField] = useState('');
	const [columnField, setColumnField] = useState('');
	const [valueField, setValueField] = useState('');
	const [aggregateFn, setAggregateFn] = useState<AggregateFn>('sum');
	const [limit, setLimit] = useState(500);
	const [result, setResult] = useState<QueryResult | null>(null);
	const [runLoading, setRunLoading] = useState(false);
	const [message, setMessage] = useState<string | null>(null);

	const selectedSource = useMemo(
		() => sources.find(source => source.dataset_id === selectedSourceId) ?? null,
		[selectedSourceId, sources],
	);

	useEffect(() => {
		void ensureSyncfusionLicense();
	}, []);

	useEffect(() => {
		const source = defaultSource(sources, initialSource);
		if (!selectedSourceId && source) {
			setSelectedSourceId(source.dataset_id);
		}
	}, [initialSource, selectedSourceId, sources]);

	useEffect(() => {
		if (!selectedSource) {
			setRowField('');
			setColumnField('');
			setValueField('');
			return;
		}
		setRowField(selectedSource.fields[0]?.field_key ?? '');
		setColumnField(selectedSource.fields[1]?.field_key ?? '');
		setValueField(selectedSource.fields[2]?.field_key ?? selectedSource.fields[0]?.field_key ?? '');
		setResult(null);
		setMessage(null);
	}, [selectedSource]);

	const pivotRows = useMemo(() => toPivotDataSet(result?.rows ?? []), [result]);

	async function handleRun() {
		if (!selectedSource || !rowField || !columnField || !valueField) {
			setMessage('Choose a dataset and pivot fields before opening the pivot view.');
			return;
		}

		setRunLoading(true);
		setMessage(null);
		try {
			const response = await analyticsAPI.runQuery(orgId, {
				dataset_id: selectedSource.dataset_id,
				select_fields: [rowField, columnField, valueField],
				limit,
				offset: 0,
			});
			setResult(response);
		} catch (error: any) {
			setMessage(error?.response?.data?.detail || error?.message || 'Could not load pivot data.');
		} finally {
			setRunLoading(false);
		}
	}

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
					title="Pivot Table"
					description="Choose row, column, and metric fields to open a crosstab summary."
					actions={<span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-emerald-50 text-emerald-700"><LayoutDashboard className="h-4 w-4" /></span>}
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
						<label className={analyticsLabelClass}>Rows</label>
						<select value={rowField} onChange={event => setRowField(event.target.value)} className={analyticsInputClass}>
							{selectedSource.fields.map(field => (
								<option key={field.field_identifier} value={field.field_key}>{field.label || prettifyLabel(field.field_key)}</option>
							))}
						</select>
					</div>

					<div>
						<label className={analyticsLabelClass}>Columns</label>
						<select value={columnField} onChange={event => setColumnField(event.target.value)} className={analyticsInputClass}>
							{selectedSource.fields.map(field => (
								<option key={field.field_identifier} value={field.field_key}>{field.label || prettifyLabel(field.field_key)}</option>
							))}
						</select>
					</div>

					<div>
						<label className={analyticsLabelClass}>Values</label>
						<select value={valueField} onChange={event => setValueField(event.target.value)} className={analyticsInputClass}>
							{selectedSource.fields.map(field => (
								<option key={field.field_identifier} value={field.field_key}>{field.label || prettifyLabel(field.field_key)}</option>
							))}
						</select>
					</div>

					<div>
						<label className={analyticsLabelClass}>Aggregation</label>
						<select value={aggregateFn} onChange={event => setAggregateFn(event.target.value as AggregateFn)} className={analyticsInputClass}>
							<option value="sum">Sum</option>
							<option value="avg">Average</option>
							<option value="min">Minimum</option>
							<option value="max">Maximum</option>
							<option value="count">Count</option>
							<option value="count_distinct">Distinct count</option>
						</select>
					</div>

					<div>
						<label className={analyticsLabelClass}>Row limit</label>
						<input type="number" min={50} max={2000} value={limit} onChange={event => setLimit(Math.max(50, Math.min(2000, Number(event.target.value) || 50)))} className={analyticsInputClass} />
					</div>

					<button type="button" onClick={() => void handleRun()} disabled={runLoading} className={`w-full ${analyticsButtonClass}`}>
						{runLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
						{runLoading ? 'Loading pivot...' : 'Open pivot'}
					</button>
					{message ? <p className="text-sm text-rose-600">{message}</p> : null}
				</div>
			</section>

			<section className={analyticsPanelClass}>
				<AnalyticsPageHeader
					eyebrow="Pivot"
					title="Pivot Surface"
					description={result ? `${result.total_count.toLocaleString()} source rows loaded` : 'Run a query to populate the pivot view.'}
				/>

				{runLoading ? (
					<AnalyticsPivotSkeleton />
				) : pivotRows.length > 0 ? (
					<div className="mt-4 overflow-hidden rounded-md border border-slate-200 bg-white p-2">
						<PivotViewComponent
							height={560}
							showGroupingBar
							showFieldList
							dataSourceSettings={{
								dataSource: pivotRows,
								rows: rowField ? [{ name: rowField, caption: prettifyLabel(rowField) }] : [],
								columns: columnField ? [{ name: columnField, caption: prettifyLabel(columnField) }] : [],
								values: valueField ? [{ name: valueField, caption: prettifyLabel(valueField), type: toPivotSummaryType(aggregateFn) }] : [],
							}}
						>
							<Inject services={[FieldList, CalculatedField, GroupingBar]} />
						</PivotViewComponent>
					</div>
				) : (
					<div className="mt-4 rounded-md border border-dashed border-slate-200 px-4 py-16 text-center text-sm text-slate-500">
						Pivot output will appear here.
					</div>
				)}
			</section>
		</div>
	);
}
