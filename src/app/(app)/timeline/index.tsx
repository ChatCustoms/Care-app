import { StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Milestone 9: unified chronological care timeline with filters
export default function TimelineScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Timeline</Text>
      <Text style={styles.note}>Chronological care history — Milestone 9</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: '600', color: '#111' },
  note: { fontSize: 14, color: '#888', marginTop: 8, textAlign: 'center', paddingHorizontal: 32 },
});
