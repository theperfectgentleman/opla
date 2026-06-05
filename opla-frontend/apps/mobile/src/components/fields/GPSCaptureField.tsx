import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import * as Location from 'expo-location';
import { MapPin, RefreshCw, CheckCircle2 } from 'lucide-react-native';
import { FormField } from '@opla/types';

interface GPSValue {
    lat: number;
    lng: number;
    accuracy?: number;
    timestamp?: number;
}

interface Props {
    field: FormField;
    value?: GPSValue;
    onChange: (value: GPSValue) => void;
    error?: string;
}

export function GPSCaptureField({ field, value, onChange, error }: Props) {
    const [loading, setLoading] = useState(false);

    const handleCapture = async () => {
        setLoading(true);
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert(
                    'Permission Denied',
                    'Location permissions are required to capture coordinates.'
                );
                return;
            }

            const position = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
            });

            onChange({
                lat: position.coords.latitude,
                lng: position.coords.longitude,
                accuracy: position.coords.accuracy ?? undefined,
                timestamp: position.timestamp,
            });
        } catch (e: any) {
            Alert.alert('GPS Capture Failed', e?.message || 'Could not retrieve coordinates.');
        } finally {
            setLoading(false);
        }
    };

    const hasValue = !!value && typeof value.lat === 'number' && typeof value.lng === 'number';

    return (
        <View>
            {hasValue ? (
                <View style={{
                    backgroundColor: '#0f172a',
                    borderColor: '#158754',
                    borderWidth: 1.5,
                    borderRadius: 12,
                    padding: 14,
                }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <View style={{ backgroundColor: '#158754', borderRadius: 999, padding: 6 }}>
                                <CheckCircle2 size={16} color="#ffffff" />
                            </View>
                            <Text style={{ color: '#cbd5e1', fontSize: 13, fontWeight: '700' }}>GPS Captured</Text>
                        </View>
                        <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={handleCapture}
                            disabled={loading}
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 6,
                                backgroundColor: '#1e293b',
                                borderWidth: 1,
                                borderColor: '#334155',
                                borderRadius: 8,
                                paddingHorizontal: 10,
                                paddingVertical: 6,
                            }}
                        >
                            {loading ? (
                                <ActivityIndicator size="small" color="#cbd5e1" />
                            ) : (
                                <RefreshCw size={12} color="#cbd5e1" />
                            )}
                            <Text style={{ color: '#cbd5e1', fontSize: 11, fontWeight: '700' }}>Recapture</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={{ gap: 4 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={{ color: '#64748b', fontSize: 12 }}>Latitude</Text>
                            <Text style={{ color: '#f1f5f9', fontSize: 12, fontWeight: '600', fontFamily: 'monospace' }}>{value.lat.toFixed(6)}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={{ color: '#64748b', fontSize: 12 }}>Longitude</Text>
                            <Text style={{ color: '#f1f5f9', fontSize: 12, fontWeight: '600', fontFamily: 'monospace' }}>{value.lng.toFixed(6)}</Text>
                        </View>
                        {value.accuracy !== undefined && (
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                <Text style={{ color: '#64748b', fontSize: 12 }}>Accuracy</Text>
                                <Text style={{ color: '#cbd5e1', fontSize: 12, fontWeight: '600' }}>±{value.accuracy.toFixed(1)} meters</Text>
                            </View>
                        )}
                        {value.timestamp !== undefined && (
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                <Text style={{ color: '#64748b', fontSize: 12 }}>Captured At</Text>
                                <Text style={{ color: '#94a3b8', fontSize: 11 }}>
                                    {new Date(value.timestamp).toLocaleTimeString()}
                                </Text>
                            </View>
                        )}
                    </View>
                </View>
            ) : (
                <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={handleCapture}
                    disabled={loading}
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        backgroundColor: '#1e293b',
                        borderColor: error ? '#ef4444' : '#334155',
                        borderWidth: 1.5,
                        borderRadius: 8,
                        paddingVertical: 14,
                    }}
                >
                    {loading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <MapPin size={18} color="#94a3b8" />
                    )}
                    <Text style={{ color: '#f1f5f9', fontSize: 14, fontWeight: '700' }}>
                        {loading ? 'Locating...' : field.placeholder || 'Capture GPS Coordinates'}
                    </Text>
                </TouchableOpacity>
            )}

            {error ? (
                <Text style={{ color: '#ef4444', fontSize: 13, marginTop: 6 }}>{error}</Text>
            ) : null}
        </View>
    );
}
