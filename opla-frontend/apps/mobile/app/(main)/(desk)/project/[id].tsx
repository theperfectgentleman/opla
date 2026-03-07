/**
 * Project workspace screen — artifact group tiles (Forms, Reports, Assets).
 * Tapping "Forms" drills down to the forms list showing only published forms.
 */
import { useEffect, useState } from 'react';
import {
  ActivityIndicator, ScrollView, StatusBar, Text,
  TouchableOpacity, View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FileText, BarChart2, Paperclip, ChevronRight, ChevronDown } from 'lucide-react-native';

import { orgAPI, projectAPI, assetsAPI, reportsAPI } from '../../../../services/api';
import { fmtDate } from '../../../../src/utils/dateFormat';

type Project = {
  id: string; name: string; description?: string;
  status?: 'planning' | 'active' | 'paused' | 'archived';
  created_at?: string; updated_at?: string;
};

type AccessRule = {
  id: string; accessor_id: string; accessor_type: 'user' | 'team';
  role?: string; role_name?: string; role_slug?: string; role_template_id?: string;
};

type Member = { user_id: string; user?: { full_name?: string; email?: string } };
type Team   = { id: string; name: string };

const statusTone: Record<string, { bg: string; fg: string }> = {
  planning: { bg: '#451a03', fg: '#fbbf24' },
  active:   { bg: '#052e16', fg: '#4ade80' },
  paused:   { bg: '#431407', fg: '#fb923c' },
  archived: { bg: '#1e293b', fg: '#94a3b8' },
};

// ─── Artifact tile ────────────────────────────────────────────────────────────

