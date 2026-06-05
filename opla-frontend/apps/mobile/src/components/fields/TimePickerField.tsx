import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, Platform } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Clock } from 'lucide-react-native';
import { FormField } from '@opla/types';

interface Props {
    field: FormField;
    value?: string; // HH:MM
    error?: string;
    onChange: (value: string) => void;
}

export function TimePickerField({ field, value, error, onChange }: Props) {
    const [showPicker, setShowPicker] = useState(false);

    // Parse the value string "HH:MM" to a Date object, or use current date
    const getInitialDate = () => {
        if (value) {
            const [hours, minutes] = value.split(':').map(Number);
            const d = new Date();
            if (!isNaN(hours) && !isNaN(minutes)) {
                d.setHours(hours, minutes, 0, 0);
                return d;
            }
        }
        return new Date();
    };

    const currentDate = getInitialDate();

    const handleTimeChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
        if (Platform.OS === 'android') {
            setShowPicker(false);
        }
        if (selectedDate && event.type !== 'dismissed') {
            const hours = String(selectedDate.getHours()).padStart(2, '0');
            const minutes = String(selectedDate.getMinutes()).padStart(2, '0');
            onChange(`${hours}:${minutes}`);
        }
    };

    return (
        <View>
            <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setShowPicker(true)}
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
                <Clock size={18} color="#94a3b8" style={{ marginRight: 8 }} />
                <Text style={{ color: value ? '#f1f5f9' : '#64748b', fontSize: 14, flex: 1 }}>
                    {value ? value : field.placeholder || 'Select time'}
                </Text>
            </TouchableOpacity>

            {/* iOS Timepicker inside a Modal */}
            {Platform.OS === 'ios' && (
                <Modal
                    visible={showPicker}
                    transparent={true}
                    animationType="slide"
                    onRequestClose={() => setShowPicker(false)}
                >
                    <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
                        <View style={{ backgroundColor: '#1e293b', borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingBottom: 30 }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#334155', padding: 16 }}>
                                <TouchableOpacity onPress={() => setShowPicker(false)}>
                                    <Text style={{ color: '#94a3b8', fontSize: 15, fontWeight: '600' }}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => setShowPicker(false)}>
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
                                    onChange={handleTimeChange}
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
                    onChange={handleTimeChange}
                />
            )}
        </View>
    );
}
