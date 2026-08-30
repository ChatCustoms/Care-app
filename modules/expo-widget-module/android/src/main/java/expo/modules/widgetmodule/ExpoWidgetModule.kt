package expo.modules.widgetmodule

import androidx.datastore.preferences.core.edit
import androidx.glance.appwidget.updateAll
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.concurrent.TimeUnit

private const val TRANSITION_WORK_NAME = "care-widget-transition-update"

class ExpoWidgetModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ExpoWidgetModule")

    AsyncFunction("updateWidgetPayload") Coroutine { json: String ->
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()

      context.widgetDataStore.edit { prefs -> prefs[WIDGET_PAYLOAD_KEY] = json }

      // Opportunistic: covers the common case (app foregrounded, a
      // Realtime event just arrived) with zero staleness.
      CareWidget().updateAll(context)

      // Middle ground between the 30-minute periodic floor and instant
      // updates: schedule one re-render at the next real status
      // transition, replacing whatever was scheduled before. No
      // SCHEDULE_EXACT_ALARM permission needed — WorkManager degrades
      // gracefully to the periodic floor if the OS defers it under Doze.
      val payload = parseWidgetPayload(json)
      val workManager = WorkManager.getInstance(context)
      val soonest = payload?.let { soonestFutureValidFrom(it, System.currentTimeMillis()) }

      if (soonest != null) {
        val delayMs = (soonest - System.currentTimeMillis()).coerceAtLeast(0)
        val request = OneTimeWorkRequestBuilder<WidgetUpdateWorker>()
          .setInitialDelay(delayMs, TimeUnit.MILLISECONDS)
          .build()
        workManager.enqueueUniqueWork(TRANSITION_WORK_NAME, ExistingWorkPolicy.REPLACE, request)
      } else {
        workManager.cancelUniqueWork(TRANSITION_WORK_NAME)
      }
    }
  }
}
