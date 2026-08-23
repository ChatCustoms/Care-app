import { Tabs } from 'expo-router';

import { Icon, IconName } from '@/components/icon';
import { useReconcileNotifications } from '@/features/notifications/use-reconcile-notifications';
import { useSyncWidgetStorage } from '@/features/notifications/use-sync-widget-storage';
import { useTheme } from '@/hooks/use-theme';

const TAB_ICON: Record<string, IconName> = {
  today: 'today',
  timeline: 'timeline',
  summary: 'summary',
  appointments: 'appointment',
  settings: 'settings',
};

// Using stable Tabs (not the unstable NativeTabs experiment from the template).
export default function AppLayout() {
  const theme = useTheme();

  // The single app-wide owner of notification reconciliation — see the hook
  // for why this can't live in a per-tab screen (Tabs unmount inactive
  // screens; this layout is the only component mounted across tab switches).
  useReconcileNotifications();
  // A sibling, not part of the hook above — see its own comment for why
  // widget-storage sync is kept separate from notification reconciliation.
  useSyncWidgetStorage();

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: theme.tint,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarStyle: { backgroundColor: theme.background, borderTopColor: theme.border },
        tabBarIcon: ({ color, size }) => (
          <Icon name={TAB_ICON[route.name]} color={color} size={size} />
        ),
      })}
    >
      <Tabs.Screen name="today" options={{ title: 'Today' }} />
      <Tabs.Screen name="timeline" options={{ title: 'Timeline' }} />
      <Tabs.Screen name="summary" options={{ title: 'Summary' }} />
      <Tabs.Screen name="appointments" options={{ title: 'Appointments' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </Tabs>
  );
}
