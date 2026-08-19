import type { AggregateFn, AnalyticsSource, QueryResult } from './types';

export function prettifyLabel(value: string) {
	return value
		.replace(/^_+/, '')
		.replace(/_/g, ' ')
		.replace(/\b\w/g, letter => letter.toUpperCase());
}

export function coerceDisplayValue(value: unknown) {
	if (value == null) {
		return '—';
	}

	if (typeof value === 'string' || typeof value === 'number') {
		return String(value);
	}

	if (typeof value === 'boolean') {
		return value ? 'True' : 'False';
	}

	if (value instanceof Date) {
		return value.toISOString();
	}

	return JSON.stringify(value);
}

export function defaultSource(sources: AnalyticsSource[], initialSource?: AnalyticsSource | null) {
	if (initialSource) {
		return initialSource;
	}
	return sources[0] ?? null;
}

export function extractMetricSeries(result: QueryResult, categoryKey: string, metricKey: string) {
	return result.rows.map(row => ({
		category: coerceDisplayValue(row[categoryKey]),
		metric: Number(row[metricKey] ?? 0),
	}));
}

export function defaultAggregateAlias(fn: AggregateFn, field: string) {
	return `${fn}_${field}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function queryPayloadFromQuestion(question: {
	query_config: unknown;
	source_config: unknown;
}): Record<string, unknown> | null {
	const cfg = isRecord(question.query_config) ? { ...question.query_config } : {};
	const src = isRecord(question.source_config) ? question.source_config : {};
	const tableFromCfg = typeof cfg.table === 'string' ? cfg.table : '';
	const tableFromSrc = typeof src.dataset_id === 'string' ? src.dataset_id : '';
	const table = tableFromCfg || tableFromSrc;
	if (!table) return null;

	if (cfg.version === 2) {
		return { ...cfg, table, dataset_id: table };
	}

	return {
		dataset_id: table,
		select_fields: cfg.select_fields,
		filters: cfg.filters,
		group_by: cfg.group_by,
		aggregates: cfg.aggregates,
		order_by: cfg.order_by,
		limit: typeof cfg.limit === 'number' ? cfg.limit : 500,
	};
}

export function dimensionFieldFromQuery(cfg: Record<string, unknown>): string | undefined {
	if (cfg.version === 2 && Array.isArray(cfg.dimensions) && isRecord(cfg.dimensions[0])) {
		const field = cfg.dimensions[0].field;
		return typeof field === 'string' ? field : undefined;
	}
	const group = Array.isArray(cfg.group_by) ? cfg.group_by[0] : undefined;
	if (typeof group === 'string') return group;
	if (isRecord(group) && typeof group.field === 'string') return group.field;
	return undefined;
}

function measureAliasFromQuery(cfg: Record<string, unknown>): string | undefined {
	if (cfg.version === 2 && Array.isArray(cfg.measures) && isRecord(cfg.measures[0])) {
		const alias = cfg.measures[0].alias;
		return typeof alias === 'string' ? alias : undefined;
	}
	const agg = Array.isArray(cfg.aggregates) ? cfg.aggregates[0] : undefined;
	if (isRecord(agg) && typeof agg.alias === 'string') return agg.alias;
	return undefined;
}

export function extractChartData(
	question: { query_config: unknown },
	result: QueryResult,
): Array<{ category: string; metric: number }> {
	const cfg = isRecord(question.query_config) ? question.query_config : {};
	if (!result.rows.length) return [];
	const key = dimensionFieldFromQuery(cfg) || result.columns[0]?.key;
	const valKey =
		measureAliasFromQuery(cfg) ||
		result.columns.find((column) => column.type === 'number')?.key ||
		result.columns[1]?.key;
	if (!key || !valKey) return [];
	return result.rows.map((row) => ({
		category: String(row[key] ?? ''),
		metric: Number(row[valKey]) || 0,
	}));
}

export function extractKPIValue(question: { query_config: unknown }, result: QueryResult): number {
	const cfg = isRecord(question.query_config) ? question.query_config : {};
	const valKey = measureAliasFromQuery(cfg) || result.columns[0]?.key;
	if (!valKey || result.rows.length === 0) return 0;
	return Number(result.rows[0]?.[valKey]) || 0;
}

export function chartMark(viz: unknown): string {
	if (!isRecord(viz)) return 'bar';
	const mark = viz.mark ?? viz.chart_type;
	if (mark === 'column') return 'bar';
	return typeof mark === 'string' ? mark : 'bar';
}
