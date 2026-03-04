/**
 * app/(main)/(yard)/_layout.tsx — Yard tab stack.
 * Public area: survey discovery and form participation, no auth required.
 */
import { Stack } from 'expo-router';

export default function YardLayout() {
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
