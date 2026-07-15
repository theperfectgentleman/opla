import type { DirectoryRuntimeEntry, FormBlueprint, FormField, FormObjectDefinition, ObjectPropertyDefinition } from '@opla/types';
import { resolveDirectoryFormFieldOptions } from '@opla/types';

import { agentFormAPI, publicFormAPI } from '../../services/api';

export type DirectoryLookupOption = {
    label: string;
    value: string;
    submission_id: string;
    data?: Record<string, unknown>;
};

export type DirectoryLookupContext = {
    mode: 'agent' | 'public';
    formId?: string;
    slug?: string;
};

function buildSourceItems(options: DirectoryLookupOption[]) {
    return options.map((option) => ({
        id: option.submission_id,
        sku_code: option.value,
        label: option.label,
        ...(option.data || {}),
    }));
}

function hydratePropertyReference(
    property: ObjectPropertyDefinition,
    sourceItemsByDirectoryId: Record<string, ReturnType<typeof buildSourceItems>>,
): ObjectPropertyDefinition {
    const reference = property.reference;
    if (!reference) {
        return property;
    }

    if (reference.source_type === 'directory_form' && reference.source_id) {
        const sourceItems = sourceItemsByDirectoryId[reference.source_id] || [];
        return {
            ...property,
            reference: {
                ...reference,
                label_field: reference.label_field || 'label',
                value_field: reference.value_field || 'sku_code',
                source_items: sourceItems,
            },
        };
    }

    if (property.properties?.length) {
        return {
            ...property,
            properties: property.properties.map((child) => hydratePropertyReference(child, sourceItemsByDirectoryId)),
        };
    }

    return property;
}

function hydrateObjectDefinition(
    definition: FormObjectDefinition | undefined,
    sourceItemsByDirectoryId: Record<string, ReturnType<typeof buildSourceItems>>,
): FormObjectDefinition | undefined {
    if (!definition) {
        return definition;
    }
    return {
        ...definition,
        properties: (definition.properties || []).map((property) =>
            hydratePropertyReference(property, sourceItemsByDirectoryId),
        ),
    };
}

function collectDirectoryFormIds(blueprint: FormBlueprint): string[] {
    const ids = new Set<string>();
    (blueprint.ui || []).forEach((screen) => {
        (screen.children || []).forEach((field) => {
            if (field.options_source === 'directory_form' && field.directory_form_id) {
                ids.add(field.directory_form_id);
            }
            if (field.directory_source_type === 'directory_form' && field.directory_form_id) {
                ids.add(field.directory_form_id);
            }
            const walkProperties = (properties?: ObjectPropertyDefinition[]) => {
                (properties || []).forEach((property) => {
                    if (property.reference?.source_type === 'directory_form' && property.reference.source_id) {
                        ids.add(property.reference.source_id);
                    }
                    if (property.properties?.length) {
                        walkProperties(property.properties);
                    }
                });
            };
            walkProperties(field.object_definition?.properties);
        });
    });
    return Array.from(ids);
}

async function fetchDirectoryOptions(context: DirectoryLookupContext, directoryFormId: string) {
    if (context.mode === 'agent' && context.formId) {
        return agentFormAPI.directoryLookupOptions(context.formId, directoryFormId, { limit: 500 });
    }
    if (context.mode === 'public' && context.slug) {
        return publicFormAPI.directoryLookupOptions(context.slug, directoryFormId, { limit: 500 });
    }
    return { options: [], value_field: '', label_field: '' };
}

function toRuntimeEntries(options: DirectoryLookupOption[]): DirectoryRuntimeEntry[] {
    return options.map((option) => ({
        label: option.label,
        value: option.value,
        submission_id: option.submission_id,
        data: option.data || {},
    }));
}

function hydrateDirectoryDropdownField(
    field: FormField,
    entries: DirectoryRuntimeEntry[],
    valueField: string,
    labelField: string,
): FormField {
    const nextField: FormField = {
        ...field,
        directory_runtime_entries: entries,
        directory_default_value_field: valueField,
        directory_default_label_field: labelField,
    };
    nextField.options = resolveDirectoryFormFieldOptions(nextField, {});
    return nextField;
}

export async function hydrateBlueprintDirectoryForms(
    blueprint: FormBlueprint,
    context: DirectoryLookupContext,
): Promise<FormBlueprint> {
    const directoryFormIds = collectDirectoryFormIds(blueprint);
    if (directoryFormIds.length === 0) {
        return blueprint;
    }

    const sourceItemsByDirectoryId: Record<string, ReturnType<typeof buildSourceItems>> = {};
    const entriesByDirectoryId: Record<string, DirectoryRuntimeEntry[]> = {};
    const metaByDirectoryId: Record<string, { value_field: string; label_field: string }> = {};

    await Promise.all(
        directoryFormIds.map(async (directoryFormId) => {
            try {
                const response = await fetchDirectoryOptions(context, directoryFormId);
                const options = Array.isArray(response?.options) ? response.options : [];
                entriesByDirectoryId[directoryFormId] = toRuntimeEntries(options);
                sourceItemsByDirectoryId[directoryFormId] = buildSourceItems(options);
                metaByDirectoryId[directoryFormId] = {
                    value_field: response?.value_field || '',
                    label_field: response?.label_field || '',
                };
            } catch {
                entriesByDirectoryId[directoryFormId] = [];
                sourceItemsByDirectoryId[directoryFormId] = [];
                metaByDirectoryId[directoryFormId] = { value_field: '', label_field: '' };
            }
        }),
    );

    return {
        ...blueprint,
        ui: (blueprint.ui || []).map((screen) => ({
            ...screen,
            children: (screen.children || []).map((field) => {
                let nextField: FormField = { ...field };
                if (field.options_source === 'directory_form' && field.directory_form_id) {
                    const entries = entriesByDirectoryId[field.directory_form_id] || [];
                    const meta = metaByDirectoryId[field.directory_form_id] || { value_field: '', label_field: '' };
                    nextField = hydrateDirectoryDropdownField(field, entries, meta.value_field, meta.label_field);
                }
                if (field.object_definition) {
                    nextField.object_definition = hydrateObjectDefinition(
                        field.object_definition,
                        sourceItemsByDirectoryId,
                    );
                }
                return nextField;
            }),
        })),
    };
}
