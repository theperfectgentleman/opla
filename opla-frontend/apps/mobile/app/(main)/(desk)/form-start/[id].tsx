/**
 * form-start/[id].tsx
 * Form start page: shows stats, draft status, and offline pre-load.
 * The user taps "Start Form" (or "Resume Draft") to open the form runner.
 */
import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  ActivityIndicator, StatusBar, Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  FileText, Users, Clock, CheckCircle2,
  WifiOff, PlayCircle, Trash2, Database, ChevronRight,
} from 'lucide-react-native';
import { formAPI } from '../../../../services/api';
import { syncAllLookupDatasets } from '../../../../src/utils/lookupCache';
import {
  getPendingCount, getQueue,
  QueuedSubmission,
} from '../../../../src/utils/offlineQueue';

type FormMeta = {
  id: string;
  title: string;
  status: string;
  version: number;
  slug: string;
  blueprint_live?: Record<string, any>;
};

type FormStats = {
  submission_count: number;
  my_submission_count: number;
  last_submitted_at: string | null;
};

function StatCard({
  icon, label, value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <View style={{
      flex: 1, backgroundColor: '#1e293b', borderRadius: 14,
      padding: 14, borderWidth: 1, borderColor: '#334155',
      alignItems: 'center', gap: 6,
    }}>
      {icon}
      <Text style={{ fontSize: 20, fontWeight: '800', color: '#f1f5f9' }}>{value}</Text>
      <Text style={{ fontSize: 11, color: '#64748b', textAlign: 'center' }}>{label}</Text>
    </View>
  );
}

