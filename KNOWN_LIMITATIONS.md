# Known Limitations

This document records intentional MVP limitations — problems that are understood,
accepted for now, and documented rather than prematurely solved.

---

## Notification Synchronization

**What the limitation is:**
Local scheduled notifications are managed on each device individually. When
Caregiver A logs a feed, Caregiver B's device learns of the update via Supabase
Realtime (Milestone 5, if the app is running and foregrounded/backgrounded) or
on next app launch/resume (if the app was terminated, or Realtime is
unreachable — e.g. a dropped/never-reconnected websocket).

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

**Additional MVP notes (Milestone 4):**
- If a caregiver denies the notification permission prompt, feed logging
  still works normally — no notification is ever scheduled, and there is no
  in-app indicator that permission was denied. The OS-level Settings app is
  the only way to re-enable it, and doing so takes effect the next time the
  app reconciles (launch or resume).
- On Android, a device reboot clears all pending `AlarmManager`-backed
  scheduled notifications. If a reboot happens while a notification is
  pending and the app isn't reopened before the feed becomes due, that
  notification is silently lost. Reconciliation on the next app open
  correctly reschedules going forward. iOS does not have this issue — its
  notification triggers persist across reboots.

---

## iOS Home Screen Widget (Milestone 12)

**What is implemented:**
A `systemLarge`-only Home Screen widget (`targets/widget/`, built with
`@bacons/apple-targets` — hand-written Swift/SwiftUI, not the newer alpha
`expo-widgets`) showing feed status, medication status, and three buttons
(Log Feed / Log Medication / Log Diaper). All three buttons deep-link to
`careapp://today` — none of them log anything without the app coming to
the foreground first, and none of them differentiate by section. The
widget never calls Supabase directly: the main app computes a
pre-computed timeline of upcoming status transitions (reusing
`getFeedStatus`'s and `computeTodaysDoseSlots`'s exact threshold logic)
and writes it to a shared App Group (`group.com.stephanochatham.careapp`)
via `src/features/notifications/use-sync-widget-storage.ts`; the widget
only reads that.

**What is NOT implemented:**
- No Live Activity (Lock Screen / Dynamic Island) — a meaningfully larger
  second system (ActivityKit start/update/end lifecycle), deferred to a
  future milestone.
- No Android widget yet — Milestone 13.
- No `systemSmall`/`systemMedium` size variants — only the largest size,
  since two status lines plus three buttons doesn't fit smaller families.
- No true no-launch interactive buttons (iOS 17 AppIntents). That would
  require duplicating Supabase auth-token access and a network write
  inside the widget extension process — a new security surface with zero
  precedent in this codebase. Tapping a button opens the app instead.

**Build/signing caveat:**
Development so far is Simulator-only (`expo run:ios`, no device, no EAS).
App Groups provision automatically there; real-device testing will need
the group id registered under an actual Apple Developer Team ID.

**Future path:**
Add a Live Activity once the Home Screen widget is proven stable in
practice; revisit `expo-widgets` once it's out of alpha if it would
meaningfully reduce the amount of hand-written Swift this app carries.

---

## Android Home Screen Widget (Milestone 13)

**What is implemented:**
A fixed-size Home Screen widget (`modules/expo-widget-module/`, a local
Expo Module — no config-plugin tool equivalent to `@bacons/apple-targets`
exists for Android) built with Jetpack Glance, showing the same content as
the iOS widget: feed status, medication status, and three
`careapp://today` deep-link buttons. The widget reads a JSON payload from
a single-key `Preferences DataStore`, written by the same
`src/features/notifications/use-sync-widget-storage.ts` hook that drives
the iOS widget — `src/features/widget/native-storage.{ios,android}.ts`
splits the actual write call per platform, but the payload shape and the
data it's derived from (`src/features/widget/logic.ts`) are identical
across both.

**What is NOT implemented / the key platform difference from iOS:**
Jetpack Glance has no equivalent to WidgetKit's precomputed `Timeline` —
an iOS widget can be handed a set of future dated entries and the OS
walks through them with zero further app involvement; a Glance widget
only ever renders its *current* state and must be told to re-render.
Three layers cover this:
- A 30-minute periodic update (`updatePeriodMillis`, the OS-enforced
  minimum) as the reliability floor.
- An immediate re-render on every payload write (covers the common case:
  app foregrounded, a Realtime event arrives).
- A single `WorkManager` one-off request, scheduled by the native module
  itself (not JS) for the next real status transition, replaced on every
  new payload write.

No `SCHEDULE_EXACT_ALARM` permission is used (gated behind a user-granted
permission on API 33+, not auto-granted outside the alarm/clock app
category) and no `AlarmManager` exact scheduling — `WorkManager` degrades
gracefully to the 30-minute floor if the OS defers it under Doze/App
Standby. **Worst case, the Android widget can show a status up to ~30
minutes stale**; iOS's `Timeline` mechanism has no equivalent gap. Also:
- Fixed size only — no resizing (`resizeMode="none"`), matching iOS's
  `systemLarge`-only scope.
- Same "no auto-log" button philosophy as iOS: tapping a button opens the
  app rather than writing directly from the widget process, to avoid
  duplicating Supabase auth-token access outside the main app.

**Future path:**
If the ~30-minute worst-case staleness proves to be a real problem in
practice, consider requesting `SCHEDULE_EXACT_ALARM` (with its user-facing
permission prompt) for tighter precision — deferred for now since the
`WorkManager` middle ground covers the common cases without it.

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

