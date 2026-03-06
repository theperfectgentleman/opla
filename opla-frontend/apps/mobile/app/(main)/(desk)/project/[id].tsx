import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { orgAPI, projectAPI } from '../../../../services/api';

type Project = {
  id: string;
  name: string;
  description?: string;
  status?: 'planning' | 'active' | 'paused' | 'archived';
  created_at?: string;
  updated_at?: string;
};

type Form = {
  id: string;
  title: string;
  status?: string;
  version?: number;
  description?: string;
};

type Member = {
  user_id: string;
  user?: { full_name?: string; email?: string; phone?: string };
};

type Team = {
  id: string;
  name: string;
};

type AccessRule = {
  id: string;
  accessor_id: string;
  accessor_type: 'user' | 'team';
  role?: 'collector' | 'analyst' | 'editor';
  role_template_id?: string;
  role_name?: string;
  role_slug?: string;
};

type ProjectRoleTemplate = {
  id: string;
  name: string;
  slug: string;
  description?: string;
  permissions: string[];
  priority: number;
  is_system: boolean;
  assignment_count?: number;
};

const toneByStatus: Record<string, { bg: string; fg: string }> = {
  planning: { bg: '#451a03', fg: '#fbbf24' },
  active: { bg: '#052e16', fg: '#4ade80' },
  paused: { bg: '#431407', fg: '#fb923c' },
  archived: { bg: '#1e293b', fg: '#94a3b8' },
};

function SectionHeader({ title, count }: { title: string; count?: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14, marginTop: 28 }}>
      <Text style={{ fontSize: 16, fontWeight: '700', color: '#f1f5f9', flex: 1 }}>{title}</Text>
      {typeof count === 'number' ? (
        <View style={{ backgroundColor: '#1e293b', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 }}>
          <Text style={{ color: '#94a3b8', fontSize: 11, fontWeight: '700' }}>{count}</Text>
        </View>
      ) : null}
    </View>
  );
}

