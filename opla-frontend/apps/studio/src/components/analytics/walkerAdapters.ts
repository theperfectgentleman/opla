import type { IMutField, IAnalyticType, ISemanticType } from '@kanaries/graphic-walker';

import type { PrepColumn } from './prepSession';
import type { AnalyticsSource } from './types';
import { extractGps, extractImageUrl, parseJsonish } from './prepCellFormat';

function inferSemanticType(fieldType?: string | null): ISemanticType {
	const normalized = fieldType?.toLowerCase() ?? '';

	if (
		normalized.includes('date') ||
		normalized.includes('time') ||
		normalized.includes('datetime') ||
		normalized === 'timestamp'
	) {
		return 'temporal';
	}

	if (
		normalized.includes('int') ||
		normalized.includes('float') ||
		normalized.includes('double') ||
		normalized.includes('decimal') ||
		normalized.includes('number') ||
		normalized === 'rating_scale' ||
		normalized === 'generic_range'
	) {
		return 'quantitative';
	}

	return 'nominal';
}

function inferAnalyticType(fieldType?: string | null): IAnalyticType {
	return inferSemanticType(fieldType) === 'quantitative' ? 'measure' : 'dimension';
}

/** Axis/facet titles in Walker — prefer readable short names over snake_case keys. */
export function walkerDisplayName(label?: string | null, key?: string | null): string {
	const raw = String(label || key || 'Field').trim();
	const looksLikeKey = /^[a-z0-9_]+$/i.test(raw) && raw.includes('_');
	const humanized = looksLikeKey
		? raw
				.split('_')
				.filter(Boolean)
				.map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
				.join(' ')
		: raw;

	if (humanized.length <= 40) return humanized;
	return `${humanized.slice(0, 37).trimEnd()}…`;
}

export function buildWalkerFields(source: AnalyticsSource): IMutField[] {
	return source.fields.map(field => ({
		fid: field.field_key,
		name: walkerDisplayName(field.label, field.field_key),
		semanticType: inferSemanticType(field.field_type),
		analyticType: inferAnalyticType(field.field_type),
	}));
}

export function buildWalkerFieldsFromPrep(columns: PrepColumn[]): IMutField[] {
	return columns.map(column => {
		const valueHint = column.calculated ? 'number' : column.field_type;
		return {
			fid: column.key,
			name: walkerDisplayName(column.label, column.key),
			semanticType: inferSemanticType(valueHint),
			analyticType: inferAnalyticType(valueHint),
		};
	});
}

export function buildWalkerRows(
	_source: AnalyticsSource,
	rows: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
	return rows.map(row => {
		const next: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(row)) {
			const parsed = parseJsonish(value);
			const imageUrl = extractImageUrl(parsed);
			if (imageUrl) {
				next[key] = imageUrl;
				continue;
			}
			const gps = extractGps(parsed);
			if (gps) {
				next[key] = `${gps.lat},${gps.lng}`;
				continue;
			}
			next[key] = parsed;
		}
		return next;
	});
}
