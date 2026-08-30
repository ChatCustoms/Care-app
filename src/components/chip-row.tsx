import { Pressable, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { ThemedText } from './themed-text';

export type ChipRowOption<T extends string | number> = { key: T; label: string };

export type ChipRowProps<T extends string | number> = {
  options: ChipRowOption<T>[];
  activeKey: T;
  onSelect: (key: T) => void;
};

export function ChipRow<T extends string | number>({
  options,
  activeKey,
  onSelect,
}: ChipRowProps<T>) {
  const theme = useTheme();

  return (
    <View style={styles.row}>
      {options.map((option) => {
        const isActive = option.key === activeKey;
        return (
          <Pressable
            key={option.key}
            onPress={() => onSelect(option.key)}
            accessibilityRole="button"
            accessibilityLabel={option.label}
            accessibilityState={{ selected: isActive }}
            style={[
              styles.chip,
              { backgroundColor: isActive ? theme.backgroundSelected : theme.backgroundElement },
            ]}
          >
            <ThemedText type="small">{option.label}</ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.four,
  },
});
