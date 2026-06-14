import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, FlatList, SafeAreaView, TextInput } from 'react-native';
import { FormField } from '@opla/types';

interface Props {
    field: FormField;
    value?: string[];
    onChange: (value: string[]) => void;
    error?: string;
    responses?: Record<string, any>;
}

export function MultiSelectDropdownField({ field, value = [], onChange, error, responses = {} }: Props) {
    const [modalVisible, setModalVisible] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Resolve cascading options
    const options = useMemo(() => {
        if (field.cascade_parent_field_id && field.cascade_options_map) {
            const parentValue = responses[field.cascade_parent_field_id];
            if (parentValue && field.cascade_options_map[parentValue]) {
                return field.cascade_options_map[parentValue];
            }
            return []; // Parent not selected — show no options
        }
        return field.options || [];
    }, [field.options, field.cascade_parent_field_id, field.cascade_options_map, responses]);

    // Clear values that are no longer valid if parent changes
    useEffect(() => {
        if (field.cascade_parent_field_id && Array.isArray(value) && value.length > 0) {
            const validValues = options.map(o => o.value);
            const filteredValue = value.filter(v => validValues.includes(v));
            if (filteredValue.length !== value.length) {
                onChange(filteredValue);
            }
        }
    }, [options]);

    const toggleOption = (optValue: string) => {
        const currentSelected = Array.isArray(value) ? value : [];
        if (currentSelected.includes(optValue)) {
            onChange(currentSelected.filter(v => v !== optValue));
        } else {
            onChange([...currentSelected, optValue]);
        }
    };

    const selectedLabels = options
        .filter(o => Array.isArray(value) && value.includes(o.value))
        .map(o => o.label);

    const filteredOptions = options.filter(o => 
        o.label.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <View>
            <TouchableOpacity
                onPress={() => setModalVisible(true)}
                style={{
                    backgroundColor: '#1e293b',
                    borderRadius: 8,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    borderWidth: 1.5,
                    borderColor: error ? '#ef4444' : '#334155',
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}
            >
                <Text style={{ color: selectedLabels.length > 0 ? '#f1f5f9' : '#475569', fontSize: 14, flex: 1 }} numberOfLines={1}>
                    {selectedLabels.length > 0 
                        ? `${selectedLabels.length} selected: ${selectedLabels.slice(0, 2).join(', ')}${selectedLabels.length > 2 ? '...' : ''}`
                        : (field.placeholder || "Select options...")}
                </Text>
                <Text style={{ color: '#94a3b8', fontSize: 12 }}>?</Text>
            </TouchableOpacity>

            {error && (
                <Text style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>{error}</Text>
            )}

            <Modal visible={modalVisible} transparent={true} animationType="slide">
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
                    <SafeAreaView style={{ backgroundColor: '#0f172a', borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '80%' }}>
                        <View style={{ paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1e293b' }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                <Text style={{ color: '#f1f5f9', fontSize: 15, fontWeight: '700' }}>{field.label}</Text>
                                <TouchableOpacity onPress={() => setModalVisible(false)}>
                                    <Text style={{ color: '#158754', fontSize: 14, fontWeight: '600' }}>Done</Text>
                                </TouchableOpacity>
                            </View>
                            <TextInput
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                placeholder="Type to filter..."
                                placeholderTextColor="#475569"
                                style={{
                                    backgroundColor: '#1e293b',
                                    borderRadius: 8,
                                    padding: 10,
                                    color: '#f1f5f9',
                                    borderWidth: 1,
                                    borderColor: '#334155'
                                }}
                            />
                        </View>
                        <FlatList
                            data={filteredOptions}
                            keyExtractor={(item) => item.value}
                            renderItem={({ item }) => {
                                const isSelected = Array.isArray(value) && value.includes(item.value);
                                return (
                                    <TouchableOpacity
                                        onPress={() => toggleOption(item.value)}
                                        style={{
                                            paddingVertical: 12,
                                            paddingHorizontal: 16,
                                            borderBottomWidth: 1,
                                            borderBottomColor: '#1e293b',
                                            flexDirection: 'row',
                                            justifyContent: 'space-between',
                                            alignItems: 'center'
                                        }}
                                    >
                                        <Text style={{ color: isSelected ? '#158754' : '#f1f5f9', fontSize: 14, fontWeight: isSelected ? '700' : '400', flex: 1 }}>
                                            {item.label}
                                        </Text>
                                        <View style={{
                                            width: 18,
                                            height: 18,
                                            borderRadius: 4,
                                            borderWidth: 1.5,
                                            borderColor: isSelected ? '#158754' : '#64748b',
                                            backgroundColor: isSelected ? '#158754' : 'transparent',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}>
                                            {isSelected && <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>✓</Text>}
                                        </View>
                                    </TouchableOpacity>
                                );
                            }}
                            ListEmptyComponent={
                                <View style={{ padding: 32, alignItems: 'center' }}>
                                    <Text style={{ color: '#64748b' }}>No options found</Text>
                                </View>
                            }
                        />
                    </SafeAreaView>
                </View>
            </Modal>
        </View>
    );
}
