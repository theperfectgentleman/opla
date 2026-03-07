import React from 'react';
import { TextInput, View, Text } from 'react-native';
import { FormField } from '@opla/types';

interface NumberInputFieldProps {
    field: FormField;
    value?: string;
    error?: string;
    onChange: (value: string) => void;
}

export function NumberInputField({ field, value, error, onChange }: NumberInputFieldProps) {
    return (
        <View style={{ marginBottom: 16 }}>
            <TextInput
                value={value || ''}
                onChangeText={onChange}
                placeholder={field.placeholder || field.label}
                placeholderTextColor="#64748b"
                keyboardType="numeric"
                style={{
                    backgroundColor: '#1e293b',
                    borderColor: error ? '#ef4444' : '#334155',
                    borderWidth: 1,
                    borderRadius: 12,
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    color: '#f1f5f9',
                    fontSize: 16,
                }}
            />
            {error && (
                <Text style={{ color: '#ef4444', fontSize: 13, marginTop: 6 }}>{error}</Text>
            )}
        </View>
    );
}
