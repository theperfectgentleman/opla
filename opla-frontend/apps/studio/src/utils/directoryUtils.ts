export type DirectoryField = {
    bind?: string;
    type?: string;
    label?: string;
    placeholder?: string;
    required?: boolean;
    options?: Array<{ label: string; value: string }>;
};

export type DirectoryBlueprintSource = {
    status?: string;
    blueprint_live?: { ui?: Array<{ children?: Array<Record<string, unknown>> }> } | null;
    blueprint_draft?: { ui?: Array<{ children?: Array<Record<string, unknown>> }> } | null;
};

const DIRECTORY_ENTRY_EXCLUDED_TYPES = new Set([
    'gps_capture',
    'photo_capture',
    'file_upload',
    'signature_pad',
    'audio_recorder',
    'object_collection',
    'object_instance',
    'form_link',
]);

export function extractBlueprintFields(blueprint?: DirectoryBlueprintSource['blueprint_live']) {
    const uiFields: DirectoryField[] = [];
    blueprint?.ui?.forEach((screen) => {
        screen.children?.forEach((field) => {
            const fieldType = String(field.type || '');
            if (DIRECTORY_ENTRY_EXCLUDED_TYPES.has(fieldType)) {
                return;
            }
            uiFields.push(field as DirectoryField);
        });
    });
    return uiFields;
}

export function getDirectoryBlueprintFields(formDetail: DirectoryBlueprintSource) {
    if (formDetail.status === 'live' && formDetail.blueprint_live) {
        return extractBlueprintFields(formDetail.blueprint_live);
    }
    return extractBlueprintFields(formDetail.blueprint_draft || formDetail.blueprint_live);
}

export function countUnpublishedDirectoryFields(formDetail: DirectoryBlueprintSource) {
    if (formDetail.status !== 'live' || !formDetail.blueprint_draft || !formDetail.blueprint_live) {
        return 0;
    }
    const liveBinds = new Set(extractBlueprintFields(formDetail.blueprint_live).map((f) => String(f.bind)));
    return extractBlueprintFields(formDetail.blueprint_draft).filter((f) => !liveBinds.has(String(f.bind))).length;
}

export function normalizeDirectoryEntry(entry: Record<string, any>) {
    return {
        ...entry,
        id: entry.submission_id || entry.id,
    };
}

export function slugifyDirectoryKey(label: string | null | undefined): string {
    return String(label ?? '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
}

export function getDirectoryFieldDisplayValue(field: DirectoryField, rawValue: unknown): string {
    if (rawValue === null || rawValue === undefined || rawValue === '') {
        return '';
    }
    if (field.type === 'dropdown' || field.type === 'radio_group') {
        const options = field.options || [];
        const match = options.find((opt) => opt.value === rawValue);
        return match?.label || String(rawValue);
    }
    if (field.type === 'toggle') {
        return rawValue === true || rawValue === 'true' ? 'Yes' : 'No';
    }
    return String(rawValue);
}

export function buildColumnSuggestions(
    rows: Array<Record<string, string>>,
    bind: string,
    field?: DirectoryField,
): string[] {
    const values = new Set<string>();

    rows.forEach((row) => {
        const raw = row[bind];
        const trimmed = raw === undefined || raw === null ? '' : String(raw).trim();
        if (trimmed) {
            values.add(trimmed);
        }
    });

    (field?.options || []).forEach((opt) => {
        if (opt.label?.trim()) {
            values.add(opt.label.trim());
        }
        if (opt.value?.trim()) {
            values.add(opt.value.trim());
        }
    });

    return Array.from(values).sort((a, b) => a.localeCompare(b));
}

export function createEmptyRowData(fields: DirectoryField[]): Record<string, string> {
    const data: Record<string, string> = {};
    fields.forEach((field) => {
        data[String(field.bind)] = '';
    });
    return data;
}

export function entryToRowData(entry: Record<string, any>, fields: DirectoryField[]): Record<string, string> {
    const data = createEmptyRowData(fields);
    const source = entry.data || {};
    fields.forEach((field) => {
        const bind = String(field.bind);
        const raw = source[bind];
        if (raw === undefined || raw === null) {
            return;
        }
        if (field.type === 'toggle') {
            data[bind] = raw === true || raw === 'true' ? 'true' : raw === false || raw === 'false' ? 'false' : '';
            return;
        }
        data[bind] = String(raw);
    });
    return data;
}
