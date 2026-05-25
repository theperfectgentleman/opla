import type { IMutField, IAnalyticType, ISemanticType } from '@kanaries/graphic-walker';

import type { AnalyticsSource } from './types';

type WalkerRow = Record<string, unknown>;

function inferSemanticType(fieldType?: string | null): ISemanticType {
	const normalized = fieldType?.toLowerCase() ?? '';

	if (normalized.includes('date') || normalized.includes('time')) {
		return 'temporal';
	}

	if (normalized.includes('int') || normalized.includes('float') || normalized.includes('double') || normalized.includes('decimal') || normalized.includes('number')) {
		return 'quantitative';
	}

	if (normalized.includes('bool')) {
		return 'nominal';
	}

	return 'nominal';
}

function inferAnalyticType(fieldType?: string | null): IAnalyticType {
	const semanticType = inferSemanticType(fieldType);
	return semanticType === 'quantitative' ? 'measure' : 'dimension';
}

export function buildWalkerFields(source: AnalyticsSource): IMutField[] {
	const sourceFields = source.fields.map(field => ({
		fid: field.field_key,
		name: field.label || field.field_key,
		semanticType: inferSemanticType(field.field_type),
		analyticType: inferAnalyticType(field.field_type),
	} satisfies IMutField));

	return [
		...sourceFields,
		{
			fid: '_source_form_title',
			name: 'Source Form',
			semanticType: 'nominal',
			analyticType: 'dimension',
		},
		{
			fid: '_source_dataset_id',
			name: 'Source Dataset ID',
			semanticType: 'nominal',
			analyticType: 'dimension',
		},
		{
			fid: '_source_project_id',
			name: 'Source Project ID',
			semanticType: 'nominal',
			analyticType: 'dimension',
		},
	];
}

export function buildWalkerRows(source: AnalyticsSource, rows: Array<Record<string, unknown>>): WalkerRow[] {
	return rows.map(row => ({
		...row,
		_source_form_title: source.form_title,
		_source_dataset_id: source.dataset_id,
		_source_project_id: source.project_id ?? '',
	}));
}