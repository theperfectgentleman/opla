import { useState, useEffect, useCallback } from 'react';
import { Filter, X, ArrowLeft, Download, Table2, Loader2 } from 'lucide-react';
import { analyticsAPI } from '../../lib/api';
import type { AnalyticsDashboard, DashboardCard, SavedQuestion, QueryResult } from './types';
import KPICard from './cards/KPICard';
import GoalCard from './cards/GoalCard';
import RichTextCard from './cards/RichTextCard';
import EChartCard from './cards/EChartCard';

interface DashboardViewerProps {
	dashboard: AnalyticsDashboard;
	onClose: () => void;
	orgId: string;
}

function extractChartData(question: SavedQuestion, result: QueryResult) {
	const cfg = question.query_config as Record<string, any> | undefined;
	const groupField = cfg?.group_by?.[0];
	const aggField = cfg?.aggregates?.[0];
	if (!result.rows.length) return [];
	const key = typeof groupField === 'object' ? groupField.field : (groupField || result.columns[0]?.key);
	const valKey = aggField?.alias || result.columns.find(c => c.type === 'number')?.key || result.columns[1]?.key;
	return result.rows.map(r => ({ category: String(r[key] || ''), metric: Number(r[valKey]) || 0 }));
}

function extractKPIValue(question: SavedQuestion, result: QueryResult): number {
	const cfg = question.query_config as Record<string, any> | undefined;
	const aggField = cfg?.aggregates?.[0];
	const valKey = aggField?.alias || result.columns[0]?.key;
	return result.rows.length > 0 ? Number(result.rows[0]?.[valKey]) || 0 : 0;
}

