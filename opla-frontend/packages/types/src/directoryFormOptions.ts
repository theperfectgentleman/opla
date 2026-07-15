import type { DirectoryRuntimeEntry, FieldOption, FormField } from './index';

function normalizeCompare(value: unknown): string {
    return String(value ?? '').trim().toLowerCase();
}

function readDirectoryCell(
    entry: DirectoryRuntimeEntry,
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

export function resolveDirectoryFormFieldOptions(
    field: FormField,
    responses: Record<string, unknown> = {},
): FieldOption[] {
    const entries = field.directory_runtime_entries;
    if (!entries?.length) {
        return field.options || [];
    }

    const valueField = field.directory_value_field || field.directory_default_value_field || '';
    const displayField = field.directory_display_field || field.directory_default_label_field || '';
    if (!valueField || !displayField) {
        return field.options || [];
    }

    let rows = entries;

    if (field.cascade_parent_field_id && field.directory_cascade_filter_column) {
        const parentValue = responses[field.cascade_parent_field_id];
        if (parentValue === undefined || parentValue === null || String(parentValue).trim() === '') {
            return [];
        }
        const parentNorm = normalizeCompare(parentValue);
        const filterColumn = field.directory_cascade_filter_column;
        rows = rows.filter((entry) => {
            const cell = readDirectoryCell(
                entry,
                filterColumn,
                field.directory_default_value_field,
                field.directory_default_label_field,
            );
            return normalizeCompare(cell) === parentNorm;
        });
    }

    let options: FieldOption[] = rows
        .map((entry) => ({
            label: readDirectoryCell(entry, displayField, field.directory_default_value_field, field.directory_default_label_field),
            value: readDirectoryCell(entry, valueField, field.directory_default_value_field, field.directory_default_label_field),
        }))
        .filter((option) => option.label && option.value);

    if (field.directory_unique_values) {
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

export function fieldUsesDirectoryOptionResolver(field: FormField): boolean {
    return field.options_source === 'directory_form' && Boolean(field.directory_runtime_entries?.length);
}
