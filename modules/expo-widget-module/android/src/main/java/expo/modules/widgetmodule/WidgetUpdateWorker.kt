package expo.modules.widgetmodule

import android.content.Context
import androidx.glance.appwidget.updateAll
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters

// Scheduled by ExpoWidgetModule as a one-off request for the single
// soonest future status transition (e.g. due_soon -> due) — Glance has no
// equivalent to WidgetKit's precomputed Timeline, so something has to
// actively trigger a re-render at that moment. This Worker needs no JS or
// network access: it just re-triggers a render, and CareWidget's own
// provideGlance re-derives "what's current" from the same DataStore
// payload, the same selection logic the 30-minute periodic floor already
// uses. Persisted by WorkManager (survives process death); degrades
// gracefully to that 30-minute floor if the OS defers it under Doze.
class WidgetUpdateWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
  override suspend fun doWork(): Result {
    CareWidget().updateAll(applicationContext)
    return Result.success()
  }
}
