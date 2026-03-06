import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Animated } from 'react-native';
import { Settings, Shield } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../contexts/AppThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useRouter } from 'expo-router';

export default function ProfileScreen() {
    const { mode, setMode } = useAppTheme();
    const { status, user } = useAuth();
    const insets = useSafeAreaInsets();
    const router = useRouter();

    const handleToggleMode = () => {
        if (mode === 'pulse') {
            // Switching to PRO
            // We should check auth first. If not authenticated, force them to login.
            if (status !== 'authenticated') {
                router.push('/(auth)/login');
            } else {
                setMode('pro');
            }
        } else {
            setMode('pulse');
        }
    };

    const isPulse = mode === 'pulse';
    const bgColor = isPulse ? 'bg-slate-50' : 'bg-slate-950';
    const textColor = isPulse ? 'text-slate-900' : 'text-white';

    return (
        <View className={`flex-1 ${bgColor}`} style={{ paddingTop: insets.top }}>
            <ScrollView showsVerticalScrollIndicator={false} className="flex-1 px-5 pt-6 pb-32 space-y-6">

                {/* Header */}
                <View className="flex-row items-center justify-between mt-2">
                    <Text className={`text-3xl font-black tracking-tight ${textColor}`}>Profile</Text>
                    <TouchableOpacity className={`w-12 h-12 rounded-full shadow-sm items-center justify-center border ${isPulse ? 'bg-white border-slate-200' : 'bg-slate-800/50 border-slate-700/50'}`}>
                        <Settings size={20} color={isPulse ? '#334155' : '#cbd5e1'} />
                    </TouchableOpacity>
                </View>

                {/* User Card */}
                <View className={`p-6 rounded-[32px] flex-row items-center mt-6 ${isPulse ? 'bg-white shadow-sm border border-slate-100' : 'bg-slate-800/30 border border-slate-700/50'}`}>
                    <View className="w-16 h-16 rounded-full items-center justify-center border-2 border-white/20 bg-indigo-500 mr-5 overflow-hidden">
                        <Text className="text-white font-black text-xl">
                            {user?.full_name ? user.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : 'JD'}
                        </Text>
                    </View>
                    <View>
                        <Text className={`text-xl font-bold ${textColor}`}>{user?.full_name || 'Jane Doe'}</Text>
                        <Text className={`text-sm font-medium mt-1 ${isPulse ? 'text-slate-500' : 'text-slate-400'}`}>Level 4 Contributor</Text>
                    </View>
                </View>

                {/* The Switch */}
                <View className={`mt-8 p-6 rounded-[32px] border-2 relative overflow-hidden ${mode === 'pro' ? 'border-cyan-500/30 bg-slate-900' : 'border-slate-200 bg-slate-50'}`}>
                    <View className="flex-row justify-between items-center relative z-10 w-full">
                        <View>
                            <View className="flex-row items-center">
                                <Shield size={18} color={mode === 'pro' ? '#22d3ee' : '#94a3b8'} />
                                <Text className={`font-black text-lg ml-2 ${textColor}`}>
                                    Gigs Dashboard
                                </Text>
                            </View>
                            <Text className={`text-sm mt-1 font-medium ${mode === 'pro' ? 'text-cyan-100/70' : 'text-slate-500'}`}>
                                {mode === 'pro' ? 'Agent access active.' : 'Switch to work mode.'}
                            </Text>
                        </View>

                        <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={handleToggleMode}
                            className={`w-16 h-8 flex-row items-center rounded-full p-1 ${mode === 'pro' ? 'bg-cyan-500 justify-end' : 'bg-slate-300 justify-start'}`}
                        >
                            <View className="bg-white w-6 h-6 rounded-full shadow-md" />
                        </TouchableOpacity>
                    </View>
                    {/* Decorative background element for Pro mode active */}
                    {mode === 'pro' && (
                        <View className="absolute -right-10 -top-10 w-32 h-32 bg-cyan-500/20 rounded-full" />
                    )}
                </View>

                {/* Stats */}
                <View className="flex-row mt-6">
                    <View className={`flex-1 p-5 rounded-2xl mr-2 ${isPulse ? 'bg-blue-50' : 'bg-slate-800/30'}`}>
                        <Text className={`text-xs font-bold uppercase opacity-60 mb-1 ${isPulse ? 'text-blue-900' : 'text-slate-400'}`}>Decks Drawn</Text>
                        <Text className={`text-2xl font-black ${isPulse ? 'text-blue-900' : 'text-white'}`}>142</Text>
                    </View>
                    <View className={`flex-1 p-5 rounded-2xl ml-2 ${isPulse ? 'bg-emerald-50' : 'bg-slate-800/30'}`}>
                        <Text className={`text-xs font-bold uppercase opacity-60 mb-1 ${isPulse ? 'text-emerald-900' : 'text-slate-400'}`}>Gig Earnings</Text>
                        <Text className={`text-2xl font-black ${mode === 'pro' ? 'text-lime-400' : (isPulse ? 'text-emerald-900' : 'text-white')}`}>$84.50</Text>
                    </View>
                </View>
                <View className="h-20" />
            </ScrollView>
        </View>
    );
}
