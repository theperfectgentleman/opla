import { useMemo, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, CheckCircle2, Copy, KeyRound, Link2, ShieldAlert } from 'lucide-react-native';

import { orgAPI } from '../../services/api';
import { updateSessionOrgIds } from '../../services/authService';
import { fmtDateTime } from '../../src/utils/dateFormat';

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
    token?: string | null;
    pin_code?: string | null;
    claimed_at?: string | null;
    accepted_at?: string | null;
  };
  membership?: {
    global_role: 'admin' | 'member';
    member_type: 'internal' | 'contractor';
    joined_at: string;
  } | null;
};

export default function InvitationAcceptScreen() {
  const router = useRouter();
  const { token, pin } = useLocalSearchParams<{ token?: string; pin?: string }>();
  const [tokenValue, setTokenValue] = useState((token || '').trim());
  const [pinCode, setPinCode] = useState((pin || '').replace(/[^0-9]/g, '').slice(0, 6));
  const [result, setResult] = useState<AcceptResponse | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const mode = useMemo<'token' | 'pin'>(() => (pinCode && !tokenValue ? 'pin' : 'token'), [pinCode, tokenValue]);

  const handleAccept = async () => {
    const trimmedToken = tokenValue.trim();
    const trimmedPin = pinCode.trim();

    if ((trimmedToken ? 1 : 0) + (trimmedPin ? 1 : 0) !== 1) {
      setError('Provide exactly one invitation token or one 6-digit PIN.');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);
    try {
      const response = await orgAPI.acceptInvitation({
        token: trimmedToken || undefined,
        pin_code: trimmedPin || undefined,
      });
      const organizations = await orgAPI.list().catch(() => []);
      if (Array.isArray(organizations)) {
        await updateSessionOrgIds(organizations.map((organization: { id: string }) => organization.id));
      }
      setResult(response);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? e?.message ?? 'Could not accept invitation');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    const value = mode === 'pin' ? pinCode : tokenValue.trim();
    if (!value || typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
      return;
    }
    await navigator.clipboard.writeText(value);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#020617' }}>
      <KeyboardAvoidingView
        style={{ flex: 1, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity
          onPress={() => router.canGoBack() ? router.back() : router.replace('/(main)/(yard)')}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 24 }}
        >
          <ArrowLeft size={18} color="#94a3b8" />
          <Text style={{ color: '#94a3b8', fontSize: 14, fontWeight: '600' }}>Back</Text>
        </TouchableOpacity>

        <View style={{ marginBottom: 28 }}>
          <Text style={{ color: '#f8fafc', fontSize: 30, fontWeight: '900', letterSpacing: -0.6 }}>
            Accept Invitation
          </Text>
          <Text style={{ color: '#94a3b8', fontSize: 14, marginTop: 8, lineHeight: 20 }}>
            Opened from a shared invite link. Sign-in is preserved automatically, then you can confirm the join here.
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
            {mode === 'pin' ? <KeyRound size={18} color="#22d3ee" /> : <Link2 size={18} color="#22d3ee" />}
            <Text style={{ color: '#e2e8f0', fontSize: 13, fontWeight: '700', letterSpacing: 1.2 }}>
              {mode === 'pin' ? 'CONTRACTOR PIN' : 'INVITATION TOKEN'}
            </Text>
          </View>

          <TextInput
            value={tokenValue}
            onChangeText={(value) => {
              setTokenValue(value);
              if (value.trim()) {
                setPinCode('');
              }
            }}
            placeholder="Paste invite token"
            placeholderTextColor="#475569"
            autoCapitalize="none"
            autoCorrect={false}
            style={{
              backgroundColor: '#0f172a',
              borderRadius: 18,
              borderWidth: 1.5,
              borderColor: '#334155',
              paddingHorizontal: 18,
              paddingVertical: 16,
              color: '#f8fafc',
              fontSize: 15,
              fontWeight: '700',
              marginBottom: 12,
            }}
          />

          <TextInput
            value={pinCode}
            onChangeText={(value) => {
              const nextValue = value.replace(/[^0-9]/g, '').slice(0, 6);
              setPinCode(nextValue);
              if (nextValue) {
                setTokenValue('');
              }
            }}
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
            Use a token for short-link or generated-link invites. Use a PIN for contractor team joins.
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

          <View style={{ flexDirection: 'row', gap: 12, marginTop: 20 }}>
            <TouchableOpacity
              onPress={handleAccept}
              disabled={loading}
              style={{
                flex: 1,
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
                <Text style={{ color: '#082f49', fontSize: 15, fontWeight: '800' }}>Accept Invite</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleCopy}
              style={{
                borderRadius: 18,
                borderWidth: 1,
                borderColor: '#334155',
                paddingHorizontal: 18,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Copy size={18} color="#cbd5e1" />
            </TouchableOpacity>
          </View>
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
                  {result.status === 'accepted' ? 'Invitation Accepted' : 'Pending Approval'}
                </Text>
                <Text style={{ color: '#94a3b8', fontSize: 13, marginTop: 8, lineHeight: 19 }}>
                  {result.status === 'accepted'
                    ? 'Your membership is active under the invitation rules below.'
                    : 'Your invite was claimed successfully and is waiting for an administrator to approve it.'}
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
              <Text style={{ color: '#cbd5e1', fontSize: 13 }}>Invitation type: {result.invitation.invitation_type}</Text>
              <Text style={{ color: '#cbd5e1', fontSize: 13 }}>Member type: {result.invitation.member_type}</Text>
              <Text style={{ color: '#cbd5e1', fontSize: 13 }}>Approval mode: {result.invitation.approval_mode}</Text>
              <Text style={{ color: '#cbd5e1', fontSize: 13 }}>Invitation status: {result.invitation.status}</Text>
              {result.membership?.joined_at ? (
                <Text style={{ color: '#cbd5e1', fontSize: 13 }}>
                  Joined: {fmtDateTime(result.membership.joined_at)}
                </Text>
              ) : null}
            </View>

            <TouchableOpacity
              onPress={() => router.replace('/(main)/(yard)')}
              style={{
                marginTop: 18,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: '#334155',
                paddingVertical: 14,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: '#e2e8f0', fontSize: 14, fontWeight: '700' }}>Continue in Opla</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}