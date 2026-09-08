import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FormBlueprint, FormField, FormObjectDefinition, FormSchemaField, ObjectPropertyDefinition } from '@opla/types';
import {
  evaluateAllRules,
  isFieldVisibleByRules,
  isFieldRequiredByRules,
  isSectionVisibleByRules,
  getFilteredOptionsByRules,
  getSetValueEffects,
  getValidationErrorByRules,
  getJumpToSectionTarget,
  RulesEvaluationResult,
} from '../utils/rulesEngine';
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
import { TimeRangeField } from './fields/TimeRangeField';
import { MultiSelectDropdownField } from './fields/MultiSelectDropdownField';
import { FormLinkField } from './fields/FormLinkField';
import { GenericRangeField } from './fields/GenericRangeField';
import { agentFormAPI, publicFormAPI } from '../../services/api';
import { syncAllLookupDatasets } from '../utils/lookupCache';
import { hydrateBlueprintDirectoryForms } from '../utils/directoryFormLookup';
import { fieldUsesDirectoryOptionResolver, resolveDirectoryFormFieldOptions } from '@opla/types';
import {
    collectFieldDefaults,
    displayInputValue,
    ensureFieldIdentity,
    getFieldKey,
    hasMeaningfulValue,
    isOnPlatform,
    resolveAutoValue,
    validateFieldConstraints,
} from '../utils/formFields';

function normalizeBlueprint(blueprint: FormBlueprint): FormBlueprint {
    return {
        ...blueprint,
        ui: (blueprint.ui || []).map((section) => ({
            ...section,
            children: (section.children || []).map((field) => ensureFieldIdentity(field)),
        })),
    };
}

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

function validateField(field: FormField, value: unknown, blueprint: FormBlueprint, rulesResult?: RulesEvaluationResult): string | undefined {
    if (field.formula) {
        return undefined;
    }

    const fieldKey = getFieldKey(field);
    const rulesRequired = rulesResult ? isFieldRequiredByRules(fieldKey, rulesResult) : null;
    const isRequired = rulesRequired !== null ? rulesRequired : field.required;
    const fieldForConstraints = { ...field, required: isRequired };

    if (field.type === 'object_collection') {
        if (isRequired && (!Array.isArray(value) || value.length === 0)) {
            return 'At least one item is required';
        }
        const objectDefinition = resolveObjectDefinition(field, blueprint);
        if (!objectDefinition) {
            return undefined;
        }
        if (Array.isArray(value)) {
            for (let index = 0; index < value.length; index += 1) {
                const rowError = validateObjectProperties(objectDefinition.properties || [], value[index], [`Item ${index + 1}`]);
                if (rowError) {
                    return rowError;
                }
            }
        }
        return undefined;
    }

    if (field.type === 'object_instance') {
        if (isRequired && !hasMeaningfulValue(value)) {
            return 'This section is required';
        }
        const objectDefinition = resolveObjectDefinition(field, blueprint);
        return objectDefinition ? validateObjectProperties(objectDefinition.properties || [], value, [field.label]) : undefined;
    }

    const constraintError = validateFieldConstraints(fieldForConstraints, value);
    if (constraintError) {
        return constraintError;
    }

    if (rulesResult) {
        const rulesValidationError = getValidationErrorByRules(fieldKey, rulesResult);
        if (rulesValidationError) {
            return rulesValidationError;
        }
    }

    return undefined;
}