export default function FormStartScreen() {
  const { id, orgId, projectId, projectName, formTitle, orgColor } = useLocalSearchParams<{
    id: string;
    orgId?: string;
    projectId?: string;
    projectName?: string;
    formTitle?: string;
    orgColor?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [meta, setMeta]             = useState<FormMeta | null>(null);
  const [stats, setStats]           = useState<FormStats | null>(null);
  const [hasDraft, setHasDraft]         = useState(false);
  const [pendingCount, setPendingCount]   = useState(0);
  const [localRecords, setLocalRecords]   = useState<QueuedSubmission[]>([]);
  const [loading, setLoading]             = useState(true);
  const [preloading, setPreloading]       = useState(false);
  const [error, setError]                 = useState('');

  const accent = orgColor ?? '#158754';

  useEffect(() => {
    if (!id) return;

    const load = async () => {
      const [metaRes, statsRes, draftRaw, pending] = await Promise.allSettled([
        formAPI.getMeta(id),
        formAPI.getStats(id),
        AsyncStorage.getItem(`draft_${id}`),
        getPendingCount(),
      ]);

      if (metaRes.status === 'fulfilled')  setMeta(metaRes.value as FormMeta);
      else setError(metaRes.reason?.response?.data?.detail ?? 'Could not load form.');

      if (statsRes.status === 'fulfilled') setStats(statsRes.value as FormStats);
      if (draftRaw.status === 'fulfilled') setHasDraft(!!draftRaw.value);
      if (pending.status  === 'fulfilled') setPendingCount(pending.value);

      // Load local (offline-queued) records for this form
      const allQueued = await getQueue();
      setLocalRecords(allQueued.filter(q => q.form_id === id));
    };

    load().finally(() => setLoading(false));
  }, [id]);

  const handleClearDraft = () => {
    Alert.alert('Clear Draft', 'Your in-progress responses will be deleted. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          await AsyncStorage.removeItem(`draft_${id}`);
          setHasDraft(false);
        },
      },
    ]);
  };

  const handlePreloadOffline = async () => {
    if (!meta?.blueprint_live) {
      Alert.alert('Not available', 'This form must be fetched online first.');
      return;
    }
    setPreloading(true);
    try {
      // Build a minimal blueprint-like object from blueprint_live for sync
      const blueprint = meta.blueprint_live as any;
      const context = { mode: 'desk' as const, formId: id, slug: meta.slug };
      const synced = await syncAllLookupDatasets(blueprint, context);
      Alert.alert(
        'Ready offline',
        synced > 0
          ? `${synced} lookup dataset${synced === 1 ? '' : 's'} cached for offline use.`
          : 'No lookup datasets to cache — form is fully ready offline.',
      );
    } catch {
      Alert.alert('Sync failed', 'Could not pre-load lookup data. Check your connection.');
    } finally {
      setPreloading(false);
    }
  };

  const handleStart = () => {
    router.push({
      pathname: '/(main)/(desk)/form/[id]',
      params: {
        id,
        orgId,
        projectId,
        projectName,
        formTitle: meta?.title ?? formTitle,
        orgColor: accent,
      },
    });
  };

  const handleOpenDeviceRecords = () => {
    router.push({
      pathname: '/(main)/(desk)/device-records/[id]',
      params: {
        id,
        orgId,
        projectId,
        projectName,
        formTitle: title,
        orgColor: accent,
      },
    });
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={accent} size="large" />
      </View>
    );
  }

  if (error && !meta) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center', padding: 28 }}>
        <FileText size={40} color="#334155" />
        <Text style={{ color: '#94a3b8', textAlign: 'center', marginTop: 16 }}>{error}</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 20 }}>
          <Text style={{ color: accent, fontWeight: '700' }}>← Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const title = meta?.title ?? formTitle ?? 'Form';

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
        <View style={{ flex: 1 }} />
        {/* Live badge */}
        <View style={{ backgroundColor: '#052e16', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}>
          <Text style={{ color: '#4ade80', fontSize: 10, fontWeight: '800', textTransform: 'uppercase' }}>Live</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }}>

        {/* Breadcrumb */}
        <Text style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>
          {projectName ?? 'Project'} › Forms
        </Text>

        {/* Form title + version */}
        <Text style={{ fontSize: 26, fontWeight: '800', color: '#f1f5f9', lineHeight: 34 }}>{title}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 }}>
          <View style={{ backgroundColor: '#1e293b', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
            <Text style={{ fontSize: 12, color: '#94a3b8', fontWeight: '600' }}>
              v{meta?.version ?? 1}
            </Text>
          </View>
        </View>

        {/* Pending sync badge */}
        {pendingCount > 0 ? (
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 8,
            backgroundColor: '#451a03', borderRadius: 12, padding: 12, marginTop: 16,
            borderWidth: 1, borderColor: '#92400e',
          }}>
            <WifiOff size={16} color="#fb923c" />
            <Text style={{ color: '#fdba74', fontSize: 13, fontWeight: '600', flex: 1 }}>
              {pendingCount} submission{pendingCount === 1 ? '' : 's'} waiting to sync
            </Text>
          </View>
        ) : null}

        {/* Stats row */}
        {stats ? (
          <>
            <Text style={{
              fontSize: 11, fontWeight: '700', color: '#64748b',
              textTransform: 'uppercase', letterSpacing: 1.2, marginTop: 24, marginBottom: 12,
            }}>
              Activity
            </Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <StatCard
                icon={<Users size={18} color="#60a5fa" />}
                label="Total submissions"
                value={String(stats.submission_count)}
              />
              <StatCard
                icon={<CheckCircle2 size={18} color="#4ade80" />}
                label="My submissions"
                value={String(stats.my_submission_count)}
              />
              <StatCard
                icon={<Clock size={18} color="#a78bfa" />}
                label="Last submitted"
                value={
                  stats.last_submitted_at
                    ? new Date(stats.last_submitted_at).toLocaleDateString()
                    : '—'
                }
              />
            </View>
          </>
        ) : null}

        {/* Draft in progress banner */}
        {hasDraft ? (
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 12,
            backgroundColor: '#0d2b1e', borderRadius: 12, padding: 12, marginTop: 20,
            borderWidth: 1, borderColor: '#166534',
          }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#86efac' }}>
                Draft in progress
              </Text>
              <Text style={{ fontSize: 12, color: '#4ade80', marginTop: 2 }}>
                Tap "Resume Draft" to continue where you left off
              </Text>
            </View>
            <TouchableOpacity onPress={handleClearDraft} hitSlop={8}>
              <Trash2 size={18} color="#4ade80" />
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Offline pre-load */}
        <TouchableOpacity
          onPress={handlePreloadOffline}
          disabled={preloading}
          style={{
            flexDirection: 'row', alignItems: 'center', gap: 10,
            marginTop: 16, padding: 14, backgroundColor: '#1e293b',
            borderRadius: 14, borderWidth: 1, borderColor: '#334155',
          }}
        >
          <WifiOff size={18} color={preloading ? '#475569' : '#94a3b8'} />
          <Text style={{ flex: 1, fontSize: 14, color: preloading ? '#475569' : '#94a3b8', fontWeight: '600' }}>
            {preloading ? 'Pre-loading…' : 'Pre-load for offline use'}
          </Text>
          {preloading ? <ActivityIndicator size="small" color="#475569" /> : null}
        </TouchableOpacity>

        {/* CTA */}
        <TouchableOpacity
          onPress={handleStart}
          activeOpacity={0.85}
          style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
            gap: 10, marginTop: 28, backgroundColor: accent,
            borderRadius: 16, paddingVertical: 18,
          }}
        >
          <PlayCircle size={22} color="#fff" />
          <Text style={{ fontSize: 17, fontWeight: '800', color: '#fff' }}>
            {hasDraft ? 'Resume Draft' : 'Start Form'}
          </Text>
        </TouchableOpacity>

        <Text style={{ fontSize: 12, color: '#334155', textAlign: 'center', marginTop: 12 }}>
          You can save your responses locally and sync later
        </Text>

        {/* ── Device Records ─────────────────────────────────────────────── */}
        <View style={{ marginTop: 28 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Database size={14} color="#64748b" />
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: 1.2 }}>
                Device Records
              </Text>
              {localRecords.length > 0 && (
                <View style={{ backgroundColor: '#1e293b', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#94a3b8' }}>{localRecords.length}</Text>
                </View>
              )}
            </View>
            <TouchableOpacity
              onPress={handleOpenDeviceRecords}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6,
                backgroundColor: accent + '22', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5,
                borderWidth: 1, borderColor: accent + '55',
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: '700', color: accent }}>Open</Text>
              <ChevronRight size={12} color={accent} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            onPress={handleOpenDeviceRecords}
            activeOpacity={0.85}
            style={{
              backgroundColor: '#1e293b', borderRadius: 14, borderWidth: 1, borderColor: '#334155', padding: 14,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#f1f5f9' }}>
                  {localRecords.length === 0 ? 'No records on this device yet' : `${localRecords.length} device record${localRecords.length === 1 ? '' : 's'} ready to manage`}
                </Text>
                <Text style={{ fontSize: 12, color: '#64748b', marginTop: 4, lineHeight: 18 }}>
                  Open the dedicated records space to sync submissions, review failures, delete saved responses, and handle future device-only tools.
                </Text>
              </View>
              <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: accent + '22', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: accent + '55' }}>
                <ChevronRight size={16} color={accent} />
              </View>
            </View>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </View>
  );
}
