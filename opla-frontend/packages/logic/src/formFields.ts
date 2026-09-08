/**
 * Shared form-field identity, defaults, masking, and constraint validation.
 * Used by the Expo FormRenderer (and tests). Keep this file free of React Native
 * so it can run under Node.
 */

export type FieldIdentity = {
    id?: string;
    bind?: string;
};

export type FieldLike = FieldIdentity & {
    type?: string;
    required?: boolean;
    formula?: string;
    platforms?: string[];
    min?: number | string;
    max?: number | string;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    default_value?: unknown;
    mask?: string;
    has_no_min?: boolean;
    has_no_max?: boolean;
    range_type?: string;
    step_value?: string;
    step_unit?: string;
};

export const MOBILE_FIELD_TYPES = [
    'input_text',
    'input_number',
    'email_input',
    'phone_input',
    'date_picker',
    'time_picker',
    'time_range',
    'generic_range',
    'dropdown',
    'radio_group',
    'checkbox_group',
    'multi_select_dropdown',
    'toggle',
    'textarea',
    'gps_capture',
    'photo_capture',
    'file_upload',
    'signature_pad',
    'barcode_scanner',
    'audio_recorder',
    'matrix_table',
    'lookup_list',
    'rating_scale',
    'object_instance',
    'object_collection',
    'form_link',
] as const;

export type MobileFieldType = (typeof MOBILE_FIELD_TYPES)[number];

/** Canonical response / rules key: published blueprints use `bind`, drafts may only have `id`. */
export function getFieldKey(field: FieldIdentity | null | undefined): string {
    if (!field) {
        return '';
    }
    const bind = typeof field.bind === 'string' ? field.bind.trim() : '';
    const id = typeof field.id === 'string' ? field.id.trim() : '';
    return bind || id;
}

/** Fill missing id/bind so widgets and rules can use either property. */
export function ensureFieldIdentity<T extends FieldIdentity>(field: T): T & { id: string; bind: string } {
    const key = getFieldKey(field);
    return {
        ...field,
        id: (typeof field.id === 'string' && field.id.trim()) || key,
        bind: (typeof field.bind === 'string' && field.bind.trim()) || key,
    };
}

export function isOnPlatform(fieldOrSection: { platforms?: string[] } | null | undefined, platform: string): boolean {
    const platforms = fieldOrSection?.platforms;
    if (!platforms || platforms.length === 0) {
        return true;
    }
    return platforms.includes(platform);
}

export function parseFieldDefault(field: FieldLike): unknown {
    const raw = field.default_value;
    if (raw === undefined || raw === null || raw === '') {
        return undefined;
    }

    if (field.type === 'toggle') {
        if (raw === true || raw === 'true') {
            return true;
        }
        if (raw === false || raw === 'false') {
            return false;
        }
        return undefined;
    }

    if (field.type === 'checkbox_group' || field.type === 'multi_select_dropdown') {
        if (Array.isArray(raw)) {
            return raw.map(String);
        }
        if (typeof raw === 'string') {
            try {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                    return parsed.map(String);
                }
            } catch {
                /* treat as a single value */
            }
            return [raw];
        }
        return [String(raw)];
    }

    if (field.type === 'input_number' || field.type === 'rating_scale') {
        if (typeof raw === 'number') {
            return raw;
        }
        const asString = String(raw);
        const numeric = Number(asString);
        return Number.isFinite(numeric) && asString.trim() !== '' ? asString : raw;
    }

    return raw;
}

export function collectFieldDefaults(
    fields: FieldLike[],
    existing: Record<string, unknown> = {},
): Record<string, unknown> {
    const next: Record<string, unknown> = {};
    for (const field of fields) {
        const key = getFieldKey(field);
        if (!key) {
            continue;
        }
        if (existing[key] !== undefined && existing[key] !== null && existing[key] !== '') {
            continue;
        }
        const parsed = parseFieldDefault(field);
        if (parsed !== undefined) {
            next[key] = parsed;
        }
    }
    return next;
}

/**
 * Apply a Studio input mask (`9` digit, `A`/`a` letter, `*` any, other chars literal).
 * Same algorithm as the Studio Simulator.
 */
