/**
 * Org detail screen — projects are the primary focus.
 * Teams and members are collapsible in an "Organisation Details" section.
 */
import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, StatusBar,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronRight, ChevronDown, Users, Folder, FolderOpen } from 'lucide-react-native';
import { orgAPI, projectAPI } from '../../../../services/api';

// ─── Types ────────────────────────────────────────────────────────────────────

type OrgDetail = {
  id: string; name: string; slug?: string;
  logo_url?: string; primary_color?: string; owner_id?: string;
};

type Team = {
  id: string; name: string; description?: string; member_count?: number;
};

type Member = {
  id: string; user_id: string;
  global_role: string; invitation_status: string;
  user: { id: string; full_name: string; email: string };
};

type Project = {
  id: string; name: string; description?: string; status?: string;
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function ProjectCard({
  project, accent, onPress,
}: { project: Project; accent: string; onPress: () => void }) {
  const statusColors: Record<string, string> = {
    active: '#4ade80', planning: '#fbbf24', paused: '#fb923c', archived: '#94a3b8',
  };
  const dotColor = statusColors[project.status ?? 'planning'] ?? '#94a3b8';

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={{
        backgroundColor: '#1e293b', borderRadius: 16, marginBottom: 10,
        borderWidth: 1, borderColor: '#334155',
        flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12,
      }}
    >
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: dotColor }} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: '#f1f5f9' }}>{project.name}</Text>
        {project.description ? (
          <Text style={{ fontSize: 12, color: '#64748b', marginTop: 2 }} numberOfLines={2}>
            {project.description}
          </Text>
        ) : (
          <Text style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>
            Tap to view forms and activity
          </Text>
        )}
      </View>
      {project.status ? (
        <View style={{
          backgroundColor: '#0f172a', borderRadius: 999,
          paddingHorizontal: 8, paddingVertical: 4,
        }}>
          <Text style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', fontWeight: '700' }}>
            {project.status}
          </Text>
        </View>
      ) : null}
      <ChevronRight size={16} color="#475569" />
    </TouchableOpacity>
  );
}

function TeamRow({ team }: { team: Team }) {
  const initials = team.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#0f172a',
    }}>
      <View style={{
        width: 34, height: 34, borderRadius: 10,
        backgroundColor: '#164e63', alignItems: 'center', justifyContent: 'center',
      }}>
        <Text style={{ color: '#67e8f9', fontSize: 12, fontWeight: '800' }}>{initials}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: '#f1f5f9' }}>{team.name}</Text>
        {team.member_count != null ? (
          <Text style={{ fontSize: 11, color: '#64748b' }}>{team.member_count} members</Text>
        ) : null}
      </View>
    </View>
  );
}

