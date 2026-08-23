import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { Icon, IconName } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type CareCardCategory = 'feed' | 'diaper' | 'medication' | 'note' | 'appointment';

const CATEGORY_ICON: Record<CareCardCategory, IconName> = {
  feed: 'feed',
  diaper: 'diaper',
  medication: 'medication',
  note: 'note',
  appointment: 'appointment',
};

export type CareCardProps = {
  category: CareCardCategory;
  title: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

// The shared "rounded, tinted, category-accented panel" shape reused for
// every section on Today — one place to keep that visual language
// consistent rather than one-off styling per section.
export function CareCard({ category, title, children, style }: CareCardProps) {
  const theme = useTheme();
  const accent = theme[`${category}Accent`];
  const accentSoft = theme[`${category}AccentSoft`];

  return (
    <View style={[styles.card, { backgroundColor: accentSoft, borderColor: theme.border }, style]}>
      <View style={styles.header}>
        <Icon name={CATEGORY_ICON[category]} size={20} color={accent} />
        <ThemedText type="smallBold" style={{ color: accent }}>
          {title}
        </ThemedText>
      </View>
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Spacing.four,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  content: {
    gap: Spacing.two,
  },
});
