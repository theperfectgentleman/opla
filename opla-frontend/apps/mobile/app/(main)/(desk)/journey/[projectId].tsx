import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CalendarDays, CheckCircle2, Circle, Clock3, MapPin, PlayCircle } from 'lucide-react-native';

import { projectAPI } from '../../../../services/api';
import { fmtDate } from '../../../../src/utils/dateFormat';

type TaskStatus = 'todo' | 'in_progress' | 'done' | 'blocked' | 'cancelled';
type TaskKind = 'general' | 'journey_visit';

type ProjectTask = {
  id: string;
  project_id: string;
  title: string;
  description?: string | null;
  kind: TaskKind;
  status: TaskStatus;
  starts_at?: string | null;
  due_at?: string | null;
  visit_date?: string | null;
  source_submission_id?: string | null;
  context_json?: Record<string, unknown> | null;
  automation_rule_id?: string | null;
  assigned_accessor_id?: string | null;
  assigned_accessor_type?: 'user' | 'team' | null;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
};

const statusTone: Record<TaskStatus, { chipBg: string; chipFg: string; cardBorder: string }> = {
  todo: { chipBg: '#1e293b', chipFg: '#cbd5e1', cardBorder: '#334155' },
  in_progress: { chipBg: '#082f49', chipFg: '#7dd3fc', cardBorder: '#0f4c75' },
  done: { chipBg: '#052e16', chipFg: '#86efac', cardBorder: '#166534' },
  blocked: { chipBg: '#431407', chipFg: '#fdba74', cardBorder: '#9a3412' },
  cancelled: { chipBg: '#3f3f46', chipFg: '#d4d4d8', cardBorder: '#52525b' },
};

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

function formatTaskMoment(task: ProjectTask) {
  return task.visit_date || task.due_at || task.starts_at || task.created_at;
}

