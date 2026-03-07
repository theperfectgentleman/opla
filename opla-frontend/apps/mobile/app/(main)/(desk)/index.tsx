/**
 * Desk home — list of organisations the user belongs to (Pro View Mode).
 */
import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../../contexts/AuthContext';
import { orgAPI } from '../../../services/api';
import { Activity, Clock, Building2, ChevronRight } from 'lucide-react-native';

type Org = {
  id: string;
  name: string;
  slug?: string;
  logo_url?: string;
  primary_color?: string;
  owner_id?: string;
};

const proMissions = [
  {
    id: 1,
    company: "Acme Corp",
    title: "Q3 Consumer Beverage Habits",
    pay: "$45.00",
    quotaMax: 20,
    quotaCurrent: 14,
    timeLeft: "2 days",
    status: "In Progress"
  },
  {
    id: 2,
    company: "Global Tech Insights",
    title: "B2B Software Adoption 2026",
    pay: "$120.00",
    quotaMax: 5,
    quotaCurrent: 1,
    timeLeft: "12 hours",
    status: "Urgent"
  }
];

function OrgCard({ org, onPress }: { org: Org; onPress: () => void }) {
  const accent = org.primary_color || '#158754';
  const initials = org.name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={onPress}
      style={{
        backgroundColor: '#1e293b',
        borderRadius: 16,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#334155',
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        gap: 14,
      }}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          backgroundColor: accent + '22',
          borderWidth: 1,
          borderColor: accent + '55',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: accent, fontSize: 15, fontWeight: '800' }}>{initials}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: '#f1f5f9' }} numberOfLines={1}>
          {org.name}
        </Text>
        {org.slug ? (
          <Text style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>@{org.slug}</Text>
        ) : null}
      </View>
      <ChevronRight size={16} color="#475569" />
    </TouchableOpacity>
  );
}

export default function DeskIndexScreen() {
  const { user, status } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const fetchOrgs = useCallback(async () => {
    try {
      const data = await orgAPI.list();
      setOrgs(Array.isArray(data) ? data : data?.organizations ?? []);
      setError('');
    } catch {
      setError('Could not load your organisations.');
    }
  }, []);

  useEffect(() => {
    if (status !== 'authenticated') return;
    fetchOrgs().finally(() => setLoading(false));
  }, [status]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchOrgs();
    setRefreshing(false);
  };

  if (status !== 'authenticated') {
    return (
      <View className="flex-1 bg-slate-950 items-center justify-center p-8">
        <Text className="text-sm text-slate-400 text-center">Sign in to access your Agent Dashboard.</Text>
        <TouchableOpacity
          onPress={() => router.push('/(auth)/login')}
          className="mt-6 bg-cyan-500 rounded-xl px-8 py-3"
        >
          <Text className="text-slate-900 font-bold">Authenticate</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-slate-950" style={{ paddingTop: insets.top }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        className="flex-1 px-5 pt-6 pb-24"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#22d3ee" />}
      >
        {/* Header */}
        <View className="flex-row items-center justify-between mb-8">
          <View>
            <Text className="text-3xl font-black text-transparent bg-clip-text text-cyan-400 tracking-tight">Active Gigs</Text>
            <Text className="text-slate-400 font-medium mt-1">Your high-priority assignments.</Text>
          </View>
          <View className="text-right bg-slate-800/60 p-2.5 rounded-2xl border border-slate-700/50">
            <Text className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-0.5">Wallet Balance</Text>
            <Text className="text-xl font-black text-lime-400">$345.50</Text>
          </View>
        </View>

        {/* Current Quotas (Mocked Active Gigs) */}
        <View className="mb-8">
          <View className="flex-row items-center mb-4">
            <Activity size={16} color="#22d3ee" />
            <Text className="text-sm font-bold text-slate-400 uppercase tracking-widest ml-2">Current Quotas</Text>
          </View>

          {proMissions.map((mission) => (
            <View key={mission.id} className="bg-slate-900 border border-slate-700/50 rounded-3xl p-5 relative overflow-hidden mb-4">
              <View className="absolute top-0 left-0 w-1 h-full bg-cyan-500" />

              <View className="flex-row justify-between items-start mb-4 pl-2">
                <View>
                  <Text className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">{mission.company}</Text>
                  <Text className="text-lg font-bold text-white mt-1 leading-tight">{mission.title}</Text>
                </View>
                <View className="bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
                  <Text className="font-bold text-lime-400">{mission.pay}</Text>
                </View>
              </View>

              <View className="mb-4 pl-2">
                <View className="flex-row justify-between text-sm mb-2">
                  <Text className="text-slate-400 font-medium text-xs">Gig Completion</Text>
                  <Text className="text-white font-bold text-xs">{mission.quotaCurrent} / {mission.quotaMax} DATA POINTS</Text>
                </View>
                <View className="w-full bg-slate-950 rounded-full h-2 border border-slate-800 overflow-hidden">
                  <View
                    style={{ width: `${(mission.quotaCurrent / mission.quotaMax) * 100}%` }}
                    className={`h-full rounded-full ${mission.status === 'Urgent' ? 'bg-orange-500' : 'bg-cyan-500'}`}
                  />
                </View>
              </View>

              <View className="flex-row items-center justify-between mt-5 pt-4 border-t border-slate-800 pl-2">
                <View className="flex-row items-center">
                  <Clock size={14} color={mission.status === 'Urgent' ? '#fb923c' : '#06b6d4'} />
                  <Text className={`ml-1.5 text-xs font-bold ${mission.status === 'Urgent' ? 'text-orange-400' : 'text-slate-400'}`}>
                    {mission.timeLeft} left
                  </Text>
                </View>
                <TouchableOpacity className="bg-cyan-500/10 border border-cyan-500/30 px-5 py-2 rounded-xl">
                  <Text className="font-bold text-sm text-cyan-400">Execute Gig</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>

        {/* My Organisations */}
        <View style={{ marginBottom: 32 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
            <Building2 size={16} color="#158754" />
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: 1.2, marginLeft: 8 }}>
              My Organisations
            </Text>
          </View>

          {loading ? (
            <ActivityIndicator color="#158754" size="large" />
          ) : error ? (
            <Text style={{ color: '#94a3b8', textAlign: 'center' }}>{error}</Text>
          ) : orgs.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 24 }}>
              <Building2 size={32} color="#334155" />
              <Text style={{ color: '#475569', marginTop: 12, textAlign: 'center' }}>
                You are not a member of any organisation yet.
              </Text>
            </View>
          ) : (
            orgs.map((org) => (
              <OrgCard
                key={org.id}
                org={org}
                onPress={() =>
                  router.push({
                    pathname: '/(main)/(desk)/org/[id]',
                    params: {
                      id: org.id,
                      name: org.name,
                      color: org.primary_color ?? '#158754',
                      owner: org.owner_id ?? '',
                    },
                  })
                }
              />
            ))
          )}
        </View>
        <View className="h-20" />
      </ScrollView>
    </View>
  );
}
