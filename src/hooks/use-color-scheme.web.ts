import { useColorScheme as useRNColorScheme } from 'react-native';

// Web-specific override of useColorScheme.
// We are a mobile-first app; this file exists for web builds only.
// Simplified from the template's SSR hydration pattern since we do not do server rendering.
export function useColorScheme() {
  return useRNColorScheme() ?? 'light';
}
