import type { PrepColumn } from './prepSession';
import { evaluateCalculatedColumn } from './excelFormulas';

export type FormulaFnCategory = 'logic' | 'text' | 'math' | 'date' | 'info';

export type ArgKind = 'any' | 'text' | 'number' | 'date' | 'logical' | 'column';

export type FormulaFnDef = {
	label: string;
	category: FormulaFnCategory;
	/** Text inserted; may include `()` for nullary fns. */
	insert: string;
	signature: string;
	example?: string;
	aliases?: string[];
	/** Preferred type for each argument (by position). */
	argTypes?: ArgKind[];
};

export type FormulaSuggestion =
	| {
			kind: 'function';
			id: string;
			label: string;
			insert: string;
			/** Cursor offset from start of insert (into the snippet). */
			cursorOffset: number;
			signature: string;
			detail: string;
			category: FormulaFnCategory;
			example?: string;
			score: number;
	  }
	| {
			kind: 'column';
			id: string;
			label: string;
			insert: string;
			cursorOffset: number;
			signature: string;
			detail: string;
			category: 'column';
			fieldType?: string | null;
			score: number;
	  }
	| {
			kind: 'fix';
			id: string;
			label: string;
			insert: string;
			cursorOffset: number;
			signature: string;
			detail: string;
			category: 'fix';
			score: number;
	  };

export const CATEGORY_LABELS: Record<FormulaFnCategory | 'column' | 'fix', string> = {
	logic: 'Logic',
	text: 'Text',
	math: 'Math',
	date: 'Date & time',
	info: 'Info',
	column: 'Columns',
	fix: 'Fixes',
};