## No Editing or Deleting Logged Feeds, Diaper Changes, or Medication Doses

**What the limitation is:**
A feed, diaper change, or medication dose event, once logged (including a
mis-tap — e.g. logging "8 oz" instead of "4 oz", "Wet" instead of "Dirty",
or "Skip" instead of "Given"), cannot be edited or deleted in-app. There is
no update or delete RLS policy on the `feeds`, `diapers`, or
`medication_events` tables.

For medications specifically, there is also deliberately no unique
constraint on `(medication_id, scheduled_for)` in `medication_events` — a
corrective re-log for the same dose slot is a new row, not an edit. The
most-recently-created event per slot is treated as authoritative (see
`computeTodaysDoseSlots` in `src/features/medications/logic.ts`), so both
the mistake and the correction remain in the audit trail.

**Why it is acceptable for MVP:**
No edit UI exists yet, and a default-deny policy is safer than granting a
write surface for a feature that doesn't exist and can't be exercised or
tested. A mis-logged feed skews the next-feed countdown until the next real
feed is logged; a mis-logged diaper change only affects the "last changed"
display; a mis-logged medication dose can be corrected by re-logging the
same slot. None lose or corrupt other data.

**Future path:**
Add an update/delete policy (scoped the same way as `feed_presets`, via
`is_household_member`) alongside an edit/delete UI on the Today or Timeline
screen, once that's a real, prioritized need.

**Deliberate exception — `care_notes` (Milestone 8):** unlike every log
table above, `care_notes` does support edit/delete, scoped to the note's
own author (`created_by = auth.uid()`, not just household membership).
Free-text content is more prone to typos than picking a preset amount or
type, and a note's content is entirely the author's own words rather than
a shared structured value like a feed amount — editing your own note is a
different, lower-risk surface than editing a shared log entry, so it was
built now rather than deferred.

---

## Medication Tracking (Milestone 7)

**What the limitation is:**
- Removing a medication is a soft delete (`deactivated_at` set, row never
  physically deleted) so historical `medication_events` stay intact for
  care history — there is no true "delete forever" action.
- Scheduled dose times (`schedule_times`) have no date/timezone component;
  "today's" doses are computed from the *viewing device's* local calendar
  day. This is correct for the common case (caregivers colocated with the
  care recipient) but means a caregiver traveling in a different timezone
  from the child will see dose times shifted to their own local clock.
- Missed-dose detection and medication-reminder notifications both require
  the app to be opened or resumed on some device — there is no server-side
  cron. This is the same architecture and the same caveat as feed-overdue
  detection (see "Notification Synchronization" above), extended to
  medications.
- Editing a medication's `schedule_times` is not versioned — Today always
  reflects the *current* schedule. If a time is removed after a dose for
  it was already logged today, that logged event stays in
  `medication_events` but simply stops rendering as a slot going forward.

**Why it is acceptable for MVP:**
All of the above match this app's existing architecture and conventions
(client-driven reconciliation, no server-side jobs, device-local time
semantics) rather than introducing a new class of limitation.

**Future path:**
Store a timezone on `care_recipients` and convert schedule times against
it if cross-timezone caregiving becomes a real, reported need.

---

## Appointment Reminders (Milestone 11)

**What the limitation is:**
- Appointment reminders are only scheduled for appointments within a
  14-day lookahead window (`fetchUpcomingAppointmentsForReminders`), not
  every future appointment. iOS caps pending local notifications at 64
  system-wide, and unlike medication doses (naturally bounded to "today"),
  appointments have no natural bound — a household pre-booking months of
  visits could otherwise crowd out feed/medication reminders. A far-future
  appointment gets its reminder scheduled once it enters the 14-day
  window on a later reconcile pass (app open/resume/realtime event), not
  the moment it's created.
- If an appointment is booked (or reconciliation happens to run) inside
  its own reminder lead time (60 minutes before `scheduled_at`), the
  reminder fires almost immediately rather than at the "natural" lead
  time, and rather than being silently dropped.
- There is no hard delete for appointments — cancelling sets
  `status = 'cancelled'`, the same row-preserving pattern as
  `medications.deactivated_at`, so appointment history (including
  cancellations) stays intact.

**Why it is acceptable for MVP:**
The 14-day window matches the architecture's existing device-driven
reconciliation (see "Notification Synchronization" above) rather than
introducing a server-side scheduling job, and a 60-minute lead time isn't
actionable for something months out regardless.

**Future path:**
If a household routinely books appointments far enough out that the
lookahead window causes missed reminders in practice, widen the window or
move reminder scheduling server-side (silent push, per the "Notification
Synchronization" future path).

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
The invitation flow is invite-by-email only (Milestone 5). The household
owner enters an email; if that email has no account yet, the invite waits
(expires after 7 days) until they sign up or sign in, at which point they're
auto-joined to the household with a fixed `caregiver` role — no manual
"Accept" step. There is no invitation link, QR code, in-app invite code, or
role picker (every invite grants the same role).

**Why it is acceptable for MVP:**
Every existing screen assumes one household per user, so allowing a role
choice or multiple pending households per person would add real complexity
for a need that hasn't come up yet. A household member can cancel a pending
invite, but there is no "remove an existing caregiver" UI yet.

**Future path:**
Add shareable invite links if the email-only flow causes friction in
practice. Add a remove-caregiver flow and role differentiation
(admin/viewer) if a real need for either emerges.

---

*This document is a living record. Add new entries when intentional limitations
are introduced. Remove or update entries when limitations are resolved.*
