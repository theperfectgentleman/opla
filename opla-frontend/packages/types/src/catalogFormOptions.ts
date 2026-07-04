import type { CatalogRuntimeEntry, FieldOption, FormField } from './index';

function normalizeCompare(value: unknown): string {
    return String(value ?? '').trim().toLowerCase();
}

function readCatalogCell(
    entry: CatalogRuntimeEntry,
    columnBind: string,
    defaultValueField?: string,
    defaultLabelField?: string,
): string {
    const data = entry.data || {};
    if (columnBind === defaultValueField) {
        const fromData = data[columnBind];
        if (fromData !== undefined && fromData !== null && String(fromData).trim() !== '') {
            return String(fromData).trim();
        }
        return String(entry.value ?? '').trim();
    }
    if (columnBind === defaultLabelField) {
        const fromData = data[columnBind];
        if (fromData !== undefined && fromData !== null && String(fromData).trim() !== '') {
            return String(fromData).trim();
        }
        return String(entry.label ?? '').trim();
    }
    const raw = data[columnBind];
    return raw === undefined || raw === null ? '' : String(raw).trim();
}

export function resolveCatalogFormFieldOptions(
    field: FormField,
    responses: Record<string, unknown> = {},
): FieldOption[] {
    const entries = field.catalog_runtime_entries;
    if (!entries?.length) {
        return field.options || [];
    }

    const valueField = field.catalog_value_field || field.catalog_default_value_field || '';
    const displayField = field.catalog_display_field || field.catalog_default_label_field || '';
    if (!valueField || !displayField) {
        return field.options || [];
    }

    let rows = entries;

    if (field.cascade_parent_field_id && field.catalog_cascade_filter_column) {
        const parentValue = responses[field.cascade_parent_field_id];
        if (parentValue === undefined || parentValue === null || String(parentValue).trim() === '') {
            return [];
        }
        const parentNorm = normalizeCompare(parentValue);
        const filterColumn = field.catalog_cascade_filter_column;
        rows = rows.filter((entry) => {
            const cell = readCatalogCell(
                entry,
                filterColumn,
                field.catalog_default_value_field,
                field.catalog_default_label_field,
            );
            return normalizeCompare(cell) === parentNorm;
        });
    }

    let options: FieldOption[] = rows
        .map((entry) => ({
            label: readCatalogCell(entry, displayField, field.catalog_default_value_field, field.catalog_default_label_field),
            value: readCatalogCell(entry, valueField, field.catalog_default_value_field, field.catalog_default_label_field),
        }))
        .filter((option) => option.label && option.value);

    if (field.catalog_unique_values) {
        const seen = new Set<string>();
        options = options.filter((option) => {
            if (seen.has(option.value)) {
                return false;
            }
            seen.add(option.value);
            return true;
        });
    }

    return options.sort((a, b) => a.label.localeCompare(b.label));
}

export function fieldUsesCatalogOptionResolver(field: FormField): boolean {
    return field.options_source === 'catalog_form' && Boolean(field.catalog_runtime_entries?.length);
}