export const FORMULA_FUNCTIONS: FormulaFnDef[] = [
	{
		label: 'IF',
		category: 'logic',
		insert: 'IF()',
		signature: 'IF(condition, value_if_true, value_if_false)',
		example: 'IF([app_rating]>3, "Good", "Low")',
		argTypes: ['logical', 'any', 'any'],
	},
	{
		label: 'IFS',
		category: 'logic',
		insert: 'IFS()',
		signature: 'IFS(cond1, val1, cond2, val2, …)',
		argTypes: ['logical', 'any'],
	},
	{ label: 'AND', category: 'logic', insert: 'AND()', signature: 'AND(logical1, logical2, …)', argTypes: ['logical'] },
	{ label: 'OR', category: 'logic', insert: 'OR()', signature: 'OR(logical1, logical2, …)', argTypes: ['logical'] },
	{ label: 'XOR', category: 'logic', insert: 'XOR()', signature: 'XOR(logical1, logical2, …)', argTypes: ['logical'] },
	{ label: 'NOT', category: 'logic', insert: 'NOT()', signature: 'NOT(logical)', argTypes: ['logical'] },
	{
		label: 'IFERROR',
		category: 'logic',
		insert: 'IFERROR()',
		signature: 'IFERROR(value, value_if_error)',
		example: 'IFERROR(VALUE([feature]), 0)',
		argTypes: ['any', 'any'],
	},
	{ label: 'IFNA', category: 'logic', insert: 'IFNA()', signature: 'IFNA(value, value_if_na)', argTypes: ['any', 'any'] },

	{
		label: 'CONCATENATE',
		category: 'text',
		insert: 'CONCATENATE()',
		signature: 'CONCATENATE(text1, text2, …)',
		aliases: ['concat', 'join', 'cat'],
		example: 'CONCATENATE([favColour], " · ", [devices])',
		argTypes: ['text', 'text'],
	},
	{
		label: 'CONCAT',
		category: 'text',
		insert: 'CONCAT()',
		signature: 'CONCAT(text1, text2, …)',
		argTypes: ['text', 'text'],
	},
	{
		label: 'TEXTJOIN',
		category: 'text',
		insert: 'TEXTJOIN()',
		signature: 'TEXTJOIN(delimiter, ignore_empty, text1, …)',
		example: 'TEXTJOIN(" | ", TRUE, [feature], [bug_comment])',
		argTypes: ['text', 'logical', 'text'],
	},
	{
		label: 'LEFT',
		category: 'text',
		insert: 'LEFT()',
		signature: 'LEFT(text, num_chars)',
		aliases: ['prefix'],
		example: 'LEFT([feature], 10)',
		argTypes: ['text', 'number'],
	},
	{
		label: 'RIGHT',
		category: 'text',
		insert: 'RIGHT()',
		signature: 'RIGHT(text, num_chars)',
		aliases: ['suffix'],
		example: 'RIGHT([feature], 5)',
		argTypes: ['text', 'number'],
	},
	{
		label: 'MID',
		category: 'text',
		insert: 'MID()',
		signature: 'MID(text, start_num, num_chars)',
		argTypes: ['text', 'number', 'number'],
	},
	{ label: 'LEN', category: 'text', insert: 'LEN()', signature: 'LEN(text)', aliases: ['length'], argTypes: ['text'] },
	{ label: 'TRIM', category: 'text', insert: 'TRIM()', signature: 'TRIM(text)', argTypes: ['text'] },
	{
		label: 'UPPER',
		category: 'text',
		insert: 'UPPER()',
		signature: 'UPPER(text)',
		aliases: ['upcase', 'uppercase'],
		example: 'UPPER([favColour])',
		argTypes: ['text'],
	},
	{
		label: 'LOWER',
		category: 'text',
		insert: 'LOWER()',
		signature: 'LOWER(text)',
		aliases: ['downcase', 'lowercase'],
		argTypes: ['text'],
	},
	{ label: 'PROPER', category: 'text', insert: 'PROPER()', signature: 'PROPER(text)', aliases: ['titlecase'], argTypes: ['text'] },
	{
		label: 'SUBSTITUTE',
		category: 'text',
		insert: 'SUBSTITUTE()',
		signature: 'SUBSTITUTE(text, old_text, new_text, [instance])',
		aliases: ['replaceall'],
		argTypes: ['text', 'text', 'text', 'number'],
	},
	{
		label: 'REPLACE',
		category: 'text',
		insert: 'REPLACE()',
		signature: 'REPLACE(old_text, start_num, num_chars, new_text)',
		argTypes: ['text', 'number', 'number', 'text'],
	},
	{ label: 'FIND', category: 'text', insert: 'FIND()', signature: 'FIND(find_text, within_text, [start_num])', argTypes: ['text', 'text', 'number'] },
	{ label: 'SEARCH', category: 'text', insert: 'SEARCH()', signature: 'SEARCH(find_text, within_text, [start_num])', argTypes: ['text', 'text', 'number'] },
	{ label: 'EXACT', category: 'text', insert: 'EXACT()', signature: 'EXACT(text1, text2)', argTypes: ['text', 'text'] },
	{ label: 'REPT', category: 'text', insert: 'REPT()', signature: 'REPT(text, number_times)', argTypes: ['text', 'number'] },
	{ label: 'TEXT', category: 'text', insert: 'TEXT()', signature: 'TEXT(value, format_text)', argTypes: ['any', 'text'] },
	{ label: 'VALUE', category: 'text', insert: 'VALUE()', signature: 'VALUE(text)', argTypes: ['text'] },
	{ label: 'T', category: 'text', insert: 'T()', signature: 'T(value)', argTypes: ['any'] },
	{ label: 'CLEAN', category: 'text', insert: 'CLEAN()', signature: 'CLEAN(text)', argTypes: ['text'] },
	{ label: 'CHAR', category: 'text', insert: 'CHAR()', signature: 'CHAR(number)', argTypes: ['number'] },
	{ label: 'CODE', category: 'text', insert: 'CODE()', signature: 'CODE(text)', argTypes: ['text'] },
	{ label: 'NUMBERVALUE', category: 'text', insert: 'NUMBERVALUE()', signature: 'NUMBERVALUE(text, [decimal_sep], [group_sep])', argTypes: ['text'] },

	{ label: 'SUM', category: 'math', insert: 'SUM()', signature: 'SUM(number1, number2, …)', argTypes: ['number'] },
	{ label: 'AVERAGE', category: 'math', insert: 'AVERAGE()', signature: 'AVERAGE(number1, number2, …)', aliases: ['avg', 'mean'], argTypes: ['number'] },
	{ label: 'MIN', category: 'math', insert: 'MIN()', signature: 'MIN(number1, number2, …)', argTypes: ['number'] },
	{ label: 'MAX', category: 'math', insert: 'MAX()', signature: 'MAX(number1, number2, …)', argTypes: ['number'] },
	{ label: 'ROUND', category: 'math', insert: 'ROUND()', signature: 'ROUND(number, digits)', argTypes: ['number', 'number'] },
	{ label: 'ROUNDUP', category: 'math', insert: 'ROUNDUP()', signature: 'ROUNDUP(number, digits)', argTypes: ['number', 'number'] },
	{ label: 'ROUNDDOWN', category: 'math', insert: 'ROUNDDOWN()', signature: 'ROUNDDOWN(number, digits)', argTypes: ['number', 'number'] },
	{ label: 'ABS', category: 'math', insert: 'ABS()', signature: 'ABS(number)', argTypes: ['number'] },
	{ label: 'INT', category: 'math', insert: 'INT()', signature: 'INT(number)', argTypes: ['number'] },
	{ label: 'MOD', category: 'math', insert: 'MOD()', signature: 'MOD(number, divisor)', argTypes: ['number', 'number'] },
	{ label: 'POWER', category: 'math', insert: 'POWER()', signature: 'POWER(number, power)', aliases: ['pow'], argTypes: ['number', 'number'] },
	{ label: 'SQRT', category: 'math', insert: 'SQRT()', signature: 'SQRT(number)', argTypes: ['number'] },
	{ label: 'CEILING', category: 'math', insert: 'CEILING()', signature: 'CEILING(number, significance)', argTypes: ['number', 'number'] },
	{ label: 'FLOOR', category: 'math', insert: 'FLOOR()', signature: 'FLOOR(number, significance)', argTypes: ['number', 'number'] },

	{ label: 'DATE', category: 'date', insert: 'DATE()', signature: 'DATE(year, month, day)', argTypes: ['number', 'number', 'number'] },
	{ label: 'TIME', category: 'date', insert: 'TIME()', signature: 'TIME(hour, minute, second)', argTypes: ['number', 'number', 'number'] },
	{ label: 'YEAR', category: 'date', insert: 'YEAR()', signature: 'YEAR(date)', argTypes: ['date'] },
	{ label: 'MONTH', category: 'date', insert: 'MONTH()', signature: 'MONTH(date)', argTypes: ['date'] },
	{ label: 'DAY', category: 'date', insert: 'DAY()', signature: 'DAY(date)', argTypes: ['date'] },
	{ label: 'HOUR', category: 'date', insert: 'HOUR()', signature: 'HOUR(time)', argTypes: ['date'] },
	{ label: 'MINUTE', category: 'date', insert: 'MINUTE()', signature: 'MINUTE(time)', argTypes: ['date'] },
	{ label: 'SECOND', category: 'date', insert: 'SECOND()', signature: 'SECOND(time)', argTypes: ['date'] },
	{ label: 'TODAY', category: 'date', insert: 'TODAY()', signature: 'TODAY()' },
	{ label: 'NOW', category: 'date', insert: 'NOW()', signature: 'NOW()' },
	{ label: 'WEEKDAY', category: 'date', insert: 'WEEKDAY()', signature: 'WEEKDAY(date, [return_type])', argTypes: ['date', 'number'] },
	{ label: 'EDATE', category: 'date', insert: 'EDATE()', signature: 'EDATE(start_date, months)', argTypes: ['date', 'number'] },
	{ label: 'EOMONTH', category: 'date', insert: 'EOMONTH()', signature: 'EOMONTH(start_date, months)', argTypes: ['date', 'number'] },
	{ label: 'DATEDIF', category: 'date', insert: 'DATEDIF()', signature: 'DATEDIF(start_date, end_date, unit)', argTypes: ['date', 'date', 'text'] },

	{ label: 'ISBLANK', category: 'info', insert: 'ISBLANK()', signature: 'ISBLANK(value)', argTypes: ['any'] },
	{ label: 'ISNUMBER', category: 'info', insert: 'ISNUMBER()', signature: 'ISNUMBER(value)', argTypes: ['any'] },
	{ label: 'ISTEXT', category: 'info', insert: 'ISTEXT()', signature: 'ISTEXT(value)', argTypes: ['any'] },
	{ label: 'ISERROR', category: 'info', insert: 'ISERROR()', signature: 'ISERROR(value)', argTypes: ['any'] },
	{ label: 'N', category: 'info', insert: 'N()', signature: 'N(value)', argTypes: ['any'] },
];

