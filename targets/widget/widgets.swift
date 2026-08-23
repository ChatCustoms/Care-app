import SwiftUI
import WidgetKit

// MARK: - Shared payload schema
//
// Mirrors src/features/widget/logic.ts's WidgetPayload exactly. The main
// app is the only writer of this data (via ExtensionStorage from
// @bacons/apple-targets); the widget only ever reads it — it never calls
// Supabase directly. `version` exists so a future JS-side schema change
// that predates a matching Swift decoder update fails decoding cleanly
// (falls into the `payload == nil` branch below) rather than crashing.

private let appGroupId = "group.com.stephanochatham.careapp" // must match app.config.ts
private let widgetPayloadKey = "widgetPayload"
private let widgetPayloadVersion = 1

private struct FeedEntryPayload: Decodable {
  let status: String
  let validFrom: String
}

private struct MedicationEntryPayload: Decodable {
  let status: String
  let validFrom: String
  let medicationName: String
}

private struct WidgetPayload: Decodable {
  let version: Int
  let careRecipientName: String
  let feedEntries: [FeedEntryPayload]
  let medicationEntries: [MedicationEntryPayload]
}

private func loadWidgetPayload() -> WidgetPayload? {
  // ExtensionStorage.set() on the JS side stores a plain JSON string via
  // UserDefaults.set(String, forKey:) (confirmed in @bacons/apple-targets'
  // native module — setString writes the raw String, not Data), so this
  // reads a String and converts it, not defaults.data(forKey:).
  guard let defaults = UserDefaults(suiteName: appGroupId),
    let jsonString = defaults.string(forKey: widgetPayloadKey),
    let data = jsonString.data(using: .utf8)
  else {
    return nil
  }
  guard let payload = try? JSONDecoder().decode(WidgetPayload.self, from: data),
    payload.version == widgetPayloadVersion
  else {
    return nil
  }
  return payload
}

private let isoFormatterWithFraction: ISO8601DateFormatter = {
  let formatter = ISO8601DateFormatter()
  formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
  return formatter
}()

private let isoFormatter: ISO8601DateFormatter = {
  let formatter = ISO8601DateFormatter()
  formatter.formatOptions = [.withInternetDateTime]
  return formatter
}()

private func parseDate(_ value: String) -> Date? {
  isoFormatterWithFraction.date(from: value) ?? isoFormatter.date(from: value)
}

// MARK: - Timeline entry
//
// A single CareEntry represents the combined feed+medication view state at
// one instant. The JS side hands over two independent streams of future
// transitions (feed status thresholds, per-medication dose transitions);
// this file merges them into one timeline here since a WidgetKit widget
// only has one entry type covering everything shown on screen at once.

struct CareEntry: TimelineEntry {
  let date: Date
  let careRecipientName: String?
  /// nil only when there is no payload at all (never synced / decode
  /// failed) — distinct from "payload present but no feeds logged yet".
  let hasPayload: Bool
  let feedStatus: String?
  let medicationStatus: String?
  let medicationName: String?
}

private func placeholderEntry() -> CareEntry {
  CareEntry(
    date: Date(), careRecipientName: nil, hasPayload: false, feedStatus: nil,
    medicationStatus: nil, medicationName: nil)
}

private func buildEntries() -> [CareEntry] {
  guard let payload = loadWidgetPayload() else {
    return [placeholderEntry()]
  }

  func activeFeed(at date: Date) -> FeedEntryPayload? {
    payload.feedEntries
      .compactMap { entry -> (FeedEntryPayload, Date)? in
        guard let validFrom = parseDate(entry.validFrom), validFrom <= date else { return nil }
        return (entry, validFrom)
      }
      .max { $0.1 < $1.1 }?.0
  }

  func activeMedication(at date: Date) -> MedicationEntryPayload? {
    payload.medicationEntries
      .compactMap { entry -> (MedicationEntryPayload, Date)? in
        guard let validFrom = parseDate(entry.validFrom), validFrom <= date else { return nil }
        return (entry, validFrom)
      }
      .max { $0.1 < $1.1 }?.0
  }

  // Every distinct transition timestamp across both streams, plus "now" —
  // at each, resolve what both statuses would independently be at that
  // instant (mirrors exactly how WidgetKit itself would pick the active
  // entry from a single-stream timeline, just done up front for two
  // streams merged into one view). Entries already in the past are
  // harmless to include — WidgetKit simply never selects them once a
  // later one becomes current, and both streams are small (a handful of
  // entries each) so there's no volume concern.
  let feedDates = payload.feedEntries.compactMap { parseDate($0.validFrom) }
  let medicationDates = payload.medicationEntries.compactMap { parseDate($0.validFrom) }
  var allDates = Set(feedDates).union(medicationDates)
  allDates.insert(Date())
  let sortedDates = allDates.sorted()

  let entries = sortedDates.map { date -> CareEntry in
    let feed = activeFeed(at: date)
    let medication = activeMedication(at: date)
    return CareEntry(
      date: date,
      careRecipientName: payload.careRecipientName,
      hasPayload: true,
      feedStatus: feed?.status,
      medicationStatus: medication?.status,
      medicationName: medication?.medicationName
    )
  }

  return entries.isEmpty ? [placeholderEntry()] : entries
}

