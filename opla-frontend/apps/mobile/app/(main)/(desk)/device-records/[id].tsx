import { useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  ActivityIndicator, StatusBar, Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AlertTriangle, Database, RefreshCw, Trash2, WifiOff,
} from 'lucide-react-native';

import { deskFormAPI } from '../../../../services/api';
import {
  clearItem, flush, getPendingCount, getQueue, QueuedSubmission,
} from '../../../../src/utils/offlineQueue';

export default function DeviceRecordsScreen() {
  const { id, projectId, projectName, formTitle, orgColor } = useLocalSearchParams<{
    id: string;
    projectId?: string;
    projectName?: string;
    formTitle?: string;
    orgColor?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const accent = orgColor ?? '#158754';

  const [localRecords, setLocalRecords] = useState<QueuedSubmission[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshRecords = async () => {
    const allQueued = await getQueue();
    setLocalRecords(allQueued.filter(item => item.form_id === id));
    setPendingCount(await getPendingCount());
  };

  useEffect(() => {
    if (!id) {
      return;
    }

    refreshRecords().finally(() => setLoading(false));
  }, [id]);

  const failedCount = useMemo(
    () => localRecords.filter(item => item.attempts > 0).length,
    [localRecords],
  );

  const handleSyncRecord = async (item: QueuedSubmission) => {
    setSyncingId(item.id);
    try {
      await deskFormAPI.submit(item.form_id, item.data, {
        ...item.metadata,
        offline_queued_at: item.queued_at,
        sync_attempt: item.attempts + 1,
      });
      await clearItem(item.id);
      await refreshRecords();
    } catch {
      Alert.alert('Sync failed', 'Could not submit this record. Check your connection.');
    } finally {
      setSyncingId(null);
    }
  };

  const handleDeleteRecord = (item: QueuedSubmission) => {
    Alert.alert(
      'Delete record?',
      'This response will be permanently removed from this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            await clearItem(item.id);
            await refreshRecords();
          },
        },
      ],
    );
  };

  const handleSyncAll = async () => {
    setSyncingId('__all__');
    try {
      const result = await flush(deskFormAPI.submit);
      await refreshRecords();
      if (result.synced > 0) {
        Alert.alert('Sync complete', `${result.synced} record${result.synced === 1 ? '' : 's'} submitted.`);
      }
    } catch {
      Alert.alert('Sync failed', 'Could not sync records right now.');
    } finally {
      setSyncingId(null);
    }
  };

  const handleBack = () => {
    router.back();
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={accent} size="large" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#0f172a' }}>
      <StatusBar barStyle="light-content" />

      <View style={{
        paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: 16,
        borderBottomWidth: 1, borderBottomColor: '#1e293b',
        flexDirection: 'row', alignItems: 'center', gap: 12,
      }}>
        <TouchableOpacity onPress={handleBack} hitSlop={12}>
          <Text style={{ fontSize: 22, color: '#94a3b8' }}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: '800', color: '#f1f5f9' }}>Device Records</Text>
          <Text style={{ fontSize: 11, color: '#64748b', marginTop: 3 }} numberOfLines={1}>
            {formTitle ?? 'Form'}{projectName ? ` · ${projectName}` : ''}
          </Text>
        </View>
        <View style={{ backgroundColor: '#1e293b', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}>
          <Text style={{ color: '#94a3b8', fontSize: 11, fontWeight: '800' }}>{localRecords.length}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }}>
        <Text style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>
          {projectName ?? 'Project'} › Forms › Device Records
        </Text>

        <Text style={{ fontSize: 26, fontWeight: '800', color: '#f1f5f9', lineHeight: 34 }}>
          Local submission workspace
        </Text>
        <Text style={{ fontSize: 13, color: '#64748b', marginTop: 8, lineHeight: 20 }}>
          This dedicated space is reserved for on-device records so more tooling can be added here without crowding the form landing page.
        </Text>

        <View style={{ flexDirection: 'row', marginTop: 20, marginHorizontal: -5 }}>
          <View style={{ flex: 1, paddingHorizontal: 5 }}>
            <View style={{ backgroundColor: '#1e293b', borderRadius: 14, borderWidth: 1, borderColor: '#334155', padding: 14 }}>
              <Text style={{ fontSize: 19, fontWeight: '800', color: '#f1f5f9' }}>{String(localRecords.length)}</Text>
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748b', marginTop: 5, textTransform: 'uppercase', letterSpacing: 0.8 }}>This form</Text>
            </View>
          </View>
          <View style={{ flex: 1, paddingHorizontal: 5 }}>
            <View style={{ backgroundColor: failedCount > 0 ? '#2b1608' : '#0d2b1e', borderRadius: 14, borderWidth: 1, borderColor: failedCount > 0 ? '#7c2d12' : '#166534', padding: 14 }}>
              <Text style={{ fontSize: 19, fontWeight: '800', color: failedCount > 0 ? '#fdba74' : '#86efac' }}>{String(failedCount)}</Text>
              <Text style={{ fontSize: 11, fontWeight: '700', color: failedCount > 0 ? '#fb923c' : '#4ade80', marginTop: 5, textTransform: 'uppercase', letterSpacing: 0.8 }}>Failed</Text>
            </View>
          </View>
          <View style={{ flex: 1, paddingHorizontal: 5 }}>
            <View style={{ backgroundColor: '#1e293b', borderRadius: 14, borderWidth: 1, borderColor: '#334155', padding: 14 }}>
              <Text style={{ fontSize: 19, fontWeight: '800', color: '#f1f5f9' }}>{String(pendingCount)}</Text>
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748b', marginTop: 5, textTransform: 'uppercase', letterSpacing: 0.8 }}>All queued</Text>
            </View>
          </View>
        </View>

        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 8,
          backgroundColor: '#1e293b', borderRadius: 14, borderWidth: 1, borderColor: '#334155',
          padding: 14, marginTop: 20,
        }}>
          <WifiOff size={16} color="#60a5fa" />
          <Text style={{ flex: 1, fontSize: 13, color: '#94a3b8', lineHeight: 18 }}>
            Queued records stay on this device until they sync successfully or are deleted.
          </Text>
          <TouchableOpacity
            onPress={handleSyncAll}
            disabled={localRecords.length === 0 || syncingId !== null}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 6,
              backgroundColor: localRecords.length === 0 ? '#172033' : accent + '22',
              borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
              borderWidth: 1, borderColor: localRecords.length === 0 ? '#253047' : accent + '55',
            }}
          >
            {syncingId === '__all__'
              ? <ActivityIndicator size="small" color={accent} />
              : <RefreshCw size={14} color={localRecords.length === 0 ? '#475569' : accent} />}
            <Text style={{ fontSize: 12, fontWeight: '700', color: localRecords.length === 0 ? '#475569' : accent }}>Sync All</Text>
          </TouchableOpacity>
        </View>

        <View style={{ marginTop: 24 }}>
          {localRecords.length === 0 ? (
            <View style={{
              alignItems: 'center', paddingVertical: 40,
              backgroundColor: '#1e293b', borderRadius: 14,
              borderWidth: 1, borderColor: '#334155',
            }}>
              <Database size={30} color="#334155" />
              <Text style={{ color: '#94a3b8', fontSize: 15, fontWeight: '700', marginTop: 12 }}>No records stored for this form</Text>
              <Text style={{ color: '#475569', fontSize: 13, marginTop: 6, textAlign: 'center', paddingHorizontal: 20 }}>
                Start the form and save responses locally to populate this space.
              </Text>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              {localRecords.map((item, idx) => {
                const isFailed = item.attempts > 0;
                const capturedAt = new Date(item.queued_at);
                const dateStr = capturedAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                const timeStr = capturedAt.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
                const fieldCount = Object.keys(item.data).length;
                const isSyncing = syncingId === item.id;

                return (
                  <View key={item.id} style={{
                    backgroundColor: '#1e293b', borderRadius: 14,
                    borderWidth: 1, borderColor: isFailed ? '#7c2d12' : '#334155',
                    padding: 14,
                  }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <Text style={{ fontSize: 16, fontWeight: '800', color: '#f1f5f9' }}>
                            Record {localRecords.length - idx}
                          </Text>
                          {isFailed ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#7c2d12', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 }}>
                              <AlertTriangle size={11} color="#fb923c" />
                              <Text style={{ fontSize: 10, fontWeight: '700', color: '#fb923c' }}>
                                {item.attempts} attempt{item.attempts === 1 ? '' : 's'}
                              </Text>
                            </View>
                          ) : (
                            <View style={{ backgroundColor: '#0d2b1e', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 }}>
                              <Text style={{ fontSize: 10, fontWeight: '700', color: '#4ade80' }}>Pending</Text>
                            </View>
                          )}
                        </View>
                        <Text style={{ fontSize: 13, color: '#64748b', marginTop: 6 }}>
                          {dateStr} at {timeStr} · {fieldCount} field{fieldCount === 1 ? '' : 's'}
                        </Text>
                      </View>

                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <TouchableOpacity
                          onPress={() => handleSyncRecord(item)}
                          disabled={syncingId !== null}
                          style={{
                            width: 42, height: 42, borderRadius: 12,
                            backgroundColor: accent + '22', alignItems: 'center', justifyContent: 'center',
                            borderWidth: 1, borderColor: accent + '55',
                          }}
                        >
                          {isSyncing
                            ? <ActivityIndicator size="small" color={accent} />
                            : <RefreshCw size={18} color={accent} />}
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleDeleteRecord(item)}
                          disabled={syncingId !== null}
                          style={{
                            width: 42, height: 42, borderRadius: 12,
                            backgroundColor: '#1a0a0a', alignItems: 'center', justifyContent: 'center',
                            borderWidth: 1, borderColor: '#7c2d12',
                          }}
                        >
                          <Trash2 size={18} color="#ef4444" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}