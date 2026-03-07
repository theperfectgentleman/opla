import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, FlatList, SafeAreaView } from 'react-native';
import { FormField } from '@opla/types';

interface Props {
    field: FormField;
    value: string;
    onChange: (value: string) => void;
    error?: string;
}

export function DropdownField({ field, value, onChange, error }: Props) {
    const [modalVisible, setModalVisible] = useState(false);
    const options = field.options || [];

    const selectedOption = options.find(o => o.value === value);

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
                <Text style={{ color: selectedOption ? '#f1f5f9' : '#475569', fontSize: 14 }}>
                    {selectedOption ? selectedOption.label : (field.placeholder || "Select an option...")}
                </Text>
                <Text style={{ color: '#94a3b8', fontSize: 12 }}>?</Text>
            </TouchableOpacity>

            {error && (
                <Text style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>{error}</Text>
            )}

            <Modal visible={modalVisible} transparent={true} animationType="slide">
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
                    <SafeAreaView style={{ backgroundColor: '#0f172a', borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '80%' }}>
                        <View style={{ paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1e293b', flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={{ color: '#f1f5f9', fontSize: 15, fontWeight: '700' }}>{field.label}</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <Text style={{ color: '#158754', fontSize: 14, fontWeight: '600' }}>Close</Text>
                            </TouchableOpacity>
                        </View>
                        <FlatList
                            data={options}
                            keyExtractor={(item) => item.value}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    onPress={() => {
                                        onChange(item.value);
                                        setModalVisible(false);
                                    }}
                                    style={{
                                        paddingVertical: 12,
                                        paddingHorizontal: 16,
                                        borderBottomWidth: 1,
                                        borderBottomColor: '#1e293b',
                                        flexDirection: 'row',
                                        justifyContent: 'space-between'
                                    }}
                                >
                                    <Text style={{ color: value === item.value ? '#158754' : '#f1f5f9', fontSize: 14, fontWeight: value === item.value ? '700' : '400' }}>
                                        {item.label}
                                    </Text>
                                    {value === item.value && <Text style={{ color: '#158754', fontSize: 14 }}>?</Text>}
                                </TouchableOpacity>
                            )}
                        />
                    </SafeAreaView>
                </View>
            </Modal>
        </View>
    );
}
