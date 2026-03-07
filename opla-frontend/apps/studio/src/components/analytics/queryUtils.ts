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
