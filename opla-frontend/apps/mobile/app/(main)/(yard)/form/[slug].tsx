/**
 * Public form runner — Yard area.
 * Loads a form by slug, renders each field, and submits to the public endpoint.
 */
import { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView, Platform, StatusBar,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { publicFormAPI } from '../../../../services/api';
import { FormRenderer } from '../../../../src/components/FormRenderer';
import { FormBlueprint } from '@opla/types';

export default function YardFormScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [form, setForm] = useState<FormBlueprint | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!slug) return;
    publicFormAPI.getBySlug(slug)
      .then(r => setForm((r as any)?.data ?? (r as any)))
      .catch((e: any) => {
        const detail = e?.response?.data?.detail;
        if (e?.response?.status === 404 || e?.response?.status === 409) {
          setError(detail || 'Survey is not available yet. It may not be published.');
        } else {
          // Provide a generic fallback that's easy to test for demo
          setError('Survey not found or no longer available.');
        }
      })
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color="#6366f1" size="large" />
      </View>
    );
  }

  if (submitted) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center', padding: 32 }}>
        <Text style={{ fontSize: 64, marginBottom: 24 }}>🎉</Text>
        <Text style={{ fontSize: 24, fontWeight: '800', color: '#f1f5f9', marginBottom: 12 }}>
          Thank you!
        </Text>
        <Text style={{ fontSize: 15, color: '#94a3b8', textAlign: 'center', lineHeight: 22 }}>
          Your response has been submitted successfully.
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            marginTop: 32, backgroundColor: '#6366f1', borderRadius: 14,
            paddingHorizontal: 32, paddingVertical: 14,
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Back to Yard</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (error && !form) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center', padding: 32 }}>
        <Text style={{ color: '#94a3b8', textAlign: 'center', fontSize: 15 }}>{error}</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 24 }}>
          <Text style={{ color: '#6366f1' }}>← Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#0f172a' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="light-content" />
      {/* Header */}
      <View style={{
        paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: 16,
        backgroundColor: '#0f172a', borderBottomWidth: 1, borderBottomColor: '#1e293b',
        flexDirection: 'row', alignItems: 'center', gap: 12,
      }}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ fontSize: 22, color: '#94a3b8' }}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 17, fontWeight: '700', color: '#f1f5f9' }} numberOfLines={1}>
            {form?.meta?.title || 'Unknown Survey'}
          </Text>
        </View>
      </View>

      {form ? (
        <FormRenderer
          blueprint={form}
          onSubmitSuccess={() => setSubmitted(true)}
          extraBottomPad={72}
        />
      ) : null}
    </KeyboardAvoidingView>
  );
}
