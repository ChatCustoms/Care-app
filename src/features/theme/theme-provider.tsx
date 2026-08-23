import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { DEFAULT_PALETTE_ID, Palettes, PaletteId, ThemeTokens } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

import {
  getStoredThemePreference,
  setStoredAppearanceMode,
  setStoredPaletteId,
} from './theme-storage';

// Third instance of this codebase's "Context wrapping otherwise-pure state"
// pattern — see features/auth/session-provider.tsx and
// features/households/household-provider.tsx for the first two. Same
// shape: synchronous default state so every consumer always has a real
// theme to render, then an effect hydrates the actual stored preference
// and flips `isLoading` (folded into the root splash-screen gate).

export type AppearanceMode = 'system' | 'light' | 'dark';

type ThemeContextValue = {
  paletteId: PaletteId;
  setPaletteId: (id: PaletteId) => void;
  appearanceMode: AppearanceMode;
  setAppearanceMode: (mode: AppearanceMode) => void;
  resolvedScheme: 'light' | 'dark';
  theme: ThemeTokens;
  isLoading: boolean;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [paletteId, setPaletteIdState] = useState<PaletteId>(DEFAULT_PALETTE_ID);
  const [appearanceMode, setAppearanceModeState] = useState<AppearanceMode>('system');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getStoredThemePreference().then((stored) => {
      setPaletteIdState(stored.paletteId);
      setAppearanceModeState(stored.appearanceMode);
      setIsLoading(false);
    });
  }, []);

  const setPaletteId = useCallback((id: PaletteId) => {
    setPaletteIdState(id);
    setStoredPaletteId(id);
  }, []);

  const setAppearanceMode = useCallback((mode: AppearanceMode) => {
    setAppearanceModeState(mode);
    setStoredAppearanceMode(mode);
  }, []);

  const resolvedScheme: 'light' | 'dark' =
    appearanceMode === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : appearanceMode;

  const theme = Palettes[paletteId][resolvedScheme];

  const value = useMemo<ThemeContextValue>(
    () => ({
      paletteId,
      setPaletteId,
      appearanceMode,
      setAppearanceMode,
      resolvedScheme,
      theme,
      isLoading,
    }),
    [paletteId, setPaletteId, appearanceMode, setAppearanceMode, resolvedScheme, theme, isLoading]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeContext(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useThemeContext must be used within a ThemeProvider');
  return context;
}