function FieldRenderer({ field, value, onChange, error, lookupContext, blueprint, responses, rulesResult, onFormLinkPress, prefilledFieldIds }: any) {
    const fieldKey = getFieldKey(field);

    // Read-only view for input_param_readonly fields that have been pre-filled
    if (field.input_param_readonly && prefilledFieldIds?.has(fieldKey)) {
        return (
            <View style={{ backgroundColor: '#1e293b', borderColor: '#334155', borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 12, opacity: 0.8 }}>
                <Text style={{ color: '#cbd5e1', fontSize: 14 }}>{displayInputValue(value) === '' ? '—' : displayInputValue(value)}</Text>
                <Text style={{ color: '#64748b', fontSize: 10, marginTop: 4 }}>Pre-filled · Read only</Text>
            </View>
        );
    }

    if (field.formula || (field.auto_value && field.auto_value_editable === false)) {
        return (
            <View style={{ backgroundColor: '#1e293b', borderColor: error ? '#ef4444' : '#334155', borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 12 }}>
                <Text style={{ color: '#cbd5e1', fontSize: 14 }}>{displayInputValue(value) === '' ? 'Will be set automatically' : displayInputValue(value)}</Text>
            </View>
        );
    }

    // Form link — navigational card, not a data field
    if (field.type === 'form_link') {
        return (
            <FormLinkField
                field={field}
                onPress={() => {
                    if (onFormLinkPress && (field.linked_form_id || field.linked_form_slug)) {
                        // Resolve parameter mapping
                        const params: Record<string, any> = {};
                        if (field.linked_form_param_map) {
                            for (const [sourceFieldId, targetFieldId] of Object.entries(field.linked_form_param_map as Record<string, string>)) {
                                if (responses[sourceFieldId] !== undefined) {
                                    params[targetFieldId] = responses[sourceFieldId];
                                }
                            }
                        }
                        onFormLinkPress({
                            formId: field.linked_form_id,
                            formSlug: field.linked_form_slug,
                            params,
                        });
                    }
                }}
                error={error}
            />
        );
    }

    const directoryResolvedField = fieldUsesDirectoryOptionResolver(field)
        ? { ...field, options: resolveDirectoryFormFieldOptions(field, responses) }
        : field;

    const filteredOptions = rulesResult
        ? getFilteredOptionsByRules(fieldKey, rulesResult, responses, directoryResolvedField.options)
        : null;
    const effectiveField = filteredOptions
        ? { ...directoryResolvedField, options: filteredOptions }
        : directoryResolvedField;

    switch (effectiveField.type) {
        case 'input_text':
        case 'email_input':
        case 'phone_input':
        case 'textarea':
            return <TextInputField field={effectiveField} value={value} onChange={onChange} error={error} />;
        case 'input_number':
            return <NumberInputField field={effectiveField} value={value} onChange={onChange} error={error} />;
        case 'radio_group':
            return <RadioGroupField field={effectiveField} value={value} onChange={onChange} error={error} responses={responses} />;
        case 'checkbox_group':
            return <CheckboxGroupField field={effectiveField} value={value} onChange={onChange} error={error} responses={responses} />;
        case 'dropdown':
            return <DropdownField field={effectiveField} value={value} onChange={onChange} error={error} responses={responses} />;
        case 'multi_select_dropdown':
            return <MultiSelectDropdownField field={effectiveField} value={value} onChange={onChange} error={error} responses={responses} />;
        case 'time_range':
            return <TimeRangeField field={effectiveField} value={value} onChange={onChange} error={error} />;
        case 'matrix_table':
            return <MatrixTableField field={effectiveField} value={value} onChange={onChange} error={error} />;
        case 'lookup_list':
            return <LookupListField field={effectiveField} value={value} onChange={onChange} error={error} lookupContext={lookupContext} responses={responses} rulesResult={rulesResult} />;
        case 'rating_scale':
            return <RatingScaleField field={effectiveField} value={value} onChange={onChange} error={error} />;
        case 'toggle':
            return <ToggleField field={effectiveField} value={value} onChange={onChange} error={error} />;
        case 'object_collection':
            return <ObjectCollectionField field={effectiveField} value={value} onChange={onChange} error={error} objectDefinition={resolveObjectDefinition(effectiveField, blueprint)} mode="collection" />;
        case 'object_instance':
            return <ObjectCollectionField field={effectiveField} value={value} onChange={onChange} error={error} objectDefinition={resolveObjectDefinition(effectiveField, blueprint)} mode="instance" />;
        case 'date_picker':
            return <DatePickerField field={effectiveField} value={value} onChange={onChange} error={error} />;
        case 'time_picker':
            return <TimePickerField field={effectiveField} value={value} onChange={onChange} error={error} />;
        case 'generic_range':
            return <GenericRangeField field={effectiveField} value={value} onChange={onChange} error={error} />;
        case 'gps_capture':
            return <GPSCaptureField field={effectiveField} value={value} onChange={onChange} error={error} />;
        case 'photo_capture':
            return <PhotoCaptureField field={effectiveField} value={value} onChange={onChange} error={error} />;
        case 'file_upload':
            return <FileUploadField field={effectiveField} value={value} onChange={onChange} error={error} />;
        case 'signature_pad':
            return <SignaturePadField field={effectiveField} value={value} onChange={onChange} error={error} />;
        case 'barcode_scanner':
            return <BarcodeScannerField field={effectiveField} value={value} onChange={onChange} error={error} />;
        case 'audio_recorder':
            return <AudioRecorderField field={effectiveField} value={value} onChange={onChange} error={error} />;
        default:
            // Fallback
            return (
                <View style={{ backgroundColor: '#1e293b', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#334155' }}>
                    <Text style={{ color: '#f1f5f9' }}>{effectiveField.label} ({effectiveField.type})</Text>
                    <Text style={{ color: '#94a3b8', fontSize: 12, marginTop: 4 }}>[Component Not Implemented]</Text>
                </View>
            );
    }
}

export function FormRenderer({
    blueprint,
    onSaveDraft,
    onSubmitSuccess,
    onSubmitAttempt,
    onFormLinkPress,
    prefillData,
    lookupMode = 'public',
    extraBottomPad = 0,
}: {
    blueprint: FormBlueprint,
    onSaveDraft?: (responses: Record<string, any>) => void,
    onSubmitSuccess?: () => void,
    /**
     * When provided (agent mode with sync choice), this callback receives the
     * raw form payload and the parent decides whether to sync immediately or
     * queue offline. The parent is responsible for clearing the draft and
     * navigating away after the user makes their choice.
     */
    onSubmitAttempt?: (formId: string, data: Record<string, any>, metadata: Record<string, any>) => void,
    /** Called when a form_link field is tapped. The parent is responsible for navigating to the linked form. */
    onFormLinkPress?: (link: { formId?: string; formSlug?: string; params: Record<string, any> }) => void,
    /** Pre-fill data passed from a parent form via form_link parameter mapping */
    prefillData?: Record<string, any>,
    lookupMode?: 'public' | 'agent',
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
    const [runtimeBlueprint, setRuntimeBlueprint] = useState(() => normalizeBlueprint(blueprint));

    const lookupContext = useMemo(() => ({
        mode: lookupMode,
        formId: blueprint.meta.form_id,
        slug: blueprint.meta.slug,
    }), [lookupMode, blueprint.meta.form_id, blueprint.meta.slug]);

    useEffect(() => {
        let mounted = true;
        hydrateBlueprintDirectoryForms(blueprint, lookupContext).then((next) => {
            if (mounted) {
                setRuntimeBlueprint(normalizeBlueprint(next));
            }
        });
        return () => {
            mounted = false;
        };
    }, [blueprint, lookupContext]);

    // Track which field IDs were pre-filled from a parent form
    const prefilledFieldIds = useMemo(() => {
        if (!prefillData) return new Set<string>();
        return new Set(Object.keys(prefillData));
    }, [prefillData]);

    const allUiFields = useMemo(
        () => (runtimeBlueprint.ui || []).flatMap((section) => section.children || []),
        [runtimeBlueprint.ui],
    );

    const draftKey = `draft_${blueprint.meta.form_id}`;

    useEffect(() => {
        const loadDraft = async () => {
            try {
                const d = await AsyncStorage.getItem(draftKey);
                if (d) {
                    Alert.alert(
                        "Resume Survey",
                        "You have an unsaved draft. Do you want to resume?",
                        [
                            { text: "Start Fresh", onPress: () => { AsyncStorage.removeItem(draftKey); setResponses(prefillData || {}); setLoadingDraft(false); }, style: "destructive" },
                            { text: "Resume", onPress: () => { setResponses({ ...(prefillData || {}), ...JSON.parse(d) }); setLoadingDraft(false); } }
                        ]
                    );
                } else {
                    if (prefillData && Object.keys(prefillData).length > 0) {
                        setResponses(prefillData);
                    }
                    setLoadingDraft(false);
                }
            } catch (e) {
                setLoadingDraft(false);
            }
        };
        loadDraft();
    }, [draftKey]);

    useEffect(() => {
        if (loadingDraft) {
            return;
        }
        setResponses((current) => {
            const defaults = collectFieldDefaults(allUiFields, current);
            if (Object.keys(defaults).length === 0) {
                return current;
            }
            return { ...defaults, ...current };
        });
    }, [loadingDraft, allUiFields]);

    useEffect(() => {
        // Save draft when responses change
        if (!loadingDraft && Object.keys(responses).length > 0) {
            AsyncStorage.setItem(draftKey, JSON.stringify(responses)).catch(console.error);
            if (onSaveDraft) onSaveDraft(responses);
        }
    }, [responses, loadingDraft, draftKey, onSaveDraft]);

    useEffect(() => {
        const computedFields = (runtimeBlueprint.ui || []).flatMap((section) => section.children || []).filter((field) => field.formula);
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
            const key = getFieldKey(field);
            if (!key) {
                return;
            }
            if (responses[key] !== computedValue) {
                updates[key] = computedValue;
            }
        });

        if (Object.keys(updates).length > 0) {
            setResponses((current) => ({ ...current, ...updates }));
        }
    }, [runtimeBlueprint.ui, responses]);

    // Evaluate centralized rules on every response change
    const rulesResult = useMemo(
        () => evaluateAllRules(runtimeBlueprint.rules || [], responses, runtimeBlueprint),
        [runtimeBlueprint, responses]
    );

    // Apply SET_VALUE effects from rules engine
    useEffect(() => {
        const setValueEffects = getSetValueEffects(rulesResult);
        if (setValueEffects.length === 0) return;

        const updates: Record<string, any> = {};
        for (const { fieldId, value } of setValueEffects) {
            // Only update if value differs to prevent infinite re-render loops
            if (String(responses[fieldId] ?? '') !== String(value)) {
                updates[fieldId] = value;
            }
        }

        if (Object.keys(updates).length > 0) {
            setResponses(current => ({ ...current, ...updates }));
        }
    }, [rulesResult]);

    // Helper to resolve auto_values
    const resolveAuto = (autoValue: string) => resolveAutoValue(autoValue);

    // Evaluate auto-values on mount/load
    useEffect(() => {
        const autoFields = (runtimeBlueprint.ui || [])
            .flatMap((section) => section.children || [])
            .filter((field) => field.auto_value && (!field.auto_value_timing || field.auto_value_timing === 'on_load'));

        const updates: Record<string, any> = {};
        autoFields.forEach((field) => {
            const key = getFieldKey(field);
            if (!key) {
                return;
            }
            if (responses[key] === undefined || responses[key] === null || responses[key] === '') {
                const resolved = resolveAuto(field.auto_value!);
                if (resolved !== undefined) {
                    updates[key] = resolved;
                }
            }
        });

        if (Object.keys(updates).length > 0) {
            setResponses((current) => ({ ...current, ...updates }));
        }
    }, [runtimeBlueprint.ui]);

    // Filter sections based on rules engine
    const sections = useMemo(() => {
        const allSections = runtimeBlueprint.ui || [];
        return allSections.filter(section => {
            if (!isOnPlatform(section, 'mobile')) return false;
            const rulesVisible = isSectionVisibleByRules(section.id, rulesResult);
            if (rulesVisible === false) return false;
            return true;
        });
    }, [runtimeBlueprint.ui, rulesResult]);

    // Clamp currentSectionIndex to stay within the valid range of filtered sections
    useEffect(() => {
        if (currentSectionIndex >= sections.length && sections.length > 0) {
            setCurrentSectionIndex(sections.length - 1);
        }
    }, [sections.length, currentSectionIndex]);

    const currentSection = sections[currentSectionIndex] || sections[0];
    const isSingleMode = currentSection?.render_mode === 'single';

    const visibleFields = useMemo(() => {
        return currentSection ? currentSection.children.filter(field => {
            if (!isOnPlatform(field, 'mobile')) return false;
            const rulesVisible = isFieldVisibleByRules(getFieldKey(field), rulesResult);
            return rulesVisible !== null ? rulesVisible : true;
        }) : [];
    }, [currentSection, rulesResult]);

    const [activeFieldId, setActiveFieldId] = useState<string | null>(null);

    // Sync activeFieldId on load / check if it becomes hidden reactively
    useEffect(() => {
        if (isSingleMode && visibleFields.length > 0) {
            if (!activeFieldId || !visibleFields.some(f => getFieldKey(f) === activeFieldId)) {
                setActiveFieldId(getFieldKey(visibleFields[0]));
            }
        } else {
            setActiveFieldId(null);
        }
    }, [isSingleMode, visibleFields, activeFieldId]);

    // Initializer when loading draft finishes
    useEffect(() => {
        if (!loadingDraft && sections.length > 0) {
            const firstSec = sections[0];
            if (firstSec && firstSec.render_mode === 'single') {
                const vFields = firstSec.children.filter(field => {
                    if (!isOnPlatform(field, 'mobile')) return false;
                    const rulesVisible = isFieldVisibleByRules(getFieldKey(field), rulesResult);
                    return rulesVisible !== null ? rulesVisible : true;
                });
                if (vFields.length > 0) {
                    setActiveFieldId(getFieldKey(vFields[0]));
                }
            }
        }
    }, [loadingDraft]);

    // Returns the next index of a section that has visible content
    const findNextSectionIndex = (startIndex: number, direction: 'forward' | 'backward'): number => {
        let index = startIndex;
        while (index >= 0 && index < sections.length) {
            const sec = sections[index];
            const hasFormLinks = sec.children.some(f => f.type === 'form_link');
            const vFields = sec.children.filter(field => {
                if (!isOnPlatform(field, 'mobile')) return false;
                const rulesVisible = isFieldVisibleByRules(getFieldKey(field), rulesResult);
                return rulesVisible !== null ? rulesVisible : true;
            });
            // A section is navigable/not empty if it has visible fields or contains form links (menu section)
            if (vFields.length > 0 || hasFormLinks) {
                return index;
            }
            index = direction === 'forward' ? index + 1 : index - 1;
        }
        return -1;
    };

    const changeSection = (newIndex: number, direction: 'forward' | 'backward') => {
        const targetIndex = findNextSectionIndex(newIndex, direction);
        if (targetIndex >= 0) {
            setCurrentSectionIndex(targetIndex);
            const nextSec = sections[targetIndex];
            if (nextSec && nextSec.render_mode === 'single') {
                const vFields = nextSec.children.filter(field => {
                    if (!isOnPlatform(field, 'mobile')) return false;
                    const rulesVisible = isFieldVisibleByRules(getFieldKey(field), rulesResult);
                    return rulesVisible !== null ? rulesVisible : true;
                });
                if (vFields.length > 0) {
                    if (direction === 'forward') {
                        setActiveFieldId(getFieldKey(vFields[0]));
                    } else {
                        setActiveFieldId(getFieldKey(vFields[vFields.length - 1]));
                    }
                } else {
                    setActiveFieldId(null);
                }
            } else {
                setActiveFieldId(null);
            }
        } else {
            // No more sections in this direction
            if (direction === 'forward') {
                submitForm();
            }
        }
    };

    const singleModeProgressText = useMemo(() => {
        if (!isSingleMode || visibleFields.length <= 1 || !activeFieldId) return null;
        const index = visibleFields.findIndex(f => getFieldKey(f) === activeFieldId);
        if (index < 0) return null;
        return `${index + 1} of ${visibleFields.length}`;
    }, [isSingleMode, visibleFields, activeFieldId]);

    if (loadingDraft) {
        return <ActivityIndicator style={{ flex: 1 }} color="#158754" size="large" />;
    }

    if (sections.length === 0) {
        return <Text style={{ color: '#fff', padding: 20 }}>This form has no sections.</Text>;
    }


    const handleNext = () => {
        if (isSingleMode && activeFieldId) {
            // Validate ONLY the current active field
            const activeField = visibleFields.find(f => getFieldKey(f) === activeFieldId);
            if (activeField) {
                const key = getFieldKey(activeField);
                const fieldError = validateField(activeField, responses[key], runtimeBlueprint, rulesResult);
                if (fieldError) {
                    setErrors({ [key]: fieldError });
                    return;
                }
            }
            setErrors({});

            // Block navigation if rules engine blocks it
            if (rulesResult.navigationBlocked) {
                return;
            }

            // Move to the next visible field in this section if there is one
            const currentIndex = visibleFields.findIndex(f => getFieldKey(f) === activeFieldId);
            if (currentIndex >= 0 && currentIndex < visibleFields.length - 1) {
                setActiveFieldId(getFieldKey(visibleFields[currentIndex + 1]));
                return;
            }
        } else {
            // List Mode: Validate ALL visible fields in the current section
            const newErrors: Record<string, string> = {};
            visibleFields.forEach(field => {
                const key = getFieldKey(field);
                const fieldError = validateField(field, responses[key], runtimeBlueprint, rulesResult);
                if (fieldError) {
                    newErrors[key] = fieldError;
                }
            });

            if (Object.keys(newErrors).length > 0) {
                setErrors(newErrors);
                return;
            }
            setErrors({});

            // Block navigation if rules engine blocks it
            if (rulesResult.navigationBlocked) {
                return;
            }
        }

        // --- Transitioning to the next section ---
        // Check for JUMP_TO_SECTION from the centralized rules engine
        const jumpTarget = getJumpToSectionTarget(rulesResult);
        if (jumpTarget) {
            const targetIndex = sections.findIndex(s => s.id === jumpTarget);
            if (targetIndex >= 0) {
                changeSection(targetIndex, 'forward');
                return;
            }
        }

        if (currentSectionIndex < sections.length - 1) {
            changeSection(currentSectionIndex + 1, 'forward');
        } else {
            submitForm();
        }
    };

    const handleBack = () => {
        if (isSingleMode && activeFieldId) {
            const currentIndex = visibleFields.findIndex(f => getFieldKey(f) === activeFieldId);
            if (currentIndex > 0) {
                setActiveFieldId(getFieldKey(visibleFields[currentIndex - 1]));
                return;
            }
        }

        if (currentSectionIndex > 0) {
            changeSection(currentSectionIndex - 1, 'backward');
        }
    };


    const submitForm = async () => {
        setSubmitting(true);
        try {
            // Resolve on_submit auto-values
            const submitAutoFields = (runtimeBlueprint.ui || [])
                .flatMap((section) => section.children || [])
                .filter((field) => field.auto_value && field.auto_value_timing === 'on_submit');

            const finalResponses = { ...responses };
            submitAutoFields.forEach((field) => {
                const resolved = resolveAutoValue(field.auto_value!);
                const key = getFieldKey(field);
                if (resolved !== undefined && key) {
                    finalResponses[key] = resolved;
                }
            });

            if (onSubmitAttempt && lookupMode === 'agent') {
                onSubmitAttempt(runtimeBlueprint.meta.form_id, finalResponses, { source: 'mobile_agent' });
                return;
            } else if (lookupMode === 'agent') {
                await agentFormAPI.submit(runtimeBlueprint.meta.form_id, finalResponses, { source: 'mobile_agent' });
            } else {
                await publicFormAPI.submit(runtimeBlueprint.meta.slug, finalResponses, { source: 'mobile_pulse' });
            }
            await AsyncStorage.removeItem(draftKey); // Clear draft on success
            if (onSubmitSuccess) onSubmitSuccess();
        } catch (e: any) {
            Alert.alert("Submission Failed", e?.response?.data?.detail || "An error occurred.");
        } finally {
            setSubmitting(false);
        }
    };

    const handleManualLookupSync = async () => {
        setSyncingLookups(true);
        try {
            const synced = await syncAllLookupDatasets(runtimeBlueprint, lookupContext);
            const hydrated = await hydrateBlueprintDirectoryForms(runtimeBlueprint, lookupContext);
            setRuntimeBlueprint(normalizeBlueprint(hydrated));
            Alert.alert('Lookup data synced', synced > 0 ? `Updated ${synced} dataset source${synced === 1 ? '' : 's'}.` : 'Catalog and dataset lookups refreshed.');
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
                        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', paddingRight: 12 }}>
                            <Text style={{ fontSize: 18, fontWeight: '700', color: '#f1f5f9', marginRight: 8 }}>{currentSection.title}</Text>
                            {singleModeProgressText && (
                                <View style={{ backgroundColor: 'rgba(59, 130, 246, 0.15)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(59, 130, 246, 0.3)' }}>
                                    <Text style={{ color: '#60a5fa', fontSize: 11, fontWeight: '600' }}>{singleModeProgressText}</Text>
                                </View>
                            )}
                        </View>
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
                    const key = getFieldKey(field);
                    if (!isOnPlatform(field, 'mobile')) return null;
                    const rulesVisible = isFieldVisibleByRules(key, rulesResult);
                    const visible = rulesVisible !== null ? rulesVisible : true;
                    if (!visible) return null;

                    if (isSingleMode && key !== activeFieldId) return null;

                    const rulesRequired = isFieldRequiredByRules(key, rulesResult);
                    const isRequired = rulesRequired !== null ? rulesRequired : field.required;

                    // Form link fields render without a label header (the card IS the label)
                    if (field.type === 'form_link') {
                        return (
                            <View key={key || field.label} style={{ marginBottom: 12 }}>
                                <FieldRenderer
                                    field={field}
                                    value={undefined}
                                    onChange={() => {}}
                                    lookupContext={lookupContext}
                                    blueprint={runtimeBlueprint}
                                    responses={responses}
                                    rulesResult={rulesResult}
                                    onFormLinkPress={onFormLinkPress}
                                    prefilledFieldIds={prefilledFieldIds}
                                />
                            </View>
                        );
                    }

                    return (
                        <View key={key || field.label} style={{ marginBottom: 16 }}>
                            <Text style={{ fontSize: 14, fontWeight: '600', color: '#e2e8f0', marginBottom: 5 }}>
                                {field.label} {isRequired && <Text style={{ color: '#ef4444' }}>*</Text>}
                                {field.is_input_param && prefilledFieldIds.has(key) && (
                                    <Text style={{ color: '#64748b', fontSize: 11, fontWeight: '400' }}> ↓ param</Text>
                                )}
                            </Text>
                            <FieldRenderer
                                field={field}
                                value={responses[key]}
                                onChange={(val: any) => {
                                    setResponses({ ...responses, [key]: val });
                                    if (errors[key]) {
                                        setErrors(prev => {
                                            const next = { ...prev };
                                            delete next[key];
                                            return next;
                                        });
                                    }
                                }}
                                error={errors[key]}
                                lookupContext={lookupContext}
                                blueprint={runtimeBlueprint}
                                responses={responses}
                                rulesResult={rulesResult}
                                onFormLinkPress={onFormLinkPress}
                                prefilledFieldIds={prefilledFieldIds}
                            />
                            {errors[key] && (
                                <Text style={{ color: '#ef4444', fontSize: 13, marginTop: 6 }}>{errors[key]}</Text>
                            )}
                        </View>
                    );
                })}
            </ScrollView>

            {/* Footer Navigation — hide for menu-only sections (all fields are form_link) */}
            {!currentSection.children.every(f => f.type === 'form_link') && (
            <View style={{
                position: 'absolute', bottom: extraBottomPad, left: 0, right: 0,
                backgroundColor: '#0f172a', borderTopWidth: 1, borderTopColor: '#1e293b',
                paddingHorizontal: 16, paddingBottom: insets.bottom + 12, paddingTop: 12,
                flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'
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

                {rulesResult.navigationBlocked && (
                    <Text style={{ color: '#f59e0b', fontSize: 12, flex: 1, textAlign: 'center', marginHorizontal: 8 }} numberOfLines={2}>
                        ⚠️ {rulesResult.navigationBlockMessage}
                    </Text>
                )}

                <TouchableOpacity
                    onPress={handleNext}
                    disabled={submitting || rulesResult.navigationBlocked}
                    style={{
                        paddingVertical: 11, paddingHorizontal: 28, borderRadius: 8,
                        backgroundColor: rulesResult.navigationBlocked ? '#334155' : '#158754',
                        opacity: rulesResult.navigationBlocked ? 0.6 : 1,
                        flexDirection: 'row', alignItems: 'center'
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
            )}
        </View>
    );
}
