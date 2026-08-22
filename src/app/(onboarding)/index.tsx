import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/primary-button';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useHousehold } from '@/features/households/household-provider';

const DATE_OF_BIRTH_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export default function OnboardingScreen() {
  const { createHousehold, createCareRecipient } = useHousehold();
  const [step, setStep] = useState<'household' | 'recipient'>('household');

  const [householdName, setHouseholdName] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleCreateHousehold = async () => {
    setErrorMessage(null);
    setIsSubmitting(true);
    const { error } = await createHousehold(householdName.trim());
    setIsSubmitting(false);
    if (error) {
      setErrorMessage('Something went wrong creating your household. Please try again.');
      return;
    }
    setStep('recipient');
  };

  const handleCreateCareRecipient = async () => {
    setErrorMessage(null);

    const trimmedDob = dateOfBirth.trim();
    if (trimmedDob.length > 0 && !DATE_OF_BIRTH_PATTERN.test(trimmedDob)) {
      setErrorMessage('Please enter the date of birth as YYYY-MM-DD, or leave it blank.');
      return;
    }

    setIsSubmitting(true);
    const { error } = await createCareRecipient(recipientName.trim(), trimmedDob.length > 0 ? trimmedDob : null);
    setIsSubmitting(false);
    if (error) {
      setErrorMessage('Something went wrong adding your care recipient. Please try again.');
    }
  };

  if (step === 'household') {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ThemedText type="title">Create Your Household</ThemedText>
          <ThemedText type="default" themeColor="textSecondary">
            Give your household a name. You can add other caregivers later.
          </ThemedText>

          <ThemedView style={styles.form}>
            <TextField label="Household name" value={householdName} onChangeText={setHouseholdName} />
            {errorMessage ? (
              <ThemedText type="small" style={styles.errorText}>
                {errorMessage}
              </ThemedText>
            ) : null}
            <PrimaryButton
              title="Continue"
              onPress={handleCreateHousehold}
              disabled={householdName.trim().length === 0 || isSubmitting}
              isLoading={isSubmitting}
            />
          </ThemedView>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="title">Add a Care Recipient</ThemedText>
        <ThemedText type="default" themeColor="textSecondary">
          Who will you be caring for?
        </ThemedText>

        <ThemedView style={styles.form}>
          <TextField label="Name" value={recipientName} onChangeText={setRecipientName} />
          <TextField
            label="Date of birth (YYYY-MM-DD, optional)"
            value={dateOfBirth}
            onChangeText={setDateOfBirth}
            keyboardType="numbers-and-punctuation"
          />
          {errorMessage ? (
            <ThemedText type="small" style={styles.errorText}>
              {errorMessage}
            </ThemedText>
          ) : null}
          <PrimaryButton
            title="Finish"
            onPress={handleCreateCareRecipient}
            disabled={recipientName.trim().length === 0 || isSubmitting}
            isLoading={isSubmitting}
          />
        </ThemedView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.four,
  },
  form: {
    gap: Spacing.three,
  },
  errorText: {
    color: '#D92D20',
  },
});
