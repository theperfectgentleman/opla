import type { DirectoryRuntimeEntry, FieldOption, FormField } from './index';

export type FieldIdentityRef = {
    id?: string;
    bind?: string;
};

function normalizeCompare(value: unknown): string {
    return String(value ?? '').trim().toLowerCase();
}

/** Parent / param lookups must treat numeric 0 as a real answer. */
export function hasParentValue(value: unknown): boolean {
    if (value === undefined || value === null) {
        return false;
    }
    if (typeof value === 'string' && value.trim() === '') {
        return false;
    }
    return true;
}

/**
 * Read a response when Studio stored the parent as `id` but the player keys
 * by `bind` (or the reverse). Direct key wins; then the sibling identity.
 */
export function lookupResponse(
    responses: Record<string, unknown> = {},
    fieldRef: string | undefined | null,
    fields: FieldIdentityRef[] = [],
): unknown {
    if (fieldRef == null || String(fieldRef).trim() === '') {
        return undefined;
    }
    if (Object.prototype.hasOwnProperty.call(responses, fieldRef)) {
        return responses[fieldRef];
    }
    const field = fields.find((entry) => entry.id === fieldRef || entry.bind === fieldRef);
    if (!field) {
        return undefined;
    }
    for (const key of [field.bind, field.id]) {
        if (key && Object.prototype.hasOwnProperty.call(responses, key)) {
            return responses[key];
        }
    }
    return undefined;
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
    fields: FieldIdentityRef[] = [],
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
        const parentValue = lookupResponse(responses, field.cascade_parent_field_id, fields);
        if (!hasParentValue(parentValue)) {
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

/**
 * Resolve the options a choice widget should show: directory rows, static
 * cascade maps, or the field's authored options. Shared by mobile, Studio
 * Simulator, and PublicForm so cascading/directory selects cannot diverge.
 */
export function resolveFieldOptions(
    field: FormField,
    responses: Record<string, unknown> = {},
    fields: FieldIdentityRef[] = [],
): FieldOption[] {
    if (fieldUsesDirectoryOptionResolver(field)) {
        return resolveDirectoryFormFieldOptions(field, responses, fields);
    }
    if (field.cascade_parent_field_id && field.cascade_options_map) {
        const parentValue = lookupResponse(responses, field.cascade_parent_field_id, fields);
        if (hasParentValue(parentValue)) {
            const mapped = field.cascade_options_map[String(parentValue)];
            if (mapped) {
                return mapped;
            }
        }
        return [];
    }
    return field.options || [];
}
