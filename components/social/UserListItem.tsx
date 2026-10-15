import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Colors } from '../../constants';
import Avatar from '../ui/Avatar';

interface UserListItemUser {
  id: string;
  username: string;
  display_name?: string | null;
  avatar_url?: string | null;
  home_region?: string | null;
  hiking_level?: string | null;
}

interface UserListItemProps {
  user: UserListItemUser;
  rightAction?: React.ReactNode;
  onPress?: () => void;
}

export default function UserListItem({ user, rightAction, onPress }: UserListItemProps) {
  const content = (
    <View style={styles.row}>
      <Avatar uri={user.avatar_url ?? null} size={44} />
      <View style={styles.info}>
        <Text style={styles.displayName} numberOfLines={1}>
          {user.display_name || user.username}
        </Text>
        <Text style={styles.username} numberOfLines={1}>
          @{user.username}
        </Text>
      </View>
      {rightAction && <View style={styles.action}>{rightAction}</View>}
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
        {content}
      </Pressable>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  info: {
    flex: 1,
    marginLeft: 12,
  },
  displayName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  username: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  action: {
    marginLeft: 8,
  },
  pressed: {
    opacity: 0.7,
  },
});
