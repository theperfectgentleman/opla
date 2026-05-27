import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  AppStateStatus,
  RefreshControl,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { CheckCircle2, Clock3, MapPin, WifiOff } from 'lucide-react-native';

import { projectAPI } from '../../../../services/api';
import {
  enqueueAttendanceEvent,
  flushAttendanceEvents,
  getPendingAttendanceCount,
  QueuedAttendanceEvent,
} from '../../../../src/utils/offlineQueue';

type AttendanceStatus = 'checked_in' | 'checked_out';

type AttendanceRecord = {
  id: string;
  project_id: string;
  user_id: string;
  attendance_date: string;
  status: AttendanceStatus;
  check_in_at: string;
  check_in_location_json: { latitude: number; longitude: number; accuracy_meters?: number; label?: string };
  check_in_note?: string | null;
  check_in_image_uri?: string | null;
  check_in_signature?: string | null;
  check_out_at?: string | null;
  check_out_location_json?: { latitude: number; longitude: number; accuracy_meters?: number; label?: string } | null;
  check_out_note?: string | null;
  check_out_image_uri?: string | null;
  check_out_signature?: string | null;
  created_at: string;
  updated_at: string;
};

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

function formatLocation(location?: { latitude: number; longitude: number; accuracy_meters?: number; label?: string } | null) {
  if (!location) return 'Location pending';
  if (location.label) return location.label;
  return `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`;
}

