import { useEffect, useMemo, useState } from 'react';
import { FileSpreadsheet, Loader2, Play } from 'lucide-react';
import { SpreadsheetComponent, SheetsDirective, SheetDirective, RangesDirective, RangeDirective } from '@syncfusion/ej2-react-spreadsheet';

import { analyticsAPI } from '../../lib/api';
import { coerceDisplayValue, defaultSource, prettifyLabel } from './queryUtils';
import type { AnalyticsToolProps, QueryResult } from './types';
import { ensureSyncfusionLicense } from './syncfusionLicense';
import { AnalyticsPageHeader, AnalyticsSheetSkeleton, analyticsButtonClass, analyticsInputClass, analyticsLabelClass, analyticsPanelClass } from './ui';

import '@syncfusion/ej2-react-spreadsheet/styles/material.css';

export default function AnalyticsSpreadsheet({ orgId, sources, initialSource }: AnalyticsToolProps) {
	const [selectedSourceId, setSelectedSourceId] = useState(defaultSource(sources, initialSource)?.dataset_id ?? '');
	const [limit, setLimit] = useState(100);
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

	async function handleRun() {
		if (!selectedSource) {
			setMessage('Choose a dataset before opening the spreadsheet.');
			return;
		}

		setRunLoading(true);
		setMessage(null);
		try {
			const response = await analyticsAPI.runQuery(orgId, {
				dataset_id: selectedSource.dataset_id,
				select_fields: selectedSource.fields.slice(0, 12).map(field => field.field_key),
				limit,
				offset: 0,
			});
			setResult(response);
		} catch (error: any) {
			setMessage(error?.response?.data?.detail || error?.message || 'Could not load spreadsheet data.');
		} finally {
			setRunLoading(false);
		}
	}

	const sheetRows = useMemo(() => {
		if (!result) {
			return [];
		}
		return result.rows.map(row => {
			const normalized: Record<string, string> = {};
			result.columns.forEach(column => {
				normalized[column.label || prettifyLabel(column.key)] = coerceDisplayValue(row[column.key]);
			});
			return normalized;
		});
	}, [result]);

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
					title="Spreadsheet"
					description="Open a dataset snapshot in a spreadsheet surface for scanning and cleanup."
					actions={<span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-emerald-50 text-emerald-700"><FileSpreadsheet className="h-4 w-4" /></span>}
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
						<input type="number" min={10} max={500} value={limit} onChange={event => setLimit(Math.max(10, Math.min(500, Number(event.target.value) || 10)))} className={analyticsInputClass} />
					</div>
					<button type="button" onClick={() => void handleRun()} disabled={runLoading} className={`w-full ${analyticsButtonClass}`}>
						{runLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
						{runLoading ? 'Loading sheet...' : 'Open spreadsheet'}
					</button>
					{message ? <p className="text-sm text-rose-600">{message}</p> : null}
				</div>
			</section>

			<section className={analyticsPanelClass}>
				<AnalyticsPageHeader
					eyebrow="Spreadsheet"
					title="Spreadsheet Surface"
					description={result ? `${result.total_count.toLocaleString()} rows loaded into the sheet` : 'Run a query to populate the spreadsheet.'}
				/>

				{runLoading ? (
					<AnalyticsSheetSkeleton />
				) : sheetRows.length > 0 ? (
					<div className="mt-4 overflow-hidden rounded-md border border-slate-200 bg-white p-2">
						<SpreadsheetComponent height={560} showRibbon={false} showFormulaBar={false}>
							<SheetsDirective>
								<SheetDirective name="Analytics">
									<RangesDirective>
										<RangeDirective dataSource={sheetRows} startCell="A1" />
									</RangesDirective>
								</SheetDirective>
							</SheetsDirective>
						</SpreadsheetComponent>
					</div>
				) : (
					<div className="mt-4 rounded-md border border-dashed border-slate-200 px-4 py-16 text-center text-sm text-slate-500">
						Spreadsheet output will appear here.
					</div>
				)}
			</section>
		</div>
	);
}
