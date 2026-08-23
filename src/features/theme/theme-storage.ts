import AsyncStorage from '@react-native-async-storage/async-storage';

import { AppearanceMode } from './theme-provider';
import { DEFAULT_PALETTE_ID, PaletteId } from '@/constants/theme';

// Isolates the third-party SDK behind a thin seam, matching how
// lib/supabase/client.ts isolates the Supabase SDK — a single place to
// swap or extend if more UI preferences accumulate later.
const PALETTE_KEY = 'theme:paletteId';
const APPEARANCE_MODE_KEY = 'theme:appearanceMode';

const VALID_PALETTE_IDS: PaletteId[] = ['meadow', 'sky', 'sunset', 'clay'];
const VALID_APPEARANCE_MODES: AppearanceMode[] = ['system', 'light', 'dark'];

export type StoredThemePreference = {
  paletteId: PaletteId;
  appearanceMode: AppearanceMode;
};

export async function getStoredThemePreference(): Promise<StoredThemePreference> {
  const [storedPaletteId, storedAppearanceMode] = await Promise.all([
    AsyncStorage.getItem(PALETTE_KEY),
    AsyncStorage.getItem(APPEARANCE_MODE_KEY),
  ]);

  return {
    paletteId: VALID_PALETTE_IDS.includes(storedPaletteId as PaletteId)
      ? (storedPaletteId as PaletteId)
      : DEFAULT_PALETTE_ID,
    appearanceMode: VALID_APPEARANCE_MODES.includes(storedAppearanceMode as AppearanceMode)
      ? (storedAppearanceMode as AppearanceMode)
      : 'system',
  };
}

export async function setStoredPaletteId(paletteId: PaletteId): Promise<void> {
  await AsyncStorage.setItem(PALETTE_KEY, paletteId);
}

export async function setStoredAppearanceMode(appearanceMode: AppearanceMode): Promise<void> {
  await AsyncStorage.setItem(APPEARANCE_MODE_KEY, appearanceMode);
}
