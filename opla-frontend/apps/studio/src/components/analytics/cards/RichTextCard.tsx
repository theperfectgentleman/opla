import { useState } from 'react';
import type { SavedQuestion } from '../types';

interface RichTextCardProps {
	question?: SavedQuestion;
	content: string;
	editable?: boolean;
	onSave?: (content: string) => void;
}

function renderMarkdown(md: string): string {
	return md
		.split('\n')
		.map(line => {
			if (line.startsWith('### ')) return `<h3>${line.slice(4)}</h3>`;
			if (line.startsWith('## ')) return `<h2>${line.slice(3)}</h2>`;
			if (line.startsWith('# ')) return `<h1>${line.slice(2)}</h1>`;
			if (line.startsWith('**') && line.endsWith('**')) return `<p><strong>${line.slice(2, -2)}</strong></p>`;
			if (line.startsWith('* ') || line.startsWith('- ')) return `<li>${line.slice(2)}</li>`;
			if (line.startsWith('> ')) return `<blockquote>${line.slice(2)}</blockquote>`;
			if (line.trim() === '') return '<br/>';
			return `<p>${line
				.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
				.replace(/\*([^*]+)\*/g, '<em>$1</em>')
				.replace(/`([^`]+)`/g, '<code>$1</code>')
			}</p>`;
		})
		.join('\n');
}

export default function RichTextCard({ question, content, editable = false, onSave }: RichTextCardProps) {
	const [isEditing, setIsEditing] = useState(false);
	const [editContent, setEditContent] = useState(content);

	const handleSave = () => {
		onSave?.(editContent);
		setIsEditing(false);
	};

	return (
		<div className="flex h-full flex-col overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
			{question?.title && (
				<div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-6 py-3">
					<h3 className="text-sm font-medium text-slate-700">{question.title}</h3>
					{editable && (
						<button
							onClick={() => isEditing ? handleSave() : setIsEditing(true)}
							className="rounded px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
						>
							{isEditing ? 'Save' : 'Edit'}
						</button>
					)}
				</div>
			)}
			{isEditing ? (
				<textarea
					value={editContent}
					onChange={e => setEditContent(e.target.value)}
					className="h-full w-full resize-none border-0 p-6 text-sm font-mono text-slate-700 outline-none ring-0 focus:ring-0"
					placeholder="Write markdown here..."
				/>
			) : (
				<div className="prose prose-sm prose-slate h-full w-full max-w-none overflow-y-auto p-6">
					<div dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }} />
				</div>
			)}
		</div>
	);
}
