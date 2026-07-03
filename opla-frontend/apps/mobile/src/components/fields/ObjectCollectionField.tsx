import React from 'react';
import { Text, TouchableOpacity, View, ScrollView } from 'react-native';
import { FormField, FormObjectDefinition, ObjectPropertyDefinition } from '@opla/types';

import { DropdownField } from './DropdownField';
import { NumberInputField } from './NumberInputField';
import { TextInputField } from './TextInputField';
import { ToggleField } from './ToggleField';

type RowValue = Record<string, any>;

interface Props {
    field: FormField;
    value?: unknown;
    onChange: (value: any) => void;
    error?: string;
    objectDefinition?: FormObjectDefinition;
    mode?: 'collection' | 'instance';
}

function createObjectValue(properties: ObjectPropertyDefinition[] = []): RowValue {
    const draft: RowValue = {};
    properties.forEach((property) => {
        if (property.type === 'object' && Array.isArray(property.properties)) {
            draft[property.key] = createObjectValue(property.properties);
            return;
        }
        if (property.type === 'object_collection') {
            draft[property.key] = [];
            return;
        }
        if (property.default_value !== undefined) {
            draft[property.key] = property.default_value;
        }
    });
    return applyComputedProperties(draft, properties);
}

function applyComputedProperties(record: RowValue, properties: ObjectPropertyDefinition[] = []): RowValue {
    const next = { ...record };
    properties.forEach((property) => {
        if (property.type === 'object' && Array.isArray(property.properties)) {
            next[property.key] = applyComputedProperties(next[property.key] || {}, property.properties);
            return;
        }
        if (property.type === 'computed' && property.formula) {
            const computed = evaluateFormula(property.formula, next);
            if (computed !== undefined) {
                next[property.key] = computed;
            }
        }
    });
    return next;
}

function evaluateFormula(formula: string, record: RowValue): number | undefined {
    const expression = formula.replace(/\b[a-zA-Z_][a-zA-Z0-9_]*\b/g, (token) => {
        const value = Number(record[token] ?? 0);
        return Number.isFinite(value) ? String(value) : '0';
    });

    if (!/^[0-9+\-*/().\s]+$/.test(expression)) {
        return undefined;
    }

    try {
        const result = Function(`"use strict"; return (${expression});`)();
        return typeof result === 'number' && Number.isFinite(result) ? result : undefined;
    } catch {
        return undefined;
    }
}

function getNestedValue(record: RowValue, path: string[]): any {
    return path.reduce<any>((current, segment) => {
        if (!current || typeof current !== 'object') {
            return undefined;
        }
        return current[segment];
    }, record);
}

function setNestedValue(record: RowValue, path: string[], value: any): RowValue {
    if (path.length === 0) {
        return record;
    }

    const [head, ...tail] = path;
    if (tail.length === 0) {
        return { ...record, [head]: value };
    }

    return {
        ...record,
        [head]: setNestedValue((record?.[head] as RowValue) || {}, tail, value),
    };
}

function renderReadOnlyValue(value: any) {
    return value === undefined || value === null || value === '' ? 'Pending' : String(value);
}

function resolveSelectOptions(property: ObjectPropertyDefinition) {
    if (property.options?.length) {
        return property.options;
    }

    if (property.reference?.source_type === 'catalog' && property.reference.source_items?.length) {
        const labelField = property.reference.label_field || 'label';
        const valueField = property.reference.value_field || 'id';
        return property.reference.source_items.map((item) => ({
            label: String((item as Record<string, any>)[labelField] ?? item.label ?? item.id),
            value: String((item as Record<string, any>)[valueField] ?? item.id),
        }));
    }

    return [];
}

