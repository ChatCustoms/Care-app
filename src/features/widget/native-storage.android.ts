import ExpoWidgetModule from '../../../modules/expo-widget-module/src/ExpoWidgetModule';
import { WidgetPayload } from './logic';

// The Kotlin side writes the payload to a Preferences DataStore, triggers
// an immediate re-render (GlanceAppWidget.updateAll), and schedules a
// WorkManager one-off request for the next status transition — see
// modules/expo-widget-module/android/.../ExpoWidgetModule.kt. Fire-and-
// forget from the JS side: a widget-sync failure shouldn't surface as an
// app-level error, mirroring how the iOS ExtensionStorage path has no
// error handling either.
export function writeWidgetPayload(payload: WidgetPayload): void {
  ExpoWidgetModule.updateWidgetPayload(JSON.stringify(payload)).catch((error) => {
    console.warn('Failed to sync widget payload', error);
  });
}
