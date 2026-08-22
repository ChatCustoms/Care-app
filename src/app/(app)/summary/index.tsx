import { StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Milestone 10: date-range care summaries for doctor appointments
export default function SummaryScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Summary</Text>
      <Text style={styles.note}>Date-range care summaries — Milestone 10</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: '600', color: '#111' },
  note: { fontSize: 14, color: '#888', marginTop: 8, textAlign: 'center', paddingHorizontal: 32 },
});
