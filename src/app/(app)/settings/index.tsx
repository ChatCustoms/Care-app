import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/primary-button';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { UnitSelector } from '@/components/unit-selector';
import { Spacing } from '@/constants/theme';
import { useSession } from '@/features/auth/session-provider';
import {
  createFeedPreset,
  deleteFeedPreset,
  FeedPreset,
  fetchFeedPresets,
} from '@/features/feeds/api';
import { useHousehold } from '@/features/households/household-provider';
import { FeedUnit } from '@/types';

export default function SettingsScreen() {
  const { signOut } = useSession();
  const {
    household,
    careRecipient,
    updateFeedInterval,
    caregivers,
    refreshCaregivers,
    inviteCaregiver,
  } = useHousehold();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const [inviteEmail, setInviteEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState(false);

  const [intervalInput, setIntervalInput] = useState(
    careRecipient ? String(careRecipient.feed_interval_minutes) : ''
  );
  const [isSavingInterval, setIsSavingInterval] = useState(false);
  const [intervalError, setIntervalError] = useState<string | null>(null);

  const [presets, setPresets] = useState<FeedPreset[]>([]);
  const [newAmount, setNewAmount] = useState('');
  const [newUnit, setNewUnit] = useState<FeedUnit>('oz');
  const [isAddingPreset, setIsAddingPreset] = useState(false);
  const [presetError, setPresetError] = useState<string | null>(null);
  const [deletingPresetId, setDeletingPresetId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!careRecipient) return;
      setIntervalInput(String(careRecipient.feed_interval_minutes));
      fetchFeedPresets(careRecipient.id).then(setPresets);
      refreshCaregivers();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [careRecipient])
  );

  const handleSignOut = async () => {
    setIsSigningOut(true);
    await signOut();
  };

  const handleInvite = async () => {
    setInviteError(null);
    setInviteSuccess(false);
    if (inviteEmail.trim().length === 0) {
      setInviteError('Please enter an email address.');
      return;
    }
    setIsInviting(true);
    const { error } = await inviteCaregiver(inviteEmail.trim());
    setIsInviting(false);
    if (error) {
      setInviteError(error.message);
      return;
    }
    setInviteEmail('');
    setInviteSuccess(true);
  };

  const handleSaveInterval = async () => {
    setIntervalError(null);
    const minutes = Number(intervalInput);
    if (!Number.isInteger(minutes) || minutes <= 0) {
      setIntervalError('Please enter a whole number of minutes greater than 0.');
      return;
    }
    setIsSavingInterval(true);
    const { error } = await updateFeedInterval(minutes);
    setIsSavingInterval(false);
    if (error) {
      setIntervalError(error.message);
    }
  };

  const handleAddPreset = async () => {
    if (!careRecipient) return;
    setPresetError(null);
    if (newAmount.trim().length === 0 || Number(newAmount) <= 0) {
      setPresetError('Please enter an amount greater than 0.');
      return;
    }
    setIsAddingPreset(true);
    const { data, error } = await createFeedPreset(careRecipient.id, newAmount.trim(), newUnit);
    setIsAddingPreset(false);
    if (error) {
      setPresetError('Something went wrong adding that preset. Please try again.');
      return;
    }
    if (data) {
      setPresets((current) => [...current, data]);
      setNewAmount('');
    }
  };

  const handleDeletePreset = async (preset: FeedPreset) => {
    setDeletingPresetId(preset.id);
    const { error } = await deleteFeedPreset(preset.id);
    setDeletingPresetId(null);
    if (!error) {
      setPresets((current) => current.filter((p) => p.id !== preset.id));
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="title">Settings</ThemedText>

        {household ? (
          <ThemedView style={styles.section}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              Household
            </ThemedText>
            <ThemedText type="default">{household.name}</ThemedText>
            {careRecipient ? (
              <ThemedText type="default">
                {careRecipient.name}
                {careRecipient.date_of_birth ? ` (born ${careRecipient.date_of_birth})` : ''}
              </ThemedText>
            ) : null}
          </ThemedView>
        ) : null}

        {household ? (
          <ThemedView style={styles.section}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              Caregivers
            </ThemedText>

            {caregivers.map((caregiver) => (
              <ThemedText key={caregiver.user_id} type="default">
                {caregiver.email} · {caregiver.role}
              </ThemedText>
            ))}

            <ThemedView style={styles.addPresetForm}>
              <TextField
                label="Invite a caregiver by email"
                value={inviteEmail}
                onChangeText={setInviteEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
              {inviteError ? (
                <ThemedText type="small" style={styles.errorText}>
                  {inviteError}
                </ThemedText>
              ) : null}
              {inviteSuccess ? (
                <ThemedText type="small" themeColor="textSecondary">
                  Invite sent.
                </ThemedText>
              ) : null}
              <PrimaryButton title="Send Invite" onPress={handleInvite} isLoading={isInviting} />
            </ThemedView>
          </ThemedView>
        ) : null}

        {careRecipient ? (
          <ThemedView style={styles.section}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              Feed interval
            </ThemedText>
            <TextField
              label="Minutes between feeds"
              value={intervalInput}
              onChangeText={setIntervalInput}
              keyboardType="number-pad"
            />
            {intervalError ? (
              <ThemedText type="small" style={styles.errorText}>
                {intervalError}
              </ThemedText>
            ) : null}
            <PrimaryButton
              title="Save Interval"
              onPress={handleSaveInterval}
              isLoading={isSavingInterval}
            />
          </ThemedView>
        ) : null}

        {careRecipient ? (
          <ThemedView style={styles.section}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              Quick-log presets
            </ThemedText>

            {presets.map((preset) => (
              <ThemedView key={preset.id} style={styles.presetRow}>
                <ThemedText type="default">
                  {preset.amount} {preset.unit}
                </ThemedText>
                <Pressable
                  onPress={() => handleDeletePreset(preset)}
                  disabled={deletingPresetId === preset.id}
                >
                  <ThemedText type="link" style={styles.errorText}>
                    {deletingPresetId === preset.id ? 'Removing…' : 'Remove'}
                  </ThemedText>
                </Pressable>
              </ThemedView>
            ))}

            <ThemedView style={styles.addPresetForm}>
              <TextField
                label="Amount"
                value={newAmount}
                onChangeText={setNewAmount}
                keyboardType="decimal-pad"
              />
              <UnitSelector value={newUnit} onChange={setNewUnit} />
              {presetError ? (
                <ThemedText type="small" style={styles.errorText}>
                  {presetError}
                </ThemedText>
              ) : null}
              <PrimaryButton
                title="Add Preset"
                onPress={handleAddPreset}
                isLoading={isAddingPreset}
              />
            </ThemedView>
          </ThemedView>
        ) : null}

        <PrimaryButton
          title="Sign Out"
          onPress={handleSignOut}
          isLoading={isSigningOut}
          style={styles.signOutButton}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    padding: Spacing.four,
    gap: Spacing.five,
  },
  section: {
    gap: Spacing.two,
  },
  presetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  addPresetForm: {
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  errorText: {
    color: '#D92D20',
  },
  signOutButton: {
    marginTop: Spacing.three,
  },
});
