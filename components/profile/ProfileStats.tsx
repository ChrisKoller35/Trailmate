import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants';

interface ProfileStatsProps {
  stats: {
    totalTours: number;
    totalKm: number;
    totalElevation: number;
  };
}

export default function ProfileStats({ stats }: ProfileStatsProps) {
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <StatItem label="Touren" value={stats.totalTours.toString()} />
        <View style={styles.divider} />
        <StatItem label="Kilometer" value={`${stats.totalKm} km`} />
        <View style={styles.divider} />
        <StatItem label="Höhenmeter" value={`${stats.totalElevation} m`} />
      </View>
    </View>
  );
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statItem}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.primary,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  divider: {
    width: 1,
    backgroundColor: Colors.borderLight,
  },
});
