import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  Appointment,
  cancelAppointment,
  createAppointment,
  fetchAppointments,
  updateAppointment,
} from '@/features/appointments/api';
import {
  APPOINTMENT_STATUS_LABEL,
  combineDateAndTime,
  groupAppointments,
} from '@/features/appointments/logic';
import { ChipRow } from '@/components/chip-row';
import { PrimaryButton } from '@/components/primary-button';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useHousehold } from '@/features/households/household-provider';
import { AppointmentStatus } from '@/types';

const STATUS_OPTIONS: { key: AppointmentStatus; label: string }[] = [
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function dateInputValue(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function timeInputValue(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatAppointmentDateTime(date: Date): string {
  return `${date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} · ${date.toLocaleTimeString(
    [],
    { hour: 'numeric', minute: '2-digit' }
  )}`;
}

export default function AppointmentsScreen() {
  const { careRecipient } = useHousehold();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [provider, setProvider] = useState('');
  const [location, setLocation] = useState('');
  const [dateStr, setDateStr] = useState('');
  const [timeStr, setTimeStr] = useState('');
  const [status, setStatus] = useState<AppointmentStatus>('scheduled');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!careRecipient) return;
    setIsLoading(true);
    setAppointments(await fetchAppointments(careRecipient.id));
    setIsLoading(false);
  }, [careRecipient]);

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setProvider('');
    setLocation('');
    setDateStr('');
    setTimeStr('');
    setStatus('scheduled');
    setNotes('');
    setFormError(null);
  };

  const startEditing = (appointment: Appointment) => {
    const scheduledDate = new Date(appointment.scheduled_at);
    setEditingId(appointment.id);
    setTitle(appointment.title);
    setProvider(appointment.provider ?? '');
    setLocation(appointment.location ?? '');
    setDateStr(dateInputValue(scheduledDate));
    setTimeStr(timeInputValue(scheduledDate));
    setStatus(appointment.status as AppointmentStatus);
    setNotes(appointment.notes ?? '');
    setFormError(null);
  };

  const handleSave = async () => {
    if (!careRecipient) return;
    setFormError(null);

    if (title.trim().length === 0) {
      setFormError('Please enter a title.');
      return;
    }
    const scheduledAt = combineDateAndTime(dateStr.trim(), timeStr.trim());
    if (!scheduledAt) {
      setFormError('Please enter a valid date (YYYY-MM-DD) and time (HH:MM).');
      return;
    }

    setIsSaving(true);
    const { data, error } = editingId
      ? await updateAppointment(
          editingId,
          title.trim(),
          provider.trim() || null,
          location.trim() || null,
          scheduledAt,
          status,
          notes.trim() || null
        )
      : await createAppointment(
          careRecipient.id,
          title.trim(),
          provider.trim() || null,
          location.trim() || null,
          scheduledAt
        );
    setIsSaving(false);

    if (error) {
      setFormError('Something went wrong saving that appointment. Please try again.');
      return;
    }
    if (data) {
      resetForm();
      refetch();
    }
  };

  const handleCancel = async (appointment: Appointment) => {
    setCancellingId(appointment.id);
    const { error } = await cancelAppointment(appointment.id);
    setCancellingId(null);
    if (!error) {
      if (editingId === appointment.id) resetForm();
      refetch();
    }
  };

  if (!careRecipient) return null;

  const { upcoming, past } = groupAppointments(appointments, new Date());

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedText type="title">Appointments</ThemedText>

          <ThemedView style={styles.section}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              Upcoming
            </ThemedText>
            {!isLoading && upcoming.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary">
                No upcoming appointments.
              </ThemedText>
            ) : null}
            {upcoming.map((appointment) => (
              <ThemedView key={appointment.id} style={styles.appointmentRow}>
                <ThemedView style={styles.appointmentInfo}>
                  <ThemedText type="default">{appointment.title}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {formatAppointmentDateTime(new Date(appointment.scheduled_at))}
                    {appointment.provider ? ` · ${appointment.provider}` : ''}
                    {appointment.location ? ` · ${appointment.location}` : ''}
                  </ThemedText>
                </ThemedView>
                <ThemedView style={styles.rowActions}>
                  <Pressable
                    onPress={() => startEditing(appointment)}
                    accessibilityRole="button"
                    accessibilityLabel={`Edit ${appointment.title}`}
                  >
                    <ThemedText type="link">Edit</ThemedText>
                  </Pressable>
                  <Pressable
                    onPress={() => handleCancel(appointment)}
                    disabled={cancellingId === appointment.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Cancel ${appointment.title}`}
                  >
                    <ThemedText type="link" themeColor="statusCritical">
                      {cancellingId === appointment.id ? 'Cancelling…' : 'Cancel'}
                    </ThemedText>
                  </Pressable>
                </ThemedView>
              </ThemedView>
            ))}
          </ThemedView>

          <ThemedView style={styles.section}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              Past
            </ThemedText>
            {!isLoading && past.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary">
                No past appointments.
              </ThemedText>
            ) : null}
            {past.map((appointment) => (
              <ThemedView key={appointment.id} style={styles.appointmentRow}>
                <ThemedView style={styles.appointmentInfo}>
                  <ThemedText type="default">{appointment.title}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {formatAppointmentDateTime(new Date(appointment.scheduled_at))} ·{' '}
                    {APPOINTMENT_STATUS_LABEL[appointment.status as AppointmentStatus]}
                  </ThemedText>
                  {appointment.notes ? (
                    <ThemedText type="small">{appointment.notes}</ThemedText>
                  ) : null}
                </ThemedView>
                <Pressable
                  onPress={() => startEditing(appointment)}
                  accessibilityRole="button"
                  accessibilityLabel={`Edit ${appointment.title}`}
                >
                  <ThemedText type="link">Edit</ThemedText>
                </Pressable>
              </ThemedView>
            ))}
          </ThemedView>

          <ThemedView style={styles.form}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              {editingId ? 'Edit appointment' : 'Add an appointment'}
            </ThemedText>

            <TextField label="Title" value={title} onChangeText={setTitle} />
            <TextField
              label="Provider (optional)"
              value={provider}
              onChangeText={setProvider}
              placeholder="e.g. Dr. Patel"
            />
            <TextField label="Location (optional)" value={location} onChangeText={setLocation} />
            <ThemedView style={styles.dateTimeRow}>
              <ThemedView style={styles.dateTimeField}>
                <TextField
                  label="Date (YYYY-MM-DD)"
                  value={dateStr}
                  onChangeText={setDateStr}
                  keyboardType="numbers-and-punctuation"
                />
              </ThemedView>
              <ThemedView style={styles.dateTimeField}>
                <TextField
                  label="Time (HH:MM)"
                  value={timeStr}
                  onChangeText={setTimeStr}
                  keyboardType="numbers-and-punctuation"
                />
              </ThemedView>
            </ThemedView>

            {editingId ? (
              <ThemedView style={styles.statusSection}>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  Status
                </ThemedText>
                <ChipRow options={STATUS_OPTIONS} activeKey={status} onSelect={setStatus} />
              </ThemedView>
            ) : null}

            <TextField
              label="Post-visit notes (optional)"
              value={notes}
              onChangeText={setNotes}
              multiline
            />

            {formError ? (
              <ThemedText type="small" themeColor="statusCritical">
                {formError}
              </ThemedText>
            ) : null}

            <PrimaryButton
              title={editingId ? 'Save Changes' : 'Add Appointment'}
              onPress={handleSave}
              isLoading={isSaving}
            />
            {editingId ? (
              <Pressable
                onPress={resetForm}
                accessibilityRole="button"
                accessibilityLabel="Cancel editing"
              >
                <ThemedText type="link">Cancel editing</ThemedText>
              </Pressable>
            ) : null}
          </ThemedView>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  section: {
    gap: Spacing.two,
  },
  appointmentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  appointmentInfo: {
    flex: 1,
    gap: Spacing.half,
  },
  rowActions: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  form: {
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  dateTimeRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  dateTimeField: {
    flex: 1,
  },
  statusSection: {
    gap: Spacing.one,
  },
});
