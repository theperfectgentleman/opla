/**
 * Desk home — authenticated user's assigned forms and workspace overview.
 */
import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../../contexts/AuthContext';
import { deskFormAPI } from '../../../services/api';

type AssignedForm = {
  id: string;
  title: string;
  description?: string;
  due_date?: string;
  status?: 'pending' | 'in_progress' | 'completed';
  submission_count?: number;
  organization?: { name: string };
};

const STATUS_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  pending:     { label: 'Pending',      color: '#fbbf24', bg: '#451a03' },
  in_progress: { label: 'In progress',  color: '#60a5fa', bg: '#1e3a5f' },
  completed:   { label: 'Completed',    color: '#4ade80', bg: '#052e16' },
};

function FormCard({ form, onPress }: { form: AssignedForm; onPress: () => void }) {
  const s = STATUS_LABEL[form.status ?? 'pending'];
  const dueSoon = form.due_date
    ? (new Date(form.due_date).getTime() - Date.now()) / 86400000 <= 2
    : false;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={{
        backgroundColor: '#1e293b', borderRadius: 16, padding: 20,
        marginBottom: 12, borderWidth: 1, borderColor: '#334155',
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1, marginRight: 12 }}>
          {form.organization && (
            <Text style={{ fontSize: 11, color: '#6366f1', fontWeight: '600', marginBottom: 6 }}>
              {form.organization.name}
            </Text>
          )}
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#f1f5f9', lineHeight: 22 }}>
            {form.title}
          </Text>
          {form.description ? (
            <Text style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }} numberOfLines={2}>
              {form.description}
            </Text>
          ) : null}
        </View>
        <View style={{
          paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
          backgroundColor: s.bg,
        }}>
          <Text style={{ fontSize: 11, fontWeight: '600', color: s.color }}>{s.label}</Text>
        </View>
      </View>
      {form.due_date && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 }}>
          <Text style={{ fontSize: 12, color: dueSoon ? '#f87171' : '#64748b' }}>
            {dueSoon ? '⚠️' : '📅'} Due {new Date(form.due_date).toLocaleDateString()}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function DeskIndexScreen() {
  const { user, status } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [forms, setForms] = useState<AssignedForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const fetchForms = useCallback(async () => {
    try {
      const res = await deskFormAPI.myForms();
      setForms(res.data?.forms ?? res.data ?? []);
      setError('');
    } catch (e: any) {
      setError('Could not load your forms.');
    }
  }, []);

  useEffect(() => {
    if (status !== 'authenticated') return;
    fetchForms().finally(() => setLoading(false));
  }, [status]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchForms();
    setRefreshing(false);
  };

  if (status !== 'authenticated') {
    // Shouldn't normally render — RootGuard handles routing
    return (
      <View style={{ flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center', padding: 32 }}>
        <Text style={{ fontSize: 15, color: '#94a3b8', textAlign: 'center' }}>
          Sign in to access your Desk workspace
        </Text>
        <TouchableOpacity
          onPress={() => router.push('/(auth)/login')}
          style={{
            marginTop: 20, backgroundColor: '#6366f1', borderRadius: 12,
            paddingHorizontal: 28, paddingVertical: 12,
          }}
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
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text style={{ fontSize: 26, fontWeight: '800', color: '#f1f5f9' }}>💼 Desk</Text>
            {user?.full_name && (
              <Text style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
                Welcome, {user.full_name.split(' ')[0]}
              </Text>
            )}
          </View>
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator color="#6366f1" size="large" />
        </View>
      ) : (
        <FlatList
          data={forms}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <FormCard
              form={item}
              onPress={() => router.push({
                pathname: '/(main)/(desk)/form/[id]',
                params: { id: item.id },
              })}
            />
          )}
          contentContainerStyle={{
            padding: 16, paddingBottom: insets.bottom + 16, flexGrow: 1,
          }}
          ListEmptyComponent={
            !error ? (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80 }}>
                <Text style={{ fontSize: 40, marginBottom: 16 }}>📭</Text>
                <Text style={{ color: '#94a3b8', fontSize: 15 }}>No forms assigned to you</Text>
              </View>
            ) : (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80 }}>
                <Text style={{ color: '#94a3b8', fontSize: 15, textAlign: 'center' }}>{error}</Text>
              </View>
            )
          }
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />
          }
        />
      )}
    </View>
  );
}
