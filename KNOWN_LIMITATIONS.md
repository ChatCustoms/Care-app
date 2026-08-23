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
