import { Redirect, useLocalSearchParams } from 'expo-router';

/** Legacy project-forms route → capture. */
export default function LegacyProjectFormsRedirect() {
  const params = useLocalSearchParams();
  return (
    <Redirect
      href={{
        pathname: '/(main)/(agent)/capture/[projectId]',
        params,
      }}
    />
  );
}
