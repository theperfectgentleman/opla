import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FormBlueprint, FormField, FormObjectDefinition, FormSchemaField, ObjectPropertyDefinition } from '@opla/types';
import { isFieldVisible } from '../utils/logic';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TextInputField } from './fields/TextInputField';
import { NumberInputField } from './fields/NumberInputField';
import { RadioGroupField } from './fields/RadioGroupField';
import { CheckboxGroupField } from './fields/CheckboxGroupField';
import { DropdownField } from './fields/DropdownField';
import { MatrixTableField } from './fields/MatrixTableField';
import { LookupListField } from './fields/LookupListField';
import { RatingScaleField } from './fields/RatingScaleField';
import { ToggleField } from './fields/ToggleField';
import { ObjectCollectionField } from './fields/ObjectCollectionField';
import { DatePickerField } from './fields/DatePickerField';
import { TimePickerField } from './fields/TimePickerField';
import { GPSCaptureField } from './fields/GPSCaptureField';
import { PhotoCaptureField } from './fields/PhotoCaptureField';
import { FileUploadField } from './fields/FileUploadField';
import { SignaturePadField } from './fields/SignaturePadField';
import { BarcodeScannerField } from './fields/BarcodeScannerField';
import { AudioRecorderField } from './fields/AudioRecorderField';
import { deskFormAPI, publicFormAPI } from '../../services/api';
import { syncAllLookupDatasets } from '../utils/lookupCache';

function getNestedValue(value: unknown, path: string[]): unknown {
    return path.reduce<unknown>((current, segment) => {
        if (!current || typeof current !== 'object') {
            return undefined;
        }
        return (current as Record<string, unknown>)[segment];
    }, value);
}