const FN_BY_LABEL = new Map(FORMULA_FUNCTIONS.map(fn => [fn.label.toUpperCase(), fn]));

const RECENTS_KEY = 'opla_prep_formula_recents';
const MAX_RECENTS = 12;

export function loadFormulaRecents(): { functions: string[]; columns: string[] } {
	try {
		const raw = localStorage.getItem(RECENTS_KEY);
		if (!raw) return { functions: [], columns: [] };
		const parsed = JSON.parse(raw) as { functions?: string[]; columns?: string[] };
		return {
			functions: Array.isArray(parsed.functions) ? parsed.functions.slice(0, MAX_RECENTS) : [],
			columns: Array.isArray(parsed.columns) ? parsed.columns.slice(0, MAX_RECENTS) : [],
		};
	} catch {
		return { functions: [], columns: [] };
	}
}

export function rememberFormulaFunction(label: string) {
	const prev = loadFormulaRecents();
	const functions = [label, ...prev.functions.filter(item => item !== label)].slice(0, MAX_RECENTS);
	try {
		localStorage.setItem(RECENTS_KEY, JSON.stringify({ ...prev, functions }));
	} catch {
		/* ignore */
	}
}

export function rememberFormulaColumn(key: string) {
	const prev = loadFormulaRecents();
	const columns = [key, ...prev.columns.filter(item => item !== key)].slice(0, MAX_RECENTS);
	try {
		localStorage.setItem(RECENTS_KEY, JSON.stringify({ ...prev, columns }));
	} catch {
		/* ignore */
	}
}

