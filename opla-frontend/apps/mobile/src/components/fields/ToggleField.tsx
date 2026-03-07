import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { FormField } from '@opla/types';

interface Props {
    field: FormField;
    value: boolean | string | undefined;
    onChange: (value: boolean) => void;
    error?: string;
}

export function ToggleField({ field, value, onChange, error }: Props) {
    // undefined / null = no answer yet
    const selected: boolean | null =
        value === true || value === 'true' ? true
        : value === false || value === 'false' ? false
        : null;

    const opts = field.options ?? [];
    const yesLabel = opts.find((o) => o.value === 'true')?.label ?? 'Yes';
    const noLabel  = opts.find((o) => o.value === 'false')?.label ?? 'No';

    const choices: { label: string; val: boolean }[] = [
        { label: yesLabel, val: true },
        { label: noLabel,  val: false },
    ];

    return (
        <View>
            {/* Segmented control — two equal-weight options */}
            <View style={{
                flexDirection: 'row',
                borderRadius: 10,
                borderWidth: 1.5,
                borderColor: selected !== null ? '#158754' : '#334155',
                overflow: 'hidden',
                backgroundColor: '#1e293b',
            }}>
                {choices.map(({ label, val }, idx) => {
                    const active = selected === val;
                    return (
                        <TouchableOpacity
                            key={String(val)}
                            activeOpacity={0.75}
                            onPress={() => onChange(val)}
                            style={{
                                flex: 1,
                                paddingVertical: 12,
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: active ? '#158754' : 'transparent',
                                borderLeftWidth: idx === 1 ? 1.5 : 0,
                                borderLeftColor: '#334155',
                            }}
                        >
                            <Text style={{
                                fontSize: 14,
                                fontWeight: '700',
                                color: active ? '#ffffff' : '#64748b',
                                letterSpacing: 0.2,
                            }}>
                                {label}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            {error ? (
                <Text style={{ color: '#ef4444', fontSize: 13, marginTop: 6 }}>{error}</Text>
            ) : null}
        </View>
    );
}
