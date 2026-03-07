import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { FormField } from '@opla/types';

interface Props {
    field: FormField;
    value: string;
    onChange: (value: string) => void;
    error?: string;
}

export function RatingScaleField({ field, value, onChange, error }: Props) {
    const min = Number(field.min ?? 1);
    const max = Number(field.max ?? 5);
    const steps = Array.from({ length: max - min + 1 }, (_, i) => min + i);
    const selected = value !== undefined && value !== '' ? Number(value) : null;

    // For scales wider than 7 steps, use a horizontal scroll so buttons don't get squished
    const useScroll = steps.length > 7;

    const buttons = steps.map((val) => {
        const isSelected = selected === val;
        return (
            <TouchableOpacity
                key={val}
                onPress={() => onChange(String(val))}
                activeOpacity={0.7}
                style={{
                    flex: useScroll ? undefined : 1,
                    width: useScroll ? 44 : undefined,
                    height: 44,
                    marginHorizontal: useScroll ? 3 : 2,
                    borderRadius: 8,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: isSelected ? '#158754' : '#1e293b',
                    borderWidth: isSelected ? 0 : 1,
                    borderColor: '#334155',
                }}
            >
                <Text style={{
                    fontSize: 14,
                    fontWeight: '700',
                    color: isSelected ? '#fff' : '#94a3b8',
                }}>
                    {val}
                </Text>
            </TouchableOpacity>
        );
    });

    return (
        <View>
            {/* Min / Max labels */}
            {(field.min_label || field.max_label) ? (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, paddingHorizontal: 2 }}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                        {field.min_label ?? ''}
                    </Text>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                        {field.max_label ?? ''}
                    </Text>
                </View>
            ) : null}

            {/* Scale buttons */}
            {useScroll ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 4, flexDirection: 'row' }}>
                    {buttons}
                </ScrollView>
            ) : (
                <View style={{ flexDirection: 'row', gap: 4 }}>
                    {buttons}
                </View>
            )}

            {error ? (
                <Text style={{ color: '#ef4444', fontSize: 13, marginTop: 6 }}>{error}</Text>
            ) : null}
        </View>
    );
}
