/**
 * form/[id].tsx — Authenticated form runner with offline-first sync choices.
 *
 * After the user finishes a form they see a sync options sheet:
 *  • "Sync Now"       — submit immediately to the API
 *  • "Save Locally"   — enqueue offline; syncs in background next time
 *
 * On every form open the offline queue is flushed silently so leftover
 * queued submissions are sent whenever the user is online.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, TouchableWithoutFeedback,
  ActivityIndicator, KeyboardAvoidingView, Platform, StatusBar,
  Animated, AppState, AppStateStatus,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CloudUpload, HardDrive, CheckCircle2, WifiOff } from 'lucide-react-native';
import { deskFormAPI } from '../../../../services/api';
import { enqueue, flush, getPendingCount } from '../../../../src/utils/offlineQueue';
import { FormRenderer } from '../../../../src/components/FormRenderer';
import { FormBlueprint } from '@opla/types';

type SyncMode = 'idle' | 'pending_choice' | 'syncing' | 'synced' | 'saved_locally';

export default function DeskFormScreen() {
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

  const [form, setForm]         = useState<FormBlueprint | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [syncMode, setSyncMode] = useState<SyncMode>('idle');
  const [pendingCount, setPendingCount] = useState(0);

  // Captured payload waiting for user's sync choice
  const pendingPayload = useRef<{
    formId: string;
    data: Record<string, any>;
    metadata: Record<string, any>;
  } | null>(null);

  // Animated slide-up for sync sheet
  const sheetAnim = useRef(new Animated.Value(300)).current;

  const accent = orgColor ?? '#158754';

  // ── Slide sheet in / out ─────────────────────────────────────────────────
  const showSheet = useCallback(() => {
    Animated.spring(sheetAnim, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 200 }).start();
  }, [sheetAnim]);

  const hideSheet = useCallback((cb?: () => void) => {
    Animated.timing(sheetAnim, { toValue: 300, duration: 220, useNativeDriver: true }).start(cb);
  }, [sheetAnim]);

  // ── Background flush: silently sync queued submissions ───────────────────
  const silentFlush = useCallback(async () => {
    try {
      await flush(deskFormAPI.submit);
      const n = await getPendingCount();
      setPendingCount(n);
    } catch { /* network unavailable — silently ignored */ }
  }, []);

  useEffect(() => {
    // Flush on mount
    silentFlush();

    // Flush whenever app returns to foreground
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') silentFlush();
    });
    return () => sub.remove();
  }, [silentFlush]);

  // ── Load form blueprint ───────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    deskFormAPI.get(id)
      .then((res: any) => {
        const payload = res?.data ?? res;
        setForm(payload?.blueprint_live ?? payload);
      })
      .catch((e: any) => {
        const detail = e?.response?.data?.detail;
        if (e?.response?.status === 404 || e?.response?.status === 409) {
          setError(detail || 'This form is not deployed yet. Ask your admin to publish it first.');
        } else {
          setError('Could not load form.');
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  // ── Navigation helpers ────────────────────────────────────────────────────
  const navigateBack = () => {
    if (projectId) {
      router.replace({
        pathname: '/(main)/(desk)/project-forms/[projectId]' as any,
        params: { projectId, orgId, projectName, orgColor: accent },
      });
      return;
    }
    router.back();
  };

  // ── Called by FormRenderer when user taps Submit ─────────────────────────
  const handleSubmitAttempt = (
    formId: string,
    data: Record<string, any>,
    metadata: Record<string, any>,
  ) => {
    pendingPayload.current = { formId, data, metadata };
    setSyncMode('pending_choice');
    showSheet();
  };

  // ── Sync Now ──────────────────────────────────────────────────────────────
  const handleSyncNow = async () => {
    if (!pendingPayload.current) return;
    setSyncMode('syncing');
    const { formId, data, metadata } = pendingPayload.current;
    try {
      await deskFormAPI.submit(formId, data, metadata);
      await AsyncStorage.removeItem(`draft_${formId}`);
      hideSheet(() => setSyncMode('synced'));
    } catch {
      // Network error — revert to choice screen so user can save locally instead
      setSyncMode('pending_choice');
      showSheet();
    }
  };

  // ── Save Locally ──────────────────────────────────────────────────────────
  const handleSaveLocally = async () => {
    if (!pendingPayload.current) return;
    const { formId, data, metadata } = pendingPayload.current;
    await enqueue({ form_id: formId, orgId, projectId, data, metadata });
    await AsyncStorage.removeItem(`draft_${formId}`);
    const n = await getPendingCount();
    setPendingCount(n);
    hideSheet(() => setSyncMode('saved_locally'));
  };

  // ── Render states ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={accent} size="large" />
      </View>
    );
  }

  if (syncMode === 'synced') {
    return (
      <View style={{ flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center', padding: 32 }}>
        <StatusBar barStyle="light-content" />
        <CheckCircle2 size={64} color="#4ade80" />
        <Text style={{ fontSize: 24, fontWeight: '800', color: '#f1f5f9', marginTop: 20, marginBottom: 8 }}>
          Submitted!
        </Text>
        <Text style={{ fontSize: 14, color: '#94a3b8', textAlign: 'center', lineHeight: 22, marginBottom: 36 }}>
          Your response has been synced successfully.
        </Text>

        {/* Primary: start new */}
        <TouchableOpacity
          onPress={() => {
            router.replace({
              pathname: '/(main)/(desk)/form/[id]' as any,
              params: { id, orgId, projectId, projectName, formTitle: form?.meta?.title ?? formTitle, orgColor: accent },
            });
          }}
          style={{
            width: '100%', backgroundColor: '#158754',
            borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 10,
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Start New Form</Text>
        </TouchableOpacity>

        {/* Secondary: view records */}
        <TouchableOpacity
          onPress={() => router.push({
            pathname: '/(main)/(desk)/device-records/[id]' as any,
            params: { id, orgId, projectId, projectName, formTitle: form?.meta?.title ?? formTitle, orgColor: accent },
          })}
          style={{
            width: '100%', backgroundColor: '#0f172a',
            borderRadius: 12, paddingVertical: 14, alignItems: 'center',
            borderWidth: 1, borderColor: '#334155', marginBottom: 10,
          }}
        >
          <Text style={{ color: '#cbd5e1', fontWeight: '600', fontSize: 15 }}>View Records</Text>
        </TouchableOpacity>

        {/* Ghost: back */}
        <TouchableOpacity onPress={navigateBack} style={{ paddingVertical: 10 }}>
          <Text style={{ color: '#64748b', fontSize: 14 }}>
            {projectId ? 'Back to Forms' : 'Back to Desk'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (syncMode === 'saved_locally') {
    return (
      <View style={{ flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center', padding: 32 }}>
        <StatusBar barStyle="light-content" />
        <HardDrive size={64} color="#60a5fa" />
        <Text style={{ fontSize: 24, fontWeight: '800', color: '#f1f5f9', marginTop: 20, marginBottom: 8 }}>
          Saved Locally
        </Text>
        <Text style={{ fontSize: 14, color: '#94a3b8', textAlign: 'center', lineHeight: 22 }}>
          Your response is queued.{'\n'}It will sync automatically when you're back online.
        </Text>
        {pendingCount > 0 ? (
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 8,
            backgroundColor: '#1e3a5f', borderRadius: 10, padding: 10, marginTop: 16, marginBottom: 4,
          }}>
            <WifiOff size={14} color="#60a5fa" />
            <Text style={{ color: '#93c5fd', fontSize: 13 }}>
              {pendingCount} submission{pendingCount === 1 ? '' : 's'} in queue
            </Text>
          </View>
        ) : null}

        <View style={{ width: '100%', marginTop: 32, gap: 10 }}>
          {/* Primary: start new */}
          <TouchableOpacity
            onPress={() => {
              router.replace({
                pathname: '/(main)/(desk)/form/[id]' as any,
                params: { id, orgId, projectId, projectName, formTitle: form?.meta?.title ?? formTitle, orgColor: accent },
              });
            }}
            style={{
              backgroundColor: '#158754',
              borderRadius: 12, paddingVertical: 14, alignItems: 'center',
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Start New Form</Text>
          </TouchableOpacity>

          {/* Secondary: view records */}
          <TouchableOpacity
            onPress={() => router.push({
              pathname: '/(main)/(desk)/device-records/[id]' as any,
              params: { id, orgId, projectId, projectName, formTitle: form?.meta?.title ?? formTitle, orgColor: accent },
            })}
            style={{
              backgroundColor: '#0f172a',
              borderRadius: 12, paddingVertical: 14, alignItems: 'center',
              borderWidth: 1, borderColor: '#334155',
            }}
          >
            <Text style={{ color: '#cbd5e1', fontWeight: '600', fontSize: 15 }}>View Records</Text>
          </TouchableOpacity>

          {/* Ghost: back */}
          <TouchableOpacity onPress={navigateBack} style={{ paddingVertical: 10, alignItems: 'center' }}>
            <Text style={{ color: '#64748b', fontSize: 14 }}>
              {projectId ? 'Back to Forms' : 'Back to Desk'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (error && !form) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center', padding: 32 }}>
        <StatusBar barStyle="light-content" />
        <Text style={{ color: '#94a3b8', textAlign: 'center', fontSize: 15 }}>{error}</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 24 }}>
          <Text style={{ color: accent }}>← Go back</Text>
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
        <TouchableOpacity onPress={navigateBack}>
          <Text style={{ fontSize: 22, color: '#94a3b8' }}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 17, fontWeight: '700', color: '#f1f5f9' }} numberOfLines={1}>
            {form?.meta?.title ?? formTitle}
          </Text>
          <Text style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }} numberOfLines={1}>
            {projectName ? `${projectName} · Form` : 'Desk Form'}
          </Text>
        </View>
        {/* Pending badge */}
        {pendingCount > 0 ? (
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 4,
            backgroundColor: '#1e3a5f', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4,
          }}>
            <WifiOff size={12} color="#60a5fa" />
            <Text style={{ fontSize: 11, color: '#60a5fa', fontWeight: '700' }}>{pendingCount}</Text>
          </View>
        ) : null}
      </View>

      {form ? (
        <FormRenderer
          blueprint={form}
          lookupMode="desk"
          onSubmitAttempt={handleSubmitAttempt}
          extraBottomPad={72}
        />
      ) : null}

      {/* ── Sync options bottom sheet ──────────────────────────────────────── */}
      {(syncMode === 'pending_choice' || syncMode === 'syncing') ? (
        <TouchableWithoutFeedback
          onPress={() => {
            if (syncMode !== 'syncing') hideSheet(() => setSyncMode('idle'));
          }}
        >
          <View style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: '#00000088', justifyContent: 'flex-end',
          }}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <Animated.View
            style={{
              backgroundColor: '#1e293b',
              borderTopLeftRadius: 16, borderTopRightRadius: 16,
              paddingTop: 16, paddingHorizontal: 20,
              paddingBottom: insets.bottom + 72 + 16,
              borderWidth: 1, borderColor: '#334155',
              transform: [{ translateY: sheetAnim }],
            }}
          >
            {/* Handle */}
            <View style={{
              width: 40, height: 4, backgroundColor: '#475569',
              borderRadius: 2, alignSelf: 'center', marginBottom: 20,
            }} />

            <Text style={{ fontSize: 20, fontWeight: '800', color: '#f1f5f9', marginBottom: 6 }}>
              Submission ready
            </Text>
            <Text style={{ fontSize: 14, color: '#94a3b8', marginBottom: 24 }}>
              How would you like to save your response?
            </Text>

            {/* Sync Now */}
            <TouchableOpacity
              onPress={handleSyncNow}
              disabled={syncMode === 'syncing'}
              activeOpacity={0.8}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 14,
                backgroundColor: '#158754', borderRadius: 10,
                padding: 14, marginBottom: 10,
                opacity: syncMode === 'syncing' ? 0.7 : 1,
              }}
            >
              {syncMode === 'syncing'
                ? <ActivityIndicator color="#fff" size="small" />
                : <CloudUpload size={22} color="#fff" />}
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>
                  {syncMode === 'syncing' ? 'Syncing…' : 'Sync Now'}
                </Text>
                <Text style={{ fontSize: 12, color: '#ffffffaa', marginTop: 2 }}>
                  Submit directly to the server
                </Text>
              </View>
            </TouchableOpacity>

            {/* Save Locally */}
            <TouchableOpacity
              onPress={handleSaveLocally}
              disabled={syncMode === 'syncing'}
              activeOpacity={0.8}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 14,
                backgroundColor: '#0f172a', borderRadius: 10,
                padding: 14, borderWidth: 1, borderColor: '#334155',
                opacity: syncMode === 'syncing' ? 0.5 : 1,
              }}
            >
              <HardDrive size={22} color="#60a5fa" />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#cbd5e1' }}>
                  Save Locally
                </Text>
                <Text style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                  Save to device — app syncs in background
                </Text>
              </View>
            </TouchableOpacity>

            {pendingCount > 0 ? (
              <View style={{
                flexDirection: 'row', alignItems: 'center', gap: 8,
                backgroundColor: '#0f172a', borderRadius: 10, padding: 10, marginTop: 14,
              }}>
                <WifiOff size={14} color="#475569" />
                <Text style={{ fontSize: 12, color: '#475569' }}>
                  {pendingCount} item{pendingCount === 1 ? '' : 's'} already in queue
                </Text>
              </View>
            ) : null}
              </Animated.View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      ) : null}
    </KeyboardAvoidingView>
  );
}
