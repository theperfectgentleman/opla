/**
 * app/_layout.tsx — Root layout
 * Sets up AuthProvider and handles routing based on auth status.
 */
import { useEffect, useMemo } from 'react';
import { Stack, useGlobalSearchParams, usePathname, useRouter, useSegments, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { AppThemeProvider } from '../contexts/AppThemeContext';
import { useFonts } from 'expo-font';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import {
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
} from '@expo-google-fonts/outfit';
import {
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';
import {
  Lora_400Regular,
  Lora_400Regular_Italic,
  Lora_700Bold,
} from '@expo-google-fonts/lora';
import * as SplashScreen from 'expo-splash-screen';

SplashScreen.preventAutoHideAsync().catch(() => {});

function RootGuard() {
  const { status } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const pathname = usePathname();
  const globalSearchParams = useGlobalSearchParams();

  const currentPath = useMemo(() => {
    const query = new URLSearchParams();
    Object.entries(globalSearchParams).forEach(([key, value]) => {
      if (key === 'redirect' || value == null) return;
      if (Array.isArray(value)) {
        value.forEach((item) => {
          if (item != null) {
            query.append(key, String(item));
          }
        });
        return;
      }
      query.append(key, String(value));
    });
    const suffix = query.toString();
    return `${pathname}${suffix ? `?${suffix}` : ''}`;
  }, [globalSearchParams, pathname]);

  const redirectTarget = useMemo(() => {
    const redirect = globalSearchParams.redirect;
    const value = Array.isArray(redirect) ? redirect[0] : redirect;
    if (!value || typeof value !== 'string' || !value.startsWith('/')) {
      return null;
    }
    if (value.startsWith('/login') || value.startsWith('/pin-entry') || value.startsWith('/pin-setup')) {
      return null;
    }
    return value;
  }, [globalSearchParams.redirect]);

  const buildAuthHref = (
    authPath: '/(auth)/login' | '/(auth)/pin-setup' | '/(auth)/pin-entry',
    redirect: string | null,
  ): Href => {
    if (!redirect) return authPath;
    return { pathname: authPath, params: { redirect } };
  };

  useEffect(() => {
    if (status === 'loading') return;

    const inAuth = segments[0] === '(auth)';
    const inPulse = segments[0] === '(main)' && segments[1] === '(pulse)';

    if (status === 'unauthenticated') {
      if (inAuth) {
        if (pathname !== '/login') {
          router.replace(buildAuthHref('/(auth)/login', redirectTarget));
        }
        return;
      }
      if (!inPulse) {
        router.replace(buildAuthHref('/(auth)/login', currentPath));
        return;
      }
      return;
    }

    if (status === 'needs_online') {
      if (!inAuth || pathname !== '/login') {
        router.replace(buildAuthHref('/(auth)/login', inAuth ? redirectTarget : currentPath));
      }
      return;
    }

    if (status === 'needs_pin') {
      if (!inAuth || pathname !== '/pin-setup') {
        router.replace(buildAuthHref('/(auth)/pin-setup', inAuth ? redirectTarget : currentPath));
      }
      return;
    }

    if (status === 'pin_ready') {
      if (!inAuth || pathname !== '/pin-entry') {
        router.replace(buildAuthHref('/(auth)/pin-entry', inAuth ? redirectTarget : currentPath));
      }
      return;
    }

    if (status === 'authenticated' && inAuth) {
      router.replace((redirectTarget || '/(main)/(pulse)') as Href);
    }
  }, [currentPath, pathname, redirectTarget, router, segments, status]);

  return null;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    'PlusJakartaSans-Regular': PlusJakartaSans_400Regular,
    'PlusJakartaSans-Medium': PlusJakartaSans_500Medium,
    'PlusJakartaSans-SemiBold': PlusJakartaSans_600SemiBold,
    'PlusJakartaSans-Bold': PlusJakartaSans_700Bold,
    'Inter-Regular': Inter_400Regular,
    'Inter-Medium': Inter_500Medium,
    'Inter-SemiBold': Inter_600SemiBold,
    'Inter-Bold': Inter_700Bold,
    'Outfit-Regular': Outfit_400Regular,
    'Outfit-Medium': Outfit_500Medium,
    'Outfit-SemiBold': Outfit_600SemiBold,
    'Outfit-Bold': Outfit_700Bold,
    'SpaceGrotesk-Medium': SpaceGrotesk_500Medium,
    'SpaceGrotesk-SemiBold': SpaceGrotesk_600SemiBold,
    'SpaceGrotesk-Bold': SpaceGrotesk_700Bold,
    'Lora-Regular': Lora_400Regular,
    'Lora-Italic': Lora_400Regular_Italic,
    'Lora-Bold': Lora_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

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
