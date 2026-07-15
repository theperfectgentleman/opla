import { Redirect } from 'expo-router';

/** Legacy route group — redirects to (pulse). */
export default function LegacyPulseLayout() {
  return <Redirect href="/(main)/(pulse)" />;
}