function ArtifactTile({
  icon, label, count, accent, onPress, locked = false,
}: {
  icon: React.ReactNode;
  label: string;
  count: number | null;
  accent: string;
  onPress?: () => void;
  locked?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={locked}
      activeOpacity={locked ? 1 : 0.75}
      style={{
        width: '48%', backgroundColor: '#1e293b', borderRadius: 18,
        padding: 18, marginBottom: 12, borderWidth: 1,
        borderColor: locked ? '#1e293b' : '#334155',
        opacity: locked ? 0.45 : 1,
      }}
    >
      <View style={{
        width: 40, height: 40, borderRadius: 12,
        backgroundColor: accent + '18', alignItems: 'center', justifyContent: 'center',
        marginBottom: 12,
      }}>
        {icon}
      </View>
      <Text style={{ fontSize: 15, fontWeight: '700', color: '#f1f5f9' }}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
        <Text style={{ fontSize: 22, fontWeight: '800', color: accent }}>
          {count === null ? '—' : count}
        </Text>
        {!locked && <ChevronRight size={16} color="#475569" />}
      </View>
    </TouchableOpacity>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function ProjectDetailScreen() {
  const { id, orgId, orgName, orgColor } = useLocalSearchParams<{
    id: string; orgId?: string; orgName?: string; orgColor?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [project, setProject]       = useState<Project | null>(null);
  const [formCount, setFormCount]   = useState<number | null>(null);
  const [assetCount, setAssetCount] = useState<number | null>(null);
  const [reportCount, setReportCount] = useState<number | null>(null);
  const [accessRules, setAccessRules] = useState<AccessRule[]>([]);
  const [members, setMembers]         = useState<Member[]>([]);
  const [teams, setTeams]             = useState<Team[]>([]);
  const [accessOpen, setAccessOpen]   = useState(false);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');

  const accent = orgColor ?? '#6366f1';

  useEffect(() => {
    if (!id || !orgId) {
      setError('This project link is missing organisation context. Open it from the organisation workspace.');
      setLoading(false);
      return;
    }

    Promise.allSettled([
      projectAPI.get(orgId, id),
      projectAPI.listForms(id, true), // live-only forms on mobile
      assetsAPI.list(orgId, id),
      reportsAPI.list(orgId, id),
      projectAPI.listAccess(orgId, id),
      orgAPI.getMembers(orgId),
      orgAPI.getTeams(orgId),
    ]).then(([projRes, formsRes, assetsRes, reportsRes, accessRes, membersRes, teamsRes]) => {
      if (projRes.status === 'fulfilled') setProject(projRes.value);
      else setError(projRes.reason?.response?.data?.detail || 'Could not load project.');

      if (formsRes.status === 'fulfilled') {
        const f = formsRes.value;
        setFormCount(Array.isArray(f) ? f.length : (f?.forms?.length ?? 0));
      }
      if (assetsRes.status === 'fulfilled') {
        const a = assetsRes.value;
        setAssetCount(Array.isArray(a) ? a.length : (a?.assets?.length ?? 0));
      }
      if (reportsRes.status === 'fulfilled') {
        const r = reportsRes.value;
        setReportCount(Array.isArray(r) ? r.length : (r?.reports?.length ?? 0));
      }
      if (accessRes.status === 'fulfilled')  setAccessRules(Array.isArray(accessRes.value) ? accessRes.value : []);
      if (membersRes.status === 'fulfilled') setMembers(Array.isArray(membersRes.value) ? membersRes.value : []);
      if (teamsRes.status   === 'fulfilled') setTeams(Array.isArray(teamsRes.value) ? teamsRes.value : []);
    }).finally(() => setLoading(false));
  }, [id, orgId]);

  const tone = statusTone[project?.status ?? 'planning'] ?? statusTone.planning;

  const resolvedAccess = accessRules.map((rule) => {
    if (rule.accessor_type === 'team') {
      const team = teams.find((t) => t.id === rule.accessor_id);
      return { ...rule, label: team?.name ?? 'Unknown team' };
    }
    const member = members.find((m) => m.user_id === rule.accessor_id);
    return {
      ...rule,
      label: member?.user?.full_name ?? member?.user?.email ?? 'Unknown member',
    };
  });

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={accent} size="large" />
      </View>
    );
  }

  if (!project || error) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center', padding: 28 }}>
        <Text style={{ color: '#cbd5e1', fontSize: 16, fontWeight: '700', marginBottom: 12 }}>Project unavailable</Text>
        <Text style={{ color: '#64748b', textAlign: 'center' }}>{error || 'This project could not be found.'}</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 20 }}>
          <Text style={{ color: accent, fontWeight: '700' }}>← Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

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
          <Text style={{ fontSize: 11, color: '#64748b', fontWeight: '600' }}>{orgName ?? 'Organisation'}</Text>
          <Text style={{ fontSize: 19, fontWeight: '800', color: '#f1f5f9' }} numberOfLines={1}>{project.name}</Text>
        </View>
        <View style={{ backgroundColor: tone.bg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}>
          <Text style={{ color: tone.fg, fontSize: 10, fontWeight: '800', textTransform: 'uppercase' }}>
            {project.status ?? 'planning'}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 32 }}>

        {/* Project info card */}
        <View style={{
          backgroundColor: '#1e293b', borderRadius: 18, padding: 18,
          borderWidth: 1, borderColor: '#334155', marginBottom: 24,
        }}>
          <Text style={{ fontSize: 14, color: '#cbd5e1', lineHeight: 22 }}>
            {project.description || 'Group your forms, reports and assets for this campaign.'}
          </Text>
          <Text style={{ fontSize: 11, color: '#64748b', marginTop: 10 }}>
            Updated {fmtDate(project.updated_at ?? project.created_at ?? Date.now())}
          </Text>
        </View>

        {/* Artifact group tiles */}
        <Text style={{
          fontSize: 11, fontWeight: '700', color: '#64748b',
          textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 12,
        }}>
          Workspaces
        </Text>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <ArtifactTile
            icon={<FileText size={20} color="#4ade80" />}
            label="Forms"
            count={formCount}
            accent="#4ade80"
            onPress={() =>
              router.push({
                pathname: '/(main)/(desk)/project-forms/[projectId]' as any,
                params: {
                  projectId: project.id,
                  orgId,
                  projectName: project.name,
                  orgColor: accent,
                },
              })
            }
          />
          <ArtifactTile
            icon={<BarChart2 size={20} color="#60a5fa" />}
            label="Reports"
            count={reportCount}
            accent="#60a5fa"
            locked
          />
          <ArtifactTile
            icon={<Paperclip size={20} color="#fbbf24" />}
            label="Assets"
            count={assetCount}
            accent="#fbbf24"
            locked
          />
        </View>

        {/* Collapsible access / roles */}
        {resolvedAccess.length > 0 ? (
          <>
            <TouchableOpacity
              onPress={() => setAccessOpen((o) => !o)}
              activeOpacity={0.75}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 8,
                marginTop: 16, paddingVertical: 12, paddingHorizontal: 14,
                backgroundColor: '#1e293b', borderRadius: 14,
                borderWidth: 1, borderColor: '#334155',
              }}
            >
              <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: '#94a3b8' }}>
                Access &amp; Roles
              </Text>
              <View style={{ backgroundColor: '#0f172a', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 }}>
                <Text style={{ fontSize: 11, color: '#64748b' }}>{resolvedAccess.length}</Text>
              </View>
              {accessOpen
                ? <ChevronDown size={16} color="#64748b" />
                : <ChevronRight size={16} color="#64748b" />}
            </TouchableOpacity>

            {accessOpen ? (
              <View style={{ backgroundColor: '#1e293b', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#334155' }}>
                {resolvedAccess.map((rule: any) => (
                  <View key={rule.id} style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#0f172a' }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#f1f5f9' }}>{rule.label}</Text>
                    <Text style={{ fontSize: 11, color: '#64748b', marginTop: 2, textTransform: 'uppercase' }}>
                      {rule.accessor_type} · {rule.role_name ?? rule.role_slug ?? rule.role ?? 'member'}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
          </>
        ) : null}

      </ScrollView>
    </View>
  );
}
