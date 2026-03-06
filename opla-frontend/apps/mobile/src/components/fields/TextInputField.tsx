import React from 'react';
import { TextInput, View, Text } from 'react-native';
import { FormField } from '@opla/types';

interface TextInputFieldProps {
    field: FormField;
    value?: string;
    error?: string;
    onChange: (value: string) => void;
}

export function TextInputField({ field, value, error, onChange }: TextInputFieldProps) {
    const isTextArea = field.type === 'textarea';

    return (
        <View style={{ marginBottom: 16 }}>
            <TextInput
                value={value || ''}
                onChangeText={onChange}
                placeholder={field.title}
                placeholderTextColor="#64748b"
                multiline={isTextArea}
                style={{
                    backgroundColor: '#1e293b',
                    borderColor: error ? '#ef4444' : '#334155',
                    borderWidth: 1.5,
                    borderRadius: 12,
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    color: '#f1f5f9',
                    fontSize: 16,
                    minHeight: isTextArea ? 100 : undefined,
                    textAlignVertical: isTextArea ? 'top' : 'center',
                }}
            />
            {error && (
                <Text style={{ color: '#ef4444', fontSize: 13, marginTop: 6 }}>{error}</Text>
            )}
        </View>
    );
}