function normalizeType(fieldType?: string | null): ArgKind {
	const t = String(fieldType || '')
		.toLowerCase()
		.replace(/[\s-]+/g, '_');
	if (!t) return 'any';
	if (t.includes('date') || t.includes('time') || t === 'timestamp') return 'date';
	if (
		t.includes('number') ||
		t.includes('int') ||
		t.includes('decimal') ||
		t.includes('float') ||
		t === 'rating_scale' ||
		t === 'generic_range'
	) {
		return 'number';
	}
	if (t === 'boolean' || t === 'toggle' || t === 'bool') return 'logical';
	if (t.includes('photo') || t.includes('image') || t.includes('gps')) return 'any';
	return 'text';
}

function typeScore(column: PrepColumn, preferred?: ArgKind): number {
	if (!preferred || preferred === 'any' || preferred === 'column') return 0;
	const actual = normalizeType(column.field_type);
	if (actual === preferred) return 40;
	if (preferred === 'text' && actual === 'any') return 10;
	if (preferred === 'number' && actual === 'text') return -5;
	return 0;
}

function fuzzyScore(query: string, target: string): number {
	if (!query) return 1;
	const q = query.toLowerCase();
	const t = target.toLowerCase();
	if (t === q) return 120;
	if (t.startsWith(q)) return 100;
	if (t.includes(q)) return 70;
	// subsequence fuzzy
	let qi = 0;
	for (let i = 0; i < t.length && qi < q.length; i++) {
		if (t[i] === q[qi]) qi++;
	}
	if (qi === q.length) return 40;
	return 0;
}

function bestAliasScore(query: string, fn: FormulaFnDef): number {
	let best = fuzzyScore(query, fn.label);
	for (const alias of fn.aliases || []) {
		best = Math.max(best, fuzzyScore(query, alias) * 0.95);
	}
	return best;
}

/** Find innermost function call still open at cursor, and which arg index we're in. */
export function getCallContext(before: string): { name: string; argIndex: number } | null {
	const stack: Array<{ name: string; argIndex: number }> = [];
	for (let i = 0; i < before.length; i++) {
		const ch = before[i];
		if (ch === '"') {
			i++;
			while (i < before.length && before[i] !== '"') {
				if (before[i] === '\\') i++;
				i++;
			}
			continue;
		}
		if (/[A-Za-z]/.test(ch)) {
			let j = i + 1;
			while (j < before.length && /[A-Za-z0-9_]/.test(before[j])) j++;
			const name = before.slice(i, j);
			let k = j;
			while (k < before.length && /\s/.test(before[k])) k++;
			if (before[k] === '(') {
				stack.push({ name: name.toUpperCase(), argIndex: 0 });
				i = k;
				continue;
			}
			i = j - 1;
			continue;
		}
		if (ch === '(') {
			stack.push({ name: '', argIndex: 0 });
			continue;
		}
		if (ch === ')') {
			stack.pop();
			continue;
		}
		if (ch === ',' && stack.length) {
			stack[stack.length - 1].argIndex += 1;
		}
	}
	for (let i = stack.length - 1; i >= 0; i--) {
		if (stack[i].name) return stack[i];
	}
	return null;
}

