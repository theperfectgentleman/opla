import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Modal, FlatList, SafeAreaView } from 'react-native';
import { FormField } from '@opla/types';
import { cellInputValue } from '../../utils/formFields';

interface Props {
    field: FormField;
    value: Record<string, any>; // maps row ID to column ID or value depending on cell type
    onChange: (value: Record<string, any>) => void;
    error?: string;
}

export function MatrixTableField({ field, value = {}, onChange, error }: Props) {
    const rows = field.table_rows || [];
    const columns = field.table_columns || [];
    const cellType = field.table_cell_type || 'radio';
    const dropdownOptions = field.options || [];
    const [dropdownCell, setDropdownCell] = useState<{ rowId: string; colId: string } | null>(null);

    const handleCellChange = (rowId: string, colId: string, cellVal: any) => {
        if (cellType === 'radio') {
            onChange({ ...value, [rowId]: colId });
        } else if (cellType === 'checkbox') {
            const rowSelections = value[rowId] || [];
            if (rowSelections.includes(colId)) {
                onChange({ ...value, [rowId]: rowSelections.filter((id: string) => id !== colId) });
            } else {
                onChange({ ...value, [rowId]: [...rowSelections, colId] });
            }
        } else {
            const rowObject = value[rowId] || {};
            onChange({ ...value, [rowId]: { ...rowObject, [colId]: cellVal } });
        }
    };

    const dropdownCellValue = dropdownCell
        ? cellInputValue((value[dropdownCell.rowId] || {})[dropdownCell.colId])
        : '';

    return (
        <View style={{ marginBottom: 16 }}>
            <ScrollView horizontal={true} showsHorizontalScrollIndicator={true} style={{
                backgroundColor: '#1e293b',
                borderRadius: 12,
                borderWidth: 1.5,
                borderColor: error ? '#ef4444' : '#334155'
            }}>
                <View style={{ padding: 16 }}>
                    <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#334155', paddingBottom: 12, marginBottom: 12 }}>
                        <View style={{ width: 120, marginRight: 16 }} />
                        {columns.map(col => (
                            <View key={col.id} style={{ width: 100, alignItems: 'center', justifyContent: 'center' }}>
                                <Text style={{ color: '#cbd5e1', fontWeight: '600', textAlign: 'center' }}>{col.label}</Text>
                            </View>
                        ))}
                    </View>

                    {rows.map((row, index) => (
                        <View key={row.id} style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            paddingVertical: 12,
                            borderBottomWidth: index === rows.length - 1 ? 0 : 1,
                            borderBottomColor: '#334155'
                        }}>
                            <View style={{ width: 120, marginRight: 16 }}>
                                <Text style={{ color: '#f1f5f9', fontWeight: '500' }}>{row.label}</Text>
                            </View>

                            {columns.map(col => {
                                let content;

                                if (cellType === 'radio' || cellType === 'checkbox') {
                                    const isRadio = cellType === 'radio';
                                    const isSelected = isRadio
                                        ? value[row.id] === col.id
                                        : (value[row.id] || []).includes(col.id);

                                    content = (
                                        <TouchableOpacity
                                            onPress={() => handleCellChange(row.id, col.id, true)}
                                            style={{
                                                width: 24,
                                                height: 24,
                                                borderRadius: isRadio ? 12 : 6,
                                                borderWidth: 2,
                                                borderColor: isSelected ? '#158754' : '#475569',
                                                backgroundColor: isSelected ? '#158754' : 'transparent',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}
                                        >
                                            {isSelected && !isRadio && <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>✓</Text>}
                                            {isSelected && isRadio && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#fff' }} />}
                                        </TouchableOpacity>
                                    );
                                } else if (cellType === 'dropdown') {
                                    const selectedValue = cellInputValue((value[row.id] || {})[col.id]);
                                    const selectedLabel = dropdownOptions.find(o => o.value === selectedValue)?.label || selectedValue;
                                    content = (
                                        <TouchableOpacity
                                            onPress={() => setDropdownCell({ rowId: row.id, colId: col.id })}
                                            style={{
                                                width: '100%',
                                                backgroundColor: '#0f172a',
                                                borderWidth: 1,
                                                borderColor: '#334155',
                                                borderRadius: 6,
                                                paddingHorizontal: 6,
                                                paddingVertical: 8,
                                            }}
                                        >
                                            <Text numberOfLines={1} style={{ color: selectedValue ? '#f1f5f9' : '#475569', fontSize: 12, textAlign: 'center' }}>
                                                {selectedLabel || 'Select'}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                } else {
                                    const cellVal = cellInputValue((value[row.id] || {})[col.id]);
                                    content = (
                                        <TextInput
                                            value={cellVal}
                                            onChangeText={(val) => handleCellChange(row.id, col.id, val)}
                                            placeholder="..."
                                            placeholderTextColor="#475569"
                                            keyboardType={cellType === 'number' ? 'numeric' : 'default'}
                                            style={{
                                                backgroundColor: '#0f172a',
                                                color: '#f1f5f9',
                                                borderWidth: 1,
                                                borderColor: '#334155',
                                                borderRadius: 6,
                                                paddingHorizontal: 8,
                                                paddingVertical: 6,
                                                width: '100%',
                                                textAlign: 'center'
                                            }}
                                        />
                                    );
                                }

                                return (
                                    <View key={col.id} style={{ width: 100, alignItems: 'center', justifyContent: 'center' }}>
                                        {content}
                                    </View>
                                );
                            })}
                        </View>
                    ))}
                </View>
            </ScrollView>

            {error && (
                <Text style={{ color: '#ef4444', fontSize: 13, marginTop: 6 }}>{error}</Text>
            )}

            <Modal visible={!!dropdownCell} transparent={true} animationType="slide">
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
                    <SafeAreaView style={{ backgroundColor: '#0f172a', borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '80%' }}>
                        <View style={{ paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1e293b', flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={{ color: '#f1f5f9', fontSize: 15, fontWeight: '700' }}>Select</Text>
                            <TouchableOpacity onPress={() => setDropdownCell(null)}>
                                <Text style={{ color: '#158754', fontSize: 14, fontWeight: '600' }}>Close</Text>
                            </TouchableOpacity>
                        </View>
                        <FlatList
                            data={dropdownOptions}
                            keyExtractor={(item) => item.value}
                            ListEmptyComponent={
                                <View style={{ padding: 24 }}>
                                    <Text style={{ color: '#94a3b8', textAlign: 'center' }}>No options configured for this matrix.</Text>
                                </View>
                            }
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    onPress={() => {
                                        if (dropdownCell) {
                                            handleCellChange(dropdownCell.rowId, dropdownCell.colId, item.value);
                                        }
                                        setDropdownCell(null);
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
                                    <Text style={{ color: dropdownCellValue === item.value ? '#158754' : '#f1f5f9', fontSize: 14, fontWeight: dropdownCellValue === item.value ? '700' : '400' }}>
                                        {item.label}
                                    </Text>
                                    {dropdownCellValue === item.value && <Text style={{ color: '#158754', fontSize: 14 }}>✓</Text>}
                                </TouchableOpacity>
                            )}
                        />
                    </SafeAreaView>
                </View>
            </Modal>
        </View>
    );
}
