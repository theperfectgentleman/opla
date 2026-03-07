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
        <View>
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
                    borderRadius: 8,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    color: '#f1f5f9',
                    fontSize: 14,
                }}
            />
            {error && (
                <Text style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>{error}</Text>
            )}
        </View>
    );
}
