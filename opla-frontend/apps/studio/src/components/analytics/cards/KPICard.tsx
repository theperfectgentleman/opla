import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import type { SavedQuestion } from '../types';

interface KPICardProps {
	question: SavedQuestion;
	currentValue: number;
	previousValue?: number;
	label?: string;
}

export default function KPICard({ question, currentValue, previousValue, label }: KPICardProps) {
	const delta = previousValue ? ((currentValue - previousValue) / previousValue) * 100 : null;
	const isPositive = delta !== null && delta > 0;
	const isNegative = delta !== null && delta < 0;

	return (
		<div className="flex h-full flex-col justify-center rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200 transition-shadow hover:shadow-md">
			<h3 className="text-sm font-medium text-slate-500">{label || question.title}</h3>
			<div className="mt-2 flex items-baseline gap-3">
				<span className="text-4xl font-bold tracking-tight text-slate-900">{currentValue.toLocaleString()}</span>
				{delta !== null && (
					<span className={`flex items-center text-sm font-medium ${isPositive ? 'text-emerald-600' : isNegative ? 'text-rose-600' : 'text-slate-500'}`}>
						{isPositive ? <ArrowUpRight className="mr-1 h-4 w-4" /> : isNegative ? <ArrowDownRight className="mr-1 h-4 w-4" /> : <Minus className="mr-1 h-4 w-4" />}
						{Math.abs(delta).toFixed(1)}%
					</span>
				)}
			</div>
			{previousValue !== undefined && (
				<p className="mt-1 text-xs text-slate-500">vs previous period ({previousValue.toLocaleString()})</p>
			)}
		</div>
	);
}
