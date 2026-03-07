import { useEffect, useMemo, useState } from 'react';
import { Database, Loader2, Play } from 'lucide-react';

import { analyticsAPI } from '../../lib/api';
import { coerceDisplayValue, defaultSource, prettifyLabel } from './queryUtils';
import type { AnalyticsToolProps, QueryResult } from './types';
import { AnalyticsPageHeader, AnalyticsTableSkeleton, analyticsButtonClass, analyticsGhostButtonClass, analyticsInputClass, analyticsInsetClass, analyticsLabelClass, analyticsPanelClass } from './ui';

export default function DataExplorer({ orgId, sources, initialSource }: AnalyticsToolProps) {
	const [selectedSourceId, setSelectedSourceId] = useState(defaultSource(sources, initialSource)?.dataset_id ?? '');
	const [selectedFields, setSelectedFields] = useState<string[]>([]);
	const [limit, setLimit] = useState(50);
	const [result, setResult] = useState<QueryResult | null>(null);
	const [runLoading, setRunLoading] = useState(false);
	const [message, setMessage] = useState<string | null>(null);

	const selectedSource = useMemo(
		() => sources.find(source => source.dataset_id === selectedSourceId) ?? null,
		[selectedSourceId, sources],
	);

	useEffect(() => {
		const nextSource = defaultSource(sources, initialSource);
		if (!selectedSourceId && nextSource) {
			setSelectedSourceId(nextSource.dataset_id);
		}
	}, [initialSource, selectedSourceId, sources]);

	useEffect(() => {
		if (!selectedSource) {
			setSelectedFields([]);
			return;
		}
		setSelectedFields(selectedSource.fields.slice(0, 6).map(field => field.field_key));
		setResult(null);
		setMessage(null);
	}, [selectedSource]);

	function toggleField(fieldKey: string) {
		setSelectedFields(current => (
			current.includes(fieldKey)
				? current.filter(item => item !== fieldKey)
				: [...current, fieldKey]
		));
	}

	async function handleRun() {
		if (!selectedSource || selectedFields.length === 0) {
			setMessage('Choose a dataset and at least one field before running the query.');
			return;
		}

		setRunLoading(true);
		setMessage(null);
		try {
			const response = await analyticsAPI.runQuery(orgId, {
				dataset_id: selectedSource.dataset_id,
				select_fields: selectedFields,
				limit,
				offset: 0,
			});
			setResult(response);
		} catch (error: any) {
			setMessage(error?.response?.data?.detail || error?.message || 'Could not run analytics query.');
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
					title="Data Explorer"
					description="Inspect dataset rows directly and choose which fields should be returned."
					actions={<span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-emerald-50 text-emerald-700"><Database className="h-4 w-4" /></span>}
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
						<label className={analyticsLabelClass}>Row limit</label>
						<input type="number" min={1} max={250} value={limit} onChange={event => setLimit(Math.max(1, Math.min(250, Number(event.target.value) || 1)))} className={analyticsInputClass} />
					</div>

					<div>
						<div className="mb-2 flex items-center justify-between gap-2">
							<label className={analyticsLabelClass}>Fields</label>
							<span className="text-xs text-slate-500">{selectedFields.length} selected</span>
						</div>
						<div className={`${analyticsInsetClass} max-h-[320px] space-y-2 overflow-y-auto p-3`}>
							{selectedSource.fields.map(field => {
								const checked = selectedFields.includes(field.field_key);
								return (
									<label key={field.field_identifier} className={`flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2.5 text-sm transition ${checked ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
										<input type="checkbox" checked={checked} onChange={() => toggleField(field.field_key)} className="mt-1 h-4 w-4 rounded border-[hsl(var(--border))]" />
										<span>
											<span className="block font-semibold text-slate-800">{field.label || prettifyLabel(field.field_key)}</span>
											<span className="block text-xs text-slate-500">{field.field_key} • {field.field_type || 'text'}</span>
										</span>
									</label>
								);
							})}
						</div>
					</div>

					<button type="button" onClick={() => void handleRun()} disabled={runLoading} className={`w-full ${analyticsButtonClass}`}>
						{runLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
						{runLoading ? 'Running query...' : 'Run query'}
					</button>
					{message ? <p className="text-sm text-rose-600">{message}</p> : null}
				</div>
			</section>

			<section className={analyticsPanelClass}>
				<AnalyticsPageHeader
					eyebrow="Results"
					title="Rows"
					description={result ? `${result.total_count.toLocaleString()} rows matched` : 'Run a query to inspect dataset rows.'}
					actions={selectedSource ? <span className={analyticsGhostButtonClass}>{selectedSource.record_count.toLocaleString()} source records</span> : null}
				/>

				<div className="mt-4 flex items-start justify-between gap-4">
					<div />
				</div>

				{runLoading ? (
					<AnalyticsTableSkeleton columns={Math.max(selectedFields.length, 4)} rows={7} />
				) : result ? (
					<div className="mt-4 overflow-hidden rounded-md border border-slate-200">
						<div className="max-h-[620px] overflow-auto">
							<table className="min-w-full text-left text-sm">
								<thead className="sticky top-0 bg-slate-50">
									<tr>
										{result.columns.map(column => (
											<th key={column.key} className="border-b border-slate-200 px-3 py-2.5 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{column.label}</th>
										))}
									</tr>
								</thead>
								<tbody>
									{result.rows.map((row, rowIndex) => (
										<tr key={`${rowIndex}-${String(row[result.columns[0]?.key] ?? rowIndex)}`} className="border-b border-slate-200 hover:bg-slate-50 last:border-b-0">
											{result.columns.map(column => (
												<td key={column.key} className="px-3 py-3 text-sm text-slate-600">{coerceDisplayValue(row[column.key])}</td>
											))}
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</div>
				) : (
					<div className="mt-4 rounded-md border border-dashed border-slate-200 px-4 py-16 text-center text-sm text-slate-500">
						Query output will appear here.
					</div>
				)}
			</section>
		</div>
	);
}
