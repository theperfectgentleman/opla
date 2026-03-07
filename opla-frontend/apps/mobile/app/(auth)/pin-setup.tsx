/**
 * PIN setup screen — shown after first successful online auth.
 * User creates a 4-digit PIN, confirms it, then the session becomes authenticated.
 */
import { useState } from 'react';
import {
  View, Text, TouchableOpacity, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';

type Phase = 'create' | 'confirm';

const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, 'del'] as const;

function PinDots({ value, length = 4 }: { value: string; length?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 20, justifyContent: 'center', marginVertical: 32 }}>
      {Array.from({ length }).map((_, i) => (
        <View
          key={i}
          style={{
            width: 18, height: 18, borderRadius: 9,
            backgroundColor: i < value.length ? '#158754' : '#1e293b',
            borderWidth: 2, borderColor: i < value.length ? '#158754' : '#334155',
          }}
        />
      ))}
    </View>
  );
}

function Keypad({ onPress }: { onPress: (key: typeof DIGITS[number]) => void }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', width: 280, alignSelf: 'center', gap: 12 }}>
      {DIGITS.map((d, idx) => (
        <TouchableOpacity
          key={idx}
          onPress={() => onPress(d)}
          disabled={d === null}
          style={{
            width: 80, height: 80, borderRadius: 40,
            backgroundColor: d === null ? 'transparent' : '#1e293b',
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Text style={{ color: '#f1f5f9', fontSize: d === 'del' ? 20 : 26, fontWeight: '600' }}>
            {d === 'del' ? '⌫' : d === null ? '' : d}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export default function PinSetupScreen() {
  const { setupPin } = useAuth();
  const [phase, setPhase] = useState<Phase>('create');
  const [firstPin, setFirstPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const current = phase === 'create' ? firstPin : confirmPin;
  const setter = phase === 'create' ? setFirstPin : setConfirmPin;

  const handleKey = (key: typeof DIGITS[number]) => {
    if (key === null) return;
    setError('');
    if (key === 'del') {
      setter(prev => prev.slice(0, -1));
      return;
    }
    const next = current + String(key);
    setter(next);

    if (next.length === 4) {
      if (phase === 'create') {
        setTimeout(() => setPhase('confirm'), 200);
      } else {
        // confirm step
        setTimeout(async () => {
          if (next !== firstPin) {
            setError('PINs do not match — try again');
            setFirstPin('');
            setConfirmPin('');
            setPhase('create');
            return;
          }
          setLoading(true);
          try {
            await setupPin(next);
          } catch (e: any) {
            setError(e?.message ?? 'Could not save PIN');
          } finally {
            setLoading(false);
          }
        }, 200);
      }
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#0f172a' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        {/* Header */}
        <View style={{
          width: 64, height: 64, borderRadius: 20,
          backgroundColor: '#1e293b', alignItems: 'center', justifyContent: 'center',
          marginBottom: 20,
        }}>
          <Text style={{ fontSize: 30 }}>🔐</Text>
        </View>
        <Text style={{ fontSize: 24, fontWeight: '800', color: '#f1f5f9', marginBottom: 8 }}>
          {phase === 'create' ? 'Create your PIN' : 'Confirm your PIN'}
        </Text>
        <Text style={{ fontSize: 14, color: '#94a3b8', textAlign: 'center', lineHeight: 20 }}>
          {phase === 'create'
            ? 'Choose a 4-digit PIN to quickly unlock the app.\nValid for 7 days from today.'
            : 'Enter the same PIN again to confirm.'}
        </Text>

        <PinDots value={current} />

        {error ? (
          <View style={{
            backgroundColor: '#450a0a', borderRadius: 10, padding: 12,
            borderWidth: 1, borderColor: '#991b1b', marginBottom: 16, width: '100%',
          }}>
            <Text style={{ color: '#fca5a5', fontSize: 13, textAlign: 'center' }}>{error}</Text>
          </View>
        ) : null}

        {loading
          ? <ActivityIndicator color="#158754" size="large" style={{ marginTop: 20 }} />
          : <Keypad onPress={handleKey} />
        }

        {/* Step indicator */}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 32 }}>
          {(['create', 'confirm'] as Phase[]).map(p => (
            <View key={p} style={{
              width: 8, height: 8, borderRadius: 4,
              backgroundColor: phase === p ? '#158754' : '#1e293b',
            }} />
          ))}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
