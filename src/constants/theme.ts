/**
 * The app's theme system: a small catalog of user-selectable color palettes,
 * each with a light and dark variant. Category accents (feed/diaper/
 * medication/note/appointment) and urgency status colors are deliberately
 * held constant across every palette — they're a semantic/wayfinding
 * vocabulary (e.g. "diaper = blue", "overdue = red"), not part of a
 * palette's decorative mood. What actually varies between palettes is the
 * neutral background/text scale and the brand `tint` used for primary
 * actions — that's what gives each palette its distinct character.
 */

import { Platform } from 'react-native';

export type ThemeTokens = {
  background: string;
  backgroundElement: string;
  backgroundSelected: string;
  text: string;
  textSecondary: string;
  border: string;
  tint: string;
  /**
   * Text/icon color for content drawn on top of `tint` (e.g. white on a
   * primary button). Not always white — this app's dark-mode tints are
   * deliberately light/pastel accents against a dark background, so white
   * text on them fails WCAG contrast; authored per palette+scheme rather
   * than computed, matching how the rest of this theme system works.
   */
  tintText: string;
  feedAccent: string;
  feedAccentSoft: string;
  diaperAccent: string;
  diaperAccentSoft: string;
  medicationAccent: string;
  medicationAccentSoft: string;
  noteAccent: string;
  noteAccentSoft: string;
  appointmentAccent: string;
  appointmentAccentSoft: string;
  statusWarning: string;
  statusUrgent: string;
  statusCritical: string;
  statusSuccess: string;
};

type NeutralTokenKey =
  | 'background'
  | 'backgroundElement'
  | 'backgroundSelected'
  | 'text'
  | 'textSecondary'
  | 'border'
  | 'tint'
  | 'tintText';
type CategoryAndStatusTokens = Omit<ThemeTokens, NeutralTokenKey>;

// Held constant across every palette — see file header.
const CATEGORY_AND_STATUS_TOKENS: {
  light: CategoryAndStatusTokens;
  dark: CategoryAndStatusTokens;
} = {
  light: {
    feedAccent: '#C7862B',
    feedAccentSoft: '#F6E7CF',
    diaperAccent: '#3D7EA6',
    diaperAccentSoft: '#DCEBF3',
    medicationAccent: '#7A5C9E',
    medicationAccentSoft: '#EAE1F4',
    noteAccent: '#B15A6B',
    noteAccentSoft: '#F5DEE1',
    appointmentAccent: '#BC5A34',
    appointmentAccentSoft: '#F5DDCB',
    statusWarning: '#B8730A',
    statusUrgent: '#2E6E8E',
    statusCritical: '#B3261E',
    statusSuccess: '#3E7A45',
  },
  dark: {
    feedAccent: '#E3A863',
    feedAccentSoft: '#3A2E1C',
    diaperAccent: '#7CB8DE',
    diaperAccentSoft: '#1D2E38',
    medicationAccent: '#B79AD9',
    medicationAccentSoft: '#2C2438',
    noteAccent: '#E092A0',
    noteAccentSoft: '#392126',
    appointmentAccent: '#E0925F',
    appointmentAccentSoft: '#3A2519',
    statusWarning: '#E3A63F',
    statusUrgent: '#6FB4DA',
    statusCritical: '#E5837C',
    statusSuccess: '#83C08C',
  },
};

export type PaletteId = 'meadow' | 'sky' | 'sunset' | 'clay';

export const PALETTE_LABEL: Record<PaletteId, string> = {
  meadow: 'Meadow',
  sky: 'Sky',
  sunset: 'Sunset',
  clay: 'Clay',
};

export const Palettes: Record<PaletteId, { light: ThemeTokens; dark: ThemeTokens }> = {
  meadow: {
    light: {
      background: '#FBFAF6',
      backgroundElement: '#F1EEE4',
      backgroundSelected: '#E5E1D3',
      text: '#2B2A25',
      textSecondary: '#6B685C',
      border: '#DEDACB',
      tint: '#4F7A5B',
      tintText: '#FFFFFF',
      ...CATEGORY_AND_STATUS_TOKENS.light,
    },
    dark: {
      background: '#1B1D18',
      backgroundElement: '#262922',
      backgroundSelected: '#32362C',
      text: '#F3F1E9',
      textSecondary: '#B5B2A4',
      border: '#3D4136',
      tint: '#7FAE8C',
      tintText: '#000000',
      ...CATEGORY_AND_STATUS_TOKENS.dark,
    },
  },
  sky: {
    light: {
      background: '#F7F9FC',
      backgroundElement: '#EBF0F7',
      backgroundSelected: '#DCE6F2',
      text: '#232A33',
      textSecondary: '#626E7C',
      border: '#D6E0EC',
      tint: '#3E6FA8',
      tintText: '#FFFFFF',
      ...CATEGORY_AND_STATUS_TOKENS.light,
    },
    dark: {
      background: '#171B21',
      backgroundElement: '#212730',
      backgroundSelected: '#2B323D',
      text: '#EFF2F6',
      textSecondary: '#A9B2BF',
      border: '#333B47',
      tint: '#7FA9D6',
      tintText: '#000000',
      ...CATEGORY_AND_STATUS_TOKENS.dark,
    },
  },
  sunset: {
    light: {
      background: '#FDF8F4',
      backgroundElement: '#F7ECE2',
      backgroundSelected: '#F0DFCF',
      text: '#302420',
      textSecondary: '#7A6459',
      border: '#EBD9C7',
      tint: '#C15B3E',
      tintText: '#000000',
      ...CATEGORY_AND_STATUS_TOKENS.light,
    },
    dark: {
      background: '#201613',
      backgroundElement: '#2B1F1B',
      backgroundSelected: '#382A24',
      text: '#F7ECE5',
      textSecondary: '#C4AA9E',
      border: '#47342C',
      tint: '#E38867',
      tintText: '#000000',
      ...CATEGORY_AND_STATUS_TOKENS.dark,
    },
  },
  clay: {
    light: {
      background: '#FAF7F3',
      backgroundElement: '#F0EAE2',
      backgroundSelected: '#E3DACC',
      text: '#2C2621',
      textSecondary: '#6E6459',
      border: '#DED2C1',
      tint: '#8C5A3C',
      tintText: '#FFFFFF',
      ...CATEGORY_AND_STATUS_TOKENS.light,
    },
    dark: {
      background: '#1D1916',
      backgroundElement: '#292420',
      backgroundSelected: '#362F29',
      text: '#F2ECE4',
      textSecondary: '#B8ACA0',
      border: '#423A33',
      tint: '#C58C64',
      tintText: '#000000',
      ...CATEGORY_AND_STATUS_TOKENS.dark,
    },
  },
};

export const DEFAULT_PALETTE_ID: PaletteId = 'meadow';

export type ThemeColor = keyof ThemeTokens;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
  /** Minimum tap-target size (iOS HIG / Material both call for ~44pt/48dp). */
  touchTarget: 44,
} as const;
