/**
 * app/(main)/(desk)/_layout.tsx — Desk tab stack.
 * Org workspace area: auth-required. Stack routes for assigned forms and messaging.
 */
import { Stack } from 'expo-router';

export default function DeskLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#0f172a' },
        animation: 'slide_from_right',
      }}
    />
  );
}
