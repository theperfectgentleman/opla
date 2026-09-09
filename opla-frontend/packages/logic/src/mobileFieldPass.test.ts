import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { FormField } from '../../types/src/index.ts';
import { lookupResponse, resolveFieldOptions } from '../../types/src/directoryFormOptions.ts';

import {
    applyOnLoadAutoValues,
    applyOnSubmitAutoValues,
    cellInputValue,
    effectiveInputMaxLength,
    isNavigationalField,
    normalizeDecimalValue,
    resolveAutoValueForField,
    resolveFormLinkParams,
    validateFieldConstraints,
} from './formFields.ts';
import { runMobileFieldPass } from './mobileFieldPass.ts';

function field(partial: Partial<FormField> & Pick<FormField, 'id' | 'type' | 'label'>): FormField {
    return {
        required: false,
        ...partial,
    } as FormField;
}

function marketActivationBlueprint() {
    return {
        ui: [
            {
                id: 'screen_visit',
                platforms: ['mobile', 'web'],
                children: [
                    field({
                        id: 'field_region',
                        bind: 'region',
                        type: 'dropdown',
                        label: 'Region',
                        required: true,
                        options: [
                            { label: 'Ashanti', value: 'ashanti' },
                            { label: 'Greater Accra', value: 'greater_accra' },
                        ],
                    }),
                    field({
                        id: 'field_district',
                        bind: 'district',
                        type: 'dropdown',
                        label: 'District',
                        required: true,
                        cascade_parent_field_id: 'field_region',
                        cascade_options_map: {
                            ashanti: [{ label: 'Kumasi', value: 'kumasi' }],
                            greater_accra: [{ label: 'Accra', value: 'accra' }],
                        },
                    }),
                    field({
                        id: 'field_outlet',
                        bind: 'outlet_type',
                        type: 'dropdown',
                        label: 'Outlet type',
                        options_source: 'directory_form',
                        directory_form_id: 'dir_outlets',
                        directory_value_field: 'code',
                        directory_display_field: 'name',
                        directory_cascade_filter_column: 'region',
                        cascade_parent_field_id: 'field_region',
                        directory_runtime_entries: [
                            { label: 'Kumasi Mart', value: 'km', data: { code: 'km', name: 'Kumasi Mart', region: 'ashanti' } },
                            { label: 'Accra Mart', value: 'am', data: { code: 'am', name: 'Accra Mart', region: 'greater_accra' } },
                        ],
                    }),
                    field({
                        id: 'field_skus',
                        bind: 'sku_categories',
                        type: 'multi_select_dropdown',
                        label: 'SKU categories',
                        default_value: '["beverage"]',
                        options: [
                            { label: 'Beverage', value: 'beverage' },
                            { label: 'Snack', value: 'snack' },
                        ],
                    }),
                    field({
                        id: 'field_phone',
                        bind: 'store_phone',
                        type: 'phone_input',
                        label: 'Store phone',
                        mask: '(999) 999-9999',
                        maxLength: 10,
                    }),
                    field({
                        id: 'field_amount',
                        bind: 'amount_paid',
                        type: 'input_number',
                        label: 'Amount paid',
                        decimal_places: 2,
                        input_prefix: 'GHS',
                        min: 0,
                        max: 9999.99,
                        default_value: '0',
                    }),
                    field({
                        id: 'field_paid_on',
                        bind: 'payment_date',
                        type: 'date_picker',
                        label: 'Payment date',
                        auto_value: 'now()',
                        auto_value_timing: 'on_load',
                        auto_value_editable: false,
                    }),
                    field({
                        id: 'field_submitted_at',
                        bind: 'submitted_at',
                        type: 'input_text',
                        label: 'Submitted at',
                        auto_value: 'now()',
                        auto_value_timing: 'on_submit',
                    }),
                    field({
                        id: 'field_hours',
                        bind: 'hours',
                        type: 'time_range',
                        label: 'Operating hours',
                        required: true,
                    }),
                    field({
                        id: 'field_lookup',
                        bind: 'country',
                        type: 'lookup_list',
                        label: 'Country',
                        lookup_source_type: 'preset',
                        lookup_preset_id: 'african_countries',
                    }),
                    field({
                        id: 'field_matrix',
                        bind: 'availability',
                        type: 'matrix_table',
                        label: 'Availability',
                        table_cell_type: 'dropdown',
                        table_rows: [{ id: 'sku_a', label: 'SKU A' }],
                        table_columns: [{ id: 'status', label: 'Status' }],
                        options: [
                            { label: 'In stock', value: 'in' },
                            { label: 'Out', value: 'out' },
                        ],
                    }),
                    field({
                        id: 'field_web_only',
                        bind: 'analyst_note',
                        type: 'textarea',
                        label: 'Web note',
                        platforms: ['web'],
                    }),
                    field({
                        id: 'field_launch',
                        bind: 'launch_stock_count',
                        type: 'form_link',
                        label: 'Open stock count',
                        required: true,
                        linked_form_id: 'child-form',
                        linked_form_slug: 'stock-count',
                        linked_form_param_map: {
                            field_region: 'region_param',
                        },
                    }),
                ],
            },
        ],
    };
}

