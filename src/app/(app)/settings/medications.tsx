import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/primary-button';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import {
  createMedication,
  deactivateMedication,
  fetchActiveMedications,
  Medication,
  updateMedication,
} from '@/features/medications/api';
import { useHousehold } from '@/features/households/household-provider';

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export default function MedicationsScreen() {
  const { careRecipient } = useHousehold();
  const [medications, setMedications] = useState<Medication[]>([]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [instructions, setInstructions] = useState('');
  const [isPrn, setIsPrn] = useState(false);
  const [scheduleTimes, setScheduleTimes] = useState<string[]>(['']);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const refetch = useCallback(() => {
    if (!careRecipient) return;
    fetchActiveMedications(careRecipient.id).then(setMedications);
  }, [careRecipient]);

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setDosage('');
    setInstructions('');
    setIsPrn(false);
    setScheduleTimes(['']);
    setFormError(null);
  };

  const startEditing = (medication: Medication) => {
    setEditingId(medication.id);
    setName(medication.name);
    setDosage(medication.dosage);
    setInstructions(medication.instructions ?? '');
    setIsPrn(medication.is_prn);
    setScheduleTimes(
      medication.schedule_times.length > 0
        ? medication.schedule_times.map((t) => t.slice(0, 5))
        : ['']
    );
    setFormError(null);
  };

  const handleSave = async () => {
    if (!careRecipient) return;
    setFormError(null);

    if (name.trim().length === 0) {
      setFormError('Please enter a medication name.');
      return;
    }
    if (dosage.trim().length === 0) {
      setFormError('Please enter a dosage.');
      return;
    }

    const trimmedTimes = scheduleTimes.map((t) => t.trim()).filter((t) => t.length > 0);
    if (isPrn && trimmedTimes.length > 0) {
      setFormError(
        'As-needed medications should not have scheduled times — remove them or turn off As-needed.'
      );
      return;
    }
    if (!isPrn) {
      if (trimmedTimes.length === 0) {
        setFormError('Please add at least one scheduled time, or mark this as As-needed.');
        return;
      }
      if (!trimmedTimes.every((t) => TIME_PATTERN.test(t))) {
        setFormError('Please enter times as HH:MM in 24-hour format (e.g. 08:00).');
        return;
      }
    }

    setIsSaving(true);
    const { data, error } = editingId
      ? await updateMedication(
          editingId,
          name.trim(),
          dosage.trim(),
          instructions.trim() || null,
          isPrn,
          trimmedTimes
        )
      : await createMedication(
          careRecipient.id,
          name.trim(),
          dosage.trim(),
          instructions.trim() || null,
          isPrn,
          trimmedTimes
        );
    setIsSaving(false);

    if (error) {
      setFormError('Something went wrong saving that medication. Please try again.');
      return;
    }
    if (data) {
      resetForm();
      refetch();
    }
  };

  const handleRemove = async (medication: Medication) => {
    setRemovingId(medication.id);
    const { error } = await deactivateMedication(medication.id);
    setRemovingId(null);
    if (!error) {
      setMedications((current) => current.filter((m) => m.id !== medication.id));
      if (editingId === medication.id) resetForm();
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <Link href="/settings">
            <ThemedText type="link">← Back to Settings</ThemedText>
          </Link>

          <ThemedText type="title">Medications</ThemedText>

          {medications.map((medication) => (
            <ThemedView key={medication.id} style={styles.medicationRow}>
              <ThemedView style={styles.medicationInfo}>
                <ThemedText type="default">
                  {medication.name} · {medication.dosage}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {medication.is_prn
                    ? 'As needed'
                    : medication.schedule_times.map((t) => t.slice(0, 5)).join(', ')}
                </ThemedText>
              </ThemedView>
              <ThemedView style={styles.rowActions}>
                <Pressable onPress={() => startEditing(medication)}>
                  <ThemedText type="link">Edit</ThemedText>
                </Pressable>
                <Pressable
                  onPress={() => handleRemove(medication)}
                  disabled={removingId === medication.id}
                >
                  <ThemedText type="link" themeColor="statusCritical">
                    {removingId === medication.id ? 'Removing…' : 'Remove'}
                  </ThemedText>
                </Pressable>
              </ThemedView>
            </ThemedView>
          ))}

          <ThemedView style={styles.form}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              {editingId ? 'Edit medication' : 'Add a medication'}
            </ThemedText>

            <TextField label="Name" value={name} onChangeText={setName} />
            <TextField
              label="Dosage"
              value={dosage}
              onChangeText={setDosage}
              placeholder="e.g. 5mg"
            />
            <TextField
              label="Instructions (optional)"
              value={instructions}
              onChangeText={setInstructions}
            />

            <ThemedView style={styles.prnRow}>
              <ThemedText type="default">As needed (no schedule)</ThemedText>
              <Switch value={isPrn} onValueChange={setIsPrn} />
            </ThemedView>

            {!isPrn ? (
              <ThemedView style={styles.timesSection}>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  Scheduled times
                </ThemedText>
                {scheduleTimes.map((time, index) => (
                  <ThemedView key={index} style={styles.timeRow}>
                    <ThemedView style={styles.timeField}>
                      <TextField
                        label={`Time ${index + 1} (HH:MM)`}
                        value={time}
                        onChangeText={(value) =>
                          setScheduleTimes((current) =>
                            current.map((t, i) => (i === index ? value : t))
                          )
                        }
                        keyboardType="numbers-and-punctuation"
                      />
                    </ThemedView>
                    <Pressable
                      onPress={() =>
                        setScheduleTimes((current) => current.filter((_, i) => i !== index))
                      }
                    >
                      <ThemedText type="link" themeColor="statusCritical">
                        Remove
                      </ThemedText>
                    </Pressable>
                  </ThemedView>
                ))}
                <Pressable onPress={() => setScheduleTimes((current) => [...current, ''])}>
                  <ThemedText type="linkPrimary">+ Add another time</ThemedText>
                </Pressable>
              </ThemedView>
            ) : null}

            {formError ? (
              <ThemedText type="small" themeColor="statusCritical">
                {formError}
              </ThemedText>
            ) : null}

            <PrimaryButton
              title={editingId ? 'Save Changes' : 'Add Medication'}
              onPress={handleSave}
              isLoading={isSaving}
            />
            {editingId ? (
              <Pressable onPress={resetForm}>
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
  medicationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  medicationInfo: {
    flex: 1,
    gap: Spacing.half,
  },
  rowActions: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  form: {
    gap: Spacing.two,
    marginTop: Spacing.four,
  },
  prnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timesSection: {
    gap: Spacing.two,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  timeField: {
    flex: 1,
  },
});
