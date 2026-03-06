import { Tabs } from 'expo-router';
import { View, TouchableOpacity, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Layers, Zap, Target, User } from 'lucide-react-native';
import { useAppTheme } from '../../contexts/AppThemeContext';

function CustomTabBar({ state, navigation }: any) {
  const { mode } = useAppTheme();
  const insets = useSafeAreaInsets();

  const currentRouteName = state.routes[state.index].name;
  const isFeed = currentRouteName === '(yard)' || currentRouteName === '(desk)';
  const isProfile = currentRouteName === 'profile';

  return (
    <View style={[{
      position: 'absolute',
      bottom: 0,
      width: '100%',
      height: 72 + insets.bottom,
      borderTopWidth: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-around',
      paddingHorizontal: 24,
      paddingBottom: insets.bottom,
    },
    mode === 'pulse'
      ? { backgroundColor: 'rgba(255,255,255,0.95)', borderTopColor: '#f1f5f9' }
      : { backgroundColor: 'rgba(2,6,23,0.95)', borderTopColor: '#1e293b' }
    ]}>

      <TouchableOpacity
        onPress={() => {
          if (mode === 'pulse') navigation.navigate('(yard)');
          else navigation.navigate('(desk)');
        }}
        activeOpacity={0.7}
        style={{ alignItems: 'center', gap: 4 }}
      >
        <Layers
          size={24}
          color={isFeed ? (mode === 'pulse' ? '#0f172a' : '#22d3ee') : '#94a3b8'}
          strokeWidth={isFeed ? 2.5 : 2}
        />
        <Text style={{
          fontSize: 10,
          fontWeight: '700',
          color: isFeed ? (mode === 'pulse' ? '#0f172a' : '#22d3ee') : '#94a3b8'
        }}>Feed</Text>
      </TouchableOpacity>

      <TouchableOpacity
        activeOpacity={0.9}
        style={[{
          width: 56, height: 56, borderRadius: 28,
          alignItems: 'center', justifyContent: 'center',
          marginTop: -32,
          shadowColor: mode === 'pulse' ? '#f59e0b' : '#22d3ee',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 8,
        }, mode === 'pulse' ? { backgroundColor: '#fbbf24' } : { backgroundColor: '#06b6d4' }]}
      >
        {mode === 'pulse' ? <Zap size={24} color="#0f172a" fill="#0f172a" /> : <Target size={24} color="#0f172a" />}
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => navigation.navigate('profile')}
        activeOpacity={0.7}
        style={{ alignItems: 'center', gap: 4 }}
      >
        <User
          size={24}
          color={isProfile ? (mode === 'pulse' ? '#0f172a' : '#22d3ee') : '#94a3b8'}
          strokeWidth={isProfile ? 2.5 : 2}
        />
        <Text style={{
          fontSize: 10,
          fontWeight: '700',
          color: isProfile ? (mode === 'pulse' ? '#0f172a' : '#22d3ee') : '#94a3b8'
        }}>Profile</Text>
      </TouchableOpacity>

    </View>
  );
}

export default function MainLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={props => <CustomTabBar {...props} />}
    >
      <Tabs.Screen name="(yard)" />
      <Tabs.Screen name="(desk)" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
