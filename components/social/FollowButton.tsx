import { useState, useEffect, useCallback } from 'react';
import { Pressable, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { Colors } from '../../constants';
import { useFollow } from '../../hooks/useFollow';

interface FollowButtonProps {
  targetUserId: string;
  size?: 'small' | 'default';
  onStatusChange?: (status: 'following' | 'requested' | 'none') => void;
}

export default function FollowButton({
  targetUserId,
  size = 'default',
  onStatusChange,
}: FollowButtonProps) {
  const { follow, unfollow, getFollowStatus } = useFollow();
  const [status, setStatus] = useState<'following' | 'requested' | 'none'>('none');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    getFollowStatus(targetUserId).then((s) => {
      if (mounted) {
        setStatus(s);
        setLoading(false);
      }
    });
    return () => { mounted = false; };
  }, [targetUserId, getFollowStatus]);

  const handlePress = useCallback(async () => {
    setLoading(true);
    try {
      if (status === 'following') {
        await unfollow(targetUserId);
        setStatus('none');
        onStatusChange?.('none');
      } else if (status === 'none') {
        await follow(targetUserId);
        const newStatus = await getFollowStatus(targetUserId);
        setStatus(newStatus);
        onStatusChange?.(newStatus);
      } else {
        // requested → cancel by unfollowing (removes the request)
        await unfollow(targetUserId);
        setStatus('none');
        onStatusChange?.('none');
      }
    } finally {
      setLoading(false);
    }
  }, [status, targetUserId, follow, unfollow, getFollowStatus, onStatusChange]);

  const isSmall = size === 'small';

  const label =
    status === 'following'
      ? 'Folge ich'
      : status === 'requested'
        ? 'Angefragt'
        : 'Folgen';

  const isFilled = status === 'following';
  const isOutline = status === 'none' || status === 'requested';

  return (
    <Pressable
      onPress={handlePress}
      disabled={loading}
      style={[
        styles.button,
        isSmall && styles.buttonSmall,
        isFilled && styles.filled,
        isOutline && styles.outline,
        status === 'requested' && styles.requested,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={isFilled ? Colors.textOnPrimary : Colors.primary}
        />
      ) : (
        <Text
          style={[
            styles.label,
            isSmall && styles.labelSmall,
            isFilled && styles.labelFilled,
            isOutline && styles.labelOutline,
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 90,
  },
  buttonSmall: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    minWidth: 72,
  },
  filled: {
    backgroundColor: Colors.primary,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  requested: {
    borderColor: Colors.border,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
  },
  labelSmall: {
    fontSize: 12,
  },
  labelFilled: {
    color: Colors.textOnPrimary,
  },
  labelOutline: {
    color: Colors.primary,
  },
});