export function applyInputMask(value: string, mask: string): string {
    if (!mask) {
        return value;
    }
    const rawValue = value.replace(/[^a-zA-Z0-9]/g, '');
    let formattedValue = '';
    let rawIndex = 0;

    for (let i = 0; i < mask.length; i++) {
        if (rawIndex >= rawValue.length) {
            break;
        }

        const maskChar = mask[i];
        const char = rawValue[rawIndex];

        if (maskChar === '9') {
            if (/[0-9]/.test(char)) {
                formattedValue += char;
                rawIndex++;
            } else {
                break;
            }
        } else if (maskChar === 'A') {
            if (/[a-zA-Z]/.test(char)) {
                formattedValue += char.toUpperCase();
                rawIndex++;
            } else {
                break;
            }
        } else if (maskChar === 'a') {
            if (/[a-zA-Z]/.test(char)) {
                formattedValue += char.toLowerCase();
                rawIndex++;
            } else {
                break;
            }
        } else if (maskChar === '*') {
            formattedValue += char;
            rawIndex++;
        } else {
            formattedValue += maskChar;
            if (/[a-zA-Z0-9]/.test(maskChar) && char.toLowerCase() === maskChar.toLowerCase()) {
                rawIndex++;
            }
        }
    }

    return formattedValue;
}

