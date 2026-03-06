/**
 * app/_layout.tsx — Root layout
 * Sets up AuthProvider and handles routing based on auth status.
 */
import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { AppThemeProvider } from '../contexts/AppThemeContext';

function RootGuard() {
  const { status } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (status === 'loading') return;

    const inAuth = segments[0] === '(auth)';
    const inMain = segments[0] === '(main)';

    if (status === 'unauthenticated' && !inAuth) {
      // No session at all → public landing (Yard is accessible without auth)
      router.replace('/(main)/(yard)');
    } else if (status === 'needs_online' && !inAuth) {
      router.replace('/(auth)/login');
    } else if (status === 'needs_pin' && !inAuth) {
      router.replace('/(auth)/pin-setup');
    } else if (status === 'pin_ready' && !inAuth) {
      router.replace('/(auth)/pin-entry');
    } else if (status === 'authenticated' && inAuth) {
      router.replace('/(main)/(yard)');
    }
  }, [status, segments]);

  return null;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppThemeProvider>
          <AuthProvider>
            <RootGuard />
            <StatusBar style="light" />
            <Stack screenOptions={{ headerShown: false }} />
          </AuthProvider>
        </AppThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
