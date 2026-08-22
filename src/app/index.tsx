import { Redirect } from 'expo-router';

import { useSession } from '@/features/auth/session-provider';

export default function Index() {
  const { session } = useSession();
  return <Redirect href={session ? '/(app)/today' : '/(auth)/sign-in'} />;
}
