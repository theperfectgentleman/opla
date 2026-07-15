import type { DirectoryField } from './directoryUtils';
import { createEmptyRowData, slugifyDirectoryKey } from './directoryUtils';
import { parseTabularPaste } from './parseTabularData';

export type DirectoryColumnMapping = Record<string, string>;

export type DirectoryFieldGeneratorType = 'slug_from_label' | 'auto_id';

/** Maps directory field bind → generator when the field is not filled from a CSV column. */
export type DirectoryOrphanGenerators = Record<string, DirectoryFieldGeneratorType>;

export const GEN_SLUG_PREFIX = '__gen:slug:';
export const GEN_AUTO_ID_PREFIX = '__gen:auto_id:';

export type DirectoryImportRow = {
    id: string;
    sourceIndex: number;
    raw: Record<string, string>;
    data: Record<string, string>;
    errors: string[];
    status: 'pending' | 'saving' | 'saved' | 'failed' | 'skipped';
    saveError?: string;
    generatorOverrides?: Set<string>;
};

export type DirectoryImportGeneratorConfig = {
    columnMapping: DirectoryColumnMapping;
    orphanGenerators: DirectoryOrphanGenerators;
};

export function encodeGeneratorMapping(type: DirectoryFieldGeneratorType, targetBind: string): string {
    return type === 'slug_from_label' ? `${GEN_SLUG_PREFIX}${targetBind}` : `${GEN_AUTO_ID_PREFIX}${targetBind}`;
}

export function decodeMappingValue(
    value: string,
): { kind: 'skip' } | { kind: 'field'; bind: string } | { kind: 'generator'; type: DirectoryFieldGeneratorType; bind: string } {
    if (!value) {
        return { kind: 'skip' };
    }
    if (value.startsWith(GEN_SLUG_PREFIX)) {
        return { kind: 'generator', type: 'slug_from_label', bind: value.slice(GEN_SLUG_PREFIX.length) };
    }
    if (value.startsWith(GEN_AUTO_ID_PREFIX)) {
        return { kind: 'generator', type: 'auto_id', bind: value.slice(GEN_AUTO_ID_PREFIX.length) };
    }
    return { kind: 'field', bind: value };
}

export function isGeneratorMappingValue(value: string): boolean {
    return value.startsWith(GEN_SLUG_PREFIX) || value.startsWith(GEN_AUTO_ID_PREFIX);
}

export function extractGeneratorTargets(
    columnMapping: DirectoryColumnMapping,
    orphanGenerators: DirectoryOrphanGenerators = {},
): Map<string, DirectoryFieldGeneratorType> {
    const targets = new Map<string, DirectoryFieldGeneratorType>();
    Object.values(columnMapping).forEach((value) => {
        const decoded = decodeMappingValue(value);
        if (decoded.kind === 'generator') {
            targets.set(decoded.bind, decoded.type);
        }
    });
    Object.entries(orphanGenerators).forEach(([bind, type]) => {
        if (bind && type) {
            targets.set(bind, type);
        }
    });
    return targets;
}

export function getDirectlyMappedFieldBinds(columnMapping: DirectoryColumnMapping): Set<string> {
    const binds = new Set<string>();
    Object.values(columnMapping).forEach((value) => {
        const decoded = decodeMappingValue(value);
        if (decoded.kind === 'field') {
            binds.add(decoded.bind);
        }
    });
    return binds;
}

export function generateImportAutoId(rowIndex: number, prefix = 'item'): string {
    return `${prefix}_${String(rowIndex + 1).padStart(4, '0')}`;
}

function normalizeToken(value: string): string {
    return value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
}

