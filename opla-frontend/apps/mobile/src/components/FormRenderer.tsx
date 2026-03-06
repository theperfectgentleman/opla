import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FormBlueprint, FormSection, FormField } from '@opla/types';
import { isFieldVisible } from '../utils/logic';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TextInputField } from './fields/TextInputField';
import { NumberInputField } from './fields/NumberInputField';
import { RadioGroupField } from './fields/RadioGroupField';
import { CheckboxGroupField } from './fields/CheckboxGroupField';
import { DropdownField } from './fields/DropdownField';
import { MatrixTableField } from './fields/MatrixTableField';
import { LookupListField } from './fields/LookupListField';
import { publicFormAPI } from '../../services/api';

function FieldRenderer({ field, value, onChange, error }: any) {
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
            return <LookupListField field={field} value={value} onChange={onChange} error={error} />;
        default:
            // Fallback
            return (
                <View style={{ backgroundColor: '#1e293b', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#334155' }}>
                    <Text style={{ color: '#f1f5f9' }}>{field.label} ({field.type})</Text>
                    <Text style={{ color: '#94a3b8', fontSize: 12, marginTop: 4 }}>[Component Not Implemented]</Text>
                </View>
            );
    }
}

export function FormRenderer({
    blueprint,
    onSaveDraft,
    onSubmitSuccess
}: {
    blueprint: FormBlueprint,
    onSaveDraft?: (responses: Record<string, any>) => void,
    onSubmitSuccess?: () => void
}) {
    const insets = useSafeAreaInsets();
    const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
    const [responses, setResponses] = useState<Record<string, any>>({});
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [submitting, setSubmitting] = useState(false);
    const [loadingDraft, setLoadingDraft] = useState(true);

    const draftKey = `draft_${blueprint.meta.form_id}`;

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


    if (loadingDraft) {
        return <ActivityIndicator style={{ flex: 1 }} color="#6366f1" size="large" />;
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
            if (visible && field.required && !responses[field.id]) {
                newErrors[field.id] = 'This field is required';
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
            await publicFormAPI.submit(blueprint.meta.slug, responses, { source: 'mobile_yard' });
            await AsyncStorage.removeItem(draftKey); // Clear draft on success
            if (onSubmitSuccess) onSubmitSuccess();
        } catch (e: any) {
            Alert.alert("Submission Failed", e?.response?.data?.detail || "An error occurred.");
        } finally {
            setSubmitting(false);
        }
    }


    return (
        <View style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 100 }}>
                {currentSection.title && (
                    <Text style={{ fontSize: 24, fontWeight: '700', color: '#f1f5f9', marginBottom: 8 }}>{currentSection.title}</Text>
                )}
                {currentSection.description && (
                    <Text style={{ fontSize: 16, color: '#94a3b8', marginBottom: 24 }}>{currentSection.description}</Text>
                )}

                {currentSection.children.map(field => {
                    const visible = isFieldVisible(field.id, blueprint.logic || [], responses);
                    if (!visible) return null;

                    return (
                        <View key={field.id} style={{ marginBottom: 24 }}>
                            <Text style={{ fontSize: 16, fontWeight: '600', color: '#e2e8f0', marginBottom: 8 }}>
                                {field.label} {field.required && <Text style={{ color: '#ef4444' }}>*</Text>}
                            </Text>
                            <FieldRenderer
                                field={field}
                                value={responses[field.id]}
                                onChange={(val: any) => setResponses({ ...responses, [field.id]: val })}
                                error={errors[field.id]}
                            />
                            {errors[field.id] && (
                                <Text style={{ color: '#ef4444', fontSize: 13, marginTop: 6 }}>{errors[field.id]}</Text>
                            )}
                        </View>
                    );
                })}
            </ScrollView>

            {/* Footer Navigation */}
            <View style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                backgroundColor: '#0f172a', borderTopWidth: 1, borderTopColor: '#1e293b',
                paddingHorizontal: 20, paddingBottom: insets.bottom + 16, paddingTop: 16,
                flexDirection: 'row', justifyContent: 'space-between'
            }}>
                <TouchableOpacity
                    onPress={handleBack}
                    disabled={currentSectionIndex === 0 || submitting}
                    style={{
                        paddingVertical: 14, paddingHorizontal: 24, borderRadius: 12,
                        backgroundColor: currentSectionIndex === 0 ? '#1e293b' : '#334155',
                        opacity: currentSectionIndex === 0 ? 0.5 : 1
                    }}
                >
                    <Text style={{ color: '#f1f5f9', fontWeight: '600' }}>Back</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={handleNext}
                    disabled={submitting}
                    style={{
                        paddingVertical: 14, paddingHorizontal: 32, borderRadius: 12,
                        backgroundColor: '#6366f1', flexDirection: 'row', alignItems: 'center'
                    }}
                >
                    {submitting ? (
                        <ActivityIndicator color="#fff" style={{ marginRight: 8 }} />
                    ) : null}
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
                        {currentSectionIndex === sections.length - 1 ? 'Submit' : 'Next'}
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}
