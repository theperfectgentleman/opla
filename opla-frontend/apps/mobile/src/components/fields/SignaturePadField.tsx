import React, { useState } from 'react';
import { View, Text, TouchableOpacity, GestureResponderEvent } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { PenTool, Trash2, Undo2 } from 'lucide-react-native';
import { FormField } from '@opla/types';

interface Props {
    field: FormField;
    value?: string; // JSON string of strokes
    onChange: (value: string | null) => void;
    error?: string;
}

export function SignaturePadField({ field, value, onChange, error }: Props) {
    const [currentPath, setCurrentPath] = useState<string>('');
    const [strokes, setStrokes] = useState<string[]>([]);

    // Parse the value when it changes, if it's set externally
    React.useEffect(() => {
        if (value) {
            try {
                const parsed = JSON.parse(value);
                if (Array.isArray(parsed)) {
                    setStrokes(parsed);
                }
            } catch {
                if (typeof value === 'string' && value.startsWith('M')) {
                    setStrokes([value]);
                }
            }
        } else {
            setStrokes([]);
        }
    }, [value]);

    const handleTouchStart = (event: GestureResponderEvent) => {
        const { locationX, locationY } = event.nativeEvent;
        const newPath = `M ${locationX.toFixed(1)} ${locationY.toFixed(1)}`;
        setCurrentPath(newPath);
    };

    const handleTouchMove = (event: GestureResponderEvent) => {
        const { locationX, locationY } = event.nativeEvent;
        if (currentPath) {
            const nextPath = `${currentPath} L ${locationX.toFixed(1)} ${locationY.toFixed(1)}`;
            setCurrentPath(nextPath);
        }
    };

    const handleTouchEnd = () => {
        if (currentPath) {
            const updatedStrokes = [...strokes, currentPath];
            setStrokes(updatedStrokes);
            setCurrentPath('');
            onChange(JSON.stringify(updatedStrokes));
        }
    };

    const handleClear = () => {
        setStrokes([]);
        setCurrentPath('');
        onChange(null);
    };

    const handleUndo = () => {
        if (strokes.length > 0) {
            const nextStrokes = strokes.slice(0, -1);
            setStrokes(nextStrokes);
            onChange(nextStrokes.length > 0 ? JSON.stringify(nextStrokes) : null);
        }
    };

    // Combine strokes for display in Svg
    const allPaths = [...strokes, currentPath].filter(Boolean);

    return (
        <View>
            <View
                style={{
                    backgroundColor: '#0f172a',
                    borderColor: error ? '#ef4444' : '#334155',
                    borderWidth: 1.5,
                    borderRadius: 12,
                    overflow: 'hidden',
                }}
            >
                {/* Visual Header */}
                <View style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderBottomWidth: 1,
                    borderBottomColor: '#1e293b',
                    backgroundColor: '#1e293b',
                }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <PenTool size={14} color="#94a3b8" />
                        <Text style={{ color: '#cbd5e1', fontSize: 12, fontWeight: '600' }}>
                            Draw Signature below
                        </Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TouchableOpacity
                            onPress={handleUndo}
                            disabled={strokes.length === 0}
                            style={{ padding: 4, opacity: strokes.length === 0 ? 0.4 : 1 }}
                        >
                            <Undo2 size={16} color="#cbd5e1" />
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={handleClear}
                            disabled={strokes.length === 0 && !currentPath}
                            style={{ padding: 4, opacity: (strokes.length === 0 && !currentPath) ? 0.4 : 1 }}
                        >
                            <Trash2 size={16} color="#ef4444" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Canvas Area */}
                <View
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    style={{
                        height: 180,
                        width: '100%',
                        backgroundColor: '#0f172a',
                    }}
                >
                    <Svg style={{ flex: 1 }}>
                        {allPaths.map((pathStr, idx) => (
                            <Path
                                key={idx}
                                d={pathStr}
                                fill="none"
                                stroke="#f1f5f9"
                                strokeWidth={3}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        ))}
                    </Svg>
                    {strokes.length === 0 && !currentPath && (
                        <View style={{
                            position: 'absolute',
                            left: 0,
                            right: 0,
                            top: 0,
                            bottom: 0,
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}>
                            <Text style={{ color: '#475569', fontSize: 13, fontStyle: 'italic' }}>
                                Sign with your finger
                            </Text>
                        </View>
                    )}
                </View>
            </View>

            {error ? (
                <Text style={{ color: '#ef4444', fontSize: 13, marginTop: 6 }}>{error}</Text>
            ) : null}
        </View>
    );
}