function MemberRow({ member, isOwner }: { member: Member; isOwner: boolean }) {
  const initials = member.user.full_name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#0f172a',
    }}>
      <View style={{
        width: 34, height: 34, borderRadius: 17,
        backgroundColor: isOwner ? '#312e81' : '#1e3a5f',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Text style={{ color: isOwner ? '#a5b4fc' : '#7dd3fc', fontSize: 12, fontWeight: '700' }}>
          {initials}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: '#f1f5f9' }}>{member.user.full_name}</Text>
        <Text style={{ fontSize: 11, color: '#64748b' }}>{member.user.email}</Text>
      </View>
      <View style={{
        paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
        backgroundColor: isOwner ? '#1e1b4b' : '#0f172a',
      }}>
        <Text style={{ fontSize: 11, color: isOwner ? '#a5b4fc' : '#475569', fontWeight: '600' }}>
          {isOwner ? 'Owner' : member.global_role}
        </Text>
      </View>
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function OrgDetailScreen() {
  const { id, name: orgName, color: orgColor, owner: orgOwner } =
    useLocalSearchParams<{ id: string; name?: string; color?: string; owner?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [teams, setTeams]       = useState<Team[]>([]);
  const [members, setMembers]   = useState<Member[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const displayName = orgName ?? 'Organisation';
  const accent      = orgColor ?? '#6366f1';
  const ownerId     = orgOwner;

  const fetchAll = useCallback(async () => {
    if (!id) return;
    const [teamsRes, membersRes, projectsRes] = await Promise.allSettled([
      orgAPI.getTeams(id),
      orgAPI.getMembers(id),
      projectAPI.listByOrg(id),
    ]);
    if (teamsRes.status   === 'fulfilled') setTeams(teamsRes.value ?? []);
    if (membersRes.status === 'fulfilled') setMembers(membersRes.value ?? []);
    if (projectsRes.status === 'fulfilled') {
      setProjects(
        Array.isArray(projectsRes.value) ? projectsRes.value : projectsRes.value?.projects ?? [],
      );
    }
  }, [id]);

  useEffect(() => {
    if (!id) return;
    fetchAll().finally(() => setLoading(false));
  }, [id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  };

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
        {/* Org avatar */}
        <View style={{
          width: 36, height: 36, borderRadius: 10,
          backgroundColor: accent + '22', borderWidth: 1, borderColor: accent + '55',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Text style={{ color: accent, fontSize: 13, fontWeight: '800' }}>
            {displayName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 19, fontWeight: '800', color: '#f1f5f9' }} numberOfLines={1}>
            {displayName}
          </Text>
        </View>
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
          {/* ── Projects (primary) ── */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <FolderOpen size={17} color={accent} />
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#f1f5f9', flex: 1 }}>Projects</Text>
            <View style={{
              backgroundColor: '#1e293b', borderRadius: 10,
              paddingHorizontal: 8, paddingVertical: 2,
            }}>
              <Text style={{ fontSize: 12, color: '#64748b', fontWeight: '600' }}>{projects.length}</Text>
            </View>
          </View>

          {projects.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 28 }}>
              <Folder size={36} color="#334155" />
              <Text style={{ color: '#475569', marginTop: 12, textAlign: 'center', fontSize: 14 }}>
                No projects in this organisation yet.
              </Text>
            </View>
          ) : (
            projects.map((p) => (
              <ProjectCard
                key={p.id}
                project={p}
                accent={accent}
                onPress={() =>
                  router.push({
                    pathname: '/(main)/(desk)/project/[id]',
                    params: {
                      id: p.id,
                      orgId: id,
                      orgName: displayName,
                      orgColor: accent,
                    },
                  })
                }
              />
            ))
          )}

          {/* ── Collapsible Organisation Details ── */}
          <TouchableOpacity
            onPress={() => setDetailsOpen((o) => !o)}
            activeOpacity={0.75}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 8,
              marginTop: 28, marginBottom: detailsOpen ? 14 : 0,
              paddingVertical: 12, paddingHorizontal: 14,
              backgroundColor: '#1e293b', borderRadius: 14,
              borderWidth: 1, borderColor: '#334155',
            }}
          >
            <Users size={15} color="#64748b" />
            <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: '#94a3b8' }}>
              Organisation Details
            </Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <View style={{ backgroundColor: '#0f172a', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 }}>
                <Text style={{ fontSize: 11, color: '#64748b' }}>{teams.length} teams</Text>
              </View>
              <View style={{ backgroundColor: '#0f172a', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 }}>
                <Text style={{ fontSize: 11, color: '#64748b' }}>{members.length} members</Text>
              </View>
            </View>
            {detailsOpen
              ? <ChevronDown size={16} color="#64748b" />
              : <ChevronRight size={16} color="#64748b" />}
          </TouchableOpacity>

          {detailsOpen ? (
            <View style={{ backgroundColor: '#1e293b', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#334155' }}>
              {/* Teams */}
              {teams.length > 0 ? (
                <>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                    Teams
                  </Text>
                  {teams.map((t) => <TeamRow key={t.id} team={t} />)}
                  <View style={{ height: 16 }} />
                </>
              ) : null}
              {/* Members */}
              {members.length > 0 ? (
                <>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                    Members
                  </Text>
                  {members.map((m) => (
                    <MemberRow
                      key={m.id}
                      member={m}
                      isOwner={!!(ownerId && m.user_id === ownerId)}
                    />
                  ))}
                </>
              ) : null}
              {teams.length === 0 && members.length === 0 ? (
                <Text style={{ color: '#475569', fontSize: 14 }}>No teams or members found.</Text>
              ) : null}
            </View>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}
