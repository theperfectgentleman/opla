import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, CheckCircle2, KeyRound, ShieldAlert } from 'lucide-react-native';

import { orgAPI } from '../../services/api';
import { updateSessionOrgIds } from '../../services/authService';

type AcceptResponse = {
  status: 'accepted' | 'pending_review';
  invitation: {
    org_name?: string | null;
    team_name?: string | null;
    invitation_type: 'organization' | 'team';
    member_type: 'internal' | 'contractor';
    delivery_mode: 'email' | 'short_link' | 'generated_link' | 'pin_code';
    approval_mode: 'auto' | 'review';
    status: 'pending' | 'approved' | 'accepted' | 'revoked' | 'declined';
    claimed_at?: string | null;
    accepted_at?: string | null;
  };
  membership?: {
    global_role: 'admin' | 'member';
    member_type: 'internal' | 'contractor';
    joined_at: string;
  } | null;
};

export default function JoinTeamScreen() {
  const router = useRouter();
  const { pin } = useLocalSearchParams<{ pin?: string }>();
  const [pinCode, setPinCode] = useState((pin || '').replace(/[^0-9]/g, '').slice(0, 6));
  const [result, setResult] = useState<AcceptResponse | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleJoin = async () => {
    if (pinCode.length !== 6) {
      setError('Enter the full 6-digit team PIN');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);
    try {
      const response = await orgAPI.acceptInvitation({ pin_code: pinCode });
      const organizations = await orgAPI.list().catch(() => []);
      if (Array.isArray(organizations)) {
        await updateSessionOrgIds(organizations.map((organization: { id: string }) => organization.id));
      }
      setResult(response);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? e?.message ?? 'Could not join team');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#020617' }}>
      <KeyboardAvoidingView
        style={{ flex: 1, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 24 }}
        >
          <ArrowLeft size={18} color="#94a3b8" />
          <Text style={{ color: '#94a3b8', fontSize: 14, fontWeight: '600' }}>Back</Text>
        </TouchableOpacity>

        <View style={{ marginBottom: 28 }}>
          <Text style={{ color: '#f8fafc', fontSize: 30, fontWeight: '900', letterSpacing: -0.6 }}>
            Join Team
          </Text>
          <Text style={{ color: '#94a3b8', fontSize: 14, marginTop: 8, lineHeight: 20 }}>
            Enter the contractor PIN you received to join a field team from mobile.
          </Text>
        </View>

        <View style={{
          backgroundColor: 'rgba(15,23,42,0.85)',
          borderRadius: 28,
          borderWidth: 1,
          borderColor: '#1e293b',
          padding: 20,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <KeyRound size={18} color="#22d3ee" />
            <Text style={{ color: '#e2e8f0', fontSize: 13, fontWeight: '700', letterSpacing: 1.2 }}>
              TEAM PIN
            </Text>
          </View>

          <TextInput
            value={pinCode}
            onChangeText={(value) => setPinCode(value.replace(/[^0-9]/g, '').slice(0, 6))}
            keyboardType="number-pad"
            maxLength={6}
            placeholder="000000"
            placeholderTextColor="#475569"
            style={{
              backgroundColor: '#0f172a',
              borderRadius: 18,
              borderWidth: 1.5,
              borderColor: '#334155',
              paddingHorizontal: 18,
              paddingVertical: 18,
              color: '#f8fafc',
              fontSize: 28,
              fontWeight: '800',
              letterSpacing: 8,
              textAlign: 'center',
            }}
          />

          <Text style={{ color: '#64748b', fontSize: 12, marginTop: 12, lineHeight: 18 }}>
            Contractor invites stay valid until an administrator removes them. If the invite uses review mode, your join will wait for approval.
          </Text>

          {error ? (
            <View style={{
              marginTop: 16,
              backgroundColor: '#3f0d13',
              borderRadius: 14,
              borderWidth: 1,
              borderColor: '#7f1d1d',
              padding: 12,
              flexDirection: 'row',
              gap: 10,
            }}>
              <ShieldAlert size={18} color="#fca5a5" />
              <Text style={{ color: '#fecaca', fontSize: 13, flex: 1, lineHeight: 18 }}>{error}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            onPress={handleJoin}
            disabled={loading}
            style={{
              marginTop: 20,
              backgroundColor: '#06b6d4',
              borderRadius: 18,
              paddingVertical: 16,
              alignItems: 'center',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? (
              <ActivityIndicator color="#082f49" />
            ) : (
              <Text style={{ color: '#082f49', fontSize: 15, fontWeight: '800' }}>Join With PIN</Text>
            )}
          </TouchableOpacity>
        </View>

        {result ? (
          <View style={{
            marginTop: 22,
            backgroundColor: 'rgba(15,23,42,0.85)',
            borderRadius: 28,
            borderWidth: 1,
            borderColor: '#1e293b',
            padding: 20,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
              <CheckCircle2 size={22} color={result.status === 'accepted' ? '#4ade80' : '#38bdf8'} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#f8fafc', fontSize: 20, fontWeight: '800' }}>
                  {result.status === 'accepted' ? 'Join Successful' : 'Pending Approval'}
                </Text>
                <Text style={{ color: '#94a3b8', fontSize: 13, marginTop: 8, lineHeight: 19 }}>
                  {result.status === 'accepted'
                    ? 'Your contractor membership is active and linked to the invited team.'
                    : 'Your PIN was claimed successfully. An admin still needs to approve this contractor join.'}
                </Text>
                <Text style={{ color: '#e2e8f0', fontSize: 14, fontWeight: '700', marginTop: 10 }}>
                  {result.invitation.team_name
                    ? `Team: ${result.invitation.team_name}`
                    : result.invitation.org_name
                      ? `Organization: ${result.invitation.org_name}`
                      : 'Invitation target available'}
                </Text>
              </View>
            </View>

            <View style={{ marginTop: 18, gap: 10 }}>
              <Text style={{ color: '#cbd5e1', fontSize: 13 }}>Member type: {result.invitation.member_type}</Text>
              <Text style={{ color: '#cbd5e1', fontSize: 13 }}>Approval mode: {result.invitation.approval_mode}</Text>
              <Text style={{ color: '#cbd5e1', fontSize: 13 }}>Invitation status: {result.invitation.status}</Text>
              {result.membership?.joined_at ? (
                <Text style={{ color: '#cbd5e1', fontSize: 13 }}>
                  Joined: {new Date(result.membership.joined_at).toLocaleString()}
                </Text>
              ) : null}
            </View>

            <TouchableOpacity
              onPress={() => router.replace('/(main)/profile')}
              style={{
                marginTop: 18,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: '#334155',
                paddingVertical: 14,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: '#e2e8f0', fontSize: 14, fontWeight: '700' }}>Back to Profile</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
