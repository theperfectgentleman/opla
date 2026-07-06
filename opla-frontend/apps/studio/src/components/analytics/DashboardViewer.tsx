import { useState } from 'react';
import { Filter, X, ArrowLeft, Download, Maximize2, Table2 } from 'lucide-react';
import type { AnalyticsDashboard, DashboardCard, SavedQuestion } from './types';
import KPICard from './cards/KPICard';
import GoalCard from './cards/GoalCard';
import RichTextCard from './cards/RichTextCard';
import EChartCard from './cards/EChartCard';

interface DashboardViewerProps {
	dashboard: AnalyticsDashboard;
	onClose: () => void;
}

export default function DashboardViewer({ dashboard, onClose }: DashboardViewerProps) {
	const [activeTab, setActiveTab] = useState<string>('0');
	const [globalFilters, setGlobalFilters] = useState<Record<string, any>>({});
	const [crossFilter, setCrossFilter] = useState<string | null>(null); // e.g. "April"

	const [drillThrough, setDrillThrough] = useState<{ category: string; cardId: string; question: any } | null>(null);
	const [showRawData, setShowRawData] = useState(false);

	// Mocking layout_config to contain tabs if it's empty
	const tabs = Array.isArray(dashboard.layout_config) && dashboard.layout_config.length > 0 
		? dashboard.layout_config 
		: [{ id: '0', name: 'Overview' }];

	// In a real app, we'd fetch data for each card here.
	// For Phase 3 implementation demonstration, we simulate data fetching based on filters.

	const renderCard = (card: DashboardCard) => {
		const question = card.question;
		if (!question) return null;

		// Mock data that reacts to crossFilter and globalFilters
		const mockData = [
			{ category: 'Jan', metric: crossFilter === 'Jan' ? 120 : 100 },
			{ category: 'Feb', metric: crossFilter === 'Feb' ? 130 : 110 },
			{ category: 'Mar', metric: crossFilter === 'Mar' ? 150 : 120 }
		];

		if (crossFilter && !mockData.find(d => d.category === crossFilter)) {
			mockData.push({ category: crossFilter, metric: 200 });
		}

		// Calculate total based on filters to simulate reactivity
		const kpiValue = mockData.reduce((acc, d) => acc + d.metric, 0) + (globalFilters.region === 'NA' ? 500 : 0);

		return (
			<div 
				key={card.id} 
				className="col-span-1 min-h-[300px] cursor-pointer"
				onClick={() => {
					// Implicit cross-filtering: clicking a card filters others
					if (question.viz_type === 'chart') {
						setCrossFilter(prev => prev === 'Feb' ? null : 'Feb'); // Mock click on 'Feb'
					}
				}}
			>
				{question.viz_type === 'kpi' && <KPICard question={question} currentValue={kpiValue} previousValue={kpiValue * 0.9} />}
				{question.viz_type === 'goal' && <GoalCard question={question} currentValue={kpiValue} targetValue={1000} />}
				{question.viz_type === 'markdown' && <RichTextCard question={question} content="This is an interactive dashboard demonstrating **Rich Text** cells for storytelling alongside charts." />}
				{question.viz_type === 'chart' && <EChartCard question={question} data={mockData} onChartClick={(params) => setDrillThrough({ category: params.name, cardId: card.id, question })} />}
				{question.viz_type === 'table' && (
					<div className="flex h-full flex-col rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
						<h3 className="text-sm font-medium text-slate-500">{question.title}</h3>
						<div className="mt-4 flex-1 border-t border-slate-100 pt-4 text-sm text-slate-600">
							Table data reacts to cross-filter: {crossFilter || 'None'}
						</div>
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
					{/* Global Filter Widget */}
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
					<span className="font-semibold">Cross-Filter Active:</span> {crossFilter}
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
									setCrossFilter(drillThrough.category);
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
									onClick={() => {
										// Simulated CSV export
										const csvContent = "data:text/csv;charset=utf-8,ID,Category,Value\n1,Jan,120\n2,Feb,130";
										const encodedUri = encodeURI(csvContent);
										const link = document.createElement("a");
										link.setAttribute("href", encodedUri);
										link.setAttribute("download", `export_${drillThrough.category}.csv`);
										document.body.appendChild(link);
										link.click();
										document.body.removeChild(link);
									}}
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
										<th className="px-4 py-3">ID</th>
										<th className="px-4 py-3">Category</th>
										<th className="px-4 py-3">Value</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-slate-100">
									<tr><td className="px-4 py-3">1</td><td className="px-4 py-3">{drillThrough.category}</td><td className="px-4 py-3">120</td></tr>
									<tr><td className="px-4 py-3">2</td><td className="px-4 py-3">{drillThrough.category}</td><td className="px-4 py-3">45</td></tr>
									<tr><td className="px-4 py-3">3</td><td className="px-4 py-3">{drillThrough.category}</td><td className="px-4 py-3">35</td></tr>
								</tbody>
							</table>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
