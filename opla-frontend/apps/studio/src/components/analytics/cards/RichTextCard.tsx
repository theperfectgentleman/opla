import type { SavedQuestion } from '../types';

interface RichTextCardProps {
	question?: SavedQuestion;
	content: string;
}

export default function RichTextCard({ question, content }: RichTextCardProps) {
	return (
		<div className="flex h-full flex-col overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
			{question?.title && (
				<div className="border-b border-slate-100 bg-slate-50 px-6 py-3">
					<h3 className="text-sm font-medium text-slate-700">{question.title}</h3>
				</div>
			)}
			<div className="prose prose-sm prose-slate h-full w-full max-w-none overflow-y-auto p-6">
				<div dangerouslySetInnerHTML={{ __html: content }} />
			</div>
		</div>
	);
}