function evaluateFormFormula(formula: string, responses: Record<string, any>): number | undefined {
    const withSums = formula.replace(/sum\(([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)\)/g, (_, pathExpression: string) => {
        const [collectionKey, ...rest] = pathExpression.split('.');
        const collectionValue = responses[collectionKey];
        if (!Array.isArray(collectionValue)) {
            return '0';
        }
        const total = collectionValue.reduce((sum, item) => {
            const rawValue = rest.length > 0 ? getNestedValue(item, rest) : item;
            const numericValue = Number(rawValue ?? 0);
            return sum + (Number.isFinite(numericValue) ? numericValue : 0);
        }, 0);
        return String(total);
    });

    const expression = withSums.replace(/\b[a-zA-Z_][a-zA-Z0-9_]*\b/g, (token) => {
        const numericValue = Number(responses[token] ?? 0);
        return Number.isFinite(numericValue) ? String(numericValue) : '0';
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

function resolveObjectDefinition(field: FormField, blueprint: FormBlueprint): FormObjectDefinition | undefined {
    if (field.object_definition) {
        return field.object_definition;
    }

    const schemaEntry = (blueprint.schema || []).find((entry: FormSchemaField) => {
        const candidates = [entry.id, entry.field_id, entry.dataset_field_id, entry.key].filter(Boolean);
        return candidates.includes(field.bind) || candidates.includes(field.id);
    });
    if (!schemaEntry) {
        return undefined;
    }

    if (schemaEntry.item_definition) {
        return schemaEntry.item_definition;
    }
    if (Array.isArray(schemaEntry.properties)) {
        return {
            label: schemaEntry.label,
            properties: schemaEntry.properties,
        };
    }
    return undefined;
}

function hasMeaningfulValue(value: unknown): boolean {
    if (Array.isArray(value)) {
        return value.length > 0;
    }
    if (value && typeof value === 'object') {
        return Object.values(value as Record<string, unknown>).some((entry) => hasMeaningfulValue(entry));
    }
    return value !== undefined && value !== null && value !== '';
}

function validateObjectProperties(properties: ObjectPropertyDefinition[], value: unknown, path: string[] = []): string | undefined {
    const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

    for (const property of properties) {
        const currentPath = [...path, property.label || property.key];
        const propertyValue = record[property.key];

        if (property.required && !hasMeaningfulValue(propertyValue)) {
            return `${currentPath.join(' > ')} is required`;
        }

        if (property.type === 'object' && Array.isArray(property.properties)) {
            const nestedError = validateObjectProperties(property.properties, propertyValue, currentPath);
            if (nestedError) {
                return nestedError;
            }
        }
    }

    return undefined;
}

function validateField(field: FormField, value: unknown, blueprint: FormBlueprint): string | undefined {
    if (field.formula) {
        return undefined;
    }

    if (!field.required && (field.type !== 'object_collection' && field.type !== 'object_instance')) {
        return undefined;
    }

    if (field.type === 'object_collection') {
        if (!Array.isArray(value) || value.length === 0) {
            return 'At least one item is required';
        }
        const objectDefinition = resolveObjectDefinition(field, blueprint);
        if (!objectDefinition) {
            return undefined;
        }
        for (let index = 0; index < value.length; index += 1) {
            const rowError = validateObjectProperties(objectDefinition.properties || [], value[index], [`Item ${index + 1}`]);
            if (rowError) {
                return rowError;
            }
        }
        return undefined;
    }

    if (field.type === 'object_instance') {
        if (!hasMeaningfulValue(value)) {
            return 'This section is required';
        }
        const objectDefinition = resolveObjectDefinition(field, blueprint);
        return objectDefinition ? validateObjectProperties(objectDefinition.properties || [], value, [field.label]) : undefined;
    }

    if (field.required && !hasMeaningfulValue(value)) {
        return 'This field is required';
    }
    return undefined;
}

function FieldRenderer({ field, value, onChange, error, lookupContext, blueprint }: any) {
    if (field.formula) {
        return (
            <View style={{ backgroundColor: '#1e293b', borderColor: error ? '#ef4444' : '#334155', borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 12 }}>
                <Text style={{ color: '#cbd5e1', fontSize: 14 }}>{value === undefined || value === null || value === '' ? 'Pending' : String(value)}</Text>
            </View>
        );
    }

    switch (field.type) {
        case 'input_text':
        case 'email_input':
        case 'phone_input':
        case 'textarea':
            return <TextInputField field={field} value={value} onChange={onChange} error={error} />;
        case 'input_number':
            return <NumberInputField field={field} value={value} onChange={onChange} error={error} />;
        case 'radio_group':
            return <RadioGroupField field={field} value={value} onChange={onChange} error={error} />;
        case 'checkbox_group':
            return <CheckboxGroupField field={field} value={value} onChange={onChange} error={error} />;
        case 'dropdown':
            return <DropdownField field={field} value={value} onChange={onChange} error={error} />;
        case 'matrix_table':
            return <MatrixTableField field={field} value={value} onChange={onChange} error={error} />;
        case 'lookup_list':
            return <LookupListField field={field} value={value} onChange={onChange} error={error} lookupContext={lookupContext} />;
        case 'rating_scale':
            return <RatingScaleField field={field} value={value} onChange={onChange} error={error} />;
        case 'toggle':
            return <ToggleField field={field} value={value} onChange={onChange} error={error} />;
        case 'object_collection':
            return <ObjectCollectionField field={field} value={value} onChange={onChange} error={error} objectDefinition={resolveObjectDefinition(field, blueprint)} mode="collection" />;
        case 'object_instance':
            return <ObjectCollectionField field={field} value={value} onChange={onChange} error={error} objectDefinition={resolveObjectDefinition(field, blueprint)} mode="instance" />;
        case 'date_picker':
            return <DatePickerField field={field} value={value} onChange={onChange} error={error} />;
        case 'time_picker':
            return <TimePickerField field={field} value={value} onChange={onChange} error={error} />;
        case 'gps_capture':
            return <GPSCaptureField field={field} value={value} onChange={onChange} error={error} />;
        case 'photo_capture':
            return <PhotoCaptureField field={field} value={value} onChange={onChange} error={error} />;
        case 'file_upload':
            return <FileUploadField field={field} value={value} onChange={onChange} error={error} />;
        case 'signature_pad':
            return <SignaturePadField field={field} value={value} onChange={onChange} error={error} />;
        case 'barcode_scanner':
            return <BarcodeScannerField field={field} value={value} onChange={onChange} error={error} />;
        case 'audio_recorder':
            return <AudioRecorderField field={field} value={value} onChange={onChange} error={error} />;
        default:
            // Fallback
            return (
                <View style={{ backgroundColor: '#1e293b', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#334155' }}>
                    <Text style={{ color: '#f1f5f9' }}>{field.label} ({field.type})</Text>
                    <Text style={{ color: '#94a3b8', fontSize: 12, marginTop: 4 }}>[Component Not Implemented]</Text>
                </View>
            );
    };
}

export function FormRenderer({
    blueprint,
    onSaveDraft,
    onSubmitSuccess,
    onSubmitAttempt,
    lookupMode = 'public',
    extraBottomPad = 0,
}: {
    blueprint: FormBlueprint,
    onSaveDraft?: (responses: Record<string, any>) => void,
    onSubmitSuccess?: () => void,
    /**
     * When provided (desk mode with sync choice), this callback receives the
     * raw form payload and the parent decides whether to sync immediately or
     * queue offline. The parent is responsible for clearing the draft and
     * navigating away after the user makes their choice.
     */
    onSubmitAttempt?: (formId: string, data: Record<string, any>, metadata: Record<string, any>) => void,
    lookupMode?: 'public' | 'desk',
    /** Height of any persistent UI (e.g. tab bar) that overlaps this view from the bottom. */
    extraBottomPad?: number,
}) {
    const insets = useSafeAreaInsets();
    const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
    const [responses, setResponses] = useState<Record<string, any>>({});
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [submitting, setSubmitting] = useState(false);
    const [loadingDraft, setLoadingDraft] = useState(true);
    const [syncingLookups, setSyncingLookups] = useState(false);

    const draftKey = `draft_${blueprint.meta.form_id}`;
    const lookupContext = {
        mode: lookupMode,
        formId: blueprint.meta.form_id,
        slug: blueprint.meta.slug,
    };

    useEffect(() => {
        // Load draft on mount
        const loadDraft = async () => {
            try {
                const d = await AsyncStorage.getItem(draftKey);
                if (d) {
                    Alert.alert(
                        "Resume Survey",
                        "You have an unsaved draft. Do you want to resume?",
                        [
                            { text: "Start Fresh", onPress: () => { AsyncStorage.removeItem(draftKey); setLoadingDraft(false); }, style: "destructive" },
                            { text: "Resume", onPress: () => { setResponses(JSON.parse(d)); setLoadingDraft(false); } }
                        ]
                    );
                } else {
                    setLoadingDraft(false);
                }
            } catch (e) {
                setLoadingDraft(false);
            }
        };
        loadDraft();
    }, [draftKey]);

    useEffect(() => {
        // Save draft when responses change
        if (!loadingDraft && Object.keys(responses).length > 0) {
            AsyncStorage.setItem(draftKey, JSON.stringify(responses)).catch(console.error);
            if (onSaveDraft) onSaveDraft(responses);
        }
    }, [responses, loadingDraft, draftKey, onSaveDraft]);

    useEffect(() => {
        const computedFields = (blueprint.ui || []).flatMap((section) => section.children || []).filter((field) => field.formula);
        if (computedFields.length === 0) {
            return;
        }

        const updates: Record<string, any> = {};
        computedFields.forEach((field) => {
            if (!field.formula) {
                return;
            }
            const computedValue = evaluateFormFormula(field.formula, responses);
            if (computedValue === undefined) {
                return;
            }
            if (responses[field.id] !== computedValue) {
                updates[field.id] = computedValue;
            }
        });

        if (Object.keys(updates).length > 0) {
            setResponses((current) => ({ ...current, ...updates }));
        }
    }, [blueprint.ui, responses]);


    if (loadingDraft) {
        return <ActivityIndicator style={{ flex: 1 }} color="#158754" size="large" />;
    }

    const sections = blueprint.ui || [];
    if (sections.length === 0) {
        return <Text style={{ color: '#fff', padding: 20 }}>This form has no sections.</Text>;
    }

    const currentSection = sections[currentSectionIndex];

    // TODO: Implement proper skip logic evaluating `section_skip` rules
    // For now, simple linear progression.

    const handleNext = () => {
        // Validate current section
        const newErrors: Record<string, string> = {};
        currentSection.children.forEach(field => {
            const visible = isFieldVisible(field.id, blueprint.logic || [], responses);
            if (!visible) {
                return;
            }
            const fieldError = validateField(field, responses[field.id], blueprint);
            if (fieldError) {
                newErrors[field.id] = fieldError;
            }
        });

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        setErrors({});

        if (currentSectionIndex < sections.length - 1) {
            setCurrentSectionIndex(currentSectionIndex + 1);
        } else {
            // Submit
            submitForm();
        }
    };

    const handleBack = () => {
        if (currentSectionIndex > 0) {
            setCurrentSectionIndex(currentSectionIndex - 1);
        }
    };

    const submitForm = async () => {
        setSubmitting(true);
        try {
            if (onSubmitAttempt && lookupMode === 'desk') {
                // Hand off to parent — parent shows sync-choice modal.
                // Parent clears draft and navigates when done.
                onSubmitAttempt(blueprint.meta.form_id, responses, { source: 'mobile_desk' });
                // Keep submitting=true until parent dismisses us; don't reset here.
                return;
            } else if (lookupMode === 'desk') {
                await deskFormAPI.submit(blueprint.meta.form_id, responses, { source: 'mobile_desk' });
            } else {
                await publicFormAPI.submit(blueprint.meta.slug, responses, { source: 'mobile_yard' });
            }
            await AsyncStorage.removeItem(draftKey); // Clear draft on success
            if (onSubmitSuccess) onSubmitSuccess();
        } catch (e: any) {
            Alert.alert("Submission Failed", e?.response?.data?.detail || "An error occurred.");
        } finally {
            setSubmitting(false);
        }
    }

    const handleManualLookupSync = async () => {
        setSyncingLookups(true);
        try {
            const synced = await syncAllLookupDatasets(blueprint, lookupContext);
            Alert.alert('Lookup data synced', synced > 0 ? `Updated ${synced} dataset source${synced === 1 ? '' : 's'}.` : 'No dataset-backed lookup fields were found on this form.');
        } catch {
            Alert.alert('Sync failed', 'Could not refresh lookup data right now. Cached data remains available on this device.');
        } finally {
            setSyncingLookups(false);
        }
    };

    return (
        <View style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + extraBottomPad + 80 }}>
                {currentSection.title && (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <Text style={{ fontSize: 18, fontWeight: '700', color: '#f1f5f9', flex: 1, paddingRight: 12 }}>{currentSection.title}</Text>
                        <TouchableOpacity
                            onPress={handleManualLookupSync}
                            disabled={syncingLookups}
                            style={{
                                paddingHorizontal: 10,
                                paddingVertical: 7,
                                borderRadius: 8,
                                backgroundColor: '#1e293b',
                                borderWidth: 1,
                                borderColor: '#334155',
                            }}
                        >
                            <Text style={{ color: '#cbd5e1', fontSize: 11, fontWeight: '700' }}>
                                {syncingLookups ? 'Syncing...' : 'Sync Data'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                )}
                {currentSection.description && (
                    <Text style={{ fontSize: 13, color: '#94a3b8', marginBottom: 16 }}>{currentSection.description}</Text>
                )}

                {currentSection.children.map(field => {
                    const visible = isFieldVisible(field.id, blueprint.logic || [], responses);
                    if (!visible) return null;

                    return (
                        <View key={field.id} style={{ marginBottom: 16 }}>
                            <Text style={{ fontSize: 14, fontWeight: '600', color: '#e2e8f0', marginBottom: 5 }}>
                                {field.label} {field.required && <Text style={{ color: '#ef4444' }}>*</Text>}
                            </Text>
                            <FieldRenderer
                                field={field}
                                value={responses[field.id]}
                                onChange={(val: any) => setResponses({ ...responses, [field.id]: val })}
                                error={errors[field.id]}
                                lookupContext={lookupContext}
                                blueprint={blueprint}
                            />
                            {errors[field.id] && (
                                <Text style={{ color: '#ef4444', fontSize: 13, marginTop: 6 }}>{errors[field.id]}</Text>
                            )}
                        </View>
                    );
                })}
            </ScrollView>

            {/* Footer Navigation — sits above the tab bar */}
            <View style={{
                position: 'absolute', bottom: extraBottomPad, left: 0, right: 0,
                backgroundColor: '#0f172a', borderTopWidth: 1, borderTopColor: '#1e293b',
                paddingHorizontal: 16, paddingBottom: insets.bottom + 12, paddingTop: 12,
                flexDirection: 'row', justifyContent: 'space-between'
            }}>
                <TouchableOpacity
                    onPress={handleBack}
                    disabled={currentSectionIndex === 0 || submitting}
                    style={{
                        paddingVertical: 11, paddingHorizontal: 20, borderRadius: 8,
                        backgroundColor: currentSectionIndex === 0 ? '#1e293b' : '#334155',
                        opacity: currentSectionIndex === 0 ? 0.4 : 1
                    }}
                >
                    <Text style={{ color: '#f1f5f9', fontWeight: '600', fontSize: 14 }}>Back</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={handleNext}
                    disabled={submitting}
                    style={{
                        paddingVertical: 11, paddingHorizontal: 28, borderRadius: 8,
                        backgroundColor: '#158754', flexDirection: 'row', alignItems: 'center'
                    }}
                >
                    {submitting ? (
                        <ActivityIndicator color="#fff" style={{ marginRight: 8 }} />
                    ) : null}
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>
                        {currentSectionIndex === sections.length - 1 ? 'Submit' : 'Next'}
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}
