import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { FileText, UploadCloud, Trash2 } from 'lucide-react-native';
import { FormField } from '@opla/types';

interface FileValue {
    uri: string;
    name: string;
    size?: number;
}

interface Props {
    field: FormField;
    value?: FileValue | string; // Can be object or string (filename)
    onChange: (value: FileValue | null) => void;
    error?: string;
}

export function FileUploadField({ field, value, onChange, error }: Props) {
    const [loading, setLoading] = useState(false);

    const handlePickDocument = async () => {
        setLoading(true);
        try {
            const res = await DocumentPicker.getDocumentAsync({
                type: '*/*',
                copyToCacheDirectory: true,
            });

            if (!res.canceled && res.assets && res.assets.length > 0) {
                const asset = res.assets[0];
                onChange({
                    uri: asset.uri,
                    name: asset.name,
                    size: asset.size ?? undefined,
                });
            }
        } catch (e: any) {
            Alert.alert('Error', e?.message || 'Could not pick document.');
        } finally {
            setLoading(false);
        }
    };

    const handleRemove = () => {
        onChange(null);
    };

    // Determine values to display
    let fileName = '';
    let fileSizeStr = '';
    const hasFile = !!value;

    if (hasFile) {
        if (typeof value === 'object' && value !== null) {
            fileName = value.name || 'document';
            if (value.size) {
                const sizeKb = value.size / 1024;
                fileSizeStr = sizeKb > 1024 
                    ? `${(sizeKb / 1024).toFixed(1)} MB` 
                    : `${sizeKb.toFixed(0)} KB`;
            }
        } else if (typeof value === 'string') {
            fileName = value.split('/').pop() || 'document';
        }
    }

    return (
        <View>
            {hasFile ? (
                <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderWidth: 1.5,
                    borderRadius: 10,
                    padding: 12,
                    gap: 12,
                }}>
                    <View style={{ backgroundColor: '#1e293b', borderRadius: 8, padding: 8 }}>
                        <FileText size={20} color="#38bdf8" />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={{ color: '#f1f5f9', fontSize: 13, fontWeight: '600' }} numberOfLines={1}>
                            {fileName}
                        </Text>
                        {fileSizeStr ? (
                            <Text style={{ color: '#64748b', fontSize: 11, marginTop: 2 }}>
                                {fileSizeStr}
                            </Text>
                        ) : null}
                    </View>
                    <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={handleRemove}
                        style={{ padding: 8 }}
                    >
                        <Trash2 size={16} color="#ef4444" />
                    </TouchableOpacity>
                </View>
            ) : (
                <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={handlePickDocument}
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
                    <UploadCloud size={18} color="#94a3b8" />
                    <Text style={{ color: '#f1f5f9', fontSize: 14, fontWeight: '700' }}>
                        {loading ? 'Opening...' : field.placeholder || 'Choose File'}
                    </Text>
                </TouchableOpacity>
            )}

            {error ? (
                <Text style={{ color: '#ef4444', fontSize: 13, marginTop: 6 }}>{error}</Text>
            ) : null}
        </View>
    );
}
