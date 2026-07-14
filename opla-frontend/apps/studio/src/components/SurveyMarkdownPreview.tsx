import React, { useMemo } from 'react';

type PreviewOption = {
	label: string;
	value?: string;
	skipTo?: string;
};

type PreviewQuestion = {
	bind: string;
	label: string;
	type?: string;
	required?: boolean;
	options: PreviewOption[];
	attrs: Array<{ key: string; value: string }>;
};

type PreviewSection = {
	id: string;
	title: string;
	goal?: string;
	questions: PreviewQuestion[];
};

type PreviewDoc = {
	title: string;
	sections: PreviewSection[];
};

function parseSurveyMarkdown(markdown: string): PreviewDoc {
	const lines = (markdown || '').replace(/\r\n/g, '\n').split('\n');
	let title = 'Survey';
	const sections: PreviewSection[] = [];
	let currentSection: PreviewSection | null = null;
	let currentQuestion: PreviewQuestion | null = null;
	let inOptions = false;

	const flushQuestion = () => {
		if (currentQuestion && currentSection) {
			currentSection.questions.push(currentQuestion);
		}
		currentQuestion = null;
		inOptions = false;
	};

	const flushSection = () => {
		flushQuestion();
		if (currentSection) sections.push(currentSection);
		currentSection = null;
	};

	for (const raw of lines) {
		const line = raw.trimEnd();
		const stripped = line.trim();
		if (!stripped) continue;

		if (stripped.startsWith('# ') && !stripped.startsWith('##')) {
			flushSection();
			title = stripped.slice(2).trim() || title;
			continue;
		}

		if (stripped.startsWith('## ')) {
			flushSection();
			const heading = stripped.slice(3).trim();
			let id = heading;
			let sectionTitle = heading;
			if (heading.includes(':')) {
				const [left, ...rest] = heading.split(':');
				const maybeId = left.trim();
				const maybeTitle = rest.join(':').trim();
				if (/^[a-zA-Z][a-zA-Z0-9_]*$/.test(maybeId) && maybeTitle) {
					id = maybeId;
					sectionTitle = maybeTitle;
				}
			}
			currentSection = { id, title: sectionTitle, questions: [] };
			continue;
		}

		if (stripped.startsWith('### ')) {
			if (!currentSection) {
				currentSection = { id: 'section', title: 'Section', questions: [] };
			}
			flushQuestion();
			const heading = stripped.slice(4).trim();
			const match = heading.match(/^([a-zA-Z][a-zA-Z0-9_]*)\.\s+(.+)$/);
			currentQuestion = {
				bind: match?.[1] || heading,
				label: match?.[2] || heading,
				options: [],
				attrs: [],
			};
			continue;
		}

		if (currentSection && !currentQuestion) {
			const goalMatch = stripped.match(/^(?:Goal|Description)\s*:\s*(.+)$/i);
			if (goalMatch) {
				currentSection.goal = goalMatch[1].trim();
				continue;
			}
		}

		if (!currentQuestion) continue;

		if (inOptions && (stripped.startsWith('- ') || stripped.startsWith('* '))) {
			if (/^[-*]\s+\w+\s*:/.test(stripped)) {
				inOptions = false;
			} else {
				currentQuestion.options.push(parseOption(stripped.slice(2).trim()));
				continue;
			}
		}

		const attrMatch = stripped.match(/^[-*]\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*(.*)$/);
		if (attrMatch) {
			const key = attrMatch[1].toLowerCase();
			const value = attrMatch[2].trim();
			if (key === 'type') {
				currentQuestion.type = value.toLowerCase().replace(/[-\s]+/g, '_');
				inOptions = false;
			} else if (key === 'required') {
				currentQuestion.required = !value || /^(true|yes|1)$/i.test(value);
				inOptions = false;
			} else if (key === 'options') {
				inOptions = true;
				if (value) {
					value.split(/,\s*/).forEach((piece) => {
						if (piece.trim()) currentQuestion!.options.push(parseOption(piece.trim()));
					});
				}
			} else {
				currentQuestion.attrs.push({ key, value });
				inOptions = false;
			}
			continue;
		}

		if (stripped.startsWith('- ') || stripped.startsWith('* ')) {
			currentQuestion.options.push(parseOption(stripped.slice(2).trim()));
			inOptions = true;
		}
	}

	flushSection();
	return { title, sections };
}

function parseOption(raw: string): PreviewOption {
	let text = raw.replace(/^\[([^\]]+)\]$/, '$1').trim();
	let skipTo: string | undefined;
	const skipMatch = text.match(/(?:\|\s*)?->\s*([a-zA-Z][a-zA-Z0-9_]*)\s*$/);
	if (skipMatch) {
		skipTo = skipMatch[1];
		text = text.slice(0, skipMatch.index).replace(/\|\s*$/, '').trim();
	}
	const parts = text.split('|').map((p) => p.trim()).filter(Boolean);
	return {
		label: parts[0] || text,
		value: parts[1],
		skipTo,
	};
}

function typeLabel(type?: string): string {
	if (!type) return 'Question';
	const map: Record<string, string> = {
		text: 'Text',
		textarea: 'Long text',
		number: 'Number',
		radio: 'Single choice',
		dropdown: 'Dropdown',
		checkbox: 'Multi choice',
		rating: 'Rating',
		date: 'Date',
		yes_no: 'Yes / No',
		email: 'Email',
		phone: 'Phone',
	};
	return map[type] || type.replace(/_/g, ' ');
}

type SurveyMarkdownPreviewProps = {
	markdown: string;
};

