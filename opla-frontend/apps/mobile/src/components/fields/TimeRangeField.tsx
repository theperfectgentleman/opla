import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, Platform } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Clock } from 'lucide-react-native';
import { FormField } from '@opla/types';

interface TimeRangeValue {
    open?: string;  // HH:MM
    close?: string; // HH:MM
}

interface Props {
    field: FormField;
    value?: TimeRangeValue;
    error?: string;
    onChange: (value: TimeRangeValue) => void;
}

export function TimeRangeField({ field, value = {}, error, onChange }: Props) {
    const [showPicker, setShowPicker] = useState<'open' | 'close' | null>(null);

    const parseTime = (timeStr?: string): Date => {
        const d = new Date();
        if (timeStr) {
            const [h, m] = timeStr.split(':').map(Number);
            if (!isNaN(h) && !isNaN(m)) {
                d.setHours(h, m, 0, 0);
                return d;
            }
        }
        return d;
    };

    const handleTimeChange = (which: 'open' | 'close') => (event: DateTimePickerEvent, selectedDate?: Date) => {
        if (Platform.OS === 'android') {
            setShowPicker(null);
        }
        if (selectedDate && event.type !== 'dismissed') {
            const hours = String(selectedDate.getHours()).padStart(2, '0');
            const minutes = String(selectedDate.getMinutes()).padStart(2, '0');
            const timeStr = `${hours}:${minutes}`;
            onChange({
                ...value,
                [which]: timeStr,
            });
        }
    };

    const renderButton = (label: string, timeValue: string | undefined, which: 'open' | 'close') => (
        <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setShowPicker(which)}
            style={{
                flex: 1,
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
            <View>
                <Text style={{ color: '#94a3b8', fontSize: 10, fontWeight: '600' }}>{label}</Text>
                <Text style={{ color: timeValue ? '#f1f5f9' : '#64748b', fontSize: 14 }}>
                    {timeValue || '--:--'}
                </Text>
            </View>
        </TouchableOpacity>
    );

    const activeTimeStr = showPicker === 'open' ? value.open : value.close;
    const currentDate = parseTime(activeTimeStr);

    return (
        <View>
            <View style={{ flexDirection: 'row', gap: 12 }}>
                {renderButton('Opens', value.open, 'open')}
                {renderButton('Closes', value.close, 'close')}
            </View>

            {/* iOS Timepicker inside a Modal */}
            {Platform.OS === 'ios' && showPicker && (
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
                                    value={currentDate}
                                    mode="time"
                                    display="spinner"
                                    is24Hour={true}
                                    textColor="#f1f5f9"
                                    onChange={handleTimeChange(showPicker)}
                                />
                            </View>
                        </View>
                    </View>
                </Modal>
            )}

            {/* Android Timepicker */}
            {Platform.OS === 'android' && showPicker && (
                <DateTimePicker
                    value={currentDate}
                    mode="time"
                    display="default"
                    is24Hour={true}
                    onChange={handleTimeChange(showPicker)}
                />
            )}
        </View>
    );
}
