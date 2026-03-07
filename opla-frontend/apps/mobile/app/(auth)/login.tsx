/**
 * Login screen — online authentication gate
 * Supports email+password or phone OTP.
 */
import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView,
  Platform, ActivityIndicator, ScrollView, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';

type Tab = 'email' | 'phone';
type PhasePhone = 'input' | 'otp';

export default function LoginScreen() {
  const { loginEmail, loginPhone, requestOtp, status } = useAuth();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>('email');
  // Email fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // Phone fields
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [phonePhase, setPhonePhase] = useState<PhasePhone>('input');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleEmailLogin = async () => {
    if (!email.trim() || !password) { setError('Enter email and password'); return; }
    setError('');
    setLoading(true);
    try {
      await loginEmail(email.trim(), password);
      // AuthProvider will set status → RootGuard redirects
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? e?.message ?? 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestOtp = async () => {
    if (!phone.trim()) { setError('Enter your phone number'); return; }
    setError('');
    setLoading(true);
    try {
      await requestOtp(phone.trim());
      setPhonePhase('otp');
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? e?.message ?? 'Could not send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) { setError('Enter the 6-digit code'); return; }
    setError('');
    setLoading(true);
    try {
      await loginPhone(phone.trim(), otp.trim());
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? e?.message ?? 'Invalid code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#0f172a' }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo / header */}
        <View style={{ marginBottom: 40, alignItems: 'center' }}>
          <View style={{
            width: 64, height: 64, borderRadius: 20,
            backgroundColor: '#158754', alignItems: 'center', justifyContent: 'center',
            marginBottom: 16,
          }}>
            <Text style={{ fontSize: 28, fontWeight: '800', color: '#fff' }}>O</Text>
          </View>
          <Text style={{ fontSize: 28, fontWeight: '800', color: '#f1f5f9', letterSpacing: -0.5 }}>
            Welcome to Opla
          </Text>
          <Text style={{ fontSize: 14, color: '#94a3b8', marginTop: 6 }}>
            Sign in to access your workspace
          </Text>
        </View>

        {/* Tab switcher */}
        <View style={{
          flexDirection: 'row', backgroundColor: '#1e293b',
          borderRadius: 14, padding: 4, marginBottom: 28,
        }}>
          {(['email', 'phone'] as Tab[]).map(t => (
            <TouchableOpacity
              key={t}
              onPress={() => { setTab(t); setError(''); setPhonePhase('input'); }}
              style={{
                flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center',
                backgroundColor: tab === t ? '#158754' : 'transparent',
              }}
            >
              <Text style={{
                fontWeight: '600', fontSize: 14,
                color: tab === t ? '#fff' : '#64748b',
              }}>
                {t === 'email' ? 'Email' : 'Phone OTP'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Email form */}
        {tab === 'email' && (
          <View style={{ gap: 14 }}>
            <View>
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#94a3b8', marginBottom: 6 }}>
                Email address
              </Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="you@company.com"
                placeholderTextColor="#475569"
                style={{
                  backgroundColor: '#1e293b', borderRadius: 12,
                  paddingHorizontal: 16, paddingVertical: 14,
                  color: '#f1f5f9', fontSize: 15, borderWidth: 1.5, borderColor: '#334155',
                }}
              />
            </View>
            <View>
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#94a3b8', marginBottom: 6 }}>
                Password
              </Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder="••••••••"
                placeholderTextColor="#475569"
                style={{
                  backgroundColor: '#1e293b', borderRadius: 12,
                  paddingHorizontal: 16, paddingVertical: 14,
                  color: '#f1f5f9', fontSize: 15, borderWidth: 1.5, borderColor: '#334155',
                }}
              />
            </View>
            <TouchableOpacity
              onPress={handleEmailLogin}
              disabled={loading}
              style={{
                backgroundColor: '#158754', borderRadius: 12,
                paddingVertical: 16, alignItems: 'center', marginTop: 4,
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Sign In</Text>
              }
            </TouchableOpacity>
          </View>
        )}

        {/* Phone OTP form */}
        {tab === 'phone' && phonePhase === 'input' && (
          <View style={{ gap: 14 }}>
            <View>
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#94a3b8', marginBottom: 6 }}>
                Phone number
              </Text>
              <TextInput
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                placeholder="+233 XX XXX XXXX"
                placeholderTextColor="#475569"
                style={{
                  backgroundColor: '#1e293b', borderRadius: 12,
                  paddingHorizontal: 16, paddingVertical: 14,
                  color: '#f1f5f9', fontSize: 15, borderWidth: 1.5, borderColor: '#334155',
                }}
              />
            </View>
            <TouchableOpacity
              onPress={handleRequestOtp}
              disabled={loading}
              style={{
                backgroundColor: '#158754', borderRadius: 12,
                paddingVertical: 16, alignItems: 'center',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Send Code</Text>
              }
            </TouchableOpacity>
          </View>
        )}

        {tab === 'phone' && phonePhase === 'otp' && (
          <View style={{ gap: 14 }}>
            <Text style={{ color: '#94a3b8', fontSize: 14, textAlign: 'center' }}>
              Enter the 6-digit code sent to{'\n'}
              <Text style={{ color: '#f1f5f9', fontWeight: '600' }}>{phone}</Text>
            </Text>
            <TextInput
              value={otp}
              onChangeText={setOtp}
              keyboardType="number-pad"
              maxLength={6}
              placeholder="_ _ _ _ _ _"
              placeholderTextColor="#475569"
              style={{
                backgroundColor: '#1e293b', borderRadius: 12,
                paddingHorizontal: 16, paddingVertical: 16,
                color: '#f1f5f9', fontSize: 24, fontWeight: '700',
                letterSpacing: 10, textAlign: 'center',
                borderWidth: 1.5, borderColor: '#334155',
              }}
            />
            <TouchableOpacity
              onPress={handleVerifyOtp}
              disabled={loading}
              style={{
                backgroundColor: '#158754', borderRadius: 12,
                paddingVertical: 16, alignItems: 'center',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Verify & Sign In</Text>
              }
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setPhonePhase('input'); setOtp(''); }}>
              <Text style={{ color: '#158754', textAlign: 'center', fontSize: 14 }}>
                ← Change number
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Error */}
        {error ? (
          <View style={{
            marginTop: 16, backgroundColor: '#450a0a',
            borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#991b1b',
          }}>
            <Text style={{ color: '#fca5a5', fontSize: 13 }}>{error}</Text>
          </View>
        ) : null}

        {/* Skip to Yard */}
        <TouchableOpacity
          onPress={() => router.replace('/(main)/(yard)')}
          style={{ marginTop: 28, alignItems: 'center' }}
        >
          <Text style={{ color: '#475569', fontSize: 14 }}>
            Browse public surveys without signing in →
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
