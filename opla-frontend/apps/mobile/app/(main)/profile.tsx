import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Animated, ActivityIndicator, Image } from 'react-native';
import { Settings, Shield, Building2, KeyRound, ChevronRight } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../contexts/AppThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useRouter } from 'expo-router';
import { orgAPI } from '../../services/api';
import { Organization } from '@opla/types';

export default function ProfileScreen() {
    const { mode, setMode } = useAppTheme();
    const { status, user } = useAuth();
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [isLoadingOrgs, setIsLoadingOrgs] = useState(false);

    useEffect(() => {
        if (status === 'authenticated') {
            setIsLoadingOrgs(true);
            orgAPI.list()
                .then(data => setOrganizations(data))
                .catch(err => console.error("Failed to load orgs", err))
                .finally(() => setIsLoadingOrgs(false));
        }
    }, [status]);

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

                {/* Organizations Section */}
                {mode === 'pro' && (
                    <View className="mt-8">
                        <Text className="text-xl font-black text-white mb-4">Organizations</Text>
                        {isLoadingOrgs ? (
                            <ActivityIndicator size="small" color="#22d3ee" className="mt-4" />
                        ) : organizations.length === 0 ? (
                            <View className="p-6 rounded-[32px] bg-slate-800/30 border border-slate-700/50 items-center justify-center">
                                <Building2 size={32} color="#64748b" />
                                <Text className="text-slate-400 mt-3 font-medium text-center">No organizations yet</Text>
                            </View>
                        ) : (
                            <View className="space-y-3">
                                {organizations.map((org) => (
                                    <TouchableOpacity
                                        key={org.id}
                                        activeOpacity={0.75}
                                        onPress={() =>
                                            router.push({
                                                pathname: '/(main)/(desk)/org/[id]',
                                                params: {
                                                    id: org.id,
                                                    name: org.name,
                                                    color: (org as any).primary_color ?? '#158754',
                                                    owner: (org as any).owner_id ?? '',
                                                },
                                            })
                                        }
                                        className="p-5 rounded-2xl bg-slate-800/30 border border-slate-700/50 flex-row items-center"
                                    >
                                        {org.logo_url ? (
                                            <Image source={{ uri: org.logo_url }} className="w-12 h-12 rounded-xl mr-4 bg-slate-800" />
                                        ) : (
                                            <View className="w-12 h-12 rounded-xl mr-4 bg-slate-800 items-center justify-center border-t border-slate-700">
                                                <Building2 size={24} color="#94a3b8" />
                                            </View>
                                        )}
                                        <View className="flex-1">
                                            <Text className="text-white font-bold text-lg">{org.name}</Text>
                                            <Text className="text-slate-400 text-sm">Tap to open workspace</Text>
                                        </View>
                                        <ChevronRight size={16} color="#475569" />
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}
                    </View>
                )}

                {mode === 'pro' && status === 'authenticated' && (
                    <View className="mt-8">
                        <Text className="text-xl font-black text-white mb-4">Contractor Access</Text>
                        <TouchableOpacity
                            activeOpacity={0.85}
                            onPress={() => router.push('./join-team')}
                            className="p-5 rounded-[28px] bg-slate-800/30 border border-slate-700/50 flex-row items-center"
                        >
                            <View className="w-12 h-12 rounded-2xl bg-cyan-500/15 items-center justify-center mr-4 border border-cyan-400/20">
                                <KeyRound size={22} color="#22d3ee" />
                            </View>
                            <View className="flex-1">
                                <Text className="text-white font-bold text-lg">Join Team by PIN</Text>
                                <Text className="text-slate-400 text-sm mt-1">Enter a contractor PIN to join a team from mobile.</Text>
                            </View>
                            <ChevronRight size={18} color="#94a3b8" />
                        </TouchableOpacity>
                    </View>
                )}

                <View className="h-20" />
            </ScrollView>
        </View>
    );
}
