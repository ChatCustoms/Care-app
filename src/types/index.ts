// Shared TypeScript types for the care app.
// Domain-specific types will be added per milestone.

export type HouseholdRole = 'owner' | 'admin' | 'caregiver' | 'viewer';

export type MembershipStatus = 'active' | 'invited' | 'removed';

export type MedicationEventStatus = 'given' | 'skipped' | 'missed' | 'prn_given';

export type AppointmentStatus = 'scheduled' | 'completed' | 'cancelled';

export type FeedUnit = 'mL' | 'oz' | 'g';

export type FeedStatus = 'upcoming' | 'due_soon' | 'due' | 'overdue';

export type DiaperType = 'wet' | 'dirty' | 'both' | 'dry';