export default function SurveyMarkdownPreview({ markdown }: SurveyMarkdownPreviewProps) {
	const doc = useMemo(() => parseSurveyMarkdown(markdown), [markdown]);

	if (!markdown.trim()) {
		return (
			<div className="rounded-xl border border-dashed border-[hsl(var(--border))] px-4 py-10 text-center text-sm text-[hsl(var(--text-tertiary))]">
				Nothing to preview yet.
			</div>
		);
	}

	if (doc.sections.length === 0) {
		return (
			<div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] px-4 py-6 text-sm text-[hsl(var(--text-secondary))] whitespace-pre-wrap font-mono">
				{markdown}
			</div>
		);
	}

	return (
		<div className="space-y-4 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] p-4 sm:p-5">
			<div>
				<h2 className="text-xl font-bold tracking-tight text-[hsl(var(--text-primary))]">{doc.title}</h2>
				<p className="mt-1 text-xs text-[hsl(var(--text-tertiary))]">
					{doc.sections.length} section{doc.sections.length === 1 ? '' : 's'} ·{' '}
					{doc.sections.reduce((n, s) => n + s.questions.length, 0)} question
					{doc.sections.reduce((n, s) => n + s.questions.length, 0) === 1 ? '' : 's'}
				</p>
			</div>

			{doc.sections.map((section, sectionIndex) => (
				<section
					key={`${section.id}-${sectionIndex}`}
					className="rounded-xl border border-[hsl(var(--border))]/80 bg-[hsl(var(--background))]/50 overflow-hidden"
				>
					<div className="border-b border-[hsl(var(--border))]/70 px-4 py-3">
						<div className="flex flex-wrap items-baseline gap-2">
							<span className="text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--text-tertiary))]">
								Section {sectionIndex + 1}
							</span>
							<code className="text-[10px] text-[hsl(var(--text-tertiary))]">{section.id}</code>
						</div>
						<h3 className="mt-0.5 text-sm font-bold text-[hsl(var(--text-primary))]">{section.title}</h3>
						{section.goal ? (
							<p className="mt-1 text-xs text-[hsl(var(--text-secondary))]">{section.goal}</p>
						) : null}
					</div>

					<div className="divide-y divide-[hsl(var(--border))]/60">
						{section.questions.length === 0 ? (
							<p className="px-4 py-3 text-xs text-[hsl(var(--text-tertiary))]">No questions in this section.</p>
						) : (
							section.questions.map((q, qIndex) => (
								<div key={`${q.bind}-${qIndex}`} className="px-4 py-3 space-y-2">
									<div className="flex flex-wrap items-start justify-between gap-2">
										<div className="min-w-0">
											<p className="text-sm font-semibold text-[hsl(var(--text-primary))]">
												<span className="mr-1.5 text-[hsl(var(--text-tertiary))] font-medium">
													Q{qIndex + 1}.
												</span>
												{q.label}
												{q.required ? <span className="ml-1 text-[hsl(var(--error))]">*</span> : null}
											</p>
											<p className="mt-0.5 text-[10px] text-[hsl(var(--text-tertiary))]">
												<code>{q.bind}</code>
											</p>
										</div>
										<span className="shrink-0 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--surface))] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--text-secondary))]">
											{typeLabel(q.type)}
										</span>
									</div>

									{q.options.length > 0 ? (
										<ul className="space-y-1.5 pl-0.5">
											{q.options.map((opt, optIndex) => (
												<li
													key={`${opt.label}-${optIndex}`}
													className="flex items-start gap-2 text-xs text-[hsl(var(--text-secondary))]"
												>
													<span
														className={`mt-0.5 inline-flex h-3.5 w-3.5 shrink-0 border border-[hsl(var(--border))] ${
															q.type === 'checkbox' ? 'rounded-[3px]' : 'rounded-full'
														}`}
														aria-hidden
													/>
													<span>
														{opt.label}
														{opt.skipTo ? (
															<span className="ml-1 text-[hsl(var(--text-tertiary))]">
																→ {opt.skipTo}
															</span>
														) : null}
													</span>
												</li>
											))}
										</ul>
									) : q.type === 'yes_no' ? (
										<div className="flex gap-2">
											<span className="rounded-md border border-[hsl(var(--border))] px-2.5 py-1 text-xs text-[hsl(var(--text-secondary))]">
												Yes
											</span>
											<span className="rounded-md border border-[hsl(var(--border))] px-2.5 py-1 text-xs text-[hsl(var(--text-secondary))]">
												No
											</span>
										</div>
									) : q.type === 'rating' ? (
										<p className="text-xs text-[hsl(var(--text-tertiary))]">
											{attrValue(q, 'min') || '1'} – {attrValue(q, 'max') || '5'}
											{attrValue(q, 'min_label') || attrValue(q, 'minlabel')
												? ` · ${attrValue(q, 'min_label') || attrValue(q, 'minlabel')} → ${attrValue(q, 'max_label') || attrValue(q, 'maxlabel') || ''}`
												: ''}
										</p>
									) : (
										<div className="h-8 rounded-md border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--surface))]/60" />
									)}

									{q.attrs.filter((a) => !['min', 'max', 'min_label', 'minlabel', 'max_label', 'maxlabel'].includes(a.key)).length >
									0 ? (
										<p className="text-[10px] text-[hsl(var(--text-tertiary))]">
											{q.attrs
												.filter((a) => !['min', 'max', 'min_label', 'minlabel', 'max_label', 'maxlabel'].includes(a.key))
												.map((a) => `${a.key}: ${a.value}`)
												.join(' · ')}
										</p>
									) : null}
								</div>
							))
						)}
					</div>
				</section>
			))}
		</div>
	);
}

function attrValue(q: PreviewQuestion, key: string): string | undefined {
	return q.attrs.find((a) => a.key === key)?.value;
}