describe('id vs bind parent lookup', () => {
    it('reads a parent answer when cascade_parent is id and responses are keyed by bind', () => {
        const fields = [
            { id: 'field_region', bind: 'region' },
            { id: 'field_district', bind: 'district' },
        ];
        assert.equal(lookupResponse({ region: 'ashanti' }, 'field_region', fields), 'ashanti');
        assert.equal(lookupResponse({ field_region: 'ashanti' }, 'region', fields), 'ashanti');
    });

    it('resolves cascade_options_map from a bind-keyed parent', () => {
        const blueprint = marketActivationBlueprint();
        const district = blueprint.ui[0].children.find((entry) => entry.bind === 'district')!;
        const options = resolveFieldOptions(district, { region: 'ashanti' }, blueprint.ui[0].children);
        assert.deepEqual(options, [{ label: 'Kumasi', value: 'kumasi' }]);
    });

    it('resolves directory cascade rows from a bind-keyed parent', () => {
        const blueprint = marketActivationBlueprint();
        const outlet = blueprint.ui[0].children.find((entry) => entry.bind === 'outlet_type')!;
        const options = resolveFieldOptions(outlet, { region: 'greater_accra' }, blueprint.ui[0].children);
        assert.deepEqual(options, [{ label: 'Accra Mart', value: 'am' }]);
    });
});

describe('currency, auto-value, form_link, matrix 0', () => {
    it('keeps currency min 0 and two decimal places', () => {
        assert.equal(normalizeDecimalValue({ type: 'input_number', decimal_places: 2 }, 12.5), '12.50');
        assert.equal(
            validateFieldConstraints({ type: 'input_number', min: 0, max: 10, decimal_places: 2 }, 0),
            undefined,
        );
        assert.equal(
            validateFieldConstraints({ type: 'input_number', decimal_places: 2 }, '1.239'),
            'Must have at most 2 decimal places',
        );
    });

    it('stamps date pickers with a local calendar day even when auto_value is now()', () => {
        const now = new Date(2026, 8, 9, 23, 45, 0);
        assert.equal(
            resolveAutoValueForField({ type: 'date_picker', auto_value: 'now()' }, now),
            '2026-09-09',
        );
        assert.equal(
            resolveAutoValueForField({ type: 'time_picker', auto_value: 'now()' }, now),
            '23:45',
        );
        const loaded = applyOnLoadAutoValues(
            [{ id: 'payment_date', bind: 'payment_date', type: 'date_picker', auto_value: 'now()', auto_value_timing: 'on_load' }],
            {},
            now,
        );
        assert.equal(loaded.payment_date, '2026-09-09');
        const submitted = applyOnSubmitAutoValues(
            [{ id: 'submitted_at', bind: 'submitted_at', auto_value: 'now()', auto_value_timing: 'on_submit' }],
            {},
            now,
        );
        assert.equal(submitted.submitted_at, now.toISOString());
    });

    it('does not treat form_link as a required data field', () => {
        assert.equal(isNavigationalField({ type: 'form_link', required: true }), true);
        assert.equal(validateFieldConstraints({ type: 'form_link', required: true }, undefined), undefined);
    });

    it('maps form_link params from id sources onto bind-keyed responses', () => {
        const params = resolveFormLinkParams(
            { field_region: 'region_param' },
            { region: 'ashanti' },
            [{ id: 'field_region', bind: 'region' }],
        );
        assert.deepEqual(params, { region_param: 'ashanti' });
    });

    it('shows numeric 0 in matrix cells', () => {
        assert.equal(cellInputValue(0), '0');
        assert.equal(cellInputValue(undefined), '');
    });

    it('does not clip a phone mask with a shorter maxLength', () => {
        assert.equal(effectiveInputMaxLength({ mask: '(999) 999-9999', maxLength: 10 }), 14);
    });
});

describe('Expo field pass against a Studio market-activation blueprint', () => {
    it('applies defaults, hides web-only fields, cascades, currency, auto-value, and form_link params', () => {
        const now = new Date(2026, 8, 9, 8, 15, 0);
        const pass = runMobileFieldPass(
            marketActivationBlueprint(),
            { region: 'ashanti', hours: { open: '08:00', close: '18:00' } },
            now,
        );

        assert.equal(pass.visibleFields.some((entry) => entry.bind === 'analyst_note'), false);
        assert.equal(pass.responses.sku_categories[0], 'beverage');
        assert.equal(pass.responses.amount_paid, '0.00');
        assert.equal(pass.responses.payment_date, '2026-09-09');
        assert.deepEqual(pass.optionsByKey.district, [{ label: 'Kumasi', value: 'kumasi' }]);
        assert.deepEqual(pass.optionsByKey.outlet_type, [{ label: 'Kumasi Mart', value: 'km' }]);
        assert.deepEqual(pass.formLinkParams.launch_stock_count, { region_param: 'ashanti' });
        assert.equal(pass.errors.hours, undefined);
        assert.equal(pass.errors.launch_stock_count, undefined);
        assert.equal(pass.errors.amount_paid, undefined);
    });

    it('blocks Next when a required cascade child is empty', () => {
        const pass = runMobileFieldPass(marketActivationBlueprint(), {});
        assert.equal(pass.errors.region, 'This field is required');
        assert.equal(pass.errors.district, 'This field is required');
        assert.deepEqual(pass.optionsByKey.district, []);
    });
});