// MARK: - Provider

struct Provider: TimelineProvider {
  func placeholder(in context: Context) -> CareEntry {
    placeholderEntry()
  }

  func getSnapshot(in context: Context, completion: @escaping (CareEntry) -> Void) {
    completion(buildEntries().first ?? placeholderEntry())
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<CareEntry>) -> Void) {
    completion(Timeline(entries: buildEntries(), policy: .atEnd))
  }
}

// MARK: - View

private let feedStatusLabel: [String: String] = [
  "upcoming": "Next feed upcoming",
  "due_soon": "Feed due soon",
  "due": "Feed due now",
  "overdue": "Feed overdue",
]

private let medicationStatusLabel: [String: String] = [
  "upcoming": "Next dose",
  "due": "Dose due now",
  "missed": "Dose missed",
]

struct WidgetEntryView: View {
  var entry: Provider.Entry

  private var feedLabel: String {
    guard let status = entry.feedStatus else { return "No feeds logged yet" }
    return feedStatusLabel[status] ?? status
  }

  private var feedColor: Color {
    switch entry.feedStatus {
    case "due_soon": return .orange
    case "due": return .blue
    case "overdue": return .red
    default: return .primary
    }
  }

  private var medicationLabel: String {
    guard let status = entry.medicationStatus, let name = entry.medicationName else {
      return "No medications due"
    }
    let label = medicationStatusLabel[status] ?? status
    return "\(label): \(name)"
  }

  private var medicationColor: Color {
    switch entry.medicationStatus {
    case "due": return .blue
    case "missed": return .red
    default: return .primary
    }
  }

  var body: some View {
    if !entry.hasPayload {
      VStack {
        Text("Open the app to sync")
          .font(.subheadline)
          .foregroundStyle(.secondary)
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity)
      .padding()
      .containerBackground(.background, for: .widget)
    } else {
      VStack(alignment: .leading, spacing: 12) {
        Text(entry.careRecipientName ?? "Care App")
          .font(.headline)

        VStack(alignment: .leading, spacing: 4) {
          Text(feedLabel)
            .font(.subheadline)
            .foregroundStyle(feedColor)
          Text(medicationLabel)
            .font(.subheadline)
            .foregroundStyle(medicationColor)
        }

        Spacer()

        HStack(spacing: 8) {
          widgetLink(title: "Log Feed")
          widgetLink(title: "Log Med")
          widgetLink(title: "Log Diaper")
        }
      }
      .padding()
      .containerBackground(.background, for: .widget)
    }
  }

  // All three buttons deep-link to the same destination — Today already
  // shows Feed/Diaper/Medications together on one screen, and every write
  // goes through the app's existing Supabase client rather than a
  // duplicated auth path in the widget extension.
  private func widgetLink(title: String) -> some View {
    Link(destination: URL(string: "careapp://today")!) {
      Text(title)
        .font(.caption)
        .multilineTextAlignment(.center)
        .frame(maxWidth: .infinity)
        .padding(.vertical, 6)
        .background(Color.blue.opacity(0.15))
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }
  }
}

struct widget: Widget {
  let kind: String = "widget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: Provider()) { entry in
      WidgetEntryView(entry: entry)
    }
    .configurationDisplayName("Care App")
    .description("Feed and medication status at a glance.")
    .supportedFamilies([.systemLarge])
  }
}

#Preview(as: .systemLarge) {
  widget()
} timeline: {
  CareEntry(
    date: .now, careRecipientName: "Ada", hasPayload: true, feedStatus: "due",
    medicationStatus: "upcoming", medicationName: "Vitamin D")
}
