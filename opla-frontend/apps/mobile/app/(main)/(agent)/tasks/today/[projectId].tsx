/**
 * tasks/today/[projectId].tsx — Today's field tasks for a project.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CalendarDays, CheckCircle2, ChevronRight, MapPin } from 'lucide-react-native';

import { projectAPI } from '../../../../../services/api';

type TaskKind = 'general' | 'field_visit';

type ProjectTask = {
  id: string;
  project_id: string;
  title: string;
  description?: string | null;
  kind: TaskKind;
  status: 'todo' | 'in_progress' | 'done' | 'blocked' | 'cancelled';
  starts_at?: string | null;
  due_at?: string | null;
  scheduled_date?: string | null;
  context_json?: Record<string, unknown> | null;
};

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

function formatDateLabel(value?: string | null) {
  if (!value) return 'Today';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Today';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function getTaskMoment(task: ProjectTask) {
  return task.scheduled_date || task.due_at || task.starts_at || null;
}

export default function TodayTasksScreen() {
  const { projectId, orgId, projectName, orgColor } = useLocalSearchParams<{
    projectId: string;
    orgId?: string;
    projectName?: string;
    orgColor?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const accent = orgColor ?? '#22d3ee';

  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadTasks = useCallback(async () => {
    if (!orgId || !projectId) {
      setError('Missing organisation or project context.');
      setTasks([]);
      return;
    }
    try {
      const rows = await projectAPI.listMyDayTasks(orgId, projectId, isoToday());
      setTasks(Array.isArray(rows) ? rows : []);
      setError('');
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Could not load today\'s tasks.');
      setTasks([]);
    }
  }, [orgId, projectId]);

  useEffect(() => {
    setLoading(true);
    void loadTasks().finally(() => setLoading(false));
  }, [loadTasks]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTasks();
    setRefreshing(false);
  };

  const sortedTasks = useMemo(
    () => [...tasks].sort((a, b) => String(getTaskMoment(a)).localeCompare(String(getTaskMoment(b)))),
    [tasks],
  );

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={accent} size="large" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#0f172a' }}>
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
          <Text style={{ fontSize: 11, color: '#64748b', fontWeight: '600' }}>Today's assignments</Text>
          <Text style={{ fontSize: 19, fontWeight: '800', color: '#f1f5f9' }} numberOfLines={1}>
            {projectName || 'Project'}
          </Text>
        </View>
        <View style={{ backgroundColor: accent + '22', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}>
          <Text style={{ color: accent, fontSize: 10, fontWeight: '800' }}>{sortedTasks.length} tasks</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={accent} />}
      >
        {error ? (
          <Text style={{ color: '#f87171', marginBottom: 16 }}>{error}</Text>
        ) : null}

        {sortedTasks.length === 0 ? (
          <View style={{ backgroundColor: '#1e293b', borderRadius: 18, padding: 20, borderWidth: 1, borderColor: '#334155' }}>
            <Text style={{ color: '#f1f5f9', fontSize: 16, fontWeight: '700' }}>No tasks scheduled for today</Text>
            <Text style={{ color: '#94a3b8', marginTop: 8, lineHeight: 20 }}>
              When field visits or assignments are scheduled for today, they will appear here.
            </Text>
          </View>
        ) : sortedTasks.map((task) => (
          <TouchableOpacity
            key={task.id}
            activeOpacity={0.8}
            onPress={() =>
              router.push({
                pathname: '/(main)/(agent)/capture/[projectId]' as any,
                params: {
                  projectId,
                  orgId,
                  projectName,
                  orgColor: accent,
                },
              })
            }
            style={{
              backgroundColor: '#1e293b',
              borderRadius: 18,
              padding: 16,
              marginBottom: 12,
              borderWidth: 1,
              borderColor: '#334155',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 10, fontWeight: '800', color: accent, textTransform: 'uppercase', letterSpacing: 1 }}>
                  {task.kind === 'field_visit' ? 'Field visit' : 'Task'}
                </Text>
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#f1f5f9', marginTop: 4 }}>{task.title}</Text>
                {task.description ? (
                  <Text style={{ fontSize: 13, color: '#94a3b8', marginTop: 6, lineHeight: 18 }}>{task.description}</Text>
                ) : null}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <CalendarDays size={12} color="#64748b" />
                    <Text style={{ fontSize: 11, color: '#64748b' }}>{formatDateLabel(getTaskMoment(task))}</Text>
                  </View>
                  {task.kind === 'field_visit' ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <MapPin size={12} color="#64748b" />
                      <Text style={{ fontSize: 11, color: '#64748b' }}>Field visit</Text>
                    </View>
                  ) : null}
                </View>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 8 }}>
                <View style={{
                  backgroundColor: task.status === 'done' ? '#052e16' : '#1e293b',
                  borderRadius: 999,
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderWidth: 1,
                  borderColor: '#334155',
                }}>
                  <Text style={{ fontSize: 9, fontWeight: '800', color: task.status === 'done' ? '#4ade80' : '#94a3b8', textTransform: 'uppercase' }}>
                    {task.status.replace('_', ' ')}
                  </Text>
                </View>
                <ChevronRight size={16} color="#475569" />
              </View>
            </View>
            {task.status === 'done' ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 }}>
                <CheckCircle2 size={14} color="#4ade80" />
                <Text style={{ fontSize: 11, color: '#4ade80', fontWeight: '600' }}>Completed</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}
