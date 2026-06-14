/**
 * project-forms/[projectId].tsx
 * Lists all LIVE (published) forms inside a project.
 * Only forms with status === 'live' are shown — draft/archived forms are excluded on mobile.
 * Forms with visibility === 'child' are hidden from the main list but shown in an info section.
 */
import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, StatusBar,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FileText, ChevronRight, ChevronDown, Inbox, Info, Link2 } from 'lucide-react-native';
import { projectAPI } from '../../../../services/api';
import { fmtDate } from '../../../../src/utils/dateFormat';

type Form = {
  id: string;
  title: string;
  status: string;
  version?: number;
  published_at?: string;
  description?: string;
  blueprint_live?: Record<string, any>;
};

function FormCard({ form, accent, onPress }: { form: Form; accent: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={{
        backgroundColor: '#1e293b', borderRadius: 16, marginBottom: 10,
        borderWidth: 1, borderColor: '#334155',
        flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14,
      }}
    >
      {/* Status indicator */}
      <View style={{
        width: 40, height: 40, borderRadius: 12,
        backgroundColor: '#4ade8018', alignItems: 'center', justifyContent: 'center',
      }}>
        <FileText size={20} color="#4ade80" />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: '#f1f5f9' }}>{form.title}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
          <View style={{
            backgroundColor: '#052e16', borderRadius: 6,
            paddingHorizontal: 6, paddingVertical: 2,
          }}>
            <Text style={{ fontSize: 10, color: '#4ade80', fontWeight: '700', textTransform: 'uppercase' }}>
              Live
            </Text>
          </View>
          <Text style={{ fontSize: 11, color: '#64748b' }}>v{form.version ?? 1}</Text>
          {form.published_at ? (
            <Text style={{ fontSize: 11, color: '#475569' }}>
              · published {fmtDate(form.published_at)}
            </Text>
          ) : null}
        </View>
      </View>
      <ChevronRight size={16} color="#475569" />
    </TouchableOpacity>
  );
}

export default function ProjectFormsScreen() {
  const { projectId, orgId, projectName, orgColor } = useLocalSearchParams<{
    projectId: string;
    orgId?: string;
    projectName?: string;
    orgColor?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [forms, setForms]       = useState<Form[]>([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]       = useState('');
  const [infoExpanded, setInfoExpanded] = useState(false);

  const accent = orgColor ?? '#6366f1';

  const fetchForms = useCallback(async () => {
    if (!projectId) return;
    try {
      const data = await projectAPI.listForms(projectId, true); // live_only=true
      const list: Form[] = Array.isArray(data) ? data : data?.forms ?? [];
      // Extra client-side guard: only show live forms
      setForms(list.filter((f) => f.status === 'live'));
      setError('');
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Could not load forms.');
    }
  }, [projectId]);

  useEffect(() => {
    fetchForms().finally(() => setLoading(false));
  }, [projectId]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchForms();
    setRefreshing(false);
  };

  // Auto-detect child forms: a form is a "child" if its ID appears
  // in any other form's linked_form_ids (i.e. it's only reachable via a form_link).
  const allLinkedIds = new Set(
    forms.flatMap(f => (f.blueprint_live?.linked_form_ids ?? []) as string[])
  );

  const listedForms = forms.filter(f => !allLinkedIds.has(f.id));
  const childForms = forms.filter(f => allLinkedIds.has(f.id));

  return (
    <View style={{ flex: 1, backgroundColor: '#0f172a' }}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={{
        paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: 16,
        borderBottomWidth: 1, borderBottomColor: '#1e293b',
        flexDirection: 'row', alignItems: 'center', gap: 12,
      }}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Text style={{ fontSize: 22, color: '#94a3b8' }}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 11, color: '#64748b', fontWeight: '600' }}>{projectName ?? 'Project'}</Text>
          <Text style={{ fontSize: 19, fontWeight: '800', color: '#f1f5f9' }}>Forms</Text>
        </View>
        {!loading && (
          <View style={{ backgroundColor: '#1e293b', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 }}>
            <Text style={{ fontSize: 12, color: '#64748b', fontWeight: '600' }}>{listedForms.length}</Text>
          </View>
        )}
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator color={accent} size="large" />
        </View>
      ) : error ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 28 }}>
          <Text style={{ color: '#94a3b8', textAlign: 'center' }}>{error}</Text>
          <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 20 }}>
            <Text style={{ color: accent, fontWeight: '700' }}>← Go back</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 32 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={accent} />}
        >
          {listedForms.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 48 }}>
              <Inbox size={40} color="#334155" />
              <Text style={{ color: '#475569', marginTop: 14, fontSize: 15, fontWeight: '600' }}>
                No live forms yet
              </Text>
              <Text style={{ color: '#334155', marginTop: 6, textAlign: 'center', fontSize: 13 }}>
                Forms must be published before they appear here.
              </Text>
            </View>
          ) : (
            listedForms.map((form) => (
              <FormCard
                key={form.id}
                form={form}
                accent={accent}
                onPress={() =>
                  router.push({
                    pathname: '/(main)/(desk)/form-start/[id]' as any,
                    params: {
                      id: form.id,
                      orgId,
                      projectId,
                      projectName,
                      formTitle: form.title,
                      orgColor: accent,
                    },
                  })
                }
              />
            ))
          )}

          {/* ── Linked Resources Info Section ─────────────────────────── */}
          {childForms.length > 0 && (
            <View style={{ marginTop: 20 }}>
              <TouchableOpacity
                onPress={() => setInfoExpanded(!infoExpanded)}
                activeOpacity={0.7}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 8,
                  backgroundColor: '#1e293b', borderRadius: 12, padding: 14,
                  borderWidth: 1, borderColor: '#334155',
                }}
              >
                <Info size={16} color="#64748b" />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#94a3b8' }}>
                    Linked Resources
                  </Text>
                  <Text style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>
                    {childForms.length} child form{childForms.length === 1 ? '' : 's'} downloaded for offline use
                  </Text>
                </View>
                {infoExpanded
                  ? <ChevronDown size={16} color="#64748b" />
                  : <ChevronRight size={16} color="#64748b" />
                }
              </TouchableOpacity>

              {infoExpanded && (
                <View style={{
                  backgroundColor: '#0f172a', borderRadius: 10,
                  borderWidth: 1, borderColor: '#1e293b',
                  marginTop: 6, overflow: 'hidden',
                }}>
                  {childForms.map((form, idx) => (
                    <View
                      key={form.id}
                      style={{
                        flexDirection: 'row', alignItems: 'center', gap: 10,
                        padding: 12,
                        borderTopWidth: idx > 0 ? 1 : 0, borderTopColor: '#1e293b',
                      }}
                    >
                      <Link2 size={14} color="#475569" />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13, fontWeight: '600', color: '#94a3b8' }}>{form.title}</Text>
                        <Text style={{ fontSize: 10, color: '#475569' }}>
                          v{form.version ?? 1} · child form · accessed via launcher
                        </Text>
                      </View>
                      <View style={{
                        backgroundColor: '#1e293b', borderRadius: 6,
                        paddingHorizontal: 6, paddingVertical: 2,
                      }}>
                        <Text style={{ fontSize: 9, color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>
                          Cached
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}
