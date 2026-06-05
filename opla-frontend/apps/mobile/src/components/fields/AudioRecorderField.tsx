import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Audio } from 'expo-av';
import { Mic, Square, Play, Pause, Trash2 } from 'lucide-react-native';
import { FormField } from '@opla/types';

interface Props {
    field: FormField;
    value?: string; // URI of captured audio file
    onChange: (value: string | null) => void;
    error?: string;
}

export function AudioRecorderField({ field, value, onChange, error }: Props) {
    const [recording, setRecording] = useState<Audio.Recording | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [duration, setDuration] = useState(0);
    const [sound, setSound] = useState<Audio.Sound | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [playProgress, setPlayProgress] = useState(0);
    const timerRef = useRef<any>(null);

    useEffect(() => {
        // Cleanup recording and playing on unmount
        return () => {
            if (recording) {
                recording.stopAndUnloadAsync().catch(() => {});
            }
            if (sound) {
                sound.unloadAsync().catch(() => {});
            }
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        };
    }, [recording, sound]);

    // Format duration in mm:ss
    const formatTime = (secs: number) => {
        const m = Math.floor(secs / 60).toString().padStart(2, '0');
        const s = (secs % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    const startRecording = async () => {
        try {
            const perm = await Audio.requestPermissionsAsync();
            if (perm.status !== 'granted') {
                Alert.alert('Permission Denied', 'Microphone permissions are required to record audio.');
                return;
            }

            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
            });

            const { recording: newRecording } = await Audio.Recording.createAsync(
                Audio.RecordingOptionsPresets.HIGH_QUALITY
            );

            setRecording(newRecording);
            setIsRecording(true);
            setDuration(0);

            timerRef.current = setInterval(() => {
                setDuration(prev => prev + 1);
            }, 1000);
        } catch (err: any) {
            Alert.alert('Recording Failed', err?.message || 'Could not start recording.');
        }
    };

    const stopRecording = async () => {
        if (!recording) return;

        setIsRecording(false);
        if (timerRef.current) {
            clearInterval(timerRef.current);
        }

        try {
            await recording.stopAndUnloadAsync();
            const uri = recording.getURI();
            setRecording(null);

            await Audio.setAudioModeAsync({
                allowsRecordingIOS: false,
            });

            if (uri) {
                onChange(uri);
            }
        } catch (err: any) {
            Alert.alert('Error', 'Failed to stop recording.');
        }
    };

    const playSound = async () => {
        if (!value) return;

        if (sound) {
            await sound.playAsync();
            setIsPlaying(true);
            return;
        }

        try {
            const { sound: newSound } = await Audio.Sound.createAsync(
                { uri: value },
                { shouldPlay: true },
                onPlaybackStatusUpdate
            );
            setSound(newSound);
            setIsPlaying(true);
        } catch (err: any) {
            Alert.alert('Playback Failed', 'Could not play audio.');
        }
    };

    const pauseSound = async () => {
        if (sound) {
            await sound.pauseAsync();
            setIsPlaying(false);
        }
    };

    const onPlaybackStatusUpdate = (status: any) => {
        if (status.isLoaded) {
            if (status.didJustFinish) {
                setIsPlaying(false);
                setPlayProgress(0);
            } else {
                const duration = status.durationMillis || 1;
                const position = status.positionMillis || 0;
                setPlayProgress(position / duration);
            }
        }
    };

    const handleRemove = async () => {
        if (sound) {
            await sound.unloadAsync();
            setSound(null);
        }
        setIsPlaying(false);
        setPlayProgress(0);
        onChange(null);
    };

    const hasAudio = !!value;

    return (
        <View>
            {hasAudio ? (
                // Captured Audio UI
                <View style={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderWidth: 1.5,
                    borderRadius: 12,
                    padding: 14,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                }}>
                    <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={isPlaying ? pauseSound : playSound}
                        style={{
                            width: 44,
                            height: 44,
                            borderRadius: 22,
                            backgroundColor: '#1e293b',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderWidth: 1,
                            borderColor: '#334155',
                        }}
                    >
                        {isPlaying ? (
                            <Pause size={18} color="#158754" />
                        ) : (
                            <Play size={18} color="#158754" style={{ marginLeft: 3 }} />
                        )}
                    </TouchableOpacity>

                    <View style={{ flex: 1 }}>
                        <Text style={{ color: '#cbd5e1', fontSize: 13, fontWeight: '700' }}>
                            Audio Recording
                        </Text>
                        <View style={{
                            height: 4,
                            backgroundColor: '#1e293b',
                            borderRadius: 2,
                            marginTop: 6,
                            overflow: 'hidden',
                        }}>
                            <View style={{
                                width: `${playProgress * 100}%`,
                                height: '100%',
                                backgroundColor: '#158754',
                            }} />
                        </View>
                    </View>

                    <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={handleRemove}
                        style={{ padding: 8 }}
                    >
                        <Trash2 size={16} color="#ef4444" />
                    </TouchableOpacity>
                </View>
            ) : isRecording ? (
                // Active Recording UI
                <View style={{
                    backgroundColor: '#0f172a',
                    borderColor: '#ef4444',
                    borderWidth: 1.5,
                    borderRadius: 12,
                    padding: 16,
                    alignItems: 'center',
                    gap: 12,
                }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <View style={{
                            width: 8,
                            height: 8,
                            borderRadius: 4,
                            backgroundColor: '#ef4444',
                        }} />
                        <Text style={{ color: '#ef4444', fontSize: 13, fontWeight: '700' }}>
                            Recording...
                        </Text>
                    </View>
                    <Text style={{ color: '#f1f5f9', fontSize: 24, fontWeight: '800', fontFamily: 'monospace' }}>
                        {formatTime(duration)}
                    </Text>
                    <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={stopRecording}
                        style={{
                            width: 56,
                            height: 56,
                            borderRadius: 28,
                            backgroundColor: '#ef4444',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginTop: 4,
                        }}
                    >
                        <Square size={20} color="#ffffff" />
                    </TouchableOpacity>
                </View>
            ) : (
                // Idle / Start Recording UI
                <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={startRecording}
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
                    <Mic size={18} color="#94a3b8" />
                    <Text style={{ color: '#f1f5f9', fontSize: 14, fontWeight: '700' }}>
                        {field.placeholder || 'Record Audio'}
                    </Text>
                </TouchableOpacity>
            )}

            {error ? (
                <Text style={{ color: '#ef4444', fontSize: 13, marginTop: 6 }}>{error}</Text>
            ) : null}
        </View>
    );
}
