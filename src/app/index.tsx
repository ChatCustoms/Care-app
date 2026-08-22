import { Redirect } from 'expo-router';

import { useSession } from '@/features/auth/session-provider';
import { useHousehold } from '@/features/households/household-provider';

export default function Index() {
  const { session } = useSession();
  const { household, careRecipient } = useHousehold();

  if (!session) return <Redirect href="/(auth)/sign-in" />;
  if (!household || !careRecipient) return <Redirect href="/(onboarding)" />;
  return <Redirect href="/(app)/today" />;
}
