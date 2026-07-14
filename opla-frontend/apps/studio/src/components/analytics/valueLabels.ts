import { parseJsonish } from './prepCellFormat';

export type DisplayMode = 'value' | 'label';

export type FieldChoiceOption = {
	label: string;
	value: string;
};

export type FieldWithOptions = {
	field_key?: string;
	key?: string;
	options?: FieldChoiceOption[] | null;
};

/** value → label map per field key */
export type ValueLabelMaps = Map<string, Map<string, string>>;

export function buildValueLabelMaps(fields: FieldWithOptions[]): ValueLabelMaps {
	const maps: ValueLabelMaps = new Map();

	for (const field of fields) {
		const key = field.field_key || field.key;
		const options = field.options;
		if (!key || !options?.length) continue;

		const valueToLabel = new Map<string, string>();
		for (const option of options) {
			if (option == null || option.value == null) continue;
			valueToLabel.set(String(option.value), String(option.label ?? option.value));
		}
		if (valueToLabel.size > 0) {
			maps.set(key, valueToLabel);
		}
	}

	return maps;
}

function mapSingle(raw: unknown, valueToLabel: Map<string, string>): unknown {
	if (raw == null) return raw;
	if (typeof raw === 'boolean' || typeof raw === 'number') {
		const asString = String(raw);
		return valueToLabel.get(asString) ?? raw;
	}
	if (typeof raw === 'string') {
		return valueToLabel.get(raw) ?? raw;
	}
	return raw;
}

/** Resolve a cell/value for display. Keeps unknown codes as-is. */
export function resolveDisplayValue(
	raw: unknown,
	valueToLabel: Map<string, string> | undefined,
	mode: DisplayMode,
): unknown {
	if (mode === 'value' || !valueToLabel || valueToLabel.size === 0) {
		return raw;
	}

	const parsed = parseJsonish(raw);

	if (Array.isArray(parsed)) {
		return parsed.map(item => mapSingle(item, valueToLabel));
	}

	return mapSingle(parsed, valueToLabel);
}

export function remapRowForDisplay(
	row: Record<string, unknown>,
	maps: ValueLabelMaps,
	mode: DisplayMode,
): Record<string, unknown> {
	if (mode === 'value' || maps.size === 0) return row;

	const next: Record<string, unknown> = { ...row };
	for (const [key, valueToLabel] of maps.entries()) {
		if (!(key in next)) continue;
		next[key] = resolveDisplayValue(next[key], valueToLabel, mode);
	}
	return next;
}

export function remapRowsForDisplay(
	rows: Array<Record<string, unknown>>,
	maps: ValueLabelMaps,
	mode: DisplayMode,
): Array<Record<string, unknown>> {
	if (mode === 'value' || maps.size === 0) return rows;
	return rows.map(row => remapRowForDisplay(row, maps, mode));
}

export function formatResolvedDisplay(value: unknown): string {
	if (value == null || value === '') return '';
	if (Array.isArray(value)) return value.map(item => String(item ?? '')).filter(Boolean).join(', ');
	if (typeof value === 'boolean') return value ? 'True' : 'False';
	return String(value);
}
