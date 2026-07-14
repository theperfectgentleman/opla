import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';

import type { PrepColumn } from './prepSession';
import {
	applyFormulaSuggestion,
	autoPairKey,
	getActiveSignature,
	getFormulaSuggestions,
	groupSuggestions,
	previewFormulaOnSample,
	rememberFormulaColumn,
	rememberFormulaFunction,
	suggestFormulaFixes,
	type FormulaSuggestion,
} from './formulaAutocomplete';
import { analyticsInputClass, analyticsLabelClass } from './ui';

export default function FormulaEditor({
	value,
	onChange,
	columns,
	sampleRow,
	evalError,
}: {
	value: string;
	onChange: (next: string) => void;
	columns: PrepColumn[];
	sampleRow?: Record<string, unknown> | null;
	evalError?: string | null;
}) {
	const inputRef = useRef<HTMLTextAreaElement>(null);
	const [cursor, setCursor] = useState(value.length);
	const [open, setOpen] = useState(false);
	const [activeIndex, setActiveIndex] = useState(0);
	const suppressOpenRef = useRef(false);

	const baseSuggestions = useMemo(
		() => getFormulaSuggestions(value, cursor, columns),
		[value, cursor, columns],
	);

	const preview = useMemo(
		() => previewFormulaOnSample(value, columns, sampleRow ?? null),
		[value, columns, sampleRow],
	);

	const fixes = useMemo(
		() => suggestFormulaFixes(value, columns, evalError || preview.error),
		[value, columns, evalError, preview.error],
	);

	const suggestions = useMemo(() => {
		const ids = new Set(baseSuggestions.map(item => item.id));
		const merged = [...fixes.filter(item => !ids.has(item.id)), ...baseSuggestions];
		return merged;
	}, [baseSuggestions, fixes]);

	const flatItems = useMemo(
		() => suggestions.filter(item => !(item.kind === 'fix' && !item.insert)),
		[suggestions],
	);

	const grouped = useMemo(() => groupSuggestions(suggestions), [suggestions]);

	const signature = useMemo(() => getActiveSignature(value, cursor), [value, cursor]);

	const active = flatItems[activeIndex] ?? null;

	useEffect(() => {
		if (suppressOpenRef.current) {
			suppressOpenRef.current = false;
			setOpen(false);
			return;
		}
		setOpen(flatItems.length > 0);
		setActiveIndex(0);
	}, [flatItems]);

	function syncCursor() {
		const el = inputRef.current;
		if (!el) return;
		setCursor(el.selectionStart ?? el.value.length);
	}

	function focusAt(next: string, nextCursor: number) {
		onChange(next);
		requestAnimationFrame(() => {
			const el = inputRef.current;
			if (!el) return;
			el.focus();
			el.setSelectionRange(nextCursor, nextCursor);
			setCursor(nextCursor);
		});
	}

	function choose(suggestion: FormulaSuggestion) {
		if (suggestion.kind === 'fix' && !suggestion.insert) return;
		const { next, cursor: nextCursor } = applyFormulaSuggestion(value, cursor, suggestion);
		if (suggestion.kind === 'function') rememberFormulaFunction(suggestion.label);
		if (suggestion.kind === 'column') {
			const key = suggestion.id.replace(/^col:/, '');
			rememberFormulaColumn(key);
		}
		if (suggestion.kind === 'fix' && suggestion.insert.startsWith('=')) {
			suppressOpenRef.current = true;
		}
		setOpen(false);
		focusAt(next, suggestion.kind === 'fix' && suggestion.insert.startsWith('=') ? suggestion.insert.length : nextCursor);
	}

	function insertColumnAtCursor(column: PrepColumn) {
		const el = inputRef.current;
		const start = el?.selectionStart ?? value.length;
		const end = el?.selectionEnd ?? value.length;
		const token = `[${column.label}]`;
		const next = `${value.slice(0, start)}${token}${value.slice(end)}`;
		rememberFormulaColumn(column.key);
		focusAt(next, start + token.length);
	}

	function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
		const el = inputRef.current;
		const pos = el?.selectionStart ?? cursor;

		if (open && flatItems.length > 0) {
			if (event.key === 'ArrowDown') {
				event.preventDefault();
				setActiveIndex(index => (index + 1) % flatItems.length);
				return;
			}
			if (event.key === 'ArrowUp') {
				event.preventDefault();
				setActiveIndex(index => (index - 1 + flatItems.length) % flatItems.length);
				return;
			}
			if (event.key === 'Enter' && !event.shiftKey) {
				event.preventDefault();
				choose(flatItems[activeIndex] ?? flatItems[0]);
				return;
			}
			if (event.key === 'Tab') {
				event.preventDefault();
				choose(flatItems[activeIndex] ?? flatItems[0]);
				return;
			}
			if (event.key === 'Escape') {
				event.preventDefault();
				setOpen(false);
				return;
			}
		}

		// Auto-pair
		if (event.key === '(' || event.key === '[' || event.key === '"') {
			const paired = autoPairKey(value, pos, event.key);
			if (paired) {
				event.preventDefault();
				focusAt(paired.next, paired.cursor);
				return;
			}
		}
		// Skip over closing pair
		if ((event.key === ')' || event.key === ']' || event.key === '"') && value[pos] === event.key) {
			event.preventDefault();
			focusAt(value, pos + 1);
		}
	}

	let runningIndex = -1;

	return (
		<div className="relative min-w-0">
			<label className={analyticsLabelClass}>Formula</label>
			<textarea
				ref={inputRef}
				value={value}
				rows={3}
				onChange={event => {
					onChange(event.target.value);
					setCursor(event.target.selectionStart ?? event.target.value.length);
				}}
				onClick={syncCursor}
				onKeyUp={syncCursor}
				onSelect={syncCursor}
				onKeyDown={onKeyDown}
				onBlur={() => {
					window.setTimeout(() => setOpen(false), 140);
				}}
				placeholder={'=UPPER(LEFT([Column], 3))\nType [ for columns, or a function name'}
				className={`${analyticsInputClass} min-h-[4.5rem] resize-y font-mono leading-relaxed`}
				spellCheck={false}
				autoComplete="off"
			/>

			{signature ? (
				<div className="mt-1.5 rounded border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-[11px] text-slate-600">
					<span className="font-semibold text-emerald-800">{signature.name}</span>
					<span className="text-slate-400"> · </span>
					<span>{signature.signature}</span>
					<span className="ml-2 rounded bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
						arg {signature.argIndex + 1}
					</span>
				</div>
			) : null}

			{(preview.result || preview.error) && value.trim().length > 1 ? (
				<div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px]">
					<span className="font-semibold uppercase tracking-wider text-slate-400">Preview</span>
					{preview.error ? (
						<span className="font-mono text-rose-600">{preview.error}</span>
					) : (
						<span className="rounded bg-emerald-50 px-1.5 py-0.5 font-mono text-emerald-900">{preview.result}</span>
					)}
					{active?.kind === 'function' && active.example ? (
						<span className="truncate text-slate-400">e.g. {active.example}</span>
					) : null}
				</div>
			) : null}

			{open && flatItems.length > 0 ? (
				<div className="absolute left-0 right-0 top-[calc(100%+4px)] z-30 max-h-72 overflow-auto rounded-md border border-slate-200 bg-white shadow-lg">
					{grouped.map(group => (
						<div key={group.category}>
							<div className="sticky top-0 z-10 border-b border-slate-100 bg-slate-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
								{group.label}
							</div>
							<ul className="py-1">
								{group.items.map(suggestion => {
									runningIndex += 1;
									const index = runningIndex;
									const isActive = index === activeIndex;
									return (
										<li key={suggestion.id}>
											<button
												type="button"
												onMouseDown={event => {
													event.preventDefault();
													choose(suggestion);
												}}
												onMouseEnter={() => setActiveIndex(index)}
												className={`flex w-full flex-col gap-0.5 px-3 py-2 text-left ${
													isActive ? 'bg-emerald-50 text-emerald-950' : 'text-slate-700 hover:bg-slate-50'
												}`}
											>
												<div className="flex items-center justify-between gap-3">
													<span className="font-mono text-sm font-semibold">
														{suggestion.kind === 'column' ? suggestion.insert : suggestion.label}
													</span>
													<span className="truncate text-[10px] text-slate-400">{suggestion.detail}</span>
												</div>
												{suggestion.kind === 'function' ? (
													<div className="font-mono text-[10px] text-slate-500">{suggestion.signature}</div>
												) : null}
												{suggestion.kind === 'function' && suggestion.example ? (
													<div className="truncate text-[10px] text-emerald-700/80">{suggestion.example}</div>
												) : null}
												{suggestion.kind === 'fix' ? (
													<div className="text-[10px] text-amber-700">{suggestion.detail}</div>
												) : null}
											</button>
										</li>
									);
								})}
							</ul>
						</div>
					))}
				</div>
			) : null}

			{columns.length > 0 ? (
				<div className="mt-2 flex flex-wrap gap-1.5">
					{columns.slice(0, 16).map(column => (
						<button
							key={column.key}
							type="button"
							onMouseDown={event => {
								event.preventDefault();
								insertColumnAtCursor(column);
							}}
							className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[11px] text-slate-600 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800"
							title={`Insert [${column.label}]`}
						>
							[{column.label}]
						</button>
					))}
				</div>
			) : null}
		</div>
	);
}
