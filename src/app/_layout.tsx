import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';

import { SessionProvider, useSession } from '@/features/auth/session-provider';
import { HouseholdProvider, useHousehold } from '@/features/households/household-provider';
import { ThemeProvider, useThemeContext } from '@/features/theme/theme-provider';

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { session, isLoading: isSessionLoading } = useSession();
  const { household, careRecipient, isLoading: isHouseholdLoading } = useHousehold();
  const { resolvedScheme, isLoading: isThemeLoading } = useThemeContext();

  const isLoading = isSessionLoading || (!!session && isHouseholdLoading) || isThemeLoading;
  const isOnboarded = !!household && !!careRecipient;

  useEffect(() => {
    if (!isLoading) SplashScreen.hideAsync();
  }, [isLoading]);

  if (isLoading) return null;

  return (
    <>
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
      <StatusBar style={resolvedScheme === 'dark' ? 'light' : 'dark'} />
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <SessionProvider>
        <HouseholdProvider>
          <RootNavigator />
        </HouseholdProvider>
      </SessionProvider>
    </ThemeProvider>
  );
}
