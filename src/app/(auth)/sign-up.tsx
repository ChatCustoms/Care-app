import { Link } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/primary-button';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { toCalmAuthMessage } from '@/features/auth/auth-error-messages';
import { useSession } from '@/features/auth/session-provider';

export default function SignUpScreen() {
  const { signUp } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [needsEmailConfirmation, setNeedsEmailConfirmation] = useState(false);

  const canSubmit = email.trim().length > 0 && password.length > 0 && !isSubmitting;

  const handleSubmit = async () => {
    setErrorMessage(null);
    setIsSubmitting(true);
    const { error, needsEmailConfirmation: needsConfirmation } = await signUp(email.trim(), password);
    if (error) {
      setErrorMessage(toCalmAuthMessage(error));
      setIsSubmitting(false);
      return;
    }
    if (needsConfirmation) {
      setNeedsEmailConfirmation(true);
    }
  };

  if (needsEmailConfirmation) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ThemedText type="title">Check your email</ThemedText>
          <ThemedText type="default">
            We sent a confirmation link to {email.trim()}. Confirm your email, then sign in.
          </ThemedText>
          <Link href="/sign-in">
            <ThemedText type="link">Back to sign in</ThemedText>
          </Link>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="title">Create Account</ThemedText>

        <ThemedView style={styles.form}>
          <TextField
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            textContentType="emailAddress"
          />
          <TextField
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType="newPassword"
          />
          {errorMessage ? (
            <ThemedText type="small" style={styles.errorText}>
              {errorMessage}
            </ThemedText>
          ) : null}
          <PrimaryButton title="Sign Up" onPress={handleSubmit} disabled={!canSubmit} isLoading={isSubmitting} />
        </ThemedView>

        <Link href="/sign-in">
          <ThemedText type="link">Already have an account? Sign in</ThemedText>
        </Link>
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
