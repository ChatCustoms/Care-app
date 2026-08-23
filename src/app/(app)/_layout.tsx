import { Tabs } from 'expo-router';

import { useReconcileNotifications } from '@/features/notifications/use-reconcile-notifications';

// Icons will be added when polishing the UI.
// Using stable Tabs (not the unstable NativeTabs experiment from the template).
export default function AppLayout() {
  // The single app-wide owner of notification reconciliation — see the hook
  // for why this can't live in a per-tab screen (Tabs unmount inactive
  // screens; this layout is the only component mounted across tab switches).
  useReconcileNotifications();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#2563EB',
      }}
    >
      <Tabs.Screen name="today" options={{ title: 'Today' }} />
      <Tabs.Screen name="timeline" options={{ title: 'Timeline' }} />
      <Tabs.Screen name="summary" options={{ title: 'Summary' }} />
      <Tabs.Screen name="appointments" options={{ title: 'Appointments' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </Tabs>
  );
}
