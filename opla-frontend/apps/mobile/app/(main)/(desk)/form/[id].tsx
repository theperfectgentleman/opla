/**
 * Desk form runner — authenticated, offline-capable form submission.
 * Loads form by ID, saves draft locally on change, submits when online.
 */
import { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, KeyboardAvoidingView, Platform, StatusBar, Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { deskFormAPI } from '../../../../services/api';

type Field = {
  id: string; type: string; label: string;
  required?: boolean; options?: string[]; placeholder?: string;
};
type Section = { id: string; title?: string; fields: Field[] };
type FormData = {
  id: string; title: string; description?: string;
  sections?: Section[]; fields?: Field[];
  organization?: { name: string };
};

const DRAFT_KEY = (formId: string) => `opla_draft_${formId}`;

function FieldRenderer({ field, value, onChange }: {
  field: Field; value: string; onChange: (v: string) => void;
}) {
  const base = {
    backgroundColor: '#0f172a', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    color: '#f1f5f9' as const, fontSize: 15,
    borderWidth: 1.5, borderColor: '#334155',
  };

  if (field.type === 'choice_single' || field.type === 'choice_multi') {
    const isMulti = field.type === 'choice_multi';
    const selected = isMulti ? (value ? value.split('||') : []) : [];
    return (
      <View style={{ gap: 8 }}>
        {(field.options ?? []).map(opt => {
          const isSelected = isMulti ? selected.includes(opt) : value === opt;
          return (
            <TouchableOpacity
              key={opt}
              onPress={() => {
                if (isMulti) {
                  const next = isSelected ? selected.filter(o => o !== opt) : [...selected, opt];
                  onChange(next.join('||'));
                } else {
                  onChange(isSelected ? '' : opt);
                }
              }}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 12,
                backgroundColor: isSelected ? '#1e1b4b' : '#0f172a',
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

  if (field.type === 'long_text') {
    return (
      <TextInput
        value={value} onChangeText={onChange} multiline numberOfLines={5}
        textAlignVertical="top" placeholder={field.placeholder ?? 'Type your answer…'}
        placeholderTextColor="#475569" style={{ ...base, minHeight: 100 }}
      />
    );
  }

  return (
    <TextInput
      value={value} onChangeText={onChange}
      placeholder={field.placeholder ?? 'Your answer…'}
      placeholderTextColor="#475569"
      keyboardType={field.type === 'number' ? 'numeric' : field.type === 'email' ? 'email-address' : 'default'}
      style={base}
    />
  );
}

export default function DeskFormScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [form, setForm] = useState<FormData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [draftSaved, setDraftSaved] = useState(false);
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load form + existing draft
  useEffect(() => {
    if (!id) return;
    Promise.all([
      deskFormAPI.get(id),
      AsyncStorage.getItem(DRAFT_KEY(id)),
    ]).then(([res, draftJson]) => {
      setForm((res as any)?.data ?? (res as any));
      if (draftJson) {
        try { setAnswers(JSON.parse(draftJson)); } catch { /* corrupt draft */ }
      }
    }).catch((e: any) => {
      const detail = e?.response?.data?.detail;
      if (e?.response?.status === 404 || e?.response?.status === 409) {
        setError(detail || 'This form is not deployed yet. Ask your admin to publish it first.');
      } else {
        setError('Could not load form.');
      }
    })
      .finally(() => setLoading(false));
  }, [id]);

  // Auto-save draft on answer change
  const updateAnswer = (fieldId: string, value: string) => {
    const next = { ...answers, [fieldId]: value };
    setAnswers(next);
    setDraftSaved(false);
    if (draftTimer.current) clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(async () => {
      await AsyncStorage.setItem(DRAFT_KEY(id!), JSON.stringify(next));
      setDraftSaved(true);
    }, 800);
  };

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
      await deskFormAPI.submit(form!.id, { responses: answers }, {});
      await AsyncStorage.removeItem(DRAFT_KEY(form!.id));
      setSubmitted(true);
    } catch (e: any) {
      if (!e?.response) {
        // Offline — keep draft
        Alert.alert(
          'Saved offline',
          'You\'re currently offline. Your answers have been saved and will submit when you reconnect.',
          [{ text: 'OK' }],
        );
      } else {
        setError(e?.response?.data?.detail ?? 'Submission failed. Please try again.');
      }
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
        <Text style={{ fontSize: 64, marginBottom: 24 }}>✅</Text>
        <Text style={{ fontSize: 24, fontWeight: '800', color: '#f1f5f9', marginBottom: 12 }}>Submitted!</Text>
        <Text style={{ fontSize: 15, color: '#94a3b8', textAlign: 'center', lineHeight: 22 }}>
          Your response has been recorded.
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            marginTop: 32, backgroundColor: '#6366f1', borderRadius: 14,
            paddingHorizontal: 32, paddingVertical: 14,
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Back to Desk</Text>
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
          {form?.organization && (
            <Text style={{ fontSize: 11, color: '#6366f1', marginTop: 2 }}>
              {form.organization.name}
            </Text>
          )}
        </View>
        {draftSaved && (
          <Text style={{ fontSize: 11, color: '#4ade80' }}>Draft saved</Text>
        )}
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
                  onChange={v => updateAnswer(field.id, v)}
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
