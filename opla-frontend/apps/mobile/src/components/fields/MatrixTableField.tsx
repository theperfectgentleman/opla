import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { FormField } from '@opla/types';

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

    const handleCellChange = (rowId: string, colId: string, cellVal: any) => {
        if (cellType === 'radio') {
            // Radio means one choice per row
            onChange({ ...value, [rowId]: colId });
        } else if (cellType === 'checkbox') {
            // Checkbox means multiple choices per row
            const rowSelections = value[rowId] || [];
            if (rowSelections.includes(colId)) {
                onChange({ ...value, [rowId]: rowSelections.filter((id: string) => id !== colId) });
            } else {
                onChange({ ...value, [rowId]: [...rowSelections, colId] });
            }
        } else {
            // Text/Number means unique value per cell
            const rowObject = value[rowId] || {};
            onChange({ ...value, [rowId]: { ...rowObject, [colId]: cellVal } });
        }
    };

    return (
        <View style={{ marginBottom: 16 }}>
            <ScrollView horizontal={true} showsHorizontalScrollIndicator={true} style={{
                backgroundColor: '#1e293b',
                borderRadius: 12,
                borderWidth: 1.5,
                borderColor: error ? '#ef4444' : '#334155'
            }}>
                <View style={{ padding: 16 }}>
                    {/* Header Row */}
                    <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#334155', paddingBottom: 12, marginBottom: 12 }}>
                        <View style={{ width: 120, marginRight: 16 }} />
                        {columns.map(col => (
                            <View key={col.id} style={{ width: 100, alignItems: 'center', justifyContent: 'center' }}>
                                <Text style={{ color: '#cbd5e1', fontWeight: '600', textAlign: 'center' }}>{col.label}</Text>
                            </View>
                        ))}
                    </View>

                    {/* Matrix Body */}
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
                                                borderColor: isSelected ? '#6366f1' : '#475569',
                                                backgroundColor: isSelected ? '#6366f1' : 'transparent',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}
                                        >
                                            {isSelected && !isRadio && <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>✓</Text>}
                                            {isSelected && isRadio && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#fff' }} />}
                                        </TouchableOpacity>
                                    );
                                } else {
                                    // Text or Number
                                    const cellVal = (value[row.id] || {})[col.id] || '';
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
        </View>
    );
}
