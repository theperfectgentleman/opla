import { Redirect, useLocalSearchParams } from 'expo-router';

/** Legacy journey route → tasks/today. */
export default function LegacyJourneyRedirect() {
  const params = useLocalSearchParams();
  return (
    <Redirect
      href={{
        pathname: '/(main)/(agent)/tasks/today/[projectId]',
        params,
      }}
    />
  );
}
