import { View, StyleSheet } from 'react-native';
import { Colors } from '../../constants';

interface ProgressIndicatorProps {
  step: number;
  total: number;
}

export default function ProgressIndicator({ step, total }: ProgressIndicatorProps) {
  return (
    <View style={styles.progress}>
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            i + 1 <= step ? styles.dotActive : styles.dotInactive,
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  progress: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 24,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dotActive: {
    backgroundColor: Colors.primary,
  },
  dotInactive: {
    backgroundColor: Colors.border,
  },
});
