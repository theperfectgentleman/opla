/**
 * Desk home — aggregated assignment view with org access shortcuts.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../../contexts/AuthContext';
import { orgAPI, projectAPI } from '../../../services/api';
import { Activity, CalendarDays, CheckCircle2, Clock, Building2, ChevronRight, PlayCircle } from 'lucide-react-native';

type Org = {
  id: string;
  name: string;
  slug?: string;
  logo_url?: string;
  primary_color?: string;
  owner_id?: string;
};

type Project = {
  id: string;
  name: string;
  status?: 'planning' | 'active' | 'paused' | 'archived';
};

type ProjectTask = {
  id: string;
  project_id: string;
  title: string;
  description?: string | null;
  kind: 'general' | 'journey_visit';
  status: 'todo' | 'in_progress' | 'done' | 'blocked' | 'cancelled';
  starts_at?: string | null;
  due_at?: string | null;
  visit_date?: string | null;
  context_json?: Record<string, unknown> | null;
};

type AssignmentCardItem = {
  id: string;
  orgId: string;
  orgName: string;
  orgColor: string;
  projectId: string;
  projectName: string;
  task: ProjectTask;
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

function getTaskMoment(task: ProjectTask) {
  return task.visit_date || task.due_at || task.starts_at || null;
}

function AssignmentCard({
  item,
  onOpenAssignment,
  onOpenForms,
}: {
  item: AssignmentCardItem;
  onOpenAssignment: () => void;
  onOpenForms: () => void;
}) {
  const sourceRecordLabel = readTaskContextText(item.task, 'source_record_label');
  const locationText = readTaskContextText(item.task, 'location_label')
    || readTaskContextText(item.task, 'region')
    || readNestedTaskContextText(item.task, 'routing', 'cluster')
    || readNestedTaskContextText(item.task, 'routing', 'zone')
    || item.task.description?.split(/\n|,|\|/)[0]?.trim()
    || 'Context pending';
  const accent = item.orgColor;
  const statusTone = item.task.status === 'done'
    ? { bg: '#052e16', fg: '#86efac' }
    : item.task.status === 'in_progress'
      ? { bg: '#082f49', fg: '#7dd3fc' }
      : { bg: '#1e293b', fg: '#cbd5e1' };

  return (
    <View
      style={{
        backgroundColor: '#0f172a',
        borderRadius: 24,
        borderWidth: 1,
        borderColor: '#1e293b',
        padding: 18,
        marginBottom: 14,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: accent, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 }}>
            {item.orgName}
          </Text>
          <Text style={{ color: '#64748b', fontSize: 11, fontWeight: '600', marginTop: 2 }}>{item.projectName}</Text>
          {sourceRecordLabel ? (
            <Text style={{ color: '#7dd3fc', fontSize: 11, fontWeight: '700', marginTop: 8 }}>{sourceRecordLabel}</Text>
          ) : null}
          <Text style={{ color: '#f8fafc', fontSize: 17, fontWeight: '800', marginTop: 4 }}>{item.task.title}</Text>
          <Text style={{ color: '#94a3b8', fontSize: 12, lineHeight: 18, marginTop: 8 }} numberOfLines={3}>
            {item.task.description?.trim() || 'Open the assignment to review the source record context and next action.'}
          </Text>
        </View>
        <View style={{ backgroundColor: statusTone.bg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }}>
          <Text style={{ color: statusTone.fg, fontSize: 10, fontWeight: '800', textTransform: 'uppercase' }}>
            {item.task.status.replace('_', ' ')}
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#111827', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }}>
          <CalendarDays size={14} color={accent} />
          <Text style={{ color: '#cbd5e1', fontSize: 11, fontWeight: '600' }}>{formatDateLabel(getTaskMoment(item.task))}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#111827', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }}>
          <Clock size={14} color="#38bdf8" />
          <Text style={{ color: '#cbd5e1', fontSize: 11, fontWeight: '600' }}>{locationText}</Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={onOpenAssignment}
          style={{
            flex: 1,
            backgroundColor: accent,
            borderRadius: 14,
            paddingVertical: 12,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: 8,
          }}
        >
          <CheckCircle2 size={16} color="#0f172a" />
          <Text style={{ color: '#0f172a', fontSize: 13, fontWeight: '800' }}>Open Assignment</Text>
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={onOpenForms}
          style={{
            backgroundColor: '#082f49',
            borderRadius: 14,
            paddingHorizontal: 14,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: 6,
          }}
        >
          <PlayCircle size={16} color="#7dd3fc" />
          <Text style={{ color: '#7dd3fc', fontSize: 12, fontWeight: '700' }}>Forms</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function OrgCard({ org, onPress }: { org: Org; onPress: () => void }) {
  const accent = org.primary_color || '#158754';
  const initials = org.name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={onPress}
      style={{
        backgroundColor: '#1e293b',
        borderRadius: 16,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#334155',
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        gap: 14,
      }}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          backgroundColor: accent + '22',
          borderWidth: 1,
          borderColor: accent + '55',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: accent, fontSize: 15, fontWeight: '800' }}>{initials}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: '#f1f5f9' }} numberOfLines={1}>
          {org.name}
        </Text>
        {org.slug ? (
          <Text style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>@{org.slug}</Text>
        ) : null}
      </View>
      <ChevronRight size={16} color="#475569" />
    </TouchableOpacity>
  );
}

export default function DeskIndexScreen() {
  const { user, status } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [orgs, setOrgs] = useState<Org[]>([]);
  const [assignmentItems, setAssignmentItems] = useState<AssignmentCardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const today = useMemo(() => isoToday(), []);

  const fetchOrgs = useCallback(async () => {
    try {
      const data = await orgAPI.list();
      const nextOrgs = Array.isArray(data) ? data : data?.organizations ?? [];
      setOrgs(nextOrgs);

      const assignmentGroups = await Promise.all(
        nextOrgs.map(async (org: Org) => {
          const projects = await projectAPI.listByOrg(org.id) as Project[];
          const activeProjects = projects.filter((project) => project.status !== 'archived');
          const taskGroups = await Promise.all(
            activeProjects.map(async (project) => {
              const tasks = await projectAPI.listMyDayTasks(org.id, project.id, today) as ProjectTask[];
              return tasks.map((task) => ({
                id: `${org.id}:${project.id}:${task.id}`,
                orgId: org.id,
                orgName: org.name,
                orgColor: org.primary_color || '#22c55e',
                projectId: project.id,
                projectName: project.name,
                task,
              }));
            }),
          );
          return taskGroups.flat();
        }),
      );

      setAssignmentItems(
        assignmentGroups
          .flat()
          .sort((left, right) => {
            const leftTime = new Date(getTaskMoment(left.task) || left.task.created_at || 0).getTime();
            const rightTime = new Date(getTaskMoment(right.task) || right.task.created_at || 0).getTime();
            return leftTime - rightTime;
          }),
      );
      setError('');
    } catch {
      setError('Could not load your organisations.');
      setAssignmentItems([]);
    }
  }, [today]);

  useEffect(() => {
    if (status !== 'authenticated') return;
    fetchOrgs().finally(() => setLoading(false));
  }, [status]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchOrgs();
    setRefreshing(false);
  };

  if (status !== 'authenticated') {
    return (
      <View className="flex-1 bg-slate-950 items-center justify-center p-8">
        <Text className="text-sm text-slate-400 text-center">Sign in to access your Agent Dashboard.</Text>
        <TouchableOpacity
          onPress={() => router.push('/(auth)/login')}
          className="mt-6 bg-cyan-500 rounded-xl px-8 py-3"
        >
          <Text className="text-slate-900 font-bold">Authenticate</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-slate-950" style={{ paddingTop: insets.top }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        className="flex-1 px-5 pt-6 pb-24"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#22d3ee" />}
      >
        {/* Header */}
        <View className="flex-row items-center justify-between mb-8">
          <View>
            <Text className="text-3xl font-black text-transparent bg-clip-text text-cyan-400 tracking-tight">Today's Assignments</Text>
            <Text className="text-slate-400 font-medium mt-1">Live project tasks due for execution today.</Text>
          </View>
          <View className="text-right bg-slate-800/60 p-2.5 rounded-2xl border border-slate-700/50">
            <Text className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-0.5">Due Today</Text>
            <Text className="text-xl font-black text-lime-400">{assignmentItems.length}</Text>
          </View>
        </View>

        {/* Today assignments */}
        <View className="mb-8">
          <View className="flex-row items-center mb-4">
            <Activity size={16} color="#22d3ee" />
            <Text className="text-sm font-bold text-slate-400 uppercase tracking-widest ml-2">Assignment Queue</Text>
          </View>

          {assignmentItems.length === 0 ? (
            <View className="bg-slate-900 border border-slate-700/50 rounded-3xl p-5">
              <Text className="text-base font-bold text-white">No assignments due today</Text>
              <Text className="text-slate-400 mt-2 leading-5">
                When a project task is assigned to you for today, it will appear here with direct links into the assignment view and project forms.
              </Text>
            </View>
          ) : assignmentItems.map((item) => (
            <AssignmentCard
              key={item.id}
              item={item}
              onOpenAssignment={() =>
                router.push({
                  pathname: '/(main)/(desk)/journey/[projectId]' as any,
                  params: {
                    projectId: item.projectId,
                    orgId: item.orgId,
                    projectName: item.projectName,
                    orgColor: item.orgColor,
                  },
                })
              }
              onOpenForms={() =>
                router.push({
                  pathname: '/(main)/(desk)/project-forms/[projectId]' as any,
                  params: {
                    projectId: item.projectId,
                    orgId: item.orgId,
                    projectName: item.projectName,
                    orgColor: item.orgColor,
                  },
                })
              }
            />
          ))}
        </View>

        {/* My Organisations */}
        <View style={{ marginBottom: 32 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
            <Building2 size={16} color="#158754" />
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: 1.2, marginLeft: 8 }}>
              My Organisations
            </Text>
          </View>

          {loading ? (
            <ActivityIndicator color="#158754" size="large" />
          ) : error ? (
            <Text style={{ color: '#94a3b8', textAlign: 'center' }}>{error}</Text>
          ) : orgs.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 24 }}>
              <Building2 size={32} color="#334155" />
              <Text style={{ color: '#475569', marginTop: 12, textAlign: 'center' }}>
                You are not a member of any organisation yet.
              </Text>
            </View>
          ) : (
            orgs.map((org) => (
              <OrgCard
                key={org.id}
                org={org}
                onPress={() =>
                  router.push({
                    pathname: '/(main)/(desk)/org/[id]',
                    params: {
                      id: org.id,
                      name: org.name,
                      color: org.primary_color ?? '#158754',
                      owner: org.owner_id ?? '',
                    },
                  })
                }
              />
            ))
          )}
        </View>
        <View className="h-20" />
      </ScrollView>
    </View>
  );
}