export function formatLocalDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/** Parse a YYYY-MM-DD (or datetime) string as a local calendar date, not UTC midnight. */
export function parseLocalDate(value?: string | null): Date {
    if (!value) {
        return new Date();
    }
    const datePart = value.split(/[T ]/)[0];
    const [y, m, d] = datePart.split('-').map(Number);
    if (y && m && d) {
        const next = new Date(y, m - 1, d);
        if (!Number.isNaN(next.getTime())) {
            return next;
        }
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

export function resolveAutoValue(autoValue: string, now: Date = new Date()): string | undefined {
    switch (autoValue) {
        case 'now()':
            return now.toISOString();
        case 'today()':
            return formatLocalDate(now);
        case 'current_time()': {
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            return `${hours}:${minutes}`;
        }
        default:
            return undefined;
    }
}

export function hasMeaningfulValue(value: unknown): boolean {
    if (Array.isArray(value)) {
        return value.length > 0;
    }
    if (value && typeof value === 'object') {
        return Object.values(value as Record<string, unknown>).some((entry) => hasMeaningfulValue(entry));
    }
    return value !== undefined && value !== null && value !== '';
}

function asNumber(value: unknown): number | undefined {
    if (value === undefined || value === null || value === '') {
        return undefined;
    }
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : undefined;
}

function compareBound(value: unknown, bound: number | string, op: 'min' | 'max'): boolean {
    if (typeof bound === 'number' || (typeof bound === 'string' && bound !== '' && !Number.isNaN(Number(bound)) && !/^\d{4}-\d{2}-\d{2}/.test(String(bound)))) {
        const numeric = asNumber(value);
        const boundNum = asNumber(bound);
        if (numeric === undefined || boundNum === undefined) {
            return true;
        }
        return op === 'min' ? numeric >= boundNum : numeric <= boundNum;
    }
    const left = String(value);
    const right = String(bound);
    if (!left || !right) {
        return true;
    }
    return op === 'min' ? left >= right : left <= right;
}

export function validateFieldConstraints(field: FieldLike, value: unknown): string | undefined {
    if (field.formula) {
        return undefined;
    }

    if (field.type === 'time_range') {
        const range = (value && typeof value === 'object') ? value as { open?: string; close?: string } : {};
        const openFilled = Boolean(range.open);
        const closeFilled = Boolean(range.close);
        if (field.required && (!openFilled || !closeFilled)) {
            return 'Both open and close times are required';
        }
        return undefined;
    }

    if (field.type === 'generic_range') {
        const rangeVal = value as { start_value?: unknown; end_value?: unknown } | undefined;
        const startFilled = rangeVal?.start_value !== undefined && rangeVal?.start_value !== null && rangeVal?.start_value !== '';
        const endFilled = rangeVal?.end_value !== undefined && rangeVal?.end_value !== null && rangeVal?.end_value !== '';
        if (field.required) {
            if (field.has_no_min && !endFilled) {
                return 'End boundary value is required';
            }
            if (field.has_no_max && !startFilled) {
                return 'Start boundary value is required';
            }
            if (!field.has_no_min && !field.has_no_max && (!startFilled || !endFilled)) {
                return 'Both start and end values are required';
            }
        }
        if (field.step_value) {
            const stepNum = parseFloat(field.step_value);
            if (!Number.isNaN(stepNum) && stepNum > 0) {
                if (field.range_type === 'NUMBER' || field.range_type === 'INTEGER' || field.range_type === 'INDEX') {
                    const check = (raw: unknown, label: string): string | undefined => {
                        const num = parseFloat(String(raw));
                        if (Number.isNaN(num)) {
                            return undefined;
                        }
                        const remainder = Math.abs(num % stepNum);
                        const tolerance = 0.00001;
                        const isDivisible = remainder < tolerance || Math.abs(remainder - stepNum) < tolerance;
                        if (!isDivisible) {
                            return `${label} must be a multiple of ${field.step_value}`;
                        }
                        return undefined;
                    };
                    if (startFilled) {
                        const err = check(rangeVal?.start_value, 'Start value');
                        if (err) return err;
                    }
                    if (endFilled) {
                        const err = check(rangeVal?.end_value, 'End value');
                        if (err) return err;
                    }
                } else if (field.range_type === 'TIME') {
                    const checkTimeValue = (val: string) => {
                        const parts = val.split(':');
                        if (parts.length >= 2) {
                            const hrs = parseInt(parts[0], 10);
                            const mins = parseInt(parts[1], 10);
                            if (!Number.isNaN(hrs) && !Number.isNaN(mins)) {
                                const totalMins = hrs * 60 + mins;
                                const stepMins = field.step_unit === 'HOUR' ? stepNum * 60 : stepNum;
                                return totalMins % stepMins === 0;
                            }
                        }
                        return true;
                    };
                    if (startFilled && !checkTimeValue(String(rangeVal?.start_value))) {
                        const unitName = field.step_unit === 'HOUR' ? 'hour(s)' : 'minute(s)';
                        return `Start time must be in increments of ${field.step_value} ${unitName}`;
                    }
                    if (endFilled && !checkTimeValue(String(rangeVal?.end_value))) {
                        const unitName = field.step_unit === 'HOUR' ? 'hour(s)' : 'minute(s)';
                        return `End time must be in increments of ${field.step_value} ${unitName}`;
                    }
                }
            }
        }
        return undefined;
    }

    if (!field.required && (field.type !== 'object_collection' && field.type !== 'object_instance')) {
        if (!hasMeaningfulValue(value)) {
            return undefined;
        }
    }

    if (field.required && !hasMeaningfulValue(value)) {
        return 'This field is required';
    }

    if (value !== undefined && value !== null && value !== '') {
        if (field.type === 'phone_input') {
            const phoneStr = String(value).replace(/[\s\-().]/g, '');
            if (!/^\+?\d{7,15}$/.test(phoneStr)) {
                return 'Please enter a valid phone number';
            }
        }

        if (field.type === 'email_input') {
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value))) {
                return 'Please enter a valid email address';
            }
        }

        if (field.minLength !== undefined && field.minLength !== null && String(value).length < Number(field.minLength)) {
            return `Must be at least ${field.minLength} characters`;
        }

        if (field.maxLength !== undefined && field.maxLength !== null && String(value).length > Number(field.maxLength)) {
            return `Must be at most ${field.maxLength} characters`;
        }

        if (field.min !== undefined && field.min !== null && field.min !== '') {
            if (!compareBound(value, field.min, 'min')) {
                return `Must be at least ${field.min}`;
            }
        }

        if (field.max !== undefined && field.max !== null && field.max !== '') {
            if (!compareBound(value, field.max, 'max')) {
                return `Must be at most ${field.max}`;
            }
        }

        if (field.pattern) {
            try {
                if (!new RegExp(field.pattern).test(String(value))) {
                    return 'Input does not match the required format';
                }
            } catch {
                /* skip invalid regex */
            }
        }
    }

    return undefined;
}

export function displayInputValue(value: unknown): string {
    if (value === undefined || value === null) {
        return '';
    }
    return String(value);
}
