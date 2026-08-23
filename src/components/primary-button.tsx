import { ActivityIndicator, Pressable, StyleSheet, type PressableProps } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { ThemedText } from './themed-text';

export type PrimaryButtonProps = Omit<PressableProps, 'children'> & {
  title: string;
  isLoading?: boolean;
};

export function PrimaryButton({ title, isLoading, disabled, style, ...rest }: PrimaryButtonProps) {
  const theme = useTheme();
  const isDisabled = disabled || isLoading;

  return (
    <Pressable
      style={(state) => [
        styles.button,
        { backgroundColor: theme.tint },
        isDisabled && styles.disabled,
        typeof style === 'function' ? style(state) : style,
      ]}
      disabled={isDisabled}
      accessibilityRole="button"
      {...rest}
    >
      {isLoading ? (
        <ActivityIndicator color="#ffffff" />
      ) : (
        <ThemedText type="smallBold" style={styles.title}>
          {title}
        </ThemedText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    minHeight: Spacing.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.5,
  },
  title: {
    color: '#ffffff',
  },
});
