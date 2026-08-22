import { Redirect } from 'expo-router';

// Milestone 1 will check auth state and redirect to (auth)/sign-in if unauthenticated.
// For now, always go to the app.
export default function Index() {
  return <Redirect href="/(app)/today" />;
}
