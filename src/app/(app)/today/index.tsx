import { StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Milestone 3: next-feed countdown, last feed, quick-log buttons, today's timeline
export default function TodayScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Today</Text>
      <Text style={styles.note}>Next feed countdown and quick-log buttons — Milestone 3</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: '600', color: '#111' },
  note: { fontSize: 14, color: '#888', marginTop: 8, textAlign: 'center', paddingHorizontal: 32 },
});
