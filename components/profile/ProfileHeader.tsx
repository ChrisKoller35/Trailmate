import { View, Text, Pressable, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants';
import Avatar from '../ui/Avatar';
import Button from '../ui/Button';
import type { User } from '../../types';

interface ProfileHeaderProps {
  user: User;
  isOwnProfile: boolean;
  followerCount: number;
  followingCount: number;
  isFollowing: boolean;
  onFollowPress?: () => void;
  onEditPress?: () => void;
  onFollowersPress?: () => void;
  onFollowingPress?: () => void;
}

export default function ProfileHeader({
  user,
  isOwnProfile,
  followerCount,
  followingCount,
  isFollowing,
  onFollowPress,
  onEditPress,
  onFollowersPress,
  onFollowingPress,
}: ProfileHeaderProps) {
  return (
    <View style={styles.container}>
      {/* Cover Image */}
      <View style={styles.coverContainer}>
        {user.cover_image_url ? (
          <Image source={{ uri: user.cover_image_url }} style={styles.coverImage} />
        ) : (
          <View style={styles.coverPlaceholder} />
        )}
      </View>

      {/* Avatar */}
      <View style={styles.avatarContainer}>
        <Avatar uri={user.avatar_url} size={80} />
      </View>

      {/* Info */}
      <View style={styles.infoContainer}>
        <View style={styles.nameRow}>
          <Text style={styles.displayName}>{user.display_name || user.username}</Text>
          {user.is_verified && (
            <Ionicons name="checkmark-circle" size={18} color={Colors.info} style={{ marginLeft: 4 }} />
          )}
          {user.is_premium && (
            <Text style={{ marginLeft: 4, fontSize: 16 }}>⭐</Text>
          )}
          {user.is_private && (
            <Text style={styles.privateIcon}> 🔒</Text>
          )}
        </View>
        <Text style={styles.username}>@{user.username}</Text>

        {user.bio ? <Text style={styles.bio}>{user.bio}</Text> : null}

        {user.home_region ? (
          <Text style={styles.region}>📍 {user.home_region}</Text>
        ) : null}

        {/* Follower / Following Counts */}
        <View style={styles.statsRow}>
          <Pressable onPress={onFollowersPress} style={styles.statItem}>
            <Text style={styles.statCount}>{followerCount}</Text>
            <Text style={styles.statLabel}>Follower</Text>
          </Pressable>
          <Pressable onPress={onFollowingPress} style={styles.statItem}>
            <Text style={styles.statCount}>{followingCount}</Text>
            <Text style={styles.statLabel}>Folge ich</Text>
          </Pressable>
        </View>

        {/* Action Button */}
        <View style={styles.actionRow}>
          {isOwnProfile ? (
            <Button title="Profil bearbeiten" variant="outline" onPress={onEditPress ?? (() => {})} />
          ) : (
            <Button
              title={isFollowing ? 'Entfolgen' : 'Folgen'}
              variant={isFollowing ? 'outline' : 'primary'}
              onPress={onFollowPress ?? (() => {})}
            />
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
  },
  coverContainer: {
    height: 200,
    width: '100%',
  },
  coverImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  coverPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.primaryLight,
  },
  avatarContainer: {
    marginTop: -40,
    marginLeft: 16,
  },
  infoContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  displayName: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
  },
  privateIcon: {
    fontSize: 14,
  },
  username: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  bio: {
    fontSize: 14,
    color: Colors.text,
    marginTop: 8,
    lineHeight: 20,
  },
  region: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 6,
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 24,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statCount: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  statLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  actionRow: {
    marginTop: 12,
  },
});
