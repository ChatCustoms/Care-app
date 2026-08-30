package expo.modules.widgetmodule

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.DpSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.LocalSize
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.SizeMode
import androidx.glance.appwidget.action.actionStartActivity
import androidx.glance.appwidget.cornerRadius
import androidx.glance.appwidget.provideContent
import androidx.glance.background
import androidx.glance.layout.Alignment
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.layout.width
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextAlign
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider
import kotlinx.coroutines.flow.first

// The two sizes declared in care_widget_info.xml's resize range: a compact
// square (matches the smallest Android home screen grid cell allowance)
// showing only the single highest-priority signal, and the original full
// layout. Glance picks whichever declared size best fits the widget's
// current on-screen dimensions and exposes it via LocalSize.current below.
private val COMPACT_SIZE = DpSize(110.dp, 110.dp)
private val FULL_SIZE = DpSize(250.dp, 180.dp)

private const val TODAY_DEEP_LINK = "careapp://today"

// Used only when there's no payload at all yet (never synced) — there's no
// app theme to read at that point, so this is a neutral, palette-agnostic
// placeholder rather than an attempt to guess the user's chosen palette.
private val FALLBACK_THEME = WidgetTheme(
  background = 0xFFFBFAF6.toInt(),
  text = 0xFF2B2A25.toInt(),
  textSecondary = 0xFF6B685C.toInt(),
  backgroundElement = 0xFFF1EEE4.toInt(),
  statusWarning = 0xFFB8730A.toInt(),
  statusUrgent = 0xFF2E6E8E.toInt(),
  statusCritical = 0xFFB3261E.toInt()
)

private val FEED_STATUS_LABEL = mapOf(
  "upcoming" to "Next feed upcoming",
  "due_soon" to "Feed due soon",
  "due" to "Feed due now",
  "overdue" to "Feed overdue"
)

private val MEDICATION_STATUS_LABEL = mapOf(
  "upcoming" to "Next dose",
  "due" to "Dose due now",
  "missed" to "Dose missed"
)

private fun feedColor(status: String?, theme: WidgetTheme): Color = when (status) {
  "due_soon" -> Color(theme.statusWarning)
  "due" -> Color(theme.statusUrgent)
  "overdue" -> Color(theme.statusCritical)
  else -> Color(theme.textSecondary)
}

private fun medicationColor(status: String?, theme: WidgetTheme): Color = when (status) {
  "due" -> Color(theme.statusUrgent)
  "missed" -> Color(theme.statusCritical)
  else -> Color(theme.textSecondary)
}

class CareWidget : GlanceAppWidget() {
  override val sizeMode = SizeMode.Responsive(setOf(COMPACT_SIZE, FULL_SIZE))

  override suspend fun provideGlance(context: Context, id: GlanceId) {
    val json = context.widgetDataStore.data.first()[WIDGET_PAYLOAD_KEY]
    val payload = json?.let { parseWidgetPayload(it) }
    val now = System.currentTimeMillis()

    val activeFeed = payload?.let { activeEntry(it.feedEntries, WidgetFeedEntry::validFrom, now) }
    val activeMedication =
      payload?.let { activeEntry(it.medicationEntries, WidgetMedicationEntry::validFrom, now) }

    provideContent {
      CareWidgetContent(payload, activeFeed, activeMedication)
    }
  }
}

@Composable
private fun CareWidgetContent(
  payload: WidgetPayload?,
  activeFeed: WidgetFeedEntry?,
  activeMedication: WidgetMedicationEntry?
) {
  if (payload == null) {
    Column(
      modifier = GlanceModifier.fillMaxSize().background(Color(FALLBACK_THEME.background)).padding(16.dp)
    ) {
      Text(
        "Open the app to sync",
        style = TextStyle(color = ColorProvider(Color(FALLBACK_THEME.textSecondary)), fontSize = 14.sp)
      )
    }
    return
  }

  // Synced payloads always carry the app's current theme (written by the
  // same JS call that writes everything else) — the fallback here is only
  // for a payload written before this field existed.
  val theme = payload.theme ?: FALLBACK_THEME

  // Below ~180dp tall there's no room for the medication line and three
  // buttons without either clipping or crushing touch targets, so the
  // compact size shows only feeding — the single highest-priority signal,
  // matching the Today screen's own "feeding is the hero card" priority.
  if (LocalSize.current.height < FULL_SIZE.height) {
    CompactWidgetContent(payload, activeFeed, theme)
  } else {
    FullWidgetContent(payload, activeFeed, activeMedication, theme)
  }
}

