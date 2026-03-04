/**
 * PIN entry screen — shown when user has a valid (non-expired) PIN session.
 * Displays remaining days, keypad, and option to force online re-auth.
 */
import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { pinDaysRemaining } from '../../services/authService';

const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, 'del'] as const;

function PinDots({ value, shake, length = 4 }: { value: string; shake: boolean; length?: number }) {
  return (
    <View style={{
      flexDirection: 'row', gap: 20, justifyContent: 'center', marginVertical: 32,
      transform: [{ translateX: shake ? 8 : 0 }],
    }}>
      {Array.from({ length }).map((_, i) => (
        <View
          key={i}
          style={{
            width: 18, height: 18, borderRadius: 9,
            backgroundColor: i < value.length
              ? (shake ? '#ef4444' : '#6366f1')
              : '#1e293b',
            borderWidth: 2,
            borderColor: i < value.length
              ? (shake ? '#ef4444' : '#6366f1')
              : '#334155',
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

export default function PinEntryScreen() {
  const { loginWithPin, logout } = useAuth();
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const [error, setError] = useState('');
  const [daysLeft, setDaysLeft] = useState<number | null>(null);

  useEffect(() => {
    pinDaysRemaining().then(setDaysLeft);
  }, []);

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const handleKey = (key: typeof DIGITS[number]) => {
    if (key === null) return;
    if (loading) return;
    setError('');
    if (key === 'del') {
      setPin(prev => prev.slice(0, -1));
      return;
    }
    const next = pin + String(key);
    setPin(next);

    if (next.length === 4) {
      setTimeout(async () => {
        setLoading(true);
        try {
          await loginWithPin(next);
          // AuthContext will set status → RootGuard routes away
        } catch (e: any) {
          triggerShake();
          setError(e?.message ?? 'Incorrect PIN');
          setPin('');
        } finally {
          setLoading(false);
        }
      }, 100);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
      {/* Header */}
      <View style={{
        width: 64, height: 64, borderRadius: 20,
        backgroundColor: '#1e293b', alignItems: 'center', justifyContent: 'center',
        marginBottom: 20,
      }}>
        <Text style={{ fontSize: 30 }}>🔒</Text>
      </View>
      <Text style={{ fontSize: 24, fontWeight: '800', color: '#f1f5f9', marginBottom: 6 }}>
        Welcome back
      </Text>
      <Text style={{ fontSize: 14, color: '#94a3b8', textAlign: 'center' }}>
        Enter your 4-digit PIN to continue
      </Text>
      {daysLeft !== null && (
        <View style={{
          marginTop: 12, backgroundColor: '#1e293b', borderRadius: 20,
          paddingHorizontal: 14, paddingVertical: 6,
        }}>
          <Text style={{ fontSize: 12, color: '#6366f1', fontWeight: '600' }}>
            PIN expires in {daysLeft} day{daysLeft !== 1 ? 's' : ''}
          </Text>
        </View>
      )}

      <PinDots value={pin} shake={shake} />

      {error ? (
        <View style={{
          backgroundColor: '#450a0a', borderRadius: 10, padding: 12,
          borderWidth: 1, borderColor: '#991b1b', marginBottom: 16, width: '100%',
        }}>
          <Text style={{ color: '#fca5a5', fontSize: 13, textAlign: 'center' }}>{error}</Text>
        </View>
      ) : null}

      {loading
        ? <ActivityIndicator color="#6366f1" size="large" />
        : <Keypad onPress={handleKey} />
      }

      {/* Fallback to online login */}
      <TouchableOpacity
        onPress={() => logout()}
        style={{ marginTop: 32, alignItems: 'center' }}
      >
        <Text style={{ color: '#475569', fontSize: 14 }}>
          Sign in with a different account
        </Text>
      </TouchableOpacity>
    </View>
  );
}