export default function ProjectAttendanceScreen() {
  const { projectId, orgId, projectName, orgColor } = useLocalSearchParams<{
    projectId: string;
    orgId?: string;
    projectName?: string;
    orgColor?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const accent = orgColor ?? '#158754';
  const targetDate = useMemo(() => isoToday(), []);

  const [record, setRecord] = useState<AttendanceRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [note, setNote] = useState('');
  const [imageUri, setImageUri] = useState('');
  const [signature, setSignature] = useState('');
  const [pendingCount, setPendingCount] = useState(0);
  const [error, setError] = useState('');

  const flushQueuedAttendance = useCallback(async () => {
    await flushAttendanceEvents(async (item: QueuedAttendanceEvent) => {
      if (!item.orgId || !item.projectId) {
        throw new Error('Queued attendance event is missing project context');
      }
      if (item.kind === 'check_in') {
        return projectAPI.checkInAttendance(item.orgId, item.projectId, item.payload);
      }
      return projectAPI.checkOutAttendance(item.orgId, item.projectId, item.payload);
    });
    setPendingCount(await getPendingAttendanceCount());
  }, []);

  const loadStatus = useCallback(async () => {
    if (!projectId || !orgId) {
      setError('This attendance screen needs both project and organisation context. Open it from the project workspace.');
      return;
    }
    try {
      await flushQueuedAttendance();
      const data = await projectAPI.getMyAttendanceStatus(orgId, projectId, targetDate);
      setRecord(data ?? null);
      setError('');
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? 'Could not load attendance status.');
    }
  }, [flushQueuedAttendance, orgId, projectId, targetDate]);

  useEffect(() => {
    loadStatus().finally(() => setLoading(false));
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        void loadStatus();
      }
    });
    return () => sub.remove();
  }, [loadStatus]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadStatus();
    setRefreshing(false);
  };

  const buildPayload = async () => {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== 'granted') {
      throw new Error('Location permission is required for attendance.');
    }
    const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return {
      timestamp: new Date().toISOString(),
      location: {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy_meters: position.coords.accuracy ?? undefined,
      },
      note: note.trim() || undefined,
      image_uri: imageUri.trim() || undefined,
      signature: signature.trim() || undefined,
    };
  };

  const handleAttendanceAction = async (kind: 'check_in' | 'check_out') => {
    if (!orgId || !projectId) return;
    setSyncing(true);
    try {
      const payload = await buildPayload();
      const nextRecord = kind === 'check_in'
        ? await projectAPI.checkInAttendance(orgId, projectId, payload)
        : await projectAPI.checkOutAttendance(orgId, projectId, payload);
      setRecord(nextRecord);
      setNote('');
      setImageUri('');
      setSignature('');
      setError('');
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (!detail) {
        try {
          const payload = await buildPayload();
          await enqueueAttendanceEvent({ kind, orgId, projectId, payload });
          setPendingCount(await getPendingAttendanceCount());
          setError('Attendance was saved offline and will sync when the device reconnects.');
        } catch (queueErr: any) {
          setError(queueErr?.message || 'Could not capture attendance right now.');
        }
      } else {
        setError(detail);
      }
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={accent} size="large" />
      </View>
    );
  }

  const isCheckedOut = record?.status === 'checked_out';
  const isCheckedIn = record?.status === 'checked_in';

  return (
    <View style={{ flex: 1, backgroundColor: '#0f172a' }}>
      <StatusBar barStyle="light-content" />

      <View style={{
        paddingTop: insets.top + 12,
        paddingHorizontal: 20,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#1e293b',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
      }}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Text style={{ fontSize: 22, color: '#94a3b8' }}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 11, color: '#64748b', fontWeight: '600' }}>Attendance</Text>
          <Text style={{ fontSize: 19, fontWeight: '800', color: '#f1f5f9' }} numberOfLines={1}>{projectName ?? 'Project'}</Text>
        </View>
        <View style={{ backgroundColor: '#1e293b', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}>
          <Text style={{ color: '#cbd5e1', fontSize: 10, fontWeight: '800', textTransform: 'uppercase' }}>{targetDate}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={accent} />}
      >
        <View style={{
          backgroundColor: '#1e293b',
          borderRadius: 18,
          padding: 18,
          borderWidth: 1,
          borderColor: isCheckedOut ? '#166534' : isCheckedIn ? '#0f4c75' : '#334155',
        }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1 }}>
            {isCheckedOut ? 'Checked Out' : isCheckedIn ? 'Checked In' : 'Not Checked In'}
          </Text>
          <Text style={{ fontSize: 24, fontWeight: '800', color: '#f8fafc', marginTop: 8 }}>
            {isCheckedOut ? 'Attendance complete' : isCheckedIn ? 'Attendance in progress' : 'Ready for check-in'}
          </Text>
          <Text style={{ fontSize: 13, color: '#94a3b8', lineHeight: 20, marginTop: 10 }}>
            Capture your daily operational attendance separately from form submissions. Location is required each time.
          </Text>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#0f172a', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }}>
              <Clock3 size={14} color={accent} />
              <Text style={{ color: '#cbd5e1', fontSize: 11, fontWeight: '600' }}>
                {record?.check_in_at ? new Date(record.check_in_at).toLocaleTimeString() : 'No check-in yet'}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#0f172a', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }}>
              <MapPin size={14} color="#38bdf8" />
              <Text style={{ color: '#cbd5e1', fontSize: 11, fontWeight: '600' }}>
                {formatLocation(record?.check_out_location_json ?? record?.check_in_location_json)}
              </Text>
            </View>
            {pendingCount > 0 ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#3f3f46', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }}>
                <WifiOff size={14} color="#fbbf24" />
                <Text style={{ color: '#f8fafc', fontSize: 11, fontWeight: '600' }}>{pendingCount} pending sync</Text>
              </View>
            ) : null}
          </View>

          {record?.check_out_at ? (
            <Text style={{ color: '#86efac', fontSize: 12, marginTop: 12 }}>
              Checked out at {new Date(record.check_out_at).toLocaleTimeString()}.
            </Text>
          ) : null}
        </View>

        <View style={{ marginTop: 18, backgroundColor: '#1e293b', borderRadius: 18, borderWidth: 1, borderColor: '#334155', padding: 18 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#f8fafc' }}>Capture Details</Text>
          <Text style={{ fontSize: 12, color: '#94a3b8', marginTop: 6, lineHeight: 18 }}>
            Optional note, image URI, and signature can be saved with the attendance event for audit support.
          </Text>

          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Add a note"
            placeholderTextColor="#64748b"
            multiline
            style={{ marginTop: 14, minHeight: 78, borderRadius: 12, borderWidth: 1, borderColor: '#334155', backgroundColor: '#0f172a', color: '#f8fafc', padding: 12, textAlignVertical: 'top' }}
          />
          <TextInput
            value={imageUri}
            onChangeText={setImageUri}
            placeholder="Optional image URI"
            placeholderTextColor="#64748b"
            style={{ marginTop: 12, borderRadius: 12, borderWidth: 1, borderColor: '#334155', backgroundColor: '#0f172a', color: '#f8fafc', padding: 12 }}
          />
          <TextInput
            value={signature}
            onChangeText={setSignature}
            placeholder="Optional signature"
            placeholderTextColor="#64748b"
            style={{ marginTop: 12, borderRadius: 12, borderWidth: 1, borderColor: '#334155', backgroundColor: '#0f172a', color: '#f8fafc', padding: 12 }}
          />

          {error ? (
            <Text style={{ color: error.includes('offline') ? '#fbbf24' : '#f87171', fontSize: 12, marginTop: 12 }}>{error}</Text>
          ) : null}

          {!isCheckedIn && !isCheckedOut ? (
            <TouchableOpacity
              onPress={() => void handleAttendanceAction('check_in')}
              disabled={syncing}
              style={{ marginTop: 16, backgroundColor: accent, borderRadius: 12, paddingVertical: 14, alignItems: 'center', opacity: syncing ? 0.7 : 1 }}
            >
              <Text style={{ color: '#0f172a', fontSize: 14, fontWeight: '800' }}>{syncing ? 'Checking in…' : 'Check In'}</Text>
            </TouchableOpacity>
          ) : null}

          {isCheckedIn ? (
            <TouchableOpacity
              onPress={() => void handleAttendanceAction('check_out')}
              disabled={syncing}
              style={{ marginTop: 16, backgroundColor: '#4ade80', borderRadius: 12, paddingVertical: 14, alignItems: 'center', opacity: syncing ? 0.7 : 1 }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <CheckCircle2 size={16} color="#052e16" />
                <Text style={{ color: '#052e16', fontSize: 14, fontWeight: '800' }}>{syncing ? 'Checking out…' : 'Check Out'}</Text>
              </View>
            </TouchableOpacity>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}