import { ActivityIndicator, Pressable, StyleSheet, type PressableProps } from 'react-native';

import { Spacing } from '@/constants/theme';

import { ThemedText } from './themed-text';

export type PrimaryButtonProps = Omit<PressableProps, 'children'> & {
  title: string;
  isLoading?: boolean;
};

export function PrimaryButton({ title, isLoading, disabled, style, ...rest }: PrimaryButtonProps) {
  const isDisabled = disabled || isLoading;

  return (
    <Pressable
      style={(state) => [
        styles.button,
        isDisabled && styles.disabled,
        typeof style === 'function' ? style(state) : style,
      ]}
      disabled={isDisabled}
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
    backgroundColor: '#2563EB',
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
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
