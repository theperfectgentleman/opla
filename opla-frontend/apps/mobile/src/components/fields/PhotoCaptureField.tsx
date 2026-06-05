import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, Image, Modal, ActivityIndicator, Alert } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Camera, RefreshCw, X } from 'lucide-react-native';
import { FormField } from '@opla/types';

interface Props {
    field: FormField;
    value?: string; // URI of local file
    onChange: (value: string) => void;
    error?: string;
}

export function PhotoCaptureField({ field, value, onChange, error }: Props) {
    const [permission, requestPermission] = useCameraPermissions();
    const [cameraVisible, setCameraVisible] = useState(false);
    const [capturing, setCapturing] = useState(false);
    const cameraRef = useRef<any>(null);

    const handleLaunchCamera = async () => {
        if (!permission || !permission.granted) {
            const res = await requestPermission();
            if (!res.granted) {
                Alert.alert('Permission Denied', 'Camera permission is required to take photos.');
                return;
            }
        }
        setCameraVisible(true);
    };

    const handleTakePicture = async () => {
        if (cameraRef.current && !capturing) {
            setCapturing(true);
            try {
                const photo = await cameraRef.current.takePictureAsync({
                    quality: 0.8,
                    skipProcessing: false,
                });
                if (photo?.uri) {
                    onChange(photo.uri);
                    setCameraVisible(false);
                }
            } catch (e: any) {
                Alert.alert('Error', e?.message || 'Failed to capture photo.');
            } finally {
                setCapturing(false);
            }
        }
    };

    const hasPhoto = !!value;

    return (
        <View>
            {hasPhoto ? (
                <View style={{
                    backgroundColor: '#1e293b',
                    borderColor: '#334155',
                    borderWidth: 1.5,
                    borderRadius: 12,
                    overflow: 'hidden',
                }}>
                    <Image
                        source={{ uri: value }}
                        style={{ width: '100%', height: 180, backgroundColor: '#0f172a' }}
                        resizeMode="cover"
                    />
                    <View style={{ padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#0f172a' }}>
                        <Text style={{ color: '#cbd5e1', fontSize: 13, fontWeight: '600' }} numberOfLines={1}>
                            Photo Attached
                        </Text>
                        <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={handleLaunchCamera}
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
                            <RefreshCw size={12} color="#cbd5e1" />
                            <Text style={{ color: '#cbd5e1', fontSize: 11, fontWeight: '700' }}>Retake</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            ) : (
                <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={handleLaunchCamera}
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
                    <Camera size={18} color="#94a3b8" />
                    <Text style={{ color: '#f1f5f9', fontSize: 14, fontWeight: '700' }}>
                        {field.placeholder || 'Take Photo'}
                    </Text>
                </TouchableOpacity>
            )}

            {error ? (
                <Text style={{ color: '#ef4444', fontSize: 13, marginTop: 6 }}>{error}</Text>
            ) : null}

            {/* Camera View Modal */}
            <Modal
                visible={cameraVisible}
                animationType="slide"
                transparent={false}
                onRequestClose={() => setCameraVisible(false)}
            >
                <View style={{ flex: 1, backgroundColor: '#000' }}>
                    <CameraView
                        ref={cameraRef}
                        style={{ flex: 1 }}
                        facing="back"
                    >
                        {/* Header Overlay */}
                        <View style={{
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            paddingHorizontal: 20,
                            paddingTop: 50,
                            paddingBottom: 20,
                            backgroundColor: 'rgba(0,0,0,0.4)',
                        }}>
                            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Camera</Text>
                            <TouchableOpacity
                                onPress={() => setCameraVisible(false)}
                                style={{ padding: 6, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 999 }}
                            >
                                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Camera controls spacer */}
                        <View style={{ flex: 1 }} />

                        {/* Footer Controls Overlay */}
                        <View style={{
                            backgroundColor: 'rgba(0,0,0,0.6)',
                            paddingVertical: 30,
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}>
                            {capturing ? (
                                <ActivityIndicator size="large" color="#ffffff" />
                            ) : (
                                <TouchableOpacity
                                    activeOpacity={0.8}
                                    onPress={handleTakePicture}
                                    style={{
                                        width: 72,
                                        height: 72,
                                        borderRadius: 36,
                                        borderWidth: 4,
                                        borderColor: '#ffffff',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        backgroundColor: 'rgba(255,255,255,0.3)',
                                    }}
                                >
                                    <View style={{
                                        width: 54,
                                        height: 54,
                                        borderRadius: 27,
                                        backgroundColor: '#ffffff',
                                    }} />
                                </TouchableOpacity>
                            )}
                        </View>
                    </CameraView>
                </View>
            </Modal>
        </View>
    );
}
