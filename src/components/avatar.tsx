import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

// UI-layer only, deliberately: accepts an optional `uri` so a future
// milestone can wire a real care_recipients.avatar_url column through this
// same prop without touching this component. No upload flow, no schema
// change here — falls back to initials on a tinted circle.
export type AvatarProps = {
  uri?: string | null;
  name: string;
  size?: number;
};

function getInitials(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) return '?';
  const parts = trimmed.split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

export function Avatar({ uri, name, size = 48 }: AvatarProps) {
  const theme = useTheme();
  const containerStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
  };

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[styles.image, containerStyle]}
        accessibilityLabel={`${name}'s photo`}
      />
    );
  }

  return (
    <View
      style={[styles.fallback, containerStyle, { backgroundColor: theme.tint }]}
      accessible
      accessibilityLabel={`${name}'s avatar`}
    >
      <ThemedText type="smallBold" style={{ fontSize: size * 0.38, color: theme.tintText }}>
        {getInitials(name)}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    backgroundColor: 'transparent',
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
