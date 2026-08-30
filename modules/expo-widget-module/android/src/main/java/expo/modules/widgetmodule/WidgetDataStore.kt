package expo.modules.widgetmodule

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore

// A single-key Preferences DataStore, not per-instance Glance state —
// every placed widget instance shows identical content from one shared
// payload, mirroring iOS's one-string-under-one-key ExtensionStorage
// usage. Single process (no android:process=":widget" on the receiver),
// so this is trivially accessible from both the Expo Module (writer) and
// the widget's provideGlance (reader).
val Context.widgetDataStore: DataStore<Preferences> by preferencesDataStore(name = "care_widget")

val WIDGET_PAYLOAD_KEY = stringPreferencesKey("widgetPayload")
