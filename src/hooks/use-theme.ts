import { ThemeTokens } from '@/constants/theme';
import { useThemeContext } from '@/features/theme/theme-provider';

/**
 * Returns the resolved token set for the active palette + light/dark mode.
 * Same external shape as before this became context-backed — every call
 * site (`const theme = useTheme()`) is unchanged.
 */
export function useTheme(): ThemeTokens {
  return useThemeContext().theme;
}
