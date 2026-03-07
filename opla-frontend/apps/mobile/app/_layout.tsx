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
    const inYard = segments[0] === '(main)' && segments[1] === '(yard)';

    if (status === 'unauthenticated') {
      if (inAuth) {
        if (pathname !== '/login') {
          router.replace(buildAuthHref('/(auth)/login', redirectTarget));
        }
        return;
      }
      if (!inYard) {
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
      router.replace((redirectTarget || '/(main)/(yard)') as Href);
    }
  }, [currentPath, pathname, redirectTarget, router, segments, status]);

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
