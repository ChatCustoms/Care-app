import { SymbolView, SymbolViewProps } from 'expo-symbols';
import { ColorValue, StyleProp, ViewStyle } from 'react-native';

// Centralizes this app's icon vocabulary so call sites never need to know
// per-platform symbol names directly. expo-symbols renders SF Symbols on
// iOS/tvOS and Material Symbols on Android/web from one component — no
// separate icon library dependency.
const ICON_NAMES = {
  feed: { ios: 'drop.fill', android: 'water_drop', web: 'water_drop' },
  diaper: { ios: 'humidity.fill', android: 'baby_changing_station', web: 'baby_changing_station' },
  medication: { ios: 'pills.fill', android: 'pill', web: 'pill' },
  note: { ios: 'note.text', android: 'sticky_note_2', web: 'sticky_note_2' },
  appointment: { ios: 'calendar', android: 'calendar_month', web: 'calendar_month' },
  today: { ios: 'house.fill', android: 'home_filled', web: 'home_filled' },
  timeline: { ios: 'clock.fill', android: 'schedule', web: 'schedule' },
  summary: { ios: 'chart.bar.fill', android: 'bar_chart', web: 'bar_chart' },
  settings: { ios: 'gearshape.fill', android: 'settings', web: 'settings' },
  person: { ios: 'person.crop.circle.fill', android: 'account_circle', web: 'account_circle' },
  add: { ios: 'plus.circle.fill', android: 'add_circle', web: 'add_circle' },
  check: { ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' },
  warning: { ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'warning' },
  skip: { ios: 'xmark.circle.fill', android: 'cancel', web: 'cancel' },
} as const satisfies Record<string, SymbolViewProps['name']>;

export type IconName = keyof typeof ICON_NAMES;

export type IconProps = {
  name: IconName;
  size?: number;
  color: ColorValue;
  style?: StyleProp<ViewStyle>;
};

export function Icon({ name, size = 24, color, style }: IconProps) {
  return (
    <SymbolView
      name={ICON_NAMES[name]}
      size={size}
      tintColor={color}
      style={[{ width: size, height: size }, style]}
    />
  );
}
