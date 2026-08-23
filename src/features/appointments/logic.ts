import { Appointment } from '@/features/appointments/api';
import { AppointmentStatus } from '@/types';

export const APPOINTMENT_STATUS_LABEL: Record<AppointmentStatus, string> = {
  scheduled: 'Scheduled',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

// Validates both the regex shape and actual calendar validity — JS silently
// rolls an invalid date like 2026-02-30 forward to March, so the
// constructed Date's fields are checked to round-trip back to the input
// rather than trusting the regex alone.
export function combineDateAndTime(dateStr: string, timeStr: string): Date | null {
  const dateMatch = DATE_PATTERN.exec(dateStr);
  const timeMatch = TIME_PATTERN.exec(timeStr);
  if (!dateMatch || !timeMatch) return null;

  const [, yearStr, monthStr, dayStr] = dateMatch;
  const [, hourStr, minuteStr] = timeMatch;
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  const hour = Number(hourStr);
  const minute = Number(minuteStr);

  const date = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hour ||
    date.getMinutes() !== minute
  ) {
    return null;
  }

  return date;
}

export function isUpcoming(appointment: Appointment, now: Date): boolean {
  return appointment.status === 'scheduled' && new Date(appointment.scheduled_at) > now;
}

export function groupAppointments(
  appointments: Appointment[],
  now: Date
): { upcoming: Appointment[]; past: Appointment[] } {
  const upcoming: Appointment[] = [];
  const past: Appointment[] = [];

  for (const appointment of appointments) {
    if (isUpcoming(appointment, now)) upcoming.push(appointment);
    else past.push(appointment);
  }

  upcoming.sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
  past.sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime());

  return { upcoming, past };
}
