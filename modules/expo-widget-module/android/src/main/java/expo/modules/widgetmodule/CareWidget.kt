package expo.modules.widgetmodule

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.action.actionStartActivity
import androidx.glance.appwidget.cornerRadius
import androidx.glance.appwidget.provideContent
import androidx.glance.background
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
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider
import kotlinx.coroutines.flow.first

private const val TODAY_DEEP_LINK = "careapp://today"

private val BACKGROUND = Color(0xFFFBFAF6)
private val TEXT_SECONDARY = Color(0xFF6B685C)
private val FEED_ACCENT = Color(0xFFC7862B)
private val STATUS_WARNING = Color(0xFFB8730A)
private val STATUS_URGENT = Color(0xFF2E6E8E)
private val STATUS_CRITICAL = Color(0xFFB3261E)
private val BUTTON_BACKGROUND = Color(0x1A2563EB)

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

private fun feedColor(status: String?): Color = when (status) {
  "due_soon" -> STATUS_WARNING
  "due" -> STATUS_URGENT
  "overdue" -> STATUS_CRITICAL
  else -> TEXT_SECONDARY
}

private fun medicationColor(status: String?): Color = when (status) {
  "due" -> STATUS_URGENT
  "missed" -> STATUS_CRITICAL
  else -> TEXT_SECONDARY
}

class CareWidget : GlanceAppWidget() {
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
  Column(
    modifier = GlanceModifier.fillMaxSize().background(BACKGROUND).padding(16.dp)
  ) {
    if (payload == null) {
      Text(
        "Open the app to sync",
        style = TextStyle(color = ColorProvider(TEXT_SECONDARY), fontSize = 14.sp)
      )
      return@Column
    }

    Text(
      payload.careRecipientName,
      style = TextStyle(fontWeight = FontWeight.Bold, fontSize = 16.sp)
    )
    Spacer(modifier = GlanceModifier.height(12.dp))

    Text(
      FEED_STATUS_LABEL[activeFeed?.status] ?: "No feeds logged yet",
      style = TextStyle(color = ColorProvider(feedColor(activeFeed?.status)), fontSize = 14.sp)
    )
    Spacer(modifier = GlanceModifier.height(4.dp))
    Text(
      activeMedication?.let { "${MEDICATION_STATUS_LABEL[it.status] ?: it.status}: ${it.medicationName}" }
        ?: "No medications due",
      style = TextStyle(color = ColorProvider(medicationColor(activeMedication?.status)), fontSize = 14.sp)
    )

    Spacer(modifier = GlanceModifier.height(16.dp))

    Row(modifier = GlanceModifier.fillMaxWidth()) {
      WidgetActionButton("Log Feed")
      Spacer(modifier = GlanceModifier.width(8.dp))
      WidgetActionButton("Log Med")
      Spacer(modifier = GlanceModifier.width(8.dp))
      WidgetActionButton("Log Diaper")
    }
  }
}

// All three buttons deep-link to the same destination — Today already
// shows Feed/Diaper/Medications together on one screen, and every write
// goes through the app's existing Supabase client rather than a
// duplicated auth path in this widget process.
@Composable
private fun WidgetActionButton(title: String) {
  Row(
    modifier = GlanceModifier
      .clickable(actionStartActivity(Intent(Intent.ACTION_VIEW, Uri.parse(TODAY_DEEP_LINK))))
      .background(BUTTON_BACKGROUND)
      .cornerRadius(8.dp)
      .padding(vertical = 6.dp, horizontal = 10.dp)
  ) {
    Text(title, style = TextStyle(fontSize = 12.sp))
  }
}