export default function DashboardViewer({ dashboard, onClose, orgId }: DashboardViewerProps) {
	const [activeTab, setActiveTab] = useState<string>('0');
	const [globalFilters, setGlobalFilters] = useState<Record<string, any>>({});
	const [crossFilter, setCrossFilter] = useState<{ field: string; value: string } | null>(null);
	const [cardData, setCardData] = useState<Record<string, QueryResult>>({});
	const [cardLoading, setCardLoading] = useState<Record<string, boolean>>({});
	const [drillThrough, setDrillThrough] = useState<{ category: string; cardId: string; question: SavedQuestion; rows: Array<Record<string, unknown>> } | null>(null);
	const [showRawData, setShowRawData] = useState(false);

	const tabs = Array.isArray(dashboard.layout_config) && dashboard.layout_config.length > 0 
		? dashboard.layout_config 
		: [{ id: '0', name: 'Overview' }];

	const fetchCardData = useCallback(async (card: DashboardCard) => {
		const question = card.question;
		if (!question) return;
		const cardId = card.id;

		setCardLoading(prev => ({ ...prev, [cardId]: true }));

		try {
			const cfg = question.query_config as Record<string, any> || {};
			const src = question.source_config as Record<string, any> || {};
			const existingFilters = cfg.filters as Record<string, any> | undefined;
			const filters = { ...(existingFilters || {}) } as Record<string, any>;
			const rules: any[] = filters.rules || [];

			if (crossFilter) {
				rules.push({ field: crossFilter.field, operator: '=', value: crossFilter.value });
			}

			const queryPayload: any = {
				dataset_id: src.dataset_id,
				select_fields: cfg.select_fields,
				filters: rules.length > 0 ? { combinator: 'and', rules } : undefined,
				group_by: cfg.group_by,
				aggregates: cfg.aggregates,
				order_by: cfg.order_by,
				limit: cfg.limit || 500,
			};

			const result = await analyticsAPI.runQuery(orgId, queryPayload);
			setCardData(prev => ({ ...prev, [cardId]: result }));
		} catch {
			// Silently handle errors per card
		} finally {
			setCardLoading(prev => ({ ...prev, [cardId]: false }));
		}
	}, [orgId, crossFilter]);

	useEffect(() => {
		dashboard.cards.forEach(card => {
			if (card.question && card.question.viz_type !== 'markdown') {
				fetchCardData(card);
			}
		});
	}, [dashboard.cards, fetchCardData]);

	const handleDrillThrough = async (question: SavedQuestion, category: string) => {
		try {
			const cfg = question.query_config as Record<string, any> || {};
			const src = question.source_config as Record<string, any> || {};
			const result = await analyticsAPI.runQuery(orgId, {
				dataset_id: src.dataset_id,
				select_fields: (cfg.select_fields as string[]) || [],
				filters: {
					combinator: 'and',
					rules: cfg.group_by?.[0]
						? [{ field: typeof cfg.group_by[0] === 'object' ? cfg.group_by[0].field : cfg.group_by[0], operator: '=', value: category }]
						: [],
				},
				limit: 100,
			});
			setDrillThrough({ category, cardId: question.id, question, rows: result.rows });
		} catch {
			setDrillThrough({ category, cardId: question.id, question, rows: [] });
		}
	};

	const exportCSV = (rows: Array<Record<string, unknown>>) => {
		if (!rows.length) return;
		const headers = Object.keys(rows[0]);
		const csvContent = [
			headers.join(','),
			...rows.map(r => headers.map(h => String(r[h] ?? '')).join(','))
		].join('\n');
		const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
		const link = document.createElement('a');
		link.href = URL.createObjectURL(blob);
		link.download = `export_${drillThrough?.category || 'data'}.csv`;
		link.click();
		URL.revokeObjectURL(link.href);
	};

	const renderCard = (card: DashboardCard) => {
		const question = card.question;
		if (!question) return null;
		const isLoading = cardLoading[card.id];
		const result = cardData[card.id];
		const chartData = result ? extractChartData(question, result) : [];
		const kpiValue = result ? extractKPIValue(question, result) : 0;

		return (
			<div key={card.id} className="col-span-1 min-h-[200px]">
				{isLoading && (
					<div className="flex h-full items-center justify-center rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
						<Loader2 className="h-6 w-6 animate-spin text-slate-400" />
					</div>
				)}
				{!isLoading && question.viz_type === 'kpi' && (
					<KPICard question={question} currentValue={kpiValue} />
				)}
				{!isLoading && question.viz_type === 'goal' && (
					<GoalCard question={question} currentValue={kpiValue} targetValue={(question.viz_config as any)?.target || 1000} />
				)}
				{!isLoading && question.viz_type === 'markdown' && (
					<RichTextCard question={question} content={(question.viz_config as any)?.content || ''} editable={false} />
				)}
				{!isLoading && (question.viz_type === 'chart' || question.viz_type === 'table') && (
					<EChartCard 
						question={question} 
						data={chartData}
						onChartClick={(params) => {
							if (params.name) {
								handleDrillThrough(question, params.name);
							}
						}}
					/>
				)}
				{!isLoading && !result && question.viz_type !== 'markdown' && (
					<div className="flex h-full items-center justify-center rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200 text-sm text-slate-400">
						No data
					</div>
				)}
			</div>
		);
	};

	return (
		<div className="flex flex-col h-full space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between border-b border-slate-200 pb-4">
				<div className="flex items-center gap-4">
					<button onClick={onClose} className="rounded-full p-2 hover:bg-slate-100"><ArrowLeft className="h-5 w-5 text-slate-500" /></button>
					<div>
						<h2 className="text-xl font-bold text-slate-800">{dashboard.title}</h2>
						<p className="text-sm text-slate-500">{dashboard.description}</p>
					</div>
				</div>
				<div className="flex items-center gap-4">
					<div className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 shadow-sm">
						<Filter className="h-4 w-4 text-slate-400" />
						<select 
							className="border-none bg-transparent text-sm font-medium text-slate-700 outline-none"
							value={globalFilters.region || ''}
							onChange={e => setGlobalFilters(prev => ({ ...prev, region: e.target.value }))}
						>
							<option value="">All Regions</option>
							<option value="NA">North America</option>
							<option value="EU">Europe</option>
						</select>
					</div>
				</div>
			</div>

			{/* Cross-Filter Indicator */}
			{crossFilter && (
				<div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
					<span className="font-semibold">Cross-Filter Active:</span> {crossFilter.field} = {crossFilter.value}
					<button onClick={() => setCrossFilter(null)} className="ml-2 hover:text-emerald-900"><X className="h-4 w-4" /></button>
				</div>
			)}

			{/* Tabs */}
			{tabs.length > 1 && (
				<div className="flex gap-4 border-b border-slate-200">
					{tabs.map((tab: any) => (
						<button
							key={tab.id}
							onClick={() => setActiveTab(tab.id)}
							className={`pb-2 text-sm font-medium transition-colors ${activeTab === tab.id ? 'border-b-2 border-emerald-600 text-emerald-700' : 'text-slate-500 hover:text-slate-700'}`}
						>
							{tab.name}
						</button>
					))}
				</div>
			)}

			{/* Cards Grid */}
			<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
				{dashboard.cards.map(renderCard)}
				{dashboard.cards.length === 0 && (
					<div className="col-span-full py-12 text-center text-slate-500">
						This dashboard has no cards yet. Return to the canvas to add some.
					</div>
				)}
			</div>

			{/* Drill-Through Modal */}
			{drillThrough && !showRawData && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
					<div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
						<div className="flex items-center justify-between">
							<h3 className="text-lg font-semibold">{drillThrough.question.title}</h3>
							<button onClick={() => setDrillThrough(null)} className="rounded p-1 hover:bg-slate-100"><X className="h-4 w-4" /></button>
						</div>
						<p className="mt-2 text-sm text-slate-500">Selected: <span className="font-semibold text-slate-800">{drillThrough.category}</span></p>
						<div className="mt-6 flex flex-col gap-2">
							<button 
								onClick={() => {
									const qc = drillThrough.question.query_config as Record<string, any> || {};
									const groupBy = qc.group_by?.[0];
									const field = typeof groupBy === 'object' ? groupBy.field : (groupBy || '');
									setCrossFilter({ field, value: drillThrough.category });
									setDrillThrough(null);
								}}
								className="flex w-full items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-500"
							>
								<Filter className="h-4 w-4" /> Filter Dashboard
							</button>
							<button 
								onClick={() => setShowRawData(true)}
								className="flex w-full items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
							>
								<Table2 className="h-4 w-4" /> View Raw Data
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Raw Data Modal with CSV Export */}
			{drillThrough && showRawData && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
					<div className="flex h-full max-h-[80vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-xl">
						<div className="flex items-center justify-between border-b border-slate-200 p-4">
							<div>
								<h3 className="text-lg font-semibold">Raw Data: {drillThrough.category}</h3>
								<p className="text-sm text-slate-500">Showing underlying records for this segment.</p>
							</div>
							<div className="flex items-center gap-2">
								<button 
									onClick={() => exportCSV(drillThrough.rows)}
									className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
								>
									<Download className="h-4 w-4" /> Export CSV
								</button>
								<button onClick={() => { setDrillThrough(null); setShowRawData(false); }} className="rounded p-1 hover:bg-slate-100"><X className="h-4 w-4" /></button>
							</div>
						</div>
						<div className="flex-1 overflow-auto p-4">
							<table className="w-full text-left text-sm text-slate-600">
								<thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
									<tr>
										{drillThrough.rows.length > 0 && Object.keys(drillThrough.rows[0]).map(key => (
											<th key={key} className="px-4 py-3">{key}</th>
										))}
									</tr>
								</thead>
								<tbody className="divide-y divide-slate-100">
									{drillThrough.rows.length === 0 && (
										<tr><td colSpan={99} className="px-4 py-8 text-center text-slate-400">No records found.</td></tr>
									)}
									{drillThrough.rows.map((row, i) => (
										<tr key={i}>
											{Object.values(row).map((val, j) => (
												<td key={j} className="px-4 py-3">{String(val ?? '')}</td>
											))}
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