function applyCatalogSelection(record: RowValue, path: string[], property: ObjectPropertyDefinition, selectedValue: any) {
    let nextRecord = setNestedValue(record, path, selectedValue);
    const reference = property.reference;

    if (reference?.source_type !== 'catalog' || !reference.source_items?.length) {
        return nextRecord;
    }

    const valueField = reference.value_field || 'id';
    const selectedItem = reference.source_items.find((item) => String((item as Record<string, any>)[valueField] ?? item.id) === String(selectedValue));
    if (!selectedItem) {
        return nextRecord;
    }

    const parentPath = path.slice(0, -1);
    Object.entries(reference.field_mappings || {}).forEach(([targetKey, sourceKey]) => {
        const mappedValue = (selectedItem as Record<string, any>)[sourceKey];
        if (mappedValue !== undefined) {
            nextRecord = setNestedValue(nextRecord, [...parentPath, targetKey], mappedValue);
        }
    });

    // GAP-8: Auto-inject default_price (MSRP) if it exists on the selected catalog item
    const defaultPrice = selectedItem.default_price;
    if (defaultPrice !== undefined && defaultPrice !== null) {
        if (!reference.field_mappings || !reference.field_mappings.hasOwnProperty('unit_price')) {
            nextRecord = setNestedValue(nextRecord, [...parentPath, 'unit_price'], defaultPrice);
        }
        if (!reference.field_mappings || !reference.field_mappings.hasOwnProperty('price')) {
            nextRecord = setNestedValue(nextRecord, [...parentPath, 'price'], defaultPrice);
        }
    }

    return nextRecord;
}

