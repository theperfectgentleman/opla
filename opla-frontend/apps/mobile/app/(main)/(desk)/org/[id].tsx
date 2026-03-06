/**
 * Org detail screen — shows everything the user has access to inside one org:
 * members summary, teams, projects and their forms.
 */
import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, StatusBar,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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

function SectionHeader({ icon, title, count }: { icon: string; title: string; count?: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 28, marginBottom: 14 }}>
      <Text style={{ fontSize: 16 }}>{icon}</Text>
      <Text style={{ fontSize: 16, fontWeight: '700', color: '#f1f5f9', flex: 1 }}>{title}</Text>
      {count != null && (
        <View style={{ backgroundColor: '#1e293b', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 }}>
          <Text style={{ fontSize: 12, color: '#64748b', fontWeight: '600' }}>{count}</Text>
        </View>
      )}
    </View>
  );
}

function TeamCard({ team }: { team: Team }) {
  const initials = team.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <View style={{
      backgroundColor: '#1e293b', borderRadius: 14, padding: 16,
      marginBottom: 10, borderWidth: 1, borderColor: '#334155',
      flexDirection: 'row', alignItems: 'center', gap: 14,
    }}>
      <View style={{
        width: 42, height: 42, borderRadius: 12,
        backgroundColor: '#164e63', alignItems: 'center', justifyContent: 'center',
      }}>
        <Text style={{ color: '#67e8f9', fontSize: 14, fontWeight: '800' }}>{initials}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: '#f1f5f9' }}>{team.name}</Text>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 3 }}>
          {team.member_count != null && (
            <Text style={{ fontSize: 12, color: '#64748b' }}>👥 {team.member_count} members</Text>
          )}
        </View>
        {team.description ? (
          <Text style={{ fontSize: 12, color: '#475569', marginTop: 2 }} numberOfLines={1}>
            {team.description}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function MemberRow({ member, isOwner }: { member: Member; isOwner: boolean }) {
  const initials = member.user.full_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#1e293b',
    }}>
      <View style={{
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: isOwner ? '#312e81' : '#1e293b',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Text style={{ color: isOwner ? '#a5b4fc' : '#64748b', fontSize: 13, fontWeight: '700' }}>
          {initials}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: '#f1f5f9' }}>{member.user.full_name}</Text>
        <Text style={{ fontSize: 11, color: '#64748b' }}>{member.user.email}</Text>
      </View>
      <View style={{
        paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
        backgroundColor: isOwner ? '#1e1b4b' : '#1e293b',
      }}>
        <Text style={{ fontSize: 11, color: isOwner ? '#a5b4fc' : '#475569', fontWeight: '600' }}>
          {isOwner ? 'Owner' : member.global_role}
        </Text>
      </View>
    </View>
  );
}

function ProjectCard({
  project, orgAccent, onPress,
}: { project: Project; orgAccent: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
      backgroundColor: '#1e293b', borderRadius: 16, marginBottom: 12,
      borderWidth: 1, borderColor: '#334155', overflow: 'hidden',
      }}
    >
      <View
        style={{
          flexDirection: 'row', alignItems: 'center', gap: 12,
          padding: 16,
        }}
      >
        <View style={{
          width: 8, height: 8, borderRadius: 4,
          backgroundColor: orgAccent,
        }} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#f1f5f9' }}>{project.name}</Text>
          {project.description ? (
            <Text style={{ fontSize: 12, color: '#64748b', marginTop: 2 }} numberOfLines={1}>
              {project.description}
            </Text>
          ) : (
            <Text style={{ fontSize: 12, color: '#475569', marginTop: 2 }} numberOfLines={1}>
              Open this workspace to view forms and access details.
            </Text>
          )}
        </View>
        {project.status ? (
          <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: '#0f172a' }}>
            <Text style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', fontWeight: '700' }}>
              {project.status}
            </Text>
          </View>
        ) : null}
        <Text style={{ color: '#475569', fontSize: 18 }}>›</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function OrgDetailScreen() {
  const { id, name: orgName, color: orgColor, owner: orgOwner } = useLocalSearchParams<{ id: string; name?: string; color?: string; owner?: string }>();
  const router  = useRouter();
  const insets  = useSafeAreaInsets();

  const [org, setOrg]         = useState<OrgDetail | null>(null);
  const [teams, setTeams]     = useState<Team[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAllMembers, setShowAllMembers] = useState(false);

  // Use params-provided values for immediate render, fall back to loaded org
  const displayName = orgName ?? org?.name ?? 'Organisation';
  const accent = orgColor ?? org?.primary_color ?? '#6366f1';
  const ownerId = orgOwner ?? org?.owner_id;

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
      setProjects(Array.isArray(projectsRes.value) ? projectsRes.value : projectsRes.value?.projects ?? []);
    }
  }, [id]);

  useEffect(() => {
    if (!id) return;
    // We already have org data from the list — fetch supplementary data
    fetchAll().finally(() => setLoading(false));
  }, [id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  };

  const visibleMembers = showAllMembers ? members : members.slice(0, 5);

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
          {/* Org name will be populated from params or first load */}
          <Text style={{ fontSize: 20, fontWeight: '800', color: '#f1f5f9' }} numberOfLines={1}>
            {displayName}
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator color="#6366f1" size="large" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 24 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />}
        >
          {/* ── Teams ── */}
          <SectionHeader icon="👥" title="Teams" count={teams.length} />
          {teams.length === 0 ? (
            <Text style={{ color: '#475569', fontSize: 14 }}>No teams in this organisation.</Text>
          ) : teams.map(t => <TeamCard key={t.id} team={t} />)}

          {/* ── Members ── */}
          <SectionHeader icon="🧑‍💼" title="Members" count={members.length} />
          {members.length === 0 ? (
            <Text style={{ color: '#475569', fontSize: 14 }}>No members found.</Text>
          ) : (
            <View style={{ backgroundColor: '#1e293b', borderRadius: 14, paddingHorizontal: 14 }}>
              {visibleMembers.map(m => (
                <MemberRow
                  key={m.id}
                  member={m}
                  isOwner={!!(ownerId && m.user_id === ownerId)}
                />
              ))}
              {members.length > 5 && (
                <TouchableOpacity
                  onPress={() => setShowAllMembers(s => !s)}
                  style={{ paddingVertical: 12, alignItems: 'center' }}
                >
                  <Text style={{ color: '#6366f1', fontSize: 13, fontWeight: '600' }}>
                    {showAllMembers ? 'Show less' : `Show ${members.length - 5} more`}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* ── Projects ── */}
          <SectionHeader icon="📁" title="Projects" count={projects.length} />
          {projects.length === 0 ? (
            <Text style={{ color: '#475569', fontSize: 14 }}>No projects in this organisation.</Text>
          ) : projects.map(p => (
            <ProjectCard
              key={p.id}
              project={p}
              orgAccent={accent}
              onPress={() => router.push(`../project/${p.id}?orgId=${id}`)}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}
