/**
 * Public form runner — Yard area.
 * Loads a form by slug, renders each field, and submits to the public endpoint.
 */
import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, KeyboardAvoidingView, Platform, StatusBar,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { publicFormAPI } from '../../../../services/api';

type Field = {
  id: string;
  type: string;
  label: string;
  required?: boolean;
  options?: string[];
  placeholder?: string;
};

type Section = { id: string; title?: string; fields: Field[] };
type FormData = {
  id: string; title: string; slug: string;
  description?: string;
  sections?: Section[];
  fields?: Field[];
};

function FieldRenderer({
  field, value, onChange,
}: { field: Field; value: string; onChange: (v: string) => void }) {
  const base = {
    backgroundColor: '#1e293b', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    color: '#f1f5f9' as const, fontSize: 15,
    borderWidth: 1.5, borderColor: '#334155',
  };

  if (field.type === 'choice_single' || field.type === 'choice_multi') {
    const isMulti = field.type === 'choice_multi';
    const selected: string[] = isMulti ? (value ? value.split('||') : []) : [];
    return (
      <View style={{ gap: 8 }}>
        {(field.options ?? []).map(opt => {
          const isSelected = isMulti ? selected.includes(opt) : value === opt;
          return (
            <TouchableOpacity
              key={opt}
              onPress={() => {
                if (isMulti) {
                  const next = isSelected
                    ? selected.filter(o => o !== opt)
                    : [...selected, opt];
                  onChange(next.join('||'));
                } else {
                  onChange(isSelected ? '' : opt);
                }
              }}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 12,
                backgroundColor: isSelected ? '#1e1b4b' : '#1e293b',
                borderWidth: 1.5, borderColor: isSelected ? '#6366f1' : '#334155',
                borderRadius: 12, padding: 14,
              }}
            >
              <View style={{
                width: 20, height: 20, borderRadius: isMulti ? 4 : 10,
                borderWidth: 2, borderColor: isSelected ? '#6366f1' : '#475569',
                backgroundColor: isSelected ? '#6366f1' : 'transparent',
                alignItems: 'center', justifyContent: 'center',
              }}>
                {isSelected && <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>✓</Text>}
              </View>
              <Text style={{ color: '#f1f5f9', fontSize: 15 }}>{opt}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }

  if (field.type === 'rating') {
    const max = 5;
    return (
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {Array.from({ length: max }, (_, i) => i + 1).map(n => (
          <TouchableOpacity
            key={n}
            onPress={() => onChange(String(n))}
            style={{
              width: 48, height: 48, borderRadius: 24,
              backgroundColor: Number(value) >= n ? '#6366f1' : '#1e293b',
              borderWidth: 2, borderColor: Number(value) >= n ? '#6366f1' : '#334155',
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 18 }}>{'★'}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  }

  if (field.type === 'long_text') {
    return (
      <TextInput
        value={value}
        onChangeText={onChange}
        multiline
        numberOfLines={5}
        textAlignVertical="top"
        placeholder={field.placeholder ?? 'Type your answer…'}
        placeholderTextColor="#475569"
        style={{ ...base, minHeight: 100 }}
      />
    );
  }

  // Default: text input
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={field.placeholder ?? 'Your answer…'}
      placeholderTextColor="#475569"
      keyboardType={field.type === 'number' ? 'numeric' : field.type === 'email' ? 'email-address' : 'default'}
      style={base}
    />
  );
}

export default function YardFormScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [form, setForm] = useState<FormData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!slug) return;
    publicFormAPI.getBySlug(slug)
      .then(r => setForm((r as any)?.data ?? (r as any)))
      .catch((e: any) => {
        const detail = e?.response?.data?.detail;
        if (e?.response?.status === 404 || e?.response?.status === 409) {
          setError(detail || 'Survey is not available yet. It may not be published.');
        } else {
          setError('Survey not found or no longer available.');
        }
      })
      .finally(() => setLoading(false));
  }, [slug]);

  const allFields: Field[] = form
    ? (form.sections ?? []).flatMap(s => s.fields ?? []).concat(form.fields ?? [])
    : [];

  const handleSubmit = async () => {
    const missing = allFields.filter(f => f.required && !answers[f.id]?.trim());
    if (missing.length > 0) {
      setError(`Please answer: ${missing.map(f => f.label).join(', ')}`);
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await publicFormAPI.submit(String(slug), { responses: answers }, {});
      setSubmitted(true);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

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
            {form?.title}
          </Text>
          {form?.description ? (
            <Text style={{ fontSize: 12, color: '#64748b', marginTop: 2 }} numberOfLines={1}>
              {form.description}
            </Text>
          ) : null}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 80 }}
        keyboardShouldPersistTaps="handled"
      >
        {(form?.sections ?? [{ id: '_', title: undefined, fields: form?.fields ?? [] }]).map(section => (
          <View key={section.id} style={{ marginBottom: 32 }}>
            {section.title && (
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#6366f1', marginBottom: 16 }}>
                {section.title}
              </Text>
            )}
            {(section.fields ?? []).map(field => (
              <View key={field.id} style={{ marginBottom: 20 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#cbd5e1', marginBottom: 8 }}>
                  {field.label}
                  {field.required && <Text style={{ color: '#ef4444' }}> *</Text>}
                </Text>
                <FieldRenderer
                  field={field}
                  value={answers[field.id] ?? ''}
                  onChange={v => setAnswers(prev => ({ ...prev, [field.id]: v }))}
                />
              </View>
            ))}
          </View>
        ))}

        {error ? (
          <View style={{
            backgroundColor: '#450a0a', borderRadius: 10, padding: 12,
            borderWidth: 1, borderColor: '#991b1b', marginBottom: 16,
          }}>
            <Text style={{ color: '#fca5a5', fontSize: 13 }}>{error}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          onPress={handleSubmit}
          disabled={submitting}
          style={{
            backgroundColor: '#6366f1', borderRadius: 14,
            paddingVertical: 16, alignItems: 'center',
            opacity: submitting ? 0.7 : 1,
          }}
        >
          {submitting
            ? <ActivityIndicator color="#fff" />
            : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Submit Response</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
