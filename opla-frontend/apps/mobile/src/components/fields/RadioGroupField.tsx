import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { FormField } from '@opla/types';

interface Props {
    field: FormField;
    value: string;
    onChange: (value: string) => void;
    error?: string;
}

export function RadioGroupField({ field, value, onChange, error }: Props) {
    const options = field.options || [];

    return (
        <View>
            <View style={{ gap: 6 }}>
                {options.map((opt) => {
                    const isSelected = value === opt.value;
                    return (
                        <TouchableOpacity
                            key={opt.value}
                            onPress={() => onChange(opt.value)}
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 10,
                                backgroundColor: isSelected ? '#0d2b1e' : '#1e293b',
                                borderWidth: 1.5,
                                borderColor: isSelected ? '#158754' : '#334155',
                                borderRadius: 8,
                                paddingVertical: 10,
                                paddingHorizontal: 12,
                            }}
                        >
                            <View
                                style={{
                                    width: 18,
                                    height: 18,
                                    borderRadius: 9,
                                    borderWidth: 2,
                                    borderColor: isSelected ? '#158754' : '#475569',
                                    backgroundColor: isSelected ? '#158754' : 'transparent',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                            >
                                {isSelected && (
                                    <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: '#fff' }} />
                                )}
                            </View>
                            <Text style={{ color: '#f1f5f9', fontSize: 14 }}>{opt.label}</Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
            {error && (
                <Text style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>{error}</Text>
            )}
        </View>
    );
}