function scoreHeaderToField(
    csvHeader: string,
    field: DirectoryField,
    keyFieldId?: string | null,
    labelFieldId?: string | null,
): number {
    const header = normalizeToken(csvHeader);
    const label = normalizeToken(field.label || '');
    const bind = normalizeToken(String(field.bind || ''));

    if (!header) {
        return 0;
    }
    if (header === label || header === bind) {
        return 100;
    }

    const bindStr = String(field.bind || '');
    if (bindStr === keyFieldId) {
        if (['sku', 'key', 'id', 'code', 'product_id', 'product_code', 'item_id'].includes(header)) {
            return 95;
        }
        if (header.includes('sku') || header.endsWith('_id') || header.endsWith('_code')) {
            return 80;
        }
    }

    if (bindStr === labelFieldId) {
        if (['product', 'label', 'name', 'title', 'description', 'item', 'item_name', 'product_name'].includes(header)) {
            return 95;
        }
        if (header.includes('product') || header.includes('name') || header.includes('label')) {
            return 75;
        }
    }

    if (label && (header.includes(label) || label.includes(header))) {
        return 65;
    }
    if (bind && (header.includes(bind) || bind.includes(header))) {
        return 60;
    }

    const headerWords = header.split('_').filter(Boolean);
    const labelWords = label.split('_').filter(Boolean);
    const shared = headerWords.filter((word) => labelWords.includes(word)).length;
    if (shared > 0) {
        return 40 + shared * 10;
    }

    return 0;
}

export function autoMatchDirectoryColumns(
    csvHeaders: string[],
    fields: DirectoryField[],
    keyFieldId?: string | null,
    labelFieldId?: string | null,
): DirectoryColumnMapping {
    const mapping: DirectoryColumnMapping = {};
    const usedFields = new Set<string>();

    const candidates: Array<{ header: string; bind: string; score: number }> = [];
    csvHeaders.forEach((header) => {
        fields.forEach((field) => {
            const bind = String(field.bind || '');
            if (!bind) {
                return;
            }
            const score = scoreHeaderToField(header, field, keyFieldId, labelFieldId);
            if (score >= 40) {
                candidates.push({ header, bind, score });
            }
        });
    });

    candidates.sort((a, b) => b.score - a.score);
    candidates.forEach(({ header, bind, score }) => {
        if (mapping[header] || usedFields.has(bind)) {
            return;
        }
        if (score >= 40) {
            mapping[header] = bind;
            usedFields.add(bind);
        }
    });

    csvHeaders.forEach((header) => {
        if (!mapping[header]) {
            mapping[header] = '';
        }
    });

    return mapping;
}

export function applyDirectoryColumnMapping(
    rawRow: Record<string, string>,
    mapping: DirectoryColumnMapping,
    fields: DirectoryField[],
    rowIndex = 0,
    orphanGenerators: DirectoryOrphanGenerators = {},
    labelFieldId?: string | null,
    overrides?: Set<string>,
): Record<string, string> {
    const data = createEmptyRowData(fields);
    Object.entries(mapping).forEach(([csvHeader, value]) => {
        const decoded = decodeMappingValue(value);
        if (decoded.kind === 'field') {
            data[decoded.bind] = String(rawRow[csvHeader] ?? '').trim();
        }
    });

    const generators = extractGeneratorTargets(mapping, orphanGenerators);
    generators.forEach((type, bind) => {
        if (overrides?.has(bind)) {
            return;
        }
        if (type === 'slug_from_label' && labelFieldId) {
            data[bind] = slugifyDirectoryKey(data[labelFieldId]);
        } else if (type === 'auto_id') {
            data[bind] = generateImportAutoId(rowIndex);
        }
    });

    return data;
}

export function validateDirectoryImportRow(
    data: Record<string, string>,
    fields: DirectoryField[],
    keyFieldId?: string | null,
    labelFieldId?: string | null,
): string[] {
    const errors: string[] = [];

    if (keyFieldId && !data[keyFieldId]?.trim()) {
        errors.push('Key is required');
    }
    if (labelFieldId && !data[labelFieldId]?.trim()) {
        errors.push('Label is required');
    }

    fields.forEach((field) => {
        const bind = String(field.bind || '');
        if (!field.required || bind === keyFieldId || bind === labelFieldId) {
            return;
        }
        if (!data[bind]?.trim()) {
            errors.push(`${field.label || bind} is required`);
        }
    });

    return errors;
}