function readTaskContextText(task: ProjectTask, key: string) {
  const value = task.context_json?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readNestedTaskContextText(task: ProjectTask, parentKey: string, childKey: string) {
  const parent = task.context_json?.[parentKey];
  if (!parent || typeof parent !== 'object' || Array.isArray(parent)) {
    return null;
  }
  const value = (parent as Record<string, unknown>)[childKey];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function TaskCard({
  task,
  accent,
  onOpenForms,
  onUpdateStatus,
}: {
  task: ProjectTask;
  accent: string;
  onOpenForms: () => void;
  onUpdateStatus: (status: TaskStatus) => void;
}) {
  const tone = statusTone[task.status];
  const dateLabel = formatTaskMoment(task);
  const shortDescription = task.description?.trim();
  const likelyLocation = shortDescription?.split(/[\n,|]/)[0]?.trim();
  const sourceRecordLabel = readTaskContextText(task, 'source_record_label');
  const contextLocation = readTaskContextText(task, 'location_label')
    || readTaskContextText(task, 'region')
    || readNestedTaskContextText(task, 'routing', 'cluster')
    || readNestedTaskContextText(task, 'routing', 'zone');

  return (
    <View
      style={{
        backgroundColor: '#1e293b',
        borderRadius: 18,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: tone.cardBorder,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <View style={{ flex: 1 }}>
          {sourceRecordLabel ? (
            <Text style={{ color: '#7dd3fc', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 }}>
              {sourceRecordLabel}
            </Text>
          ) : null}
          <Text style={{ color: '#f8fafc', fontSize: 16, fontWeight: '800' }}>{task.title}</Text>
          {shortDescription ? (
            <Text style={{ color: '#94a3b8', fontSize: 12, marginTop: 6, lineHeight: 18 }}>
              {shortDescription}
            </Text>
          ) : (
            <Text style={{ color: '#64748b', fontSize: 12, marginTop: 6 }}>
              Assignment details will appear here when the task carries source-record context.
            </Text>
          )}
        </View>
        <View style={{ backgroundColor: tone.chipBg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }}>
          <Text style={{ color: tone.chipFg, fontSize: 10, fontWeight: '800', textTransform: 'uppercase' }}>
            {task.status.replace('_', ' ')}
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#0f172a', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }}>
          <CalendarDays size={14} color={accent} />
          <Text style={{ color: '#cbd5e1', fontSize: 11, fontWeight: '600' }}>
            {dateLabel ? fmtDate(dateLabel) : 'No scheduled date'}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#0f172a', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }}>
          <MapPin size={14} color="#38bdf8" />
          <Text style={{ color: '#cbd5e1', fontSize: 11, fontWeight: '600' }}>
            {contextLocation || likelyLocation || 'Context pending'}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#0f172a', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }}>
          <Clock3 size={14} color="#fbbf24" />
          <Text style={{ color: '#cbd5e1', fontSize: 11, fontWeight: '600' }}>
            {task.kind === 'journey_visit' ? 'Scheduled visit' : 'Task'}
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
        <TouchableOpacity
          onPress={onOpenForms}
          activeOpacity={0.8}
          style={{
            flex: 1,
            backgroundColor: accent,
            borderRadius: 12,
            paddingVertical: 12,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: 8,
          }}
        >
          <PlayCircle size={16} color="#0f172a" />
          <Text style={{ color: '#0f172a', fontSize: 13, fontWeight: '800' }}>Open Forms</Text>
        </TouchableOpacity>
        {task.status !== 'in_progress' ? (
          <TouchableOpacity
            onPress={() => onUpdateStatus('in_progress')}
            activeOpacity={0.8}
            style={{
              backgroundColor: '#082f49',
              borderRadius: 12,
              paddingHorizontal: 14,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Circle size={16} color="#7dd3fc" />
          </TouchableOpacity>
        ) : null}
        {task.status !== 'done' ? (
          <TouchableOpacity
            onPress={() => onUpdateStatus('done')}
            activeOpacity={0.8}
            style={{
              backgroundColor: '#052e16',
              borderRadius: 12,
              paddingHorizontal: 14,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CheckCircle2 size={16} color="#86efac" />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

export default function JourneyDayScreen() {
  const { projectId, orgId, projectName, orgColor } = useLocalSearchParams<{
    projectId: string;
    orgId?: string;
    projectName?: string;
    orgColor?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const accent = orgColor ?? '#158754';
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const targetDate = useMemo(() => isoToday(), []);

  const loadTasks = useCallback(async () => {
    if (!projectId || !orgId) {
      setError('This assignment view needs both project and organisation context. Open it from the project workspace.');
      return;
    }
    try {
      const data = await projectAPI.listMyDayTasks(orgId, projectId, targetDate);
      setTasks(Array.isArray(data) ? data : []);
      setError('');
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? 'Could not load today\'s assignments.');
    }
  }, [orgId, projectId, targetDate]);

  useEffect(() => {
    loadTasks().finally(() => setLoading(false));
  }, [loadTasks]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTasks();
    setRefreshing(false);
  };

  const updateTaskStatus = async (taskId: string, status: TaskStatus) => {
    if (!orgId || !projectId) return;
    try {
      const updated = await projectAPI.updateTask(orgId, projectId, taskId, { status });
      setTasks((prev) => prev.map((task) => (task.id === updated.id ? updated : task)));
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? 'Could not update assignment status.');
    }
  };

  const openForms = () => {
    if (!projectId) return;
    router.push({
      pathname: '/(main)/(desk)/project-forms/[projectId]' as any,
      params: {
        projectId,
        orgId,
        projectName,
        orgColor: accent,
      },
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#0f172a' }}>
      <StatusBar barStyle="light-content" />

      <View
        style={{
          paddingTop: insets.top + 12,
          paddingHorizontal: 20,
          paddingBottom: 16,
          borderBottomWidth: 1,
          borderBottomColor: '#1e293b',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Text style={{ fontSize: 22, color: '#94a3b8' }}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 11, color: '#64748b', fontWeight: '600' }}>{projectName ?? 'Project'}</Text>
          <Text style={{ fontSize: 19, fontWeight: '800', color: '#f1f5f9' }}>Today's Assignments</Text>
        </View>
        {!loading ? (
          <View style={{ backgroundColor: '#1e293b', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 }}>
            <Text style={{ fontSize: 12, color: '#cbd5e1', fontWeight: '700' }}>{tasks.length}</Text>
          </View>
        ) : null}
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator color={accent} size="large" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 32 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={accent} />}
        >
          <View
            style={{
              backgroundColor: '#1e293b',
              borderRadius: 16,
              padding: 16,
              marginBottom: 16,
              borderWidth: 1,
              borderColor: '#334155',
            }}
          >
            <Text style={{ color: '#f8fafc', fontSize: 15, fontWeight: '800' }}>{fmtDate(targetDate)}</Text>
            <Text style={{ color: '#94a3b8', fontSize: 12, marginTop: 6, lineHeight: 18 }}>
              Assigned follow-ups for this project. Source-record identity and context come from the task title and description until richer task metadata is added.
            </Text>
          </View>

          {error ? (
            <View style={{ backgroundColor: '#3f1d20', borderRadius: 14, padding: 14, marginBottom: 16 }}>
              <Text style={{ color: '#fecaca', fontSize: 13 }}>{error}</Text>
            </View>
          ) : null}

          {tasks.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 48 }}>
              <CalendarDays size={40} color="#334155" />
              <Text style={{ color: '#475569', marginTop: 14, fontSize: 15, fontWeight: '600' }}>
                No assignments scheduled for today
              </Text>
              <Text style={{ color: '#334155', marginTop: 6, textAlign: 'center', fontSize: 13 }}>
                Tasks assigned to you or your teams for {fmtDate(targetDate)} will appear here.
              </Text>
            </View>
          ) : (
            tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                accent={accent}
                onOpenForms={openForms}
                onUpdateStatus={(status) => updateTaskStatus(task.id, status)}
              />
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}