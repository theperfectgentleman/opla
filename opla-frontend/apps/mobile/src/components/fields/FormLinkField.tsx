import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { FormField } from '@opla/types';
import { ChevronRight, ExternalLink } from 'lucide-react-native';

interface FormLinkFieldProps {
    field: FormField;
    onPress: () => void;
    error?: string;
}

export function FormLinkField({ field, onPress, error }: FormLinkFieldProps) {
    return (
        <TouchableOpacity
            activeOpacity={0.7}
            onPress={onPress}
            style={{
                backgroundColor: '#1e293b',
                borderRadius: 14,
                borderWidth: 1.5,
                borderColor: error ? '#ef4444' : '#334155',
                paddingHorizontal: 18,
                paddingVertical: 16,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 14,
            }}
        >
            <View style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                backgroundColor: '#158754',
                alignItems: 'center',
                justifyContent: 'center',
            }}>
                <ExternalLink size={18} color="#fff" />
            </View>

            <View style={{ flex: 1 }}>
                <Text style={{ color: '#f1f5f9', fontSize: 15, fontWeight: '700' }}>
                    {field.label}
                </Text>
                {field.placeholder ? (
                    <Text style={{ color: '#94a3b8', fontSize: 12, marginTop: 2 }}>
                        {field.placeholder}
                    </Text>
                ) : null}
            </View>

            <ChevronRight size={18} color="#64748b" />
        </TouchableOpacity>
    );
}
