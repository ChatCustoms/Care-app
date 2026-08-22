import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { SessionProvider, useSession } from '@/features/auth/session-provider';
import { HouseholdProvider, useHousehold } from '@/features/households/household-provider';

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { session, isLoading: isSessionLoading } = useSession();
  const { household, careRecipient, isLoading: isHouseholdLoading } = useHousehold();

  const isLoading = isSessionLoading || (!!session && isHouseholdLoading);
  const isOnboarded = !!household && !!careRecipient;

  useEffect(() => {
    if (!isLoading) SplashScreen.hideAsync();
  }, [isLoading]);

  if (isLoading) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Protected guard={!!session && isOnboarded}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={!!session && !isOnboarded}>
        <Stack.Screen name="(onboarding)" />
      </Stack.Protected>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <SessionProvider>
      <HouseholdProvider>
        <RootNavigator />
        <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      </HouseholdProvider>
    </SessionProvider>
  );
}
