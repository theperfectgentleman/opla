import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
    applyInputMask,
    collectFieldDefaults,
    displayInputValue,
    ensureFieldIdentity,
    formatLocalDate,
    getFieldKey,
    hasMeaningfulValue,
    isOnPlatform,
    MOBILE_FIELD_TYPES,
    parseFieldDefault,
    parseLocalDate,
    resolveAutoValue,
    validateFieldConstraints,
} from './formFields.ts';
import { resolveFieldOptions } from '../../types/src/directoryFormOptions.ts';

describe('mobile field identity', () => {
    it('prefers bind over id so published blueprints match Studio/Simulator keys', () => {
        assert.equal(getFieldKey({ id: 'field_1', bind: 'store_name' }), 'store_name');
        assert.equal(getFieldKey({ id: 'field_1' }), 'field_1');
        assert.equal(getFieldKey({ bind: 'sku' }), 'sku');
        assert.equal(getFieldKey({}), '');
    });

    it('fills missing id/bind without clobbering either', () => {
        const fromBind = ensureFieldIdentity({ bind: 'region' });
        assert.equal(fromBind.id, 'region');
        assert.equal(fromBind.bind, 'region');

        const fromId = ensureFieldIdentity({ id: 'field_9' });
        assert.equal(fromId.id, 'field_9');
        assert.equal(fromId.bind, 'field_9');
    });
});

describe('defaults', () => {
    it('parses toggle, checkbox, and multi-select defaults the way Simulator does', () => {
        assert.equal(parseFieldDefault({ type: 'toggle', default_value: 'true' }), true);
        assert.equal(parseFieldDefault({ type: 'toggle', default_value: 'false' }), false);
        assert.deepEqual(
            parseFieldDefault({ type: 'checkbox_group', default_value: '["a","b"]' }),
            ['a', 'b'],
        );
        assert.deepEqual(
            parseFieldDefault({ type: 'multi_select_dropdown', default_value: 'other' }),
            ['other'],
        );
        assert.equal(parseFieldDefault({ type: 'input_text', default_value: 'Accra' }), 'Accra');
        assert.equal(parseFieldDefault({ type: 'input_text' }), undefined);
    });

    it('does not overwrite existing responses when collecting defaults', () => {
        const fields = [
            { id: 'a', bind: 'a', type: 'input_text', default_value: 'one' },
            { id: 'b', bind: 'b', type: 'input_text', default_value: 'two' },
        ];
        const next = collectFieldDefaults(fields, { a: 'kept' });
        assert.deepEqual(next, { b: 'two' });
    });
});

describe('platforms', () => {
    it('treats missing platforms as visible on mobile', () => {
        assert.equal(isOnPlatform({}, 'mobile'), true);
        assert.equal(isOnPlatform({ platforms: [] }, 'mobile'), true);
        assert.equal(isOnPlatform({ platforms: ['mobile', 'web'] }, 'mobile'), true);
        assert.equal(isOnPlatform({ platforms: ['web'] }, 'mobile'), false);
    });
});

describe('mask and dates', () => {
    it('applies the Studio US phone mask', () => {
        assert.equal(applyInputMask('2025551234', '(999) 999-9999'), '(202) 555-1234');
        assert.equal(applyInputMask('202', '(999) 999-9999'), '(202');
    });

    it('formats local calendar dates instead of UTC ISO', () => {
        const local = new Date(2026, 8, 8, 0, 30, 0);
        assert.equal(formatLocalDate(local), '2026-09-08');
        assert.equal(resolveAutoValue('today()', local), '2026-09-08');
        assert.equal(resolveAutoValue('current_time()', local), '00:30');
        assert.equal(formatLocalDate(parseLocalDate('2026-09-08')), '2026-09-08');
    });
});

describe('constraint validation', () => {
    it('enforces min/max and minLength/maxLength from Studio field properties', () => {
        assert.equal(
            validateFieldConstraints({ type: 'input_number', min: 1, max: 10 }, 0),
            'Must be at least 1',
        );
        assert.equal(
            validateFieldConstraints({ type: 'input_number', min: 1, max: 10 }, 11),
            'Must be at most 10',
        );
        assert.equal(
            validateFieldConstraints({ type: 'input_text', minLength: 3 }, 'ab'),
            'Must be at least 3 characters',
        );
        assert.equal(
            validateFieldConstraints({ type: 'input_text', maxLength: 4 }, 'hello'),
            'Must be at most 4 characters',
        );
        assert.equal(validateFieldConstraints({ type: 'input_number', min: 1, max: 10 }, 5), undefined);
    });

    it('requires both ends of a time_range', () => {
        assert.equal(
            validateFieldConstraints({ type: 'time_range', required: true }, { open: '09:00' }),
            'Both open and close times are required',
        );
        assert.equal(
            validateFieldConstraints({ type: 'time_range', required: true }, { open: '09:00', close: '17:00' }),
            undefined,
        );
    });

    it('validates phone and email formats', () => {
        assert.equal(
            validateFieldConstraints({ type: 'phone_input' }, '123'),
            'Please enter a valid phone number',
        );
        assert.equal(validateFieldConstraints({ type: 'phone_input' }, '+233201234567'), undefined);
        assert.equal(
            validateFieldConstraints({ type: 'email_input' }, 'not-an-email'),
            'Please enter a valid email address',
        );
    });

    it('treats numeric zero as a real value', () => {
        assert.equal(hasMeaningfulValue(0), true);
        assert.equal(displayInputValue(0), '0');
        assert.equal(displayInputValue(null), '');
    });
});

describe('choice option resolution', () => {
    it('filters cascade_options_map from the parent response', () => {
        const field = {
            id: 'district',
            type: 'dropdown' as const,
            label: 'District',
            required: false,
            cascade_parent_field_id: 'region',
            cascade_options_map: {
                ashanti: [{ label: 'Kumasi', value: 'kumasi' }],
                greater_accra: [{ label: 'Accra', value: 'accra' }],
            },
        };
        assert.deepEqual(resolveFieldOptions(field, {}), []);
        assert.deepEqual(resolveFieldOptions(field, { region: 'ashanti' }), [
            { label: 'Kumasi', value: 'kumasi' },
        ]);
    });

    it('falls back to authored options when there is no cascade', () => {
        const field = {
            id: 'brand',
            type: 'checkbox_group' as const,
            label: 'Brand',
            required: false,
            options: [{ label: 'A', value: 'a' }, { label: 'B', value: 'b' }],
        };
        assert.deepEqual(resolveFieldOptions(field, {}), field.options);
    });
});

describe('mobile field-type coverage', () => {
    it('implements every canonical FieldType from @opla/types', () => {
        const canonical = [
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
        ];
        assert.deepEqual([...MOBILE_FIELD_TYPES].sort(), [...canonical].sort());
        assert.equal(MOBILE_FIELD_TYPES.length, 26);
    });
});
