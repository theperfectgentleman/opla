/**
 * app/(main)/_layout.tsx — Bottom tab bar with Yard and Desk tabs.
 * Desk tab requires authentication; Yard is always accessible.
 */
import { Tabs, useRouter } from 'expo-router';
import { TouchableOpacity, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';

function TabIcon({ icon, label, focused, locked }: {
  icon: string; label: string; focused: boolean; locked?: boolean;
}) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', paddingTop: 6 }}>
      <Text style={{ fontSize: 22, opacity: locked ? 0.35 : 1 }}>{icon}</Text>
      <Text style={{
        fontSize: 10, marginTop: 2, fontWeight: focused ? '700' : '500',
        color: focused ? '#6366f1' : locked ? '#334155' : '#64748b',
      }}>
        {label}
      </Text>
      {locked && (
        <Text style={{ fontSize: 9, color: '#475569', marginTop: 1 }}>🔒</Text>
      )}
    </View>
  );
}

export default function MainLayout() {
  const { status } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isAuthenticated = status === 'authenticated';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#0f172a',
          borderTopColor: '#1e293b',
          borderTopWidth: 1,
          height: 56 + insets.bottom,
          paddingBottom: insets.bottom,
        },
        tabBarActiveTintColor: '#6366f1',
        tabBarInactiveTintColor: '#64748b',
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="(yard)"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="🌿" label="Yard" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="(desk)"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="💼" label="Desk" focused={focused} locked={!isAuthenticated} />
          ),
          tabBarButton: isAuthenticated
            ? undefined
            : (props) => (
                <TouchableOpacity
                  {...(props as any)}
                  onPress={() => router.push('/(auth)/login')}
                />
              ),
        }}
      />
    </Tabs>
  );
}
