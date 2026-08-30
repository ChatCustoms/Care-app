package expo.modules.widgetmodule

import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone

// Mirrors src/features/widget/logic.ts's WidgetPayload exactly. The main
// app is the only writer of this data; the widget only ever reads it — it
// never calls Supabase directly.

const val WIDGET_PAYLOAD_VERSION = 1

data class WidgetFeedEntry(val status: String, val validFrom: Long)

data class WidgetMedicationEntry(val status: String, val validFrom: Long, val medicationName: String)

data class WidgetPayload(
  val careRecipientName: String,
  val feedEntries: List<WidgetFeedEntry>,
  val medicationEntries: List<WidgetMedicationEntry>
)

// date.toISOString() in JS always produces exactly this format (3
// fractional-second digits, literal 'Z') — no fallback format needed,
// unlike the iOS side which had to guard against ISO8601DateFormatter's
// fussier fractional-seconds handling.
private val isoFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
  timeZone = TimeZone.getTimeZone("UTC")
}

private fun parseIsoDate(value: String): Long? = try {
  isoFormat.parse(value)?.time
} catch (error: Exception) {
  null
}

// version exists so a future JS-side field addition that predates a
// matching Kotlin decoder update fails decoding cleanly (returns null,
// which the widget renders as "Open the app to sync") rather than
// crashing — the first JS-to-Kotlin schema boundary in this app, same
// defensiveness as targets/widget/widgets.swift on iOS.
fun parseWidgetPayload(json: String): WidgetPayload? = try {
  val root = JSONObject(json)
  if (root.optInt("version", -1) != WIDGET_PAYLOAD_VERSION) {
    null
  } else {
    val feedEntries = root.getJSONArray("feedEntries").let { array ->
      (0 until array.length()).mapNotNull { index ->
        val entry = array.getJSONObject(index)
        parseIsoDate(entry.getString("validFrom"))?.let { validFrom ->
          WidgetFeedEntry(entry.getString("status"), validFrom)
        }
      }
    }
    val medicationEntries = root.getJSONArray("medicationEntries").let { array ->
      (0 until array.length()).mapNotNull { index ->
        val entry = array.getJSONObject(index)
        parseIsoDate(entry.getString("validFrom"))?.let { validFrom ->
          WidgetMedicationEntry(entry.getString("status"), validFrom, entry.getString("medicationName"))
        }
      }
    }
    WidgetPayload(root.getString("careRecipientName"), feedEntries, medicationEntries)
  }
} catch (error: Exception) {
  null
}

// Mirrors exactly how WidgetKit itself would pick the active entry from a
// single-stream timeline — the latest entry whose validFrom has already
// passed.
fun <T> activeEntry(entries: List<T>, validFromOf: (T) -> Long, now: Long): T? =
  entries.filter { validFromOf(it) <= now }.maxByOrNull(validFromOf)

// The single soonest future transition across both streams — used to
// schedule the one WorkManager one-off request that keeps the widget from
// going stale between the 30-minute periodic floor and the next real
// change.
fun soonestFutureValidFrom(payload: WidgetPayload, now: Long): Long? {
  val candidates = payload.feedEntries.map { it.validFrom } + payload.medicationEntries.map { it.validFrom }
  return candidates.filter { it > now }.minOrNull()
}