export function ObjectCollectionField({
    field,
    value,
    onChange,
    error,
    objectDefinition,
    mode = 'collection',
}: Props) {
    const definition = objectDefinition || field.object_definition;
    const properties = definition?.properties || [];
    const isInstance = mode === 'instance';

    const items = React.useMemo<RowValue[]>(() => {
        if (isInstance) {
            if (value && typeof value === 'object' && !Array.isArray(value)) {
                return [applyComputedProperties(value as RowValue, properties)];
            }
            return [createObjectValue(properties)];
        }
        
        let loadedItems: RowValue[] = [];
        if (Array.isArray(value) && value.length > 0) {
            loadedItems = value.map((entry) => applyComputedProperties((entry as RowValue) || {}, properties));
        } else if (field.catalog_source_type === 'project_catalog') {
            const propWithCatalog = properties.find((p) => p.type === 'select' && p.reference?.source_type === 'catalog');
            const sourceItems = propWithCatalog?.reference?.source_items || [];
            const mode = (field as any).catalog_prepopulate_mode || 'all';
            if (mode !== 'none' && sourceItems.length > 0) {
                const targetItems = mode === 'required_only'
                    ? sourceItems.filter((item: any) => !!item.metadata_json?.is_mandatory)
                    : sourceItems;

                loadedItems = targetItems.map((item) => {
                    let row: RowValue = { _isCatalogItem: true };
                    properties.forEach((prop) => {
                        if (prop.type === 'select' && prop.reference?.source_type === 'catalog') {
                            row[prop.key] = item.id;
                            Object.entries(prop.reference.field_mappings || {}).forEach(([targetKey, sourceKey]) => {
                                const val = (item as Record<string, any>)[sourceKey];
                                if (val !== undefined) {
                                    row[targetKey] = val;
                                }
                            });
                        } else if (prop.key === 'unit_price' || prop.key === 'price') {
                            row[prop.key] = item.default_price;
                        } else if (prop.default_value !== undefined) {
                            row[prop.key] = prop.default_value;
                        }
                    });
                    return applyComputedProperties(row, properties);
                });
            }
        }
        return loadedItems;
    }, [isInstance, value, properties, field.catalog_source_type, (field as any).catalog_prepopulate_mode]);

    const commitItems = (nextItems: RowValue[]) => {
        if (isInstance) {
            onChange(nextItems[0] || createObjectValue(properties));
            return;
        }
        onChange(nextItems);
    };

    React.useEffect(() => {
        if (!isInstance && (!value || (Array.isArray(value) && value.length === 0)) && field.catalog_source_type === 'project_catalog') {
            const mode = (field as any).catalog_prepopulate_mode || 'all';
            if (mode !== 'none') {
                const propWithCatalog = properties.find((p) => p.type === 'select' && p.reference?.source_type === 'catalog');
                const sourceItems = propWithCatalog?.reference?.source_items || [];
                if (sourceItems.length > 0) {
                    commitItems(items);
                }
            }
        }
    }, [properties, value, field.catalog_source_type, (field as any).catalog_prepopulate_mode]);

    const updateRow = (rowIndex: number, path: string[], nextValue: any, property?: ObjectPropertyDefinition) => {
        const nextItems = items.map((entry, index) => {
            if (index !== rowIndex) {
                return entry;
            }
            const updated = property ? applyCatalogSelection(entry, path, property, nextValue) : setNestedValue(entry, path, nextValue);
            return applyComputedProperties(updated, properties);
        });
        commitItems(nextItems);
    };

    const addRow = () => {
        commitItems([...items, createObjectValue(properties)]);
    };

    const removeRow = (rowIndex: number) => {
        if (items[rowIndex]?._isCatalogItem) return;
        commitItems(items.filter((_, index) => index !== rowIndex));
    };

    const renderProperty = (row: RowValue, rowIndex: number, property: ObjectPropertyDefinition, path: string[] = [property.key]) => {
        const valueAtPath = getNestedValue(row, path);
        const propertyLabel = property.label || property.key;

        if (property.edit_mode === 'hidden') {
            return null;
        }

        if (property.type === 'object' && Array.isArray(property.properties)) {
            return (
                <View key={path.join('.')} style={{ marginBottom: 12, padding: 12, borderRadius: 10, backgroundColor: '#172033', borderWidth: 1, borderColor: '#243041' }}>
                    <Text style={{ color: '#e2e8f0', fontSize: 13, fontWeight: '700', marginBottom: 10 }}>{propertyLabel}</Text>
                    {property.properties.map((child) => renderProperty(row, rowIndex, child, [...path, child.key]))}
                </View>
            );
        }

        let control: React.ReactNode;
        const selectOptions = resolveSelectOptions(property);
        if (property.type === 'select' && selectOptions.length) {
            control = (
                <DropdownField
                    field={{
                        id: path.join('.'),
                        type: 'dropdown',
                        label: propertyLabel,
                        required: Boolean(property.required),
                        placeholder: property.placeholder,
                        options: selectOptions,
                    }}
                    value={typeof valueAtPath === 'string' ? valueAtPath : ''}
                    onChange={(nextValue) => updateRow(rowIndex, path, nextValue, property)}
                />
            );
        } else if (property.type === 'boolean') {
            control = (
                <ToggleField
                    field={{ id: path.join('.'), type: 'toggle', label: propertyLabel, required: Boolean(property.required) }}
                    value={valueAtPath}
                    onChange={(nextValue) => updateRow(rowIndex, path, nextValue)}
                />
            );
        } else if (property.type === 'number' || property.type === 'integer' || property.type === 'decimal') {
            control = (
                <NumberInputField
                    field={{ id: path.join('.'), type: 'input_number', label: propertyLabel, required: Boolean(property.required), placeholder: property.placeholder }}
                    value={valueAtPath !== undefined && valueAtPath !== null ? String(valueAtPath) : ''}
                    onChange={(nextValue) => updateRow(rowIndex, path, nextValue === '' ? '' : Number(nextValue))}
                />
            );
        } else if (property.type === 'computed') {
            control = (
                <View style={{ backgroundColor: '#1e293b', borderColor: '#334155', borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 12 }}>
                    <Text style={{ color: '#cbd5e1', fontSize: 14 }}>{renderReadOnlyValue(valueAtPath)}</Text>
                </View>
            );
        } else {
            control = (
                <TextInputField
                    field={{ id: path.join('.'), type: 'input_text', label: propertyLabel, required: Boolean(property.required), placeholder: property.placeholder }}
                    value={valueAtPath !== undefined && valueAtPath !== null ? String(valueAtPath) : ''}
                    onChange={(nextValue) => updateRow(rowIndex, path, nextValue)}
                />
            );
        }

        return (
            <View key={path.join('.')} style={{ marginBottom: 12 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#e2e8f0', marginBottom: 6 }}>
                    {propertyLabel} {property.required ? <Text style={{ color: '#ef4444' }}>*</Text> : null}
                </Text>
                {control}
            </View>
        );
    };

    const renderPropertyInputInline = (row: RowValue, rowIndex: number, property: ObjectPropertyDefinition, path: string[] = [property.key]) => {
        const valueAtPath = getNestedValue(row, path);
        if (property.edit_mode === 'hidden') return null;

        const selectOptions = resolveSelectOptions(property);
        if (property.type === 'select' && selectOptions.length) {
            return (
                <DropdownField
                    field={{
                        id: path.join('.'),
                        type: 'dropdown',
                        label: '',
                        required: Boolean(property.required),
                        placeholder: property.placeholder,
                        options: selectOptions,
                    }}
                    value={typeof valueAtPath === 'string' ? valueAtPath : ''}
                    onChange={(nextValue) => updateRow(rowIndex, path, nextValue, property)}
                />
            );
        } else if (property.type === 'boolean') {
            return (
                <ToggleField
                    field={{ id: path.join('.'), type: 'toggle', label: '', required: Boolean(property.required) }}
                    value={valueAtPath}
                    onChange={(nextValue) => updateRow(rowIndex, path, nextValue)}
                />
            );
        } else if (property.type === 'number' || property.type === 'integer' || property.type === 'decimal') {
            return (
                <NumberInputField
                    field={{ id: path.join('.'), type: 'input_number', label: '', required: Boolean(property.required), placeholder: property.placeholder }}
                    value={valueAtPath !== undefined && valueAtPath !== null ? String(valueAtPath) : ''}
                    onChange={(nextValue) => updateRow(rowIndex, path, nextValue === '' ? '' : Number(nextValue))}
                />
            );
        } else if (property.type === 'computed') {
            return (
                <View style={{ backgroundColor: '#1e293b', borderColor: '#334155', borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 8 }}>
                    <Text style={{ color: '#cbd5e1', fontSize: 12 }}>{renderReadOnlyValue(valueAtPath)}</Text>
                </View>
            );
        } else {
            return (
                <TextInputField
                    field={{ id: path.join('.'), type: 'input_text', label: '', required: Boolean(property.required), placeholder: property.placeholder }}
                    value={valueAtPath !== undefined && valueAtPath !== null ? String(valueAtPath) : ''}
                    onChange={(nextValue) => updateRow(rowIndex, path, nextValue)}
                />
            );
        }
    };

    const isTableLayout = !isInstance && field.collection_layout === 'table';

    if (isTableLayout) {
        return (
            <View>
                <ScrollView horizontal showsHorizontalScrollIndicator={true} style={{ marginBottom: 12, borderRadius: 10, borderWidth: 1, borderColor: '#334155', backgroundColor: '#0f172a' }}>
                    <View style={{ flexDirection: 'column', minWidth: '100%' }}>
                        {/* Headers */}
                        <View style={{ flexDirection: 'row', backgroundColor: '#1e293b', paddingVertical: 10, borderBottomWidth: 1.5, borderBottomColor: '#334155', alignItems: 'center' }}>
                            {properties.map((prop) => (
                                <View key={prop.key} style={{ width: 140, paddingHorizontal: 8 }}>
                                    <Text style={{ color: '#cbd5e1', fontSize: 12, fontWeight: '700' }}>
                                        {prop.label || prop.key} {prop.required ? <Text style={{ color: '#ef4444' }}>*</Text> : null}
                                    </Text>
                                </View>
                            ))}
                            {(field.allow_remove_items ?? definition?.allow_manual_remove ?? true) && (
                                <View style={{ width: 70, paddingHorizontal: 8 }}>
                                    <Text style={{ color: '#cbd5e1', fontSize: 12, fontWeight: '700', textAlign: 'center' }}>Actions</Text>
                                </View>
                            )}
                        </View>
                        {/* Rows */}
                        {items.length === 0 ? (
                            <View style={{ padding: 16, alignItems: 'center' }}>
                                <Text style={{ color: '#64748b', fontSize: 13 }}>No items added yet.</Text>
                            </View>
                        ) : (
                            items.map((row, rowIndex) => (
                                <View key={`${field.id}_row_${rowIndex}`} style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#243041', paddingVertical: 8, alignItems: 'center' }}>
                                    {properties.map((prop) => (
                                        <View key={prop.key} style={{ width: 140, paddingHorizontal: 8 }}>
                                            {renderPropertyInputInline(row, rowIndex, prop)}
                                        </View>
                                    ))}
                                    {(field.allow_remove_items ?? definition?.allow_manual_remove ?? true) && (
                                        <TouchableOpacity 
                                            onPress={() => removeRow(rowIndex)} 
                                            disabled={!!row._isCatalogItem}
                                            style={{ width: 70, alignItems: 'center', justifyContent: 'center', opacity: row._isCatalogItem ? 0.3 : 1 }}
                                        >
                                            <Text style={{ color: row._isCatalogItem ? '#64748b' : '#ef4444', fontSize: 12, fontWeight: '700' }}>Delete</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            ))
                        )}
                    </View>
                </ScrollView>

                {(field.allow_add_items ?? definition?.allow_manual_add ?? true) && (
                    <TouchableOpacity
                        onPress={addRow}
                        style={{
                            alignSelf: 'flex-start',
                            backgroundColor: '#158754',
                            borderRadius: 8,
                            paddingHorizontal: 14,
                            paddingVertical: 10,
                        }}
                    >
                        <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>Add Item</Text>
                    </TouchableOpacity>
                )}

                {error ? <Text style={{ color: '#ef4444', fontSize: 12, marginTop: 6 }}>{error}</Text> : null}
            </View>
        );
    }

    return (
        <View>
            {items.map((row, rowIndex) => (
                <View
                    key={`${field.id}_${rowIndex}`}
                    style={{
                        marginBottom: 12,
                        borderRadius: 14,
                        borderWidth: 1,
                        borderColor: '#334155',
                        backgroundColor: '#0f172a',
                        padding: 14,
                    }}
                >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: properties.length > 0 ? 12 : 0 }}>
                        <Text style={{ color: '#f1f5f9', fontSize: 14, fontWeight: '700' }}>
                            {definition?.label || field.label} {isInstance ? '' : `#${rowIndex + 1}`}
                        </Text>
                        {!isInstance && (field.allow_remove_items ?? definition?.allow_manual_remove ?? true) && !row._isCatalogItem ? (
                            <TouchableOpacity onPress={() => removeRow(rowIndex)}>
                                <Text style={{ color: '#ef4444', fontSize: 12, fontWeight: '700' }}>Remove</Text>
                            </TouchableOpacity>
                        ) : null}
                    </View>
                    {properties.map((property) => renderProperty(row, rowIndex, property))}
                </View>
            ))}

            {!isInstance && (field.allow_add_items ?? definition?.allow_manual_add ?? true) ? (
                <TouchableOpacity
                    onPress={addRow}
                    style={{
                        alignSelf: 'flex-start',
                        backgroundColor: '#158754',
                        borderRadius: 8,
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                    }}
                >
                    <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>Add Item</Text>
                </TouchableOpacity>
            ) : null}

            {error ? <Text style={{ color: '#ef4444', fontSize: 12, marginTop: 6 }}>{error}</Text> : null}
        </View>
    );
}