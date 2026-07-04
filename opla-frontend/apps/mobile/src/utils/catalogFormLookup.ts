import type { CatalogRuntimeEntry, FormBlueprint, FormField, FormObjectDefinition, ObjectPropertyDefinition } from '@opla/types';
import { resolveCatalogFormFieldOptions } from '@opla/types';

import { deskFormAPI, publicFormAPI } from '../../services/api';

export type CatalogLookupOption = {
    label: string;
    value: string;
    submission_id: string;
    data?: Record<string, unknown>;
};

export type CatalogLookupContext = {
    mode: 'desk' | 'public';
    formId?: string;
    slug?: string;
};

function buildSourceItems(options: CatalogLookupOption[]) {
    return options.map((option) => ({
        id: option.submission_id,
        sku_code: option.value,
        label: option.label,
        ...(option.data || {}),
    }));
}

function hydratePropertyReference(
    property: ObjectPropertyDefinition,
    sourceItemsByCatalogId: Record<string, ReturnType<typeof buildSourceItems>>,
): ObjectPropertyDefinition {
    const reference = property.reference;
    if (!reference) {
        return property;
    }

    if (reference.source_type === 'catalog_form' && reference.source_id) {
        const sourceItems = sourceItemsByCatalogId[reference.source_id] || [];
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
            properties: property.properties.map((child) => hydratePropertyReference(child, sourceItemsByCatalogId)),
        };
    }

    return property;
}

function hydrateObjectDefinition(
    definition: FormObjectDefinition | undefined,
    sourceItemsByCatalogId: Record<string, ReturnType<typeof buildSourceItems>>,
): FormObjectDefinition | undefined {
    if (!definition) {
        return definition;
    }
    return {
        ...definition,
        properties: (definition.properties || []).map((property) =>
            hydratePropertyReference(property, sourceItemsByCatalogId),
        ),
    };
}

function collectCatalogFormIds(blueprint: FormBlueprint): string[] {
    const ids = new Set<string>();
    (blueprint.ui || []).forEach((screen) => {
        (screen.children || []).forEach((field) => {
            if (field.options_source === 'catalog_form' && field.catalog_form_id) {
                ids.add(field.catalog_form_id);
            }
            if (field.catalog_source_type === 'catalog_form' && field.catalog_form_id) {
                ids.add(field.catalog_form_id);
            }
            const walkProperties = (properties?: ObjectPropertyDefinition[]) => {
                (properties || []).forEach((property) => {
                    if (property.reference?.source_type === 'catalog_form' && property.reference.source_id) {
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

async function fetchCatalogOptions(context: CatalogLookupContext, catalogFormId: string) {
    if (context.mode === 'desk' && context.formId) {
        return deskFormAPI.catalogLookupOptions(context.formId, catalogFormId, { limit: 500 });
    }
    if (context.mode === 'public' && context.slug) {
        return publicFormAPI.catalogLookupOptions(context.slug, catalogFormId, { limit: 500 });
    }
    return { options: [], value_field: '', label_field: '' };
}

function toRuntimeEntries(options: CatalogLookupOption[]): CatalogRuntimeEntry[] {
    return options.map((option) => ({
        label: option.label,
        value: option.value,
        submission_id: option.submission_id,
        data: option.data || {},
    }));
}

function hydrateCatalogDropdownField(
    field: FormField,
    entries: CatalogRuntimeEntry[],
    valueField: string,
    labelField: string,
): FormField {
    const nextField: FormField = {
        ...field,
        catalog_runtime_entries: entries,
        catalog_default_value_field: valueField,
        catalog_default_label_field: labelField,
    };
    nextField.options = resolveCatalogFormFieldOptions(nextField, {});
    return nextField;
}

export async function hydrateBlueprintCatalogForms(
    blueprint: FormBlueprint,
    context: CatalogLookupContext,
): Promise<FormBlueprint> {
    const catalogFormIds = collectCatalogFormIds(blueprint);
    if (catalogFormIds.length === 0) {
        return blueprint;
    }

    const sourceItemsByCatalogId: Record<string, ReturnType<typeof buildSourceItems>> = {};
    const entriesByCatalogId: Record<string, CatalogRuntimeEntry[]> = {};
    const metaByCatalogId: Record<string, { value_field: string; label_field: string }> = {};

    await Promise.all(
        catalogFormIds.map(async (catalogFormId) => {
            try {
                const response = await fetchCatalogOptions(context, catalogFormId);
                const options = Array.isArray(response?.options) ? response.options : [];
                entriesByCatalogId[catalogFormId] = toRuntimeEntries(options);
                sourceItemsByCatalogId[catalogFormId] = buildSourceItems(options);
                metaByCatalogId[catalogFormId] = {
                    value_field: response?.value_field || '',
                    label_field: response?.label_field || '',
                };
            } catch {
                entriesByCatalogId[catalogFormId] = [];
                sourceItemsByCatalogId[catalogFormId] = [];
                metaByCatalogId[catalogFormId] = { value_field: '', label_field: '' };
            }
        }),
    );

    return {
        ...blueprint,
        ui: (blueprint.ui || []).map((screen) => ({
            ...screen,
            children: (screen.children || []).map((field) => {
                let nextField: FormField = { ...field };
                if (field.options_source === 'catalog_form' && field.catalog_form_id) {
                    const entries = entriesByCatalogId[field.catalog_form_id] || [];
                    const meta = metaByCatalogId[field.catalog_form_id] || { value_field: '', label_field: '' };
                    nextField = hydrateCatalogDropdownField(field, entries, meta.value_field, meta.label_field);
                }
                if (field.object_definition) {
                    nextField.object_definition = hydrateObjectDefinition(
                        field.object_definition,
                        sourceItemsByCatalogId,
                    );
                }
                return nextField;
            }),
        })),
    };
}