export function buildDirectoryImportRows(
    parsedRows: Array<Record<string, string>>,
    mapping: DirectoryColumnMapping,
    fields: DirectoryField[],
    keyFieldId?: string | null,
    labelFieldId?: string | null,
    orphanGenerators: DirectoryOrphanGenerators = {},
): DirectoryImportRow[] {
    return parsedRows.map((raw, index) => {
        const data = applyDirectoryColumnMapping(raw, mapping, fields, index, orphanGenerators, labelFieldId);
        const errors = validateDirectoryImportRow(data, fields, keyFieldId, labelFieldId);
        return {
            id: `import_${index}`,
            sourceIndex: index + 1,
            raw,
            data,
            errors,
            status: 'pending' as const,
            generatorOverrides: new Set<string>(),
        };
    });
}

export function reapplyRowGenerators(
    row: DirectoryImportRow,
    mapping: DirectoryColumnMapping,
    fields: DirectoryField[],
    keyFieldId?: string | null,
    labelFieldId?: string | null,
    orphanGenerators: DirectoryOrphanGenerators = {},
): DirectoryImportRow {
    const data = applyDirectoryColumnMapping(
        row.raw,
        mapping,
        fields,
        row.sourceIndex - 1,
        orphanGenerators,
        labelFieldId,
        row.generatorOverrides,
    );
    // Preserve manual edits for overridden binds
    row.generatorOverrides?.forEach((bind) => {
        if (row.data[bind] !== undefined) {
            data[bind] = row.data[bind];
        }
    });
    const errors = validateDirectoryImportRow(data, fields, keyFieldId, labelFieldId);
    return { ...row, data, errors };
}

export function parseDirectoryPaste(
    pasteText: string,
    fields: DirectoryField[],
    keyFieldId?: string | null,
    labelFieldId?: string | null,
    existingMapping?: DirectoryColumnMapping,
    existingOrphanGenerators?: DirectoryOrphanGenerators,
) {
    const parsed = parseTabularPaste(pasteText);
    if (parsed.error) {
        return {
            parsed,
            mapping: {} as DirectoryColumnMapping,
            orphanGenerators: {} as DirectoryOrphanGenerators,
            rows: [] as DirectoryImportRow[],
            error: parsed.error,
        };
    }
    if (parsed.headers.length === 0) {
        return {
            parsed,
            mapping: {} as DirectoryColumnMapping,
            orphanGenerators: {} as DirectoryOrphanGenerators,
            rows: [] as DirectoryImportRow[],
            error: 'No columns found in pasted data.',
        };
    }

    const autoMapping = autoMatchDirectoryColumns(parsed.headers, fields, keyFieldId, labelFieldId);
    const mapping = existingMapping && Object.keys(existingMapping).length > 0
        ? { ...autoMapping, ...existingMapping }
        : autoMapping;

    let orphanGenerators: DirectoryOrphanGenerators = existingOrphanGenerators || {};
    if (!existingOrphanGenerators && keyFieldId && labelFieldId) {
        const directBinds = getDirectlyMappedFieldBinds(mapping);
        const generatorTargets = extractGeneratorTargets(mapping, orphanGenerators);
        if (!directBinds.has(keyFieldId) && !generatorTargets.has(keyFieldId) && directBinds.has(labelFieldId)) {
            orphanGenerators = { ...orphanGenerators, [keyFieldId]: 'slug_from_label' };
        }
    }

    const rows = buildDirectoryImportRows(
        parsed.rows,
        mapping,
        fields,
        keyFieldId,
        labelFieldId,
        orphanGenerators,
    );
    return { parsed, mapping, orphanGenerators, rows, error: undefined as string | undefined };
}
