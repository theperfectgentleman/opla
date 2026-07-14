import type { AnalyticsSource, AnalyticsSourceField } from './types';
import { evaluateCalculatedColumn } from './excelFormulas';

export type PrepColumn = {
	key: string;
	label: string;
	field_type?: string | null;
	calculated?: boolean;
	formula?: string;
	options?: Array<{ label: string; value: string }> | null;
};

export type PrepSessionPayload = {
	orgId: string;
	datasetId: string;
	datasetLabel: string;
	columns: PrepColumn[];
	rows: Array<Record<string, unknown>>;
	displayMode?: 'value' | 'label';
	createdAt: string;
};

const STORAGE_KEY = 'opla_analytics_prep_session';

export function savePrepSession(payload: PrepSessionPayload) {
	sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function consumePrepSession(orgId: string): PrepSessionPayload | null {
	const raw = sessionStorage.getItem(STORAGE_KEY);
	if (!raw) return null;
	try {
		const parsed = JSON.parse(raw) as PrepSessionPayload;
		if (parsed.orgId !== orgId) return null;
		sessionStorage.removeItem(STORAGE_KEY);
		return parsed;
	} catch {
		sessionStorage.removeItem(STORAGE_KEY);
		return null;
	}
}

export function fieldsToPrepColumns(fields: AnalyticsSourceField[]): PrepColumn[] {
	return fields.map(field => ({
		key: field.field_key,
		label: field.label || field.field_key,
		field_type: field.field_type,
		calculated: false,
		options: field.options ?? null,
	}));
}

export function sourceLabel(source: AnalyticsSource) {
	const base = source.form_title || source.dataset_name;
	if (source.derived?.mode === 'snapshot') return `${base} (snapshot)`;
	if (source.derived?.mode === 'linked') return `${base} (linked)`;
	return base;
}

export function columnsFromDerivedMeta(
	derived: NonNullable<AnalyticsSource['derived']>['columns'],
): PrepColumn[] {
	if (!derived?.length) return [];
	return derived.map(column => ({
		key: column.key,
		label: column.label || column.key,
		field_type: column.field_type,
		calculated: Boolean(column.calculated),
		formula: column.formula || undefined,
	}));
}

/** Re-apply calculated Prep formulas onto live parent rows (linked tables). */
export function applyPrepFormulas(
	baseRows: Array<Record<string, unknown>>,
	columns: PrepColumn[],
): { rows: Array<Record<string, unknown>>; error: string | null } {
	let working = baseRows.map(row => ({ ...row }));
	const calcColumns = columns.filter(column => column.calculated && column.formula);
	for (const column of calcColumns) {
		const prior = columns.filter(c => c.key !== column.key || !c.calculated);
		const { values, error } = evaluateCalculatedColumn(working, prior.length ? prior : columns.filter(c => !c.calculated), column.formula!);
		if (error) return { rows: working, error };
		working = working.map((row, index) => ({ ...row, [column.key]: values[index] }));
	}
	return { rows: working, error: null };
}

// ─── Persisted column widths ─────────────────────────────────────────────────

const COL_WIDTH_STORAGE_PREFIX = 'opla_prep_col_widths';
export const PREP_DEFAULT_COL_WIDTH = 160;
export const PREP_MIN_COL_WIDTH = 72;
export const PREP_MAX_COL_WIDTH = 640;
export const PREP_INDEX_COL_WIDTH = 48;

function colWidthStorageKey(orgId: string, datasetId: string) {
	return `${COL_WIDTH_STORAGE_PREFIX}:${orgId}:${datasetId}`;
}

export function loadPrepColumnWidths(orgId: string, datasetId: string): Record<string, number> {
	if (!orgId || !datasetId || typeof localStorage === 'undefined') return {};
	try {
		const raw = localStorage.getItem(colWidthStorageKey(orgId, datasetId));
		if (!raw) return {};
		const parsed = JSON.parse(raw) as Record<string, unknown>;
		const out: Record<string, number> = {};
		for (const [key, value] of Object.entries(parsed || {})) {
			const n = Number(value);
			if (Number.isFinite(n) && n >= PREP_MIN_COL_WIDTH && n <= PREP_MAX_COL_WIDTH) {
				out[key] = Math.round(n);
			}
		}
		return out;
	} catch {
		return {};
	}
}

export function savePrepColumnWidths(orgId: string, datasetId: string, widths: Record<string, number>) {
	if (!orgId || !datasetId || typeof localStorage === 'undefined') return;
	try {
		const cleaned: Record<string, number> = {};
		for (const [key, value] of Object.entries(widths)) {
			const n = Number(value);
			if (Number.isFinite(n) && n >= PREP_MIN_COL_WIDTH && n <= PREP_MAX_COL_WIDTH) {
				cleaned[key] = Math.round(n);
			}
		}
		localStorage.setItem(colWidthStorageKey(orgId, datasetId), JSON.stringify(cleaned));
	} catch {
		// ignore quota / private mode
	}
}

export function clampPrepColumnWidth(width: number) {
	return Math.min(PREP_MAX_COL_WIDTH, Math.max(PREP_MIN_COL_WIDTH, Math.round(width)));
}
