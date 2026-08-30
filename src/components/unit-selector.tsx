import { Pressable, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { FeedUnit } from '@/types';

import { ThemedText } from './themed-text';

const UNITS: FeedUnit[] = ['mL', 'oz', 'g'];

export type UnitSelectorProps = {
  value: FeedUnit;
  onChange: (unit: FeedUnit) => void;
};

export function UnitSelector({ value, onChange }: UnitSelectorProps) {
  const theme = useTheme();

  return (
    <View style={styles.row}>
      {UNITS.map((unit) => {
        const isSelected = unit === value;
        return (
          <Pressable
            key={unit}
            onPress={() => onChange(unit)}
            accessibilityRole="button"
            accessibilityLabel={unit}
            accessibilityState={{ selected: isSelected }}
            style={[
              styles.chip,
              { backgroundColor: isSelected ? theme.backgroundSelected : theme.backgroundElement },
            ]}
          >
            <ThemedText type="smallBold" themeColor={isSelected ? 'text' : 'textSecondary'}>
              {unit}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
  },
});
