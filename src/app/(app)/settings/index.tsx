import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/primary-button';
import { Spacing } from '@/constants/theme';
import { useSession } from '@/features/auth/session-provider';
import { useHousehold } from '@/features/households/household-provider';

// Settings: care recipient profile, feed schedule, caregivers, notifications, account
export default function SettingsScreen() {
  const { signOut } = useSession();
  const { household, careRecipient } = useHousehold();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    await signOut();
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Settings</Text>
      <Text style={styles.note}>Care recipient, schedule, caregivers — Milestones 2–4</Text>

      {household ? (
        <Text style={styles.info}>
          Household: {household.name}
          {careRecipient ? `\nCare recipient: ${careRecipient.name}` : ''}
          {careRecipient?.date_of_birth ? ` (born ${careRecipient.date_of_birth})` : ''}
        </Text>
      ) : null}

      <PrimaryButton
        title="Sign Out"
        onPress={handleSignOut}
        isLoading={isSigningOut}
        style={styles.signOutButton}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: '600', color: '#111' },
  note: { fontSize: 14, color: '#888', marginTop: 8, textAlign: 'center', paddingHorizontal: 32 },
  info: { fontSize: 14, color: '#333', marginTop: 24, textAlign: 'center', paddingHorizontal: 32 },
  signOutButton: { marginTop: Spacing.five, paddingHorizontal: Spacing.five },
});
