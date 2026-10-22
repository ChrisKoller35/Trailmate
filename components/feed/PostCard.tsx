import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  FlatList,
  Dimensions,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Video, ResizeMode } from 'expo-av';
import { Colors } from '../../constants';
import { usePostMessages } from '../../hooks/usePostMessages';
import { showErrorToast, showSuccessToast } from '../../lib/toast';
import Avatar from '../ui/Avatar';
import type { FeedPost } from '../../types';
import type { SACScale } from '../../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MAX_MEDIA_HEIGHT = 500;
const FALLBACK_MEDIA_HEIGHT = Math.min(SCREEN_WIDTH * 0.6, 340);

interface PostCardProps {
  post: FeedPost;
  isLiked: boolean;
  isBookmarked: boolean;
  onLike: () => void;
  onBookmark: () => void;
  onComment: () => void;
  onReport: () => void;
  onDelete?: () => void;
  isOwnPost?: boolean;
  route?: {
    title: string | null;
    distance_m: number | null;
    elevation_gain_m: number | null;
    sac_scale: SACScale | null;
  } | null;
}

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Jetzt';
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w`;
  return new Date(dateStr).toLocaleDateString('de-CH', { day: 'numeric', month: 'short' });
}

function formatDistance(meters: number | null): string {
  if (meters == null) return '–';
  return meters >= 1000
    ? `${(meters / 1000).toFixed(1)} km`
    : `${Math.round(meters)} m`;
}

export default function PostCard({
  post,
  isLiked,
  isBookmarked,
  onLike,
  onBookmark,
  onComment,
  onReport,
  onDelete,
  isOwnPost,
  route,
}: PostCardProps) {
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [messageOpen, setMessageOpen] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const { sendPostMessage } = usePostMessages();

  const handleSendMessage = async () => {
    const trimmed = messageText.trim();
    if (!trimmed || sendingMessage) return;
    setSendingMessage(true);
    try {
      await sendPostMessage(post.id, post.user_id, trimmed);
      setMessageText('');
      setMessageOpen(false);
      showSuccessToast('Nachricht gesendet.');
    } catch (err) {
      // z. B. Tageslimit (Migration 013): Text bleibt im Feld
      const message = (err as { message?: unknown } | null)?.message;
      showErrorToast(typeof message === 'string' && message ? message : 'Nachricht konnte nicht gesendet werden.');
    } finally {
      setSendingMessage(false);
    }
  };

  const mediaList = post.media_urls ?? [];
  const hasMedia = mediaList.length > 0;
  const hasMultipleMedia = mediaList.length > 1;

  // Use the first item's aspect ratio; fall back to default
  const firstItem = mediaList[0];
  const mediaHeight = (firstItem?.width && firstItem?.height)
    ? Math.min(Math.round(SCREEN_WIDTH * firstItem.height / firstItem.width), MAX_MEDIA_HEIGHT)
    : FALLBACK_MEDIA_HEIGHT;
  const mediaImageStyle = { width: SCREEN_WIDTH, height: mediaHeight };

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          style={styles.userInfo}
          onPress={() => router.push(`/user-profile?id=${post.user_id}`)}
          accessibilityRole="link"
        >
          <Avatar uri={post.avatar_url} size={40} />
          <View style={styles.userMeta}>
            <Text style={styles.username} numberOfLines={1}>
              @{post.username}
            </Text>
            <Text style={styles.timestamp}>{formatTimeAgo(post.created_at)}</Text>
          </View>
        </Pressable>
        <Pressable style={styles.moreButton} onPress={() => setMenuOpen(true)}>
          <Ionicons name="ellipsis-horizontal" size={22} color={Colors.textSecondary} />
        </Pressable>
      </View>

      {/* Inline dropdown menu */}
      {menuOpen && (
        <>
          {/* Transparent backdrop — tap anywhere outside to close */}
          <Pressable style={styles.menuBackdrop} onPress={() => setMenuOpen(false)} />
          <View style={styles.menuDropdown}>
            {isOwnPost ? (
              <Pressable
                style={styles.menuItem}
                onPress={() => {
                  setMenuOpen(false);
                  setConfirmDelete(true);
                }}
              >
                <Ionicons name="trash-outline" size={18} color={Colors.error} />
                <Text style={[styles.menuItemText, { color: Colors.error }]}>Löschen</Text>
              </Pressable>
            ) : (
              <Pressable
                style={styles.menuItem}
                onPress={() => {
                  setMenuOpen(false);
                  onReport();
                }}
              >
                <Ionicons name="flag-outline" size={18} color={Colors.textSecondary} />
                <Text style={styles.menuItemText}>Melden</Text>
              </Pressable>
            )}
          </View>
        </>
      )}

      {/* Media Gallery */}
      {hasMedia && (
        <View style={styles.mediaContainer}>
          <FlatList
            data={mediaList}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(_, i) => `media-${i}`}
            onMomentumScrollEnd={(e) => {
              const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
              setActiveImageIndex(index);
            }}
            renderItem={({ item }) => (
              item.type === 'video' ? (
                <Pressable
                  style={[styles.mediaImage, mediaImageStyle]}
                  onPress={() => setIsMuted((m) => !m)}
                >
                  <Video
                    source={{ uri: item.url }}
                    style={[styles.mediaImage, mediaImageStyle]}
                    resizeMode={ResizeMode.COVER}
                    shouldPlay
                    isLooping
                    isMuted={isMuted}
                    useNativeControls={false}
                  />
                  {isMuted && (
                    <View style={styles.muteIndicator}>
                      <Ionicons name="volume-mute" size={16} color="#fff" />
                    </View>
                  )}
                </Pressable>
              ) : (
                <Image
                  source={{ uri: item.url }}
                  style={[styles.mediaImage, mediaImageStyle]}
                  resizeMode="cover"
                />
              )
            )}
          />
          {hasMultipleMedia && (
            <View style={styles.dotContainer}>
              {mediaList.map((_, i) => (
                <View
                  key={i}
                  style={[styles.dot, i === activeImageIndex && styles.dotActive]}
                />
              ))}
            </View>
          )}
        </View>
      )}

      {/* Route Preview */}
      {route && (
        <Pressable
          style={styles.routePreview}
          onPress={() => router.push({ pathname: '/route-detail', params: { id: post.route_id! } })}
        >
          <Ionicons name="map-outline" size={16} color={Colors.primary} />
          <Text style={styles.routeTitle} numberOfLines={1}>
            {route.title ?? 'Route'}
          </Text>
          <Text style={styles.routeStats}>
            {formatDistance(route.distance_m)}
            {route.elevation_gain_m != null ? ` | ↑${Math.round(route.elevation_gain_m)}m` : ''}
            {route.sac_scale ? ` | ${route.sac_scale}` : ''}
          </Text>
        </Pressable>
      )}

      {/* Content */}
      {post.content && (
        <View style={styles.contentSection}>
          <Text style={styles.content}>{post.content}</Text>
        </View>
      )}

      {/* Engagement Counts */}
      <View style={styles.countsRow}>
        {post.likes_count > 0 && (
          <Text style={styles.countText}>❤️ {post.likes_count}</Text>
        )}
        {post.comments_count > 0 && (
          <Text style={styles.countText}>💬 {post.comments_count}</Text>
        )}
        {post.saves_count > 0 && (
          <Text style={styles.countText}>🔖 {post.saves_count}</Text>
        )}
      </View>

      {/* Action Buttons */}
      <View style={styles.actions}>
        <Pressable style={styles.actionButton} onPress={onLike}>
          <Ionicons
            name={isLiked ? 'heart' : 'heart-outline'}
            size={22}
            color={isLiked ? Colors.error : Colors.textSecondary}
          />
          <Text style={[styles.actionText, isLiked && { color: Colors.error }]}>Like</Text>
        </Pressable>

        <Pressable style={styles.actionButton} onPress={onComment}>
          <Ionicons name="chatbubble-outline" size={20} color={Colors.textSecondary} />
          <Text style={styles.actionText}>Kommentar</Text>
        </Pressable>

        <Pressable style={styles.actionButton} onPress={onBookmark}>
          <Ionicons
            name={isBookmarked ? 'bookmark' : 'bookmark-outline'}
            size={20}
            color={isBookmarked ? Colors.primary : Colors.textSecondary}
          />
          <Text style={[styles.actionText, isBookmarked && { color: Colors.primary }]}>
            Speichern
          </Text>
        </Pressable>

        {!isOwnPost && (
          <Pressable style={styles.actionButton} onPress={() => setMessageOpen(true)}>
            <Ionicons name="mail-outline" size={20} color={Colors.textSecondary} />
            <Text style={styles.actionText}>Nachricht</Text>
          </Pressable>
        )}
      </View>

      {/* Private message to the post owner */}
      <Modal
        visible={messageOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMessageOpen(false)}
      >
        <Pressable style={styles.confirmOverlay} onPress={() => setMessageOpen(false)}>
          <Pressable style={styles.confirmBox}>
            <Text style={styles.confirmTitle}>Nachricht an @{post.username}</Text>
            <TextInput
              style={styles.messageInput}
              placeholder="Deine Nachricht..."
              placeholderTextColor={Colors.textLight}
              value={messageText}
              onChangeText={setMessageText}
              multiline
              maxLength={2000}
              autoFocus
            />
            <View style={styles.confirmButtons}>
              <Pressable style={styles.confirmCancelBtn} onPress={() => setMessageOpen(false)}>
                <Text style={styles.confirmCancelText}>Abbrechen</Text>
              </Pressable>
              <Pressable
                style={[styles.messageSendBtn, !messageText.trim() && { opacity: 0.5 }]}
                onPress={handleSendMessage}
                disabled={!messageText.trim() || sendingMessage}
              >
                {sendingMessage ? (
                  <ActivityIndicator size="small" color={Colors.textOnPrimary} />
                ) : (
                  <Text style={styles.confirmDeleteText}>Senden</Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Delete confirmation modal */}
      <Modal
        visible={confirmDelete}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmDelete(false)}
      >
        <Pressable style={styles.confirmOverlay} onPress={() => setConfirmDelete(false)}>
          <Pressable style={styles.confirmBox}>
            <Text style={styles.confirmTitle}>Beitrag löschen?</Text>
            <Text style={styles.confirmText}>
              Dieser Beitrag wird unwiderruflich gelöscht.
            </Text>
            <View style={styles.confirmButtons}>
              <Pressable
                style={styles.confirmCancelBtn}
                onPress={() => setConfirmDelete(false)}
              >
                <Text style={styles.confirmCancelText}>Abbrechen</Text>
              </Pressable>
              <Pressable
                style={styles.confirmDeleteBtn}
                onPress={() => {
                  setConfirmDelete(false);
                  onDelete?.();
                }}
              >
                <Text style={styles.confirmDeleteText}>Ja, löschen</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  userMeta: {
    flex: 1,
  },
  username: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  timestamp: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  moreButton: {
    padding: 8,
    marginRight: -4,
  },
  // Dropdown menu
  menuBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
  },
  menuDropdown: {
    position: 'absolute',
    top: 52,
    right: 12,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 20,
    minWidth: 140,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  menuItemText: {
    fontSize: 15,
    color: Colors.text,
    fontWeight: '500',
  },
  // Media
  mediaContainer: {
    position: 'relative',
  },
  mediaImage: {
    width: SCREEN_WIDTH,
  },
  muteIndicator: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 14,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotContainer: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  dotActive: {
    backgroundColor: '#fff',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  routePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.surfaceVariant,
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 10,
    gap: 8,
  },
  routeTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
    flex: 1,
  },
  routeStats: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  contentSection: {
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  content: {
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
  },
  countsRow: {
    flexDirection: 'row',
    gap: 14,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  countText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  actions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.borderLight,
    marginTop: 4,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 4,
  },
  actionText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  // Delete confirmation modal
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBox: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 24,
    width: 300,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  confirmTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 8,
  },
  confirmText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  confirmButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  confirmCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: Colors.surfaceVariant,
    alignItems: 'center',
  },
  confirmCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  confirmDeleteBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: Colors.error,
    alignItems: 'center',
  },
  messageInput: {
    width: '100%',
    minHeight: 80,
    maxHeight: 160,
    backgroundColor: Colors.surfaceVariant,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: Colors.text,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  messageSendBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center',
  },
  confirmDeleteText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
});
