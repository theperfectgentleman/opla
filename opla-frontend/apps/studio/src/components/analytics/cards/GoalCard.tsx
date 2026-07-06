import type { SavedQuestion } from '../types';

interface GoalCardProps {
	question: SavedQuestion;
	currentValue: number;
	targetValue: number;
	label?: string;
}

export default function GoalCard({ question, currentValue, targetValue, label }: GoalCardProps) {
	const percentage = targetValue > 0 ? Math.min(100, Math.max(0, (currentValue / targetValue) * 100)) : 0;

	return (
		<div className="flex h-full flex-col justify-center rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200 transition-shadow hover:shadow-md">
			<div className="flex items-center justify-between">
				<h3 className="text-sm font-medium text-slate-500">{label || question.title}</h3>
				<span className="text-sm font-bold text-slate-900">{Math.round(percentage)}%</span>
			</div>
			<div className="mt-4 flex items-baseline gap-2">
				<span className="text-2xl font-bold text-slate-900">{currentValue.toLocaleString()}</span>
				<span className="text-sm text-slate-500">/ {targetValue.toLocaleString()}</span>
			</div>
			<div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
				<div 
					className="h-full rounded-full bg-emerald-500 transition-all duration-500 ease-out"
					style={{ width: `${percentage}%` }}
				/>
			</div>
		</div>
	);
}
