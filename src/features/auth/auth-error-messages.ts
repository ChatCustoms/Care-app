import { AuthError } from '@supabase/supabase-js';

const KNOWN_MESSAGES: Record<string, string> = {
  'Invalid login credentials': "That email or password doesn't match our records. Please try again.",
  'User already registered': 'An account with this email already exists. Try signing in instead.',
  'Password should be at least 6 characters': 'Please use a password with at least 6 characters.',
};

export function toCalmAuthMessage(error: AuthError): string {
  const known = KNOWN_MESSAGES[error.message];
  if (known) return known;

  console.warn('Unmapped auth error:', error.message);
  return 'Something went wrong. Please try again.';
}
