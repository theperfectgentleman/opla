import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, Modal, FlatList, SafeAreaView, Platform } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Calendar, Clock, Sliders } from 'lucide-react-native';
import { FormField, GenericRangeValue, RangeType } from '@opla/types';

interface Props {
    field: FormField;
    value?: GenericRangeValue;
    error?: string;
    onChange: (value: GenericRangeValue) => void;
}

export function GenericRangeField({ field, value, error, onChange }: Props) {
    const [showPicker, setShowPicker] = useState<{ which: 'start' | 'end'; mode: 'date' | 'time' } | null>(null);
    const [dropdownSelect, setDropdownSelect] = useState<'start' | 'end' | null>(null);

    // Sensible defaults if value is uninitialized
    const rangeVal: GenericRangeValue = value || {
        variable_id: field.bind || '',
        range_type: (field.range_type || 'NUMBER') as RangeType,
        start_value: null,
        end_value: null,
        step_value: field.step_value || null,
        step_unit: field.step_unit || 'NONE',
        is_inclusive: field.is_inclusive !== false,
        has_no_min: !!field.has_no_min,
        has_no_max: !!field.has_no_max,
    };

    const updateValue = (updates: Partial<GenericRangeValue>) => {
        onChange({
            ...rangeVal,
            variable_id: field.bind || '',
            range_type: (field.range_type || 'NUMBER') as RangeType,
            step_value: field.step_value || null,
            step_unit: field.step_unit || 'NONE',
            is_inclusive: field.is_inclusive !== false,
            has_no_min: !!field.has_no_min,
            has_no_max: !!field.has_no_max,
            ...updates,
        });
    };

    // Helper for rendering numeric inputs
    const handleNumberChange = (which: 'start' | 'end', text: string) => {
        const isInteger = field.range_type === 'INTEGER' || field.range_type === 'INDEX';
        let cleaned = text.replace(isInteger ? /[^0-9-]/g : /[^0-9.-]/g, '');
        
        // Handle multiple decimals or signs
        const parts = cleaned.split('.');
        if (parts.length > 2) {
            cleaned = parts[0] + '.' + parts.slice(1).join('');
        }
        if (cleaned.indexOf('-') > 0) {
            cleaned = cleaned.replace(/-/g, '');
        }
        
        updateValue({ [which === 'start' ? 'start_value' : 'end_value']: cleaned || null });
    };

    // Helper for parsing DateTime string to Date object
    const getPickerDate = (which: 'start' | 'end', mode: 'date' | 'time'): Date => {
        const val = which === 'start' ? rangeVal.start_value : rangeVal.end_value;
        const d = new Date();
        
        if (field.range_type === 'TIME' && val) {
            const [h, m] = val.split(':').map(Number);
            if (!isNaN(h) && !isNaN(m)) {
                d.setHours(h, m, 0, 0);
            }
            return d;
        }

        if (field.range_type === 'DATETIME' && val) {
            const parsed = new Date(val);
            if (!isNaN(parsed.getTime())) {
                return parsed;
            }
        }

        if (field.range_type === 'DATE' && val) {
            const parsed = new Date(val);
            if (!isNaN(parsed.getTime())) {
                return parsed;
            }
        }

        return d;
    };

    const handleDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
        if (Platform.OS === 'android') {
            setShowPicker(null);
        }
        if (selectedDate && event.type !== 'dismissed' && showPicker) {
            const { which, mode } = showPicker;
            const currentVal = which === 'start' ? rangeVal.start_value : rangeVal.end_value;

            if (field.range_type === 'DATE') {
                const formatted = selectedDate.toISOString().split('T')[0];
                updateValue({ [which === 'start' ? 'start_value' : 'end_value']: formatted });
            } else if (field.range_type === 'TIME') {
                const hours = String(selectedDate.getHours()).padStart(2, '0');
                const minutes = String(selectedDate.getMinutes()).padStart(2, '0');
                updateValue({ [which === 'start' ? 'start_value' : 'end_value']: `${hours}:${minutes}` });
            } else if (field.range_type === 'DATETIME') {
                // Combine date and time
                let datePart = selectedDate.toISOString().split('T')[0];
                let timePart = '00:00';
                
                if (currentVal) {
                    const parts = currentVal.split(/[T ]/);
                    if (parts[0]) datePart = parts[0];
                    if (parts[1]) timePart = parts[1].substring(0, 5);
                }

                if (mode === 'date') {
                    datePart = selectedDate.toISOString().split('T')[0];
                } else {
                    const hours = String(selectedDate.getHours()).padStart(2, '0');
                    const minutes = String(selectedDate.getMinutes()).padStart(2, '0');
                    timePart = `${hours}:${minutes}`;
                }
                
                updateValue({ [which === 'start' ? 'start_value' : 'end_value']: `${datePart}T${timePart}` });
            }
        }
    };

    // Render weekday / month dropdown contents
    const getDropdownOptions = () => {
        if (field.range_type === 'WEEKDAY') {
            return ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(d => ({ label: d, value: d }));
        }
        if (field.range_type === 'MONTH') {
            return ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map(m => ({ label: m, value: m }));
        }
        return [];
    };

    const renderInputFields = (which: 'start' | 'end', label: string) => {
        const val = which === 'start' ? rangeVal.start_value : rangeVal.end_value;
        const type = field.range_type || 'NUMBER';

        if (type === 'NUMBER' || type === 'INTEGER' || type === 'INDEX') {
            return (
                <View style={{ flex: 1, gap: 4 }}>
                    <Text style={{ color: '#94a3b8', fontSize: 11, fontWeight: '600', marginBottom: 4 }}>{label}</Text>
                    <TextInput
                        value={val || ''}
                        onChangeText={(t) => handleNumberChange(which, t)}
                        placeholder={which === 'start' ? 'Start' : 'End'}
                        placeholderTextColor="#64748b"
                        keyboardType={type === 'NUMBER' ? 'decimal-pad' : 'number-pad'}
                        style={{
                            backgroundColor: '#1e293b',
                            borderColor: error ? '#ef4444' : '#334155',
                            borderWidth: 1.5,
                            borderRadius: 8,
                            paddingHorizontal: 12,
                            paddingVertical: 10,
                            color: '#f1f5f9',
                            fontSize: 14,
                        }}
                    />
                </View>
            );
        }

        if (type === 'WEEKDAY' || type === 'MONTH') {
            return (
                <View style={{ flex: 1 }}>
                    <Text style={{ color: '#94a3b8', fontSize: 11, fontWeight: '600', marginBottom: 4 }}>{label}</Text>
                    <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => setDropdownSelect(which)}
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            backgroundColor: '#1e293b',
                            borderColor: error ? '#ef4444' : '#334155',
                            borderWidth: 1.5,
                            borderRadius: 8,
                            paddingHorizontal: 12,
                            paddingVertical: 11,
                        }}
                    >
                        <Text style={{ color: val ? '#f1f5f9' : '#64748b', fontSize: 14, flex: 1 }}>
                            {val || 'Select'}
                        </Text>
                        <Text style={{ color: '#94a3b8', fontSize: 12 }}>?</Text>
                    </TouchableOpacity>
                </View>
            );
        }

        if (type === 'DATE') {
            return (
                <View style={{ flex: 1 }}>
                    <Text style={{ color: '#94a3b8', fontSize: 11, fontWeight: '600', marginBottom: 4 }}>{label}</Text>
                    <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => setShowPicker({ which, mode: 'date' })}
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            backgroundColor: '#1e293b',
                            borderColor: error ? '#ef4444' : '#334155',
                            borderWidth: 1.5,
                            borderRadius: 8,
                            paddingHorizontal: 12,
                            paddingVertical: 10,
                        }}
                    >
                        <Calendar size={16} color="#94a3b8" style={{ marginRight: 6 }} />
                        <Text style={{ color: val ? '#f1f5f9' : '#64748b', fontSize: 14, flex: 1 }}>
                            {val || 'Date'}
                        </Text>
                    </TouchableOpacity>
                </View>
            );
        }

        if (type === 'TIME') {
            return (
                <View style={{ flex: 1 }}>
                    <Text style={{ color: '#94a3b8', fontSize: 11, fontWeight: '600', marginBottom: 4 }}>{label}</Text>
                    <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => setShowPicker({ which, mode: 'time' })}
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            backgroundColor: '#1e293b',
                            borderColor: error ? '#ef4444' : '#334155',
                            borderWidth: 1.5,
                            borderRadius: 8,
                            paddingHorizontal: 12,
                            paddingVertical: 10,
                        }}
                    >
                        <Clock size={16} color="#94a3b8" style={{ marginRight: 6 }} />
                        <Text style={{ color: val ? '#f1f5f9' : '#64748b', fontSize: 14, flex: 1 }}>
                            {val || 'Time'}
                        </Text>
                    </TouchableOpacity>
                </View>
            );
        }

        if (type === 'DATETIME') {
            const parts = val ? val.split(/[T ]/) : [];
            const dateStr = parts[0] || '';
            const timeStr = parts[1] ? parts[1].substring(0, 5) : '';
            return (
                <View style={{ flex: 1 }}>
                    <Text style={{ color: '#94a3b8', fontSize: 11, fontWeight: '600', marginBottom: 4 }}>{label}</Text>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                        <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={() => setShowPicker({ which, mode: 'date' })}
                            style={{
                                flex: 1,
                                flexDirection: 'row',
                                alignItems: 'center',
                                backgroundColor: '#1e293b',
                                borderColor: error ? '#ef4444' : '#334155',
                                borderWidth: 1.5,
                                borderRadius: 8,
                                paddingHorizontal: 8,
                                paddingVertical: 10,
                            }}
                        >
                            <Calendar size={14} color="#94a3b8" style={{ marginRight: 4 }} />
                            <Text numberOfLines={1} style={{ color: dateStr ? '#f1f5f9' : '#64748b', fontSize: 12 }}>
                                {dateStr || 'Date'}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={() => setShowPicker({ which, mode: 'time' })}
                            style={{
                                flex: 1,
                                flexDirection: 'row',
                                alignItems: 'center',
                                backgroundColor: '#1e293b',
                                borderColor: error ? '#ef4444' : '#334155',
                                borderWidth: 1.5,
                                borderRadius: 8,
                                paddingHorizontal: 8,
                                paddingVertical: 10,
                            }}
                        >
                            <Clock size={14} color="#94a3b8" style={{ marginRight: 4 }} />
                            <Text numberOfLines={1} style={{ color: timeStr ? '#f1f5f9' : '#64748b', fontSize: 12 }}>
                                {timeStr || 'Time'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            );
        }

        return null;
    };

    return (
        <View>
            <View style={{ flexDirection: 'row', gap: 12 }}>
                {!field.has_no_min && renderInputFields('start', field.range_type === 'DATE' || field.range_type === 'DATETIME' ? 'From Date' : field.range_type === 'TIME' ? 'Opens' : 'Start Value')}
                {!field.has_no_max && renderInputFields('end', field.range_type === 'DATE' || field.range_type === 'DATETIME' ? 'To Date' : field.range_type === 'TIME' ? 'Closes' : 'End Value')}
            </View>

            {error && (
                <Text style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>{error}</Text>
            )}

            {/* DateTimePicker Picker for iOS/Android */}
            {showPicker && Platform.OS === 'ios' && (
                <Modal
                    visible={true}
                    transparent={true}
                    animationType="slide"
                    onRequestClose={() => setShowPicker(null)}
                >
                    <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
                        <View style={{ backgroundColor: '#1e293b', borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingBottom: 30 }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#334155', padding: 16 }}>
                                <TouchableOpacity onPress={() => setShowPicker(null)}>
                                    <Text style={{ color: '#94a3b8', fontSize: 15, fontWeight: '600' }}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => setShowPicker(null)}>
                                    <Text style={{ color: '#158754', fontSize: 15, fontWeight: '700' }}>Done</Text>
                                </TouchableOpacity>
                            </View>
                            <View style={{ padding: 16, alignItems: 'center' }}>
                                <DateTimePicker
                                    value={getPickerDate(showPicker.which, showPicker.mode)}
                                    mode={showPicker.mode}
                                    display="spinner"
                                    is24Hour={true}
                                    textColor="#f1f5f9"
                                    onChange={handleDateChange}
                                />
                            </View>
                        </View>
                    </View>
                </Modal>
            )}

            {showPicker && Platform.OS === 'android' && (
                <DateTimePicker
                    value={getPickerDate(showPicker.which, showPicker.mode)}
                    mode={showPicker.mode}
                    display="default"
                    is24Hour={true}
                    onChange={handleDateChange}
                />
            )}

            {/* Dropdown Modal for Weekday/Month picker */}
            <Modal visible={!!dropdownSelect} transparent={true} animationType="slide">
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
                    <SafeAreaView style={{ backgroundColor: '#0f172a', borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '80%' }}>
                        <View style={{ paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1e293b', flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={{ color: '#f1f5f9', fontSize: 15, fontWeight: '700' }}>{field.label}</Text>
                            <TouchableOpacity onPress={() => setDropdownSelect(null)}>
                                <Text style={{ color: '#158754', fontSize: 14, fontWeight: '600' }}>Close</Text>
                            </TouchableOpacity>
                        </View>
                        <FlatList
                            data={getDropdownOptions()}
                            keyExtractor={(item) => item.value}
                            renderItem={({ item }) => {
                                const isSelected = (dropdownSelect === 'start' ? rangeVal.start_value : rangeVal.end_value) === item.value;
                                return (
                                    <TouchableOpacity
                                        onPress={() => {
                                            if (dropdownSelect) {
                                                updateValue({ [dropdownSelect === 'start' ? 'start_value' : 'end_value']: item.value });
                                            }
                                            setDropdownSelect(null);
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
                                        <Text style={{ color: isSelected ? '#158754' : '#f1f5f9', fontSize: 14, fontWeight: isSelected ? '700' : '400' }}>
                                            {item.label}
                                        </Text>
                                        {isSelected && <Text style={{ color: '#158754', fontSize: 14 }}>?</Text>}
                                    </TouchableOpacity>
                                );
                            }}
                        />
                    </SafeAreaView>
                </View>
            </Modal>
        </View>
    );
}
