/**
 * Headless Expo FormRenderer pass: the same identity, defaults, platforms,
 * cascade, auto-value, currency, lookup, and form_link steps the phone
 * runtime uses. Lets us prove Studio blueprints without an Expo device.
 */
import type { FieldOption, FormField, FormSection } from '../../types/src/index.ts';
import { lookupResponse, resolveFieldOptions } from '../../types/src/directoryFormOptions.ts';

import {
    applyDecimalNormalization,
    applyOnLoadAutoValues,
    applyOnSubmitAutoValues,
    collectFieldDefaults,
    ensureFieldIdentity,
    getFieldKey,
    isNavigationalField,
    isOnPlatform,
    resolveFormLinkParams,
    validateFieldConstraints,
    type FieldLike,
} from './formFields.ts';

export type PlayerBlueprint = {
    ui: Array<Pick<FormSection, 'id' | 'platforms' | 'children'> & { children: FormField[] }>;
};

export type FieldPassResult = {
    fields: FormField[];
    visibleFields: FormField[];
    responses: Record<string, unknown>;
    optionsByKey: Record<string, FieldOption[]>;
    errors: Record<string, string>;
    formLinkParams: Record<string, Record<string, unknown>>;
};

export function flattenUiFields(blueprint: PlayerBlueprint): FormField[] {
    return (blueprint.ui || []).flatMap((section) =>
        (section.children || []).map((field) => ensureFieldIdentity(field)),
    );
}

export function visibleMobileFields(blueprint: PlayerBlueprint): FormField[] {
    return (blueprint.ui || [])
        .filter((section) => isOnPlatform(section, 'mobile'))
        .flatMap((section) =>
            (section.children || [])
                .map((field) => ensureFieldIdentity(field))
                .filter((field) => isOnPlatform(field, 'mobile')),
        );
}

export function hydratePlayerResponses(
    fields: FieldLike[],
    seed: Record<string, unknown> = {},
    now: Date = new Date(),
): Record<string, unknown> {
    const withDefaults = { ...collectFieldDefaults(fields, seed), ...seed };
    const withAuto = { ...applyOnLoadAutoValues(fields, withDefaults, now), ...withDefaults };
    return applyDecimalNormalization(fields, withAuto);
}

export function optionsForField(
    field: FormField,
    responses: Record<string, unknown>,
    fields: FormField[],
): FieldOption[] {
    return resolveFieldOptions(field, responses, fields);
}

export function runMobileFieldPass(
    blueprint: PlayerBlueprint,
    seed: Record<string, unknown> = {},
    now: Date = new Date(),
): FieldPassResult {
    const fields = flattenUiFields(blueprint);
    const visibleFields = visibleMobileFields(blueprint);
    const responses = hydratePlayerResponses(visibleFields, seed, now);
    const optionsByKey: Record<string, FieldOption[]> = {};
    const errors: Record<string, string> = {};
    const formLinkParams: Record<string, Record<string, unknown>> = {};

    for (const field of visibleFields) {
        const key = getFieldKey(field);
        if (!key) {
            continue;
        }
        optionsByKey[key] = optionsForField(field, responses, fields);
        if (!isNavigationalField(field)) {
            const error = validateFieldConstraints(field, responses[key]);
            if (error) {
                errors[key] = error;
            }
        }
        if (field.type === 'form_link') {
            formLinkParams[key] = resolveFormLinkParams(field.linked_form_param_map, responses, fields);
        }
    }

    return { fields, visibleFields, responses, optionsByKey, errors, formLinkParams };
}

export function parentResponse(
    responses: Record<string, unknown>,
    parentFieldId: string | undefined,
    fields: FormField[],
): unknown {
    return lookupResponse(responses, parentFieldId, fields);
}
