/**
 * Yard home — public survey catalog.
 * Fetches published forms, shows them as cards. Tapping opens the form runner.
 */
import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  ActivityIndicator, RefreshControl, StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { publicFormAPI } from '../../../services/api';

type FormSummary = {
  id: string;
  title: string;
  slug: string;
  description?: string;
  question_count?: number;
  estimated_minutes?: number;
  organization?: { name: string };
};

function FormCard({ form, onPress }: { form: FormSummary; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={{
        backgroundColor: '#1e293b', borderRadius: 16, padding: 20,
        marginBottom: 12, borderWidth: 1, borderColor: '#334155',
      }}
    >
      {form.organization && (
        <View style={{
          backgroundColor: '#0f172a', borderRadius: 20,
          paddingHorizontal: 10, paddingVertical: 4,
          alignSelf: 'flex-start', marginBottom: 10,
        }}>
          <Text style={{ fontSize: 11, color: '#6366f1', fontWeight: '600' }}>
            {form.organization.name}
          </Text>
        </View>
      )}
      <Text style={{ fontSize: 17, fontWeight: '700', color: '#f1f5f9', lineHeight: 24 }}>
        {form.title}
      </Text>
      {form.description ? (
        <Text style={{ fontSize: 13, color: '#94a3b8', marginTop: 6, lineHeight: 20 }} numberOfLines={2}>
          {form.description}
        </Text>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 16, marginTop: 14 }}>
        {form.question_count != null && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={{ fontSize: 12, color: '#64748b' }}>📋</Text>
            <Text style={{ fontSize: 12, color: '#64748b' }}>{form.question_count} questions</Text>
          </View>
        )}
        {form.estimated_minutes != null && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={{ fontSize: 12, color: '#64748b' }}>⏱</Text>
            <Text style={{ fontSize: 12, color: '#64748b' }}>{form.estimated_minutes} min</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function YardIndexScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [forms, setForms] = useState<FormSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  const fetchForms = useCallback(async (query?: string) => {
    try {
      const res = await publicFormAPI.list(query ? { search: query } : undefined);
      setForms(res.data?.forms ?? res.data ?? []);
      setError('');
    } catch (e: any) {
      setError('Could not load surveys. Pull down to retry.');
    }
  }, []);

  useEffect(() => {
    fetchForms().finally(() => setLoading(false));
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchForms(search);
    setRefreshing(false);
  };

  const onSearch = (text: string) => {
    setSearch(text);
    // Debounce not needed for simplicity; search on submit
  };

  const submitSearch = () => fetchForms(search);

  return (
    <View style={{ flex: 1, backgroundColor: '#0f172a' }}>
      <StatusBar barStyle="light-content" />
      {/* Header */}
      <View style={{
        paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: 16,
        backgroundColor: '#0f172a', borderBottomWidth: 1, borderBottomColor: '#1e293b',
      }}>
        <Text style={{ fontSize: 26, fontWeight: '800', color: '#f1f5f9', marginBottom: 14 }}>
          🌿 Yard
        </Text>
        <TextInput
          value={search}
          onChangeText={onSearch}
          onSubmitEditing={submitSearch}
          returnKeyType="search"
          placeholder="Search surveys…"
          placeholderTextColor="#475569"
          style={{
            backgroundColor: '#1e293b', borderRadius: 12,
            paddingHorizontal: 16, paddingVertical: 12,
            color: '#f1f5f9', fontSize: 14, borderWidth: 1.5, borderColor: '#334155',
          }}
        />
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
          data={forms}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <FormCard
              form={item}
              onPress={() => router.push({ pathname: '/(main)/(yard)/form/[slug]', params: { slug: item.slug } })}
            />
          )}
          contentContainerStyle={{
            padding: 16, paddingBottom: insets.bottom + 16,
            flexGrow: 1,
          }}
          ListEmptyComponent={
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80 }}>
              <Text style={{ fontSize: 40, marginBottom: 16 }}>🔍</Text>
              <Text style={{ color: '#94a3b8', fontSize: 15 }}>No surveys found</Text>
            </View>
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#6366f1"
            />
          }
        />
      )}
    </View>
  );
}