function snippetCursorOffset(insert: string): number {
	if (insert.endsWith('()')) return insert.length - 1;
	if (insert.endsWith('(')) return insert.length;
	return insert.length;
}

function columnSuggestions(
	columns: PrepColumn[],
	query: string,
	preferred: ArgKind | undefined,
	recents: string[],
	limit: number,
): FormulaSuggestion[] {
	const recentRank = new Map(recents.map((key, index) => [key, recents.length - index]));
	return columns
		.map(column => {
			const labelScore = Math.max(fuzzyScore(query, column.label), fuzzyScore(query, column.key));
			if (query && labelScore === 0) return null;
			const score =
				labelScore +
				typeScore(column, preferred) +
				(recentRank.get(column.key) || 0) * 3 +
				(column.calculated ? 2 : 0);
			return {
				kind: 'column' as const,
				id: `col:${column.key}`,
				label: column.label,
				insert: `[${column.label}]`,
				cursorOffset: `[${column.label}]`.length,
				signature: column.field_type ? String(column.field_type) : 'column',
				detail: column.key !== column.label ? column.key : column.calculated ? 'Calculated' : 'Column',
				category: 'column' as const,
				fieldType: column.field_type,
				score,
			};
		})
		.filter((item): item is NonNullable<typeof item> => Boolean(item))
		.sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
		.slice(0, limit);
}

function functionSuggestions(
	query: string,
	recents: string[],
	limit: number,
	preferredCategory?: FormulaFnCategory,
): FormulaSuggestion[] {
	const recentRank = new Map(recents.map((key, index) => [key, recents.length - index]));
	return FORMULA_FUNCTIONS.map(fn => {
		const match = bestAliasScore(query, fn);
		if (query && match === 0) return null;
		const score =
			match +
			(recentRank.get(fn.label) || 0) * 4 +
			(preferredCategory && fn.category === preferredCategory ? 15 : 0) +
			(!query && recentRank.has(fn.label) ? 20 : 0);
		return {
			kind: 'function' as const,
			id: `fn:${fn.label}`,
			label: fn.label,
			insert: fn.insert,
			cursorOffset: snippetCursorOffset(fn.insert),
			signature: fn.signature,
			detail: fn.signature,
			category: fn.category,
			example: fn.example,
			score,
		};
	})
		.filter((item): item is NonNullable<typeof item> => Boolean(item))
		.sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
		.slice(0, limit);
}

