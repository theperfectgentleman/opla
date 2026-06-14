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
    const handleTextChange = (text: string) => {
        // Allow only numbers and a single decimal point
        let cleaned = text.replace(/[^0-9.]/g, '');
        const parts = cleaned.split('.');
        if (parts.length > 2) {
            cleaned = parts[0] + '.' + parts.slice(1).join('');
        }
        onChange(cleaned);
    };

    const handleBlur = () => {
        if (value && field.decimal_places !== undefined && field.decimal_places !== null) {
            const num = parseFloat(value);
            if (!isNaN(num)) {
                onChange(num.toFixed(field.decimal_places));
            }
        }
    };

    return (
        <View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {field.input_prefix ? (
                    <View style={{
                        backgroundColor: '#334155',
                        borderTopLeftRadius: 8,
                        borderBottomLeftRadius: 8,
                        borderWidth: 1.5,
                        borderColor: error ? '#ef4444' : '#334155',
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                        justifyContent: 'center',
                    }}>
                        <Text style={{ color: '#cbd5e1', fontSize: 14, fontWeight: '600' }}>{field.input_prefix}</Text>
                    </View>
                ) : null}

                <TextInput
                    value={value || ''}
                    onChangeText={handleTextChange}
                    onBlur={handleBlur}
                    placeholder={field.placeholder || field.label}
                    placeholderTextColor="#64748b"
                    keyboardType="decimal-pad"
                    style={{
                        flex: 1,
                        backgroundColor: '#1e293b',
                        borderColor: error ? '#ef4444' : '#334155',
                        borderWidth: 1.5,
                        borderLeftWidth: field.input_prefix ? 0 : 1.5,
                        borderRightWidth: field.input_suffix ? 0 : 1.5,
                        borderTopLeftRadius: field.input_prefix ? 0 : 8,
                        borderBottomLeftRadius: field.input_prefix ? 0 : 8,
                        borderTopRightRadius: field.input_suffix ? 0 : 8,
                        borderBottomRightRadius: field.input_suffix ? 0 : 8,
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                        color: '#f1f5f9',
                        fontSize: 14,
                    }}
                />

                {field.input_suffix ? (
                    <View style={{
                        backgroundColor: '#334155',
                        borderTopRightRadius: 8,
                        borderBottomRightRadius: 8,
                        borderWidth: 1.5,
                        borderColor: error ? '#ef4444' : '#334155',
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                        justifyContent: 'center',
                    }}>
                        <Text style={{ color: '#cbd5e1', fontSize: 14, fontWeight: '600' }}>{field.input_suffix}</Text>
                    </View>
                ) : null}
            </View>
            {error && (
                <Text style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>{error}</Text>
            )}
        </View>
    );
}
