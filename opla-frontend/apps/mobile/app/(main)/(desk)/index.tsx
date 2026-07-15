import { Redirect } from 'expo-router';

/** Legacy (desk) home → agent Today. */
export default function LegacyDeskHomeRedirect() {
  return <Redirect href="/(main)/(agent)" />;
}
