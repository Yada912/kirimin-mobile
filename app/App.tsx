import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { ORDER_STATUS_LABELS, ROLE_LABELS, PACKAGE_SIZE_INFO } from '@kirimin/shared';

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Kirimin Mobile</Text>
      <Text style={styles.subtitle}>Crowdsourced Delivery</Text>
      <View style={styles.card}>
        <Text style={styles.label}>Shared Domain Test:</Text>
        <Text style={styles.item}>• Roles: {ROLE_LABELS.sender} & {ROLE_LABELS.driver}</Text>
        <Text style={styles.item}>• Sample Status: {ORDER_STATUS_LABELS.requested}</Text>
        <Text style={styles.item}>• Sample Size: {PACKAGE_SIZE_INFO.XS.label} ({PACKAGE_SIZE_INFO.XS.hint})</Text>
      </View>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1463F3',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748B',
    marginBottom: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 8,
  },
  item: {
    fontSize: 14,
    color: '#334155',
    marginVertical: 2,
  },
});
