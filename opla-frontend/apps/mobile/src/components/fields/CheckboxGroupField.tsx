import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { FormField } from '@opla/types';

interface Props {
    field: FormField;
    value: any; // usually an array of strings
    onChange: (value: any) => void;
    error?: string;
}

export function CheckboxGroupField({ field, value, onChange, error }: Props) {
    const options = field.options || [];
    const selectedValues: string[] = Array.isArray(value) ? value : [];

    const toggleOption = (optValue: string) => {
        if (selectedValues.includes(optValue)) {
            onChange(selectedValues.filter((v) => v !== optValue));
        } else {
            onChange([...selectedValues, optValue]);
        }
    };

    return (
        <View style={{ marginBottom: 16 }}>
            <View style={{ gap: 8 }}>
                {options.map((opt) => {
                    const isSelected = selectedValues.includes(opt.value);
                    return (
                        <TouchableOpacity
                            key={opt.value}
                            onPress={() => toggleOption(opt.value)}
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 12,
                                backgroundColor: isSelected ? '#1e1b4b' : '#1e293b',
                                borderWidth: 1.5,
                                borderColor: isSelected ? '#6366f1' : '#334155',
                                borderRadius: 12,
                                padding: 14,
                            }}
                        >
                            <View
                                style={{
                                    width: 20,
                                    height: 20,
                                    borderRadius: 4,
                                    borderWidth: 2,
                                    borderColor: isSelected ? '#6366f1' : '#475569',
                                    backgroundColor: isSelected ? '#6366f1' : 'transparent',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                            >
                                {isSelected && (
                                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>✓</Text>
                                )}
                            </View>
                            <Text style={{ color: '#f1f5f9', fontSize: 16 }}>{opt.label}</Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
            {error && (
                <Text style={{ color: '#ef4444', fontSize: 13, marginTop: 6 }}>{error}</Text>
            )}
        </View>
    );
}