export function getFormulaSuggestions(
	formula: string,
	cursor: number,
	columns: PrepColumn[],
): FormulaSuggestion[] {
	const before = formula.slice(0, cursor);
	const recents = loadFormulaRecents();

	// Column picker: [partial
	const bracketMatch = before.match(/\[([^\]]*)$/);
	if (bracketMatch) {
		const query = bracketMatch[1];
		const call = getCallContext(before.slice(0, before.lastIndexOf('[')));
		const fn = call ? FN_BY_LABEL.get(call.name) : undefined;
		const preferred = fn?.argTypes?.[Math.min(call!.argIndex, (fn.argTypes?.length || 1) - 1)];
		return columnSuggestions(columns, query, preferred, recents.columns, 14);
	}

	const call = getCallContext(before);
	const insideArgs = Boolean(call && /[(,]\s*[A-Za-z0-9_]*$/.test(before));

	// Partial function token: UPPER or LEFT
	const fnToken = before.match(/(?:^|[=+\-*/(,])\s*([A-Za-z][A-Za-z0-9_]*)$/);
	if (fnToken) {
		const query = fnToken[1];
		const preferredCategory = call ? FN_BY_LABEL.get(call.name)?.category : undefined;
		const fns = functionSuggestions(query, recents.functions, 10, preferredCategory);
		// Also allow columns if typing looks like a word after comma inside a call
		if (call && before.endsWith(query) && /,\s*[A-Za-z][A-Za-z0-9_]*$/.test(before)) {
			const preferred = FN_BY_LABEL.get(call.name)?.argTypes?.[
				Math.min(call.argIndex, (FN_BY_LABEL.get(call.name)?.argTypes?.length || 1) - 1)
			];
			const cols = columnSuggestions(columns, query, preferred, recents.columns, 6);
			return [...fns, ...cols].sort((a, b) => b.score - a.score).slice(0, 14);
		}
		return fns;
	}

	// Empty trigger: after = ( , or start — offer context-aware suggestions
	const emptyTrigger = /(?:^|[=+\-*/(,])\s*$/.test(before);
	if (emptyTrigger) {
		if (call) {
			const fn = FN_BY_LABEL.get(call.name);
			const preferred = fn?.argTypes?.[Math.min(call.argIndex, (fn.argTypes?.length || 1) - 1)];
			const cols = columnSuggestions(columns, '', preferred, recents.columns, 8);
			const fns = functionSuggestions('', recents.functions, 6, fn?.category);
			const headerHint: FormulaSuggestion[] = fn
				? [
						{
							kind: 'fix',
							id: `sig:${fn.label}:${call.argIndex}`,
							label: `Arg ${call.argIndex + 1}`,
							insert: '',
							cursorOffset: 0,
							signature: fn.signature,
							detail: preferred ? `Expected: ${preferred}` : fn.signature,
							category: 'fix',
							score: 1000,
						},
					]
				: [];
			// Don't insert the signature row as a real completion — filter in UI, but keep for display
			return [...headerHint, ...cols, ...fns].slice(0, 16);
		}
		const fns = functionSuggestions('', recents.functions, 8);
		const cols = columnSuggestions(columns, '', 'any', recents.columns, 6);
		return [...fns, ...cols].slice(0, 14);
	}

	if (insideArgs && call) {
		const fn = FN_BY_LABEL.get(call.name);
		const preferred = fn?.argTypes?.[Math.min(call.argIndex, (fn.argTypes?.length || 1) - 1)];
		return columnSuggestions(columns, '', preferred, recents.columns, 10);
	}

	return [];
}

export function applyFormulaSuggestion(
	formula: string,
	cursor: number,
	suggestion: FormulaSuggestion,
): { next: string; cursor: number } {
	if (suggestion.kind === 'fix') {
		if (!suggestion.insert) return { next: formula, cursor };
		if (suggestion.insert.startsWith('=')) {
			return { next: suggestion.insert, cursor: suggestion.insert.length };
		}
	}

	const before = formula.slice(0, cursor);
	const after = formula.slice(cursor);

	if (suggestion.kind === 'column') {
		const start = before.lastIndexOf('[');
		if (start >= 0 && !before.slice(start).includes(']')) {
			const nextBefore = `${before.slice(0, start)}${suggestion.insert}`;
			return { next: `${nextBefore}${after}`, cursor: nextBefore.length };
		}
		const nextBefore = `${before}${suggestion.insert}`;
		return { next: `${nextBefore}${after}`, cursor: nextBefore.length };
	}

	// Replace partial function token if present
	const tokenMatch = before.match(/([A-Za-z][A-Za-z0-9_]*)$/);
	const token = tokenMatch?.[1] ?? '';
	const replaceFrom = token ? before.length - token.length : before.length;
	const insert = suggestion.insert;
	const nextBefore = `${before.slice(0, replaceFrom)}${insert}`;
	const cursorPos = before.slice(0, replaceFrom).length + suggestion.cursorOffset;
	return { next: `${nextBefore}${after}`, cursor: cursorPos };
}

/** Auto-pair brackets/quotes. Returns null if no change. */
export function autoPairKey(
	formula: string,
	cursor: number,
	key: string,
): { next: string; cursor: number } | null {
	const pairs: Record<string, string> = {
		'(': ')',
		'[': ']',
		'"': '"',
	};
	const close = pairs[key];
	if (!close) return null;
	const before = formula.slice(0, cursor);
	const after = formula.slice(cursor);
	// Don't double-close if next char already the closer
	if (after.startsWith(close) && (key === '"' || key === ')' || key === ']')) {
		return { next: formula, cursor: cursor + 1 };
	}
	if (key === '"' && before.endsWith('\\')) return null;
	return {
		next: `${before}${key}${close}${after}`,
		cursor: cursor + 1,
	};
}

export function previewFormulaOnSample(
	formula: string,
	columns: PrepColumn[],
	sampleRow: Record<string, unknown> | null,
): { result: string; error?: string } {
	if (!formula.trim() || !sampleRow) return { result: '' };
	const { values, error } = evaluateCalculatedColumn([sampleRow], columns, formula);
	if (error) return { result: '', error };
	const value = values[0];
	if (value == null) return { result: '∅' };
	if (typeof value === 'string' && value.startsWith('#')) return { result: value, error: value };
	return { result: String(value) };
}

export function suggestFormulaFixes(
	formula: string,
	columns: PrepColumn[],
	error: string | null | undefined,
): FormulaSuggestion[] {
	if (!error && !formula) return [];
	const fixes: FormulaSuggestion[] = [];
	const unknownCols = [...formula.matchAll(/\[([^\]]+)\]/g)]
		.map(match => match[1])
		.filter(name => !columns.some(column => column.label === name || column.key === name));

	for (const name of unknownCols) {
		const closest = columns
			.map(column => ({
				column,
				score: Math.max(fuzzyScore(name, column.label), fuzzyScore(name, column.key)),
			}))
			.filter(item => item.score > 0)
			.sort((a, b) => b.score - a.score)[0];
		if (closest) {
			fixes.push({
				kind: 'fix',
				id: `fix-col:${name}`,
				label: `Replace [${name}] → [${closest.column.label}]`,
				insert: formula.split(`[${name}]`).join(`[${closest.column.label}]`),
				cursorOffset: 0,
				signature: 'Unknown column',
				detail: `Did you mean [${closest.column.label}]?`,
				category: 'fix',
				score: 200,
			});
		}
	}

	const err = (error || '').toLowerCase();
	if (err.includes('#name') || err.includes('name')) {
		fixes.push({
			kind: 'fix',
			id: 'fix-iferror',
			label: 'Wrap with IFERROR',
			insert: `=IFERROR(${formula.replace(/^=/, '')}, "")`,
			cursorOffset: 0,
			signature: 'IFERROR(value, fallback)',
			detail: 'Hide #NAME? / #VALUE! errors',
			category: 'fix',
			score: 150,
		});
	}
	if (err.includes('#value') || err.includes('value')) {
		const firstText = columns.find(column => normalizeType(column.field_type) === 'text');
		if (firstText && !formula.toUpperCase().includes('VALUE(')) {
			fixes.push({
				kind: 'fix',
				id: 'fix-value',
				label: `Try VALUE([${firstText.label}])`,
				insert: `=VALUE([${firstText.label}])`,
				cursorOffset: 0,
				signature: 'VALUE(text)',
				detail: 'Coerce text to number',
				category: 'fix',
				score: 140,
			});
		}
	}

	return fixes.slice(0, 4);
}

export function groupSuggestions(suggestions: FormulaSuggestion[]): Array<{
	category: FormulaSuggestion['category'];
	label: string;
	items: FormulaSuggestion[];
}> {
	const order: Array<FormulaSuggestion['category']> = ['fix', 'column', 'text', 'logic', 'math', 'date', 'info'];
	const map = new Map<FormulaSuggestion['category'], FormulaSuggestion[]>();
	for (const item of suggestions) {
		if (item.kind === 'fix' && !item.insert) continue; // signature-only rows handled separately
		const list = map.get(item.category) || [];
		list.push(item);
		map.set(item.category, list);
	}
	return order
		.filter(category => (map.get(category) || []).length > 0)
		.map(category => ({
			category,
			label: CATEGORY_LABELS[category],
			items: map.get(category) || [],
		}));
}

export function getActiveSignature(
	formula: string,
	cursor: number,
): { signature: string; argIndex: number; name: string } | null {
	const before = formula.slice(0, cursor);
	const call = getCallContext(before);
	if (!call) return null;
	const fn = FN_BY_LABEL.get(call.name);
	if (!fn) return null;
	return { signature: fn.signature, argIndex: call.argIndex, name: fn.label };
}
