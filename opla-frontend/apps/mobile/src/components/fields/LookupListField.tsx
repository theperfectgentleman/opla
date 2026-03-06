import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, FlatList, SafeAreaView, TextInput } from 'react-native';
import { FormField } from '@opla/types';

interface Props {
    field: FormField;
    value: string;
    onChange: (value: string) => void;
    error?: string;
}

export function LookupListField({ field, value, onChange, error }: Props) {
    const [modalVisible, setModalVisible] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Very basic CSV parsing for demo
    // In a real app we'd fetch preset data from the API if it's a preset source.
    const dataString = field.lookup_custom_data || '';
    const separator = field.lookup_separator || ',';
    const labelCol = field.lookup_label_column || 1;
    const valueCol = field.lookup_value_column || 1;

    // Assuming first row might be header, let's just parse all rows for simplicity
    const rows = dataString.split('\n').filter(r => r.trim() !== '');
    const options = rows.map((row, idx) => {
        const cols = row.split(separator);
        // 1-indexed column numbers
        const rowLabel = cols[labelCol - 1] || `Row ${idx}`;
        const rowValue = cols[valueCol - 1] || rowLabel;
        return { label: rowLabel.trim(), value: rowValue.trim() };
    });

    const selectedOption = options.find(o => o.value === value);

    // Filter based on search query
    const filteredOptions = options.filter(o => o.label.toLowerCase().includes(searchQuery.toLowerCase()));

    return (
        <View style={{ marginBottom: 16 }}>
            <TouchableOpacity
                onPress={() => setModalVisible(true)}
                style={{
                    backgroundColor: '#1e293b',
                    borderRadius: 12,
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    borderWidth: 1.5,
                    borderColor: error ? '#ef4444' : '#334155',
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}
            >
                <Text style={{ color: selectedOption ? '#f1f5f9' : '#475569', fontSize: 16 }}>
                    {selectedOption ? selectedOption.label : (field.placeholder || "Tap to search...")}
                </Text>
                <Text style={{ color: '#94a3b8' }}>🔍</Text>
            </TouchableOpacity>

            {error && (
                <Text style={{ color: '#ef4444', fontSize: 13, marginTop: 6 }}>{error}</Text>
            )}

            <Modal visible={modalVisible} transparent={true} animationType="slide">
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
                    <SafeAreaView style={{ backgroundColor: '#0f172a', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '90%' }}>
                        <View style={{ padding: 20, borderBottomWidth: 1, borderBottomColor: '#1e293b' }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
                                <Text style={{ color: '#f1f5f9', fontSize: 18, fontWeight: '700' }}>Search {field.label}</Text>
                                <TouchableOpacity onPress={() => setModalVisible(false)}>
                                    <Text style={{ color: '#6366f1', fontSize: 16, fontWeight: '600' }}>Close</Text>
                                </TouchableOpacity>
                            </View>
                            <TextInput
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                placeholder="Type to filter..."
                                placeholderTextColor="#475569"
                                style={{
                                    backgroundColor: '#1e293b',
                                    borderRadius: 10,
                                    padding: 12,
                                    color: '#f1f5f9',
                                    borderWidth: 1,
                                    borderColor: '#334155'
                                }}
                            />
                        </View>
                        <FlatList
                            data={filteredOptions}
                            keyExtractor={(item, idx) => `${item.value}-${idx}`}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    onPress={() => {
                                        onChange(item.value);
                                        setModalVisible(false);
                                    }}
                                    style={{
                                        padding: 16,
                                        borderBottomWidth: 1,
                                        borderBottomColor: '#1e293b',
                                        flexDirection: 'row',
                                        justifyContent: 'space-between'
                                    }}
                                >
                                    <Text style={{ color: value === item.value ? '#6366f1' : '#f1f5f9', fontSize: 16, fontWeight: value === item.value ? '700' : '400' }}>
                                        {item.label}
                                    </Text>
                                    {value === item.value && <Text style={{ color: '#6366f1', fontSize: 16 }}>✓</Text>}
                                </TouchableOpacity>
                            )}
                            ListEmptyComponent={
                                <View style={{ padding: 32, alignItems: 'center' }}>
                                    <Text style={{ color: '#64748b' }}>No results found</Text>
                                </View>
                            }
                        />
                    </SafeAreaView>
                </View>
            </Modal>
        </View>
    );
}
