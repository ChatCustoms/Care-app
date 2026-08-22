# Known Limitations

This document records intentional MVP limitations — problems that are understood,
accepted for now, and documented rather than prematurely solved.

---

## Notification Synchronization

**What the limitation is:**
Local scheduled notifications are managed on each device individually. When
Caregiver A logs a feed, Caregiver B's device learns of the update via Supabase
Realtime (if the app is running) or on next app launch (if the app was terminated).

If Caregiver B's app is fully terminated when the feed is logged, Caregiver B's
device will retain its previously scheduled local notification until the app is
opened and synchronizes with the database.

**Why it is acceptable for MVP:**
- For a family caregiving context, caregivers open the app frequently.
- On every app launch or resume, the app re-syncs with Supabase and reconciles
  all local notifications against current database state.
- The database is always the authoritative source of truth. No local notification
  state is ever trusted over the database.
- The window of inconsistency is short in normal use.

**Future path if this becomes a real problem:**
Silent push notifications (background APNs/FCM) can wake a terminated app to
reschedule notifications. This requires an Apple Developer account and adds
infrastructure complexity. Evaluate only if the MVP limitation causes real
caregiving issues in practice.

---

## Widget Support

**What the limitation is:**
iOS Home Screen widgets, iOS Live Activities, and Android Home Screen widgets are
not implemented in the MVP.

**Why it is deferred:**
Widgets require native platform extensions (Swift/WidgetKit for iOS,
Kotlin/Jetpack Glance for Android) that can only be built and tested with local
development builds. The core caregiving workflow — logging, countdown, timeline,
notifications — must be stable before widget state can be reliably derived from it.

**Architecture note:**
The application is designed so widgets can be added later without refactoring. All
care state is computed from the same business logic functions (`calculateNextFeed`,
`getFeedStatus`, etc.) that widgets will also use. Widgets will read pre-computed
state written to a shared App Group (iOS) or SharedPreferences (Android) by the
main app — they will not call Supabase directly.

**Future path:**
Implement after Milestone 11 (Appointments) when the core product is stable.

---

## Offline Support

**What the limitation is:**
The MVP does not include a full offline-first synchronization engine. Care events
require an active network connection to be saved to the database.

**What IS handled:**
- The UI disables submission while saving and does not report success until the
  database confirms the write.
- If a save fails due to connectivity, the user is shown a clear, calm error and
  the form is not cleared so they can retry.
- No care event is silently lost: if the save fails, the user knows.

**What is NOT handled:**
- Queuing care events for later sync while offline.
- Conflict resolution between events logged offline by multiple caregivers.

**Why it is acceptable for MVP:**
Most home caregiving environments have reliable Wi-Fi. The caregiver is immediately
told if a save fails. Data is never silently lost.

**Future path:**
If offline logging becomes a real need (travel, poor connectivity), evaluate a
local queue (e.g., a device-side SQLite store via `expo-sqlite`) that syncs when
connectivity returns. Design this as an additive layer over the existing
architecture rather than a rewrite.

---

## Single Care Recipient per Household (MVP)

**What the limitation is:**
The data model supports multiple care recipients per household, but the MVP UI
assumes one active care recipient per household. Switching between recipients is
not implemented.

**Why it is acceptable for MVP:**
The immediate use case is one care recipient per family. The data model is
correctly designed to support multiple in the future.

**Future path:**
Add a care recipient selector in the app header or settings when a second
recipient is needed.

---

## Caregiver Invitation

**What the limitation is:**
The MVP invitation flow is invite-by-email only. There is no invitation link,
QR code, or in-app invite code.

**Future path:**
Add shareable invite links if the email-only flow causes friction in practice.

---

*This document is a living record. Add new entries when intentional limitations
are introduced. Remove or update entries when limitations are resolved.*
