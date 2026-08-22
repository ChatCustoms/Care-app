import { StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Milestone 11: upcoming/past appointments and post-visit notes
export default function AppointmentsScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Appointments</Text>
      <Text style={styles.note}>Upcoming and past appointments — Milestone 11</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: '600', color: '#111' },
  note: { fontSize: 14, color: '#888', marginTop: 8, textAlign: 'center', paddingHorizontal: 32 },
});
