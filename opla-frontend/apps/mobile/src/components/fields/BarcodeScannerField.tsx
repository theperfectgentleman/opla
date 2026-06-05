import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, Alert } from 'react-native';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import { Barcode } from 'lucide-react-native';
import { FormField } from '@opla/types';

interface Props {
    field: FormField;
    value?: string;
    onChange: (value: string) => void;
    error?: string;
}

export function BarcodeScannerField({ field, value, onChange, error }: Props) {
    const [permission, requestPermission] = useCameraPermissions();
    const [scannerVisible, setScannerVisible] = useState(false);

    const handleOpenScanner = async () => {
        if (!permission || !permission.granted) {
            const res = await requestPermission();
            if (!res.granted) {
                Alert.alert('Permission Denied', 'Camera permission is required to scan barcodes.');
                return;
            }
        }
        setScannerVisible(true);
    };

    const handleBarcodeScanned = (result: BarcodeScanningResult) => {
        if (result.data) {
            onChange(result.data);
            setScannerVisible(false);
        }
    };

    return (
        <View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput
                    value={value || ''}
                    onChangeText={onChange}
                    placeholder={field.placeholder || 'Scan or enter code'}
                    placeholderTextColor="#64748b"
                    style={{
                        flex: 1,
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
                <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={handleOpenScanner}
                    style={{
                        width: 48,
                        height: 48,
                        backgroundColor: '#158754',
                        borderRadius: 8,
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <Barcode size={22} color="#ffffff" />
                </TouchableOpacity>
            </View>

            {error ? (
                <Text style={{ color: '#ef4444', fontSize: 13, marginTop: 6 }}>{error}</Text>
            ) : null}

            {/* Barcode Scanner Camera Modal */}
            <Modal
                visible={scannerVisible}
                animationType="slide"
                transparent={false}
                onRequestClose={() => setScannerVisible(false)}
            >
                <View style={{ flex: 1, backgroundColor: '#000' }}>
                    <CameraView
                        style={{ flex: 1 }}
                        facing="back"
                        barcodeScannerSettings={{
                            barcodeTypes: [
                                'qr',
                                'ean13',
                                'ean8',
                                'code39',
                                'code128',
                                'upc_a',
                                'upc_e',
                            ],
                        }}
                        onBarcodeScanned={handleBarcodeScanned}
                    >
                        {/* Scanner Viewfinder Overlay */}
                        <View style={{
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            paddingHorizontal: 20,
                            paddingTop: 50,
                            paddingBottom: 20,
                            backgroundColor: 'rgba(0,0,0,0.4)',
                        }}>
                            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Scan Barcode / QR</Text>
                            <TouchableOpacity
                                onPress={() => setScannerVisible(false)}
                                style={{ padding: 6, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 999 }}
                            >
                                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Centered Laser/Viewfinder UI */}
                        <View style={{
                            flex: 1,
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}>
                            <View style={{
                                width: 250,
                                height: 250,
                                borderWidth: 2,
                                borderColor: '#158754',
                                borderRadius: 12,
                                backgroundColor: 'transparent',
                                position: 'relative',
                            }}>
                                {/* Red Laser line */}
                                <View style={{
                                    position: 'absolute',
                                    left: '10%',
                                    right: '10%',
                                    top: '50%',
                                    height: 2,
                                    backgroundColor: '#ef4444',
                                }} />
                            </View>
                            <Text style={{ color: '#94a3b8', fontSize: 13, marginTop: 24, textAlign: 'center', paddingHorizontal: 40 }}>
                                Align the barcode or QR code inside the green frame to scan automatically.
                            </Text>
                        </View>

                        {/* Bottom Spacer */}
                        <View style={{ height: 100, backgroundColor: 'rgba(0,0,0,0.4)' }} />
                    </CameraView>
                </View>
            </Modal>
        </View>
    );
}