@Composable
private fun CompactWidgetContent(payload: WidgetPayload, activeFeed: WidgetFeedEntry?, theme: WidgetTheme) {
  Column(
    modifier = GlanceModifier
      .fillMaxSize()
      .background(Color(theme.background))
      .cornerRadius(16.dp)
      .clickable(actionStartActivity(Intent(Intent.ACTION_VIEW, Uri.parse(TODAY_DEEP_LINK))))
      .padding(12.dp),
    horizontalAlignment = Alignment.CenterHorizontally,
    verticalAlignment = Alignment.CenterVertically
  ) {
    Text(
      payload.careRecipientName,
      style = TextStyle(
        color = ColorProvider(Color(theme.text)),
        fontWeight = FontWeight.Bold,
        fontSize = 13.sp,
        textAlign = TextAlign.Center
      )
    )
    Spacer(modifier = GlanceModifier.height(6.dp))
    Text(
      FEED_STATUS_LABEL[activeFeed?.status] ?: "No feeds logged yet",
      style = TextStyle(
        color = ColorProvider(feedColor(activeFeed?.status, theme)),
        fontSize = 13.sp,
        textAlign = TextAlign.Center
      )
    )
  }
}

@Composable
private fun FullWidgetContent(
  payload: WidgetPayload,
  activeFeed: WidgetFeedEntry?,
  activeMedication: WidgetMedicationEntry?,
  theme: WidgetTheme
) {
  Column(
    modifier = GlanceModifier.fillMaxSize().background(Color(theme.background)).padding(16.dp)
  ) {
    Text(
      payload.careRecipientName,
      style = TextStyle(color = ColorProvider(Color(theme.text)), fontWeight = FontWeight.Bold, fontSize = 16.sp)
    )
    Spacer(modifier = GlanceModifier.height(12.dp))

    Text(
      FEED_STATUS_LABEL[activeFeed?.status] ?: "No feeds logged yet",
      style = TextStyle(color = ColorProvider(feedColor(activeFeed?.status, theme)), fontSize = 14.sp)
    )
    Spacer(modifier = GlanceModifier.height(4.dp))
    Text(
      activeMedication?.let { "${MEDICATION_STATUS_LABEL[it.status] ?: it.status}: ${it.medicationName}" }
        ?: "No medications due",
      style = TextStyle(color = ColorProvider(medicationColor(activeMedication?.status, theme)), fontSize = 14.sp)
    )

    Spacer(modifier = GlanceModifier.height(16.dp))

    Row(modifier = GlanceModifier.fillMaxWidth()) {
      WidgetActionButton("Log Feed", theme)
      Spacer(modifier = GlanceModifier.width(8.dp))
      WidgetActionButton("Log Med", theme)
      Spacer(modifier = GlanceModifier.width(8.dp))
      WidgetActionButton("Log Diaper", theme)
    }
  }
}

// All three buttons deep-link to the same destination — Today already
// shows Feed/Diaper/Medications together on one screen, and every write
// goes through the app's existing Supabase client rather than a
// duplicated auth path in this widget process.
@Composable
private fun WidgetActionButton(title: String, theme: WidgetTheme) {
  Row(
    modifier = GlanceModifier
      .clickable(actionStartActivity(Intent(Intent.ACTION_VIEW, Uri.parse(TODAY_DEEP_LINK))))
      .background(Color(theme.backgroundElement))
      .cornerRadius(8.dp)
      .padding(vertical = 6.dp, horizontal = 10.dp)
  ) {
    Text(title, style = TextStyle(color = ColorProvider(Color(theme.text)), fontSize = 12.sp))
  }
}
