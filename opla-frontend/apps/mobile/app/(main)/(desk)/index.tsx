/**
 * Desk home — list of organisations the user belongs to.
 * Tap an org to see everything inside it (teams, projects, forms).
 */
import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../../contexts/AuthContext';
import { orgAPI } from '../../../services/api';

type Org = {
  id: string;
  name: string;
  slug?: string;
  logo_url?: string;
  primary_color?: string;
  owner_id?: string;
};

function OrgCard({ org, onPress, isOwner }: { org: Org; onPress: () => void; isOwner: boolean }) {
  const initials = org.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const accent = org.primary_color ?? '#6366f1';

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={{
        backgroundColor: '#1e293b', borderRadius: 18, padding: 18,
        marginBottom: 12, borderWidth: 1, borderColor: '#334155',
        flexDirection: 'row', alignItems: 'center', gap: 16,
      }}
    >
      {/* Avatar */}
      <View style={{
        width: 52, height: 52, borderRadius: 16,
        backgroundColor: accent + '33',
        borderWidth: 2, borderColor: accent + '66',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Text style={{ color: accent, fontSize: 18, fontWeight: '800' }}>{initials}</Text>
      </View>

      {/* Info */}
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: '#f1f5f9' }}>{org.name}</Text>
        {org.slug && (
          <Text style={{ fontSize: 12, color: '#475569', marginTop: 3 }}>@{org.slug}</Text>
        )}
        {isOwner && (
          <View style={{
            marginTop: 5, alignSelf: 'flex-start',
            backgroundColor: '#1e1b4b', borderRadius: 8,
            paddingHorizontal: 8, paddingVertical: 2,
          }}>
            <Text style={{ fontSize: 11, color: '#a5b4fc', fontWeight: '600' }}>Owner</Text>
          </View>
        )}
      </View>

      {/* Chevron */}
      <Text style={{ color: '#475569', fontSize: 18 }}>›</Text>
    </TouchableOpacity>
  );
}

export default function DeskIndexScreen() {
  const { user, status } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [orgs, setOrgs]       = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]     = useState('');

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
      <View style={{ flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center', padding: 32 }}>
        <Text style={{ fontSize: 15, color: '#94a3b8', textAlign: 'center' }}>
          Sign in to access your Desk workspace
        </Text>
        <TouchableOpacity
          onPress={() => router.push('/(auth)/login')}
          style={{ marginTop: 20, backgroundColor: '#6366f1', borderRadius: 12, paddingHorizontal: 28, paddingVertical: 12 }}
        >
          <Text style={{ color: '#fff', fontWeight: '700' }}>Sign In</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#0f172a' }}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={{
        paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: 16,
        backgroundColor: '#0f172a', borderBottomWidth: 1, borderBottomColor: '#1e293b',
      }}>
        <Text style={{ fontSize: 26, fontWeight: '800', color: '#f1f5f9' }}>💼 Desk</Text>
        {user?.full_name && (
          <Text style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
            Welcome, {user.full_name.split(' ')[0]}
          </Text>
        )}
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator color="#6366f1" size="large" />
        </View>
      ) : error ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 }}>
          <Text style={{ color: '#94a3b8', textAlign: 'center', fontSize: 14 }}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={orgs}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <OrgCard
              org={item}
              isOwner={item.owner_id === user?.id}
              onPress={() => router.push({
                pathname: '/(main)/(desk)/org/[id]',
                params: {
                  id: item.id,
                  name: item.name,
                  color: item.primary_color ?? '#6366f1',
                  owner: item.owner_id ?? '',
                },
              })}
            />
          )}
          contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 20, flexGrow: 1 }}
          ListHeaderComponent={
            orgs.length > 0 ? (
              <Text style={{ fontSize: 13, color: '#475569', marginBottom: 16 }}>
                {orgs.length} organisation{orgs.length !== 1 ? 's' : ''}
              </Text>
            ) : null
          }
          ListEmptyComponent={
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80 }}>
              <Text style={{ fontSize: 40, marginBottom: 16 }}>🏢</Text>
              <Text style={{ color: '#94a3b8', fontSize: 15, textAlign: 'center' }}>
                You're not part of any organisation yet.
              </Text>
            </View>
          }
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />}
        />
      )}
    </View>
  );
}
