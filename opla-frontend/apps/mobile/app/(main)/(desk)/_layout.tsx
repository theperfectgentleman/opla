import { Redirect } from 'expo-router';

/** Legacy route group — redirects to (agent). */
export default function LegacyDeskLayout() {
  return <Redirect href="/(main)/(agent)" />;
}