export default function ProjectDetailScreen() {
  const { id, orgId } = useLocalSearchParams<{ id: string; orgId?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [project, setProject] = useState<Project | null>(null);
  const [forms, setForms] = useState<Form[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [accessRules, setAccessRules] = useState<AccessRule[]>([]);
  const [roleTemplates, setRoleTemplates] = useState<ProjectRoleTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id || !orgId) {
      setError('This project link is missing organisation context. Open it from the organisation workspace.');
      setLoading(false);
      return;
    }

    Promise.all([
      projectAPI.get(orgId, id),
      projectAPI.listForms(id),
      projectAPI.listAccess(orgId, id),
      projectAPI.listRoleTemplates(orgId),
      orgAPI.getMembers(orgId),
      orgAPI.getTeams(orgId),
    ])
      .then(([projectData, formData, accessData, roleTemplateData, memberData, teamData]) => {
        setProject(projectData);
        setForms(Array.isArray(formData) ? formData : formData?.forms ?? []);
        setAccessRules(Array.isArray(accessData) ? accessData : []);
        setRoleTemplates(Array.isArray(roleTemplateData) ? roleTemplateData : []);
        setMembers(Array.isArray(memberData) ? memberData : []);
        setTeams(Array.isArray(teamData) ? teamData : []);
      })
      .catch((err: any) => {
        setError(err?.response?.data?.detail || 'Could not load project workspace.');
      })
      .finally(() => setLoading(false));
  }, [id, orgId]);

  const statusTone = toneByStatus[project?.status || 'planning'] || toneByStatus.planning;

  const resolvedAccessRules = useMemo(() => {
    return accessRules.map(rule => {
      if (rule.accessor_type === 'team') {
        const team = teams.find(item => item.id === rule.accessor_id);
        return { ...rule, label: team?.name || 'Unknown team' };
      }
      const member = members.find(item => item.user_id === rule.accessor_id);
      return {
        ...rule,
        label: member?.user?.full_name || member?.user?.email || member?.user?.phone || 'Unknown member',
      };
    });
  }, [accessRules, members, teams]);

  const roleTemplateUsage = useMemo(() => {
    const usageByTemplate = accessRules.reduce<Record<string, number>>((acc, rule) => {
      if (rule.role_template_id) {
        acc[rule.role_template_id] = (acc[rule.role_template_id] || 0) + 1;
      }
      return acc;
    }, {});

    return roleTemplates
      .map(template => ({
        ...template,
        projectAssignmentCount: usageByTemplate[template.id] || 0,
      }))
      .sort((left, right) => right.priority - left.priority || left.name.localeCompare(right.name));
  }, [accessRules, roleTemplates]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color="#6366f1" size="large" />
      </View>
    );
  }

  if (!project || error) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center', padding: 28 }}>
        <Text style={{ color: '#cbd5e1', fontSize: 16, fontWeight: '700', marginBottom: 12 }}>Project unavailable</Text>
        <Text style={{ color: '#64748b', textAlign: 'center' }}>{error || 'This project could not be found.'}</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 20 }}>
          <Text style={{ color: '#6366f1', fontWeight: '700' }}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

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
          <Text style={{ fontSize: 20, fontWeight: '800', color: '#f1f5f9' }} numberOfLines={1}>{project.name}</Text>
          <Text style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Campaign workspace</Text>
        </View>
        <View style={{ backgroundColor: statusTone.bg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}>
          <Text style={{ color: statusTone.fg, fontSize: 10, fontWeight: '800', textTransform: 'uppercase' }}>
            {project.status || 'planning'}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 24 }}>
        <View style={{ backgroundColor: '#1e293b', borderRadius: 18, padding: 18, borderWidth: 1, borderColor: '#334155' }}>
          <Text style={{ fontSize: 15, color: '#cbd5e1', lineHeight: 22 }}>
            {project.description || 'This workspace groups the forms, collaborators, and operational activity for this campaign.'}
          </Text>
          <Text style={{ fontSize: 11, color: '#64748b', marginTop: 12 }}>
            Updated {new Date(project.updated_at || project.created_at || Date.now()).toLocaleDateString()}
          </Text>
        </View>

        <SectionHeader title="Forms" count={forms.length} />
        {forms.length === 0 ? (
          <Text style={{ color: '#475569', fontSize: 14 }}>No forms in this project.</Text>
        ) : forms.map(form => (
          <TouchableOpacity
            key={form.id}
            onPress={() => router.push({
              pathname: '/(main)/(desk)/form/[id]',
              params: {
                id: form.id,
                orgId,
                projectId: project.id,
                projectName: project.name,
              },
            })}
            style={{
              backgroundColor: '#1e293b', borderRadius: 14, padding: 16, marginBottom: 10,
              borderWidth: 1, borderColor: '#334155', flexDirection: 'row', alignItems: 'center', gap: 12,
            }}
          >
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: form.status === 'live' ? '#4ade80' : '#64748b' }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#f1f5f9' }}>{form.title}</Text>
              <Text style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                v{form.version || 0} • {form.status || 'draft'}
              </Text>
            </View>
            <Text style={{ fontSize: 18, color: '#475569' }}>›</Text>
          </TouchableOpacity>
        ))}

        <SectionHeader title="Access" count={resolvedAccessRules.length} />
        {resolvedAccessRules.length === 0 ? (
          <Text style={{ color: '#475569', fontSize: 14 }}>No explicit access rules on this project.</Text>
        ) : resolvedAccessRules.map(rule => (
          <View
            key={rule.id}
            style={{
              backgroundColor: '#1e293b', borderRadius: 14, padding: 14, marginBottom: 10,
              borderWidth: 1, borderColor: '#334155',
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#f1f5f9' }}>{rule.label}</Text>
            <Text style={{ fontSize: 11, color: '#64748b', marginTop: 3, textTransform: 'uppercase' }}>
              {rule.accessor_type} • {rule.role_name || rule.role_slug || rule.role || 'role'}
            </Text>
          </View>
        ))}

        <SectionHeader title="Role Templates" count={roleTemplateUsage.length} />
        {roleTemplateUsage.length === 0 ? (
          <Text style={{ color: '#475569', fontSize: 14 }}>No role templates available for this organisation yet.</Text>
        ) : roleTemplateUsage.map(template => (
          <View
            key={template.id}
            style={{
              backgroundColor: '#1e293b', borderRadius: 14, padding: 14, marginBottom: 10,
              borderWidth: 1, borderColor: template.projectAssignmentCount > 0 ? '#4338ca' : '#334155',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#f1f5f9' }}>{template.name}</Text>
                  {template.is_system ? (
                    <View style={{ backgroundColor: '#0f172a', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 }}>
                      <Text style={{ color: '#94a3b8', fontSize: 10, fontWeight: '800', textTransform: 'uppercase' }}>System</Text>
                    </View>
                  ) : null}
                  {template.projectAssignmentCount > 0 ? (
                    <View style={{ backgroundColor: '#312e81', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 }}>
                      <Text style={{ color: '#c7d2fe', fontSize: 10, fontWeight: '800', textTransform: 'uppercase' }}>
                        {template.projectAssignmentCount} in this project
                      </Text>
                    </View>
                  ) : null}
                </View>
                <Text style={{ fontSize: 12, color: '#94a3b8', marginTop: 6, lineHeight: 18 }}>
                  {template.description || 'No description provided.'}
                </Text>
                <Text style={{ fontSize: 10, color: '#64748b', marginTop: 8, textTransform: 'uppercase' }}>
                  Priority {template.priority} • {template.permissions.length} permissions
                </Text>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}