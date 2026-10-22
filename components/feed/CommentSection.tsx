import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors } from '../../constants';
import Avatar from '../ui/Avatar';
import { usePostActions } from '../../hooks/usePostActions';
import { useAuthStore } from '../../stores/authStore';
import { chooseAction } from '../../lib/dialog';
import { showErrorToast, showInfoToast, showSuccessToast } from '../../lib/toast';
import type { Comment } from '../../types';

interface CommentWithUser extends Comment {
  username: string;
  avatar_url: string | null;
}

interface CommentSectionProps {
  postId: string;
  visible: boolean;
  onClose: () => void;
  onCommentCountChange?: (delta: number) => void;
}

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Jetzt';
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export default function CommentSection({
  postId,
  visible,
  onClose,
  onCommentCountChange,
}: CommentSectionProps) {
  const profile = useAuthStore((s) => s.profile);
  const { fetchComments, addComment, deleteComment, reportComment } = usePostActions();
  const [comments, setComments] = useState<CommentWithUser[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const loadComments = useCallback(async () => {
    setIsLoading(true);
    const data = await fetchComments(postId);
    setComments(data);
    setIsLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  useEffect(() => {
    if (visible) {
      loadComments();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, postId]);

  const handleSend = async () => {
    if (!newComment.trim() || isSending) return;

    setIsSending(true);
    const result = await addComment(postId, newComment);
    if (result) {
      // Optimistic: add to list immediately
      setComments((prev) => [
        ...prev,
        {
          ...result,
          username: profile?.username ?? 'Du',
          avatar_url: profile?.avatar_url ?? null,
        },
      ]);
      setNewComment('');
      onCommentCountChange?.(1);
    }
    setIsSending(false);
  };

  const handleDelete = async (commentId: string) => {
    await deleteComment(commentId, postId);
    setComments((prev) => prev.filter((c) => c.id !== commentId));
    onCommentCountChange?.(-1);
  };

  const handleReportComment = async (commentId: string) => {
    const reason = await chooseAction(
      'Kommentar melden',
      [
        { label: 'Spam', value: 'spam' },
        { label: 'Beleidigung', value: 'abuse' },
        { label: 'Unangemessen', value: 'inappropriate' },
      ],
      'Warum möchtest du diesen Kommentar melden?',
    );
    if (reason === 'spam' || reason === 'abuse' || reason === 'inappropriate') {
      await doReport(commentId, reason);
    }
  };

  const doReport = async (commentId: string, reason: 'spam' | 'abuse' | 'fake' | 'inappropriate') => {
    try {
      const alreadyReported = await reportComment(commentId, reason);
      if (alreadyReported) {
        showInfoToast('Du hast diesen Kommentar schon gemeldet.');
      } else {
        showSuccessToast('Danke für deine Meldung. Wir prüfen den Kommentar.');
      }
    } catch {
      showErrorToast('Meldung konnte nicht gesendet werden.');
    }
  };

  if (!visible) return null;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Kommentare ({comments.length})</Text>
        <Pressable onPress={onClose} hitSlop={8}>
          <Ionicons name="close" size={24} color={Colors.text} />
        </Pressable>
      </View>

      {/* Comment List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={comments}
          keyExtractor={(item) => item.id}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Noch keine Kommentare</Text>
              <Text style={styles.emptySubtext}>
                Sei der Erste, der kommentiert!
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.commentItem}>
              <Avatar uri={item.avatar_url} size={32} />
              <View style={styles.commentContent}>
                <View style={styles.commentHeader}>
                  <Pressable onPress={() => router.push(`/user-profile?id=${item.user_id}`)} hitSlop={4}>
                    <Text style={styles.commentUsername}>@{item.username}</Text>
                  </Pressable>
                  <Text style={styles.commentTime}>
                    {formatTimeAgo(item.created_at)}
                  </Text>
                </View>
                <Text style={styles.commentText}>{item.content}</Text>
              </View>
              {item.user_id === profile?.id ? (
                <Pressable
                  onPress={() => handleDelete(item.id)}
                  hitSlop={8}
                  style={styles.deleteButton}
                >
                  <Ionicons name="trash-outline" size={16} color={Colors.textLight} />
                </Pressable>
              ) : (
                <Pressable
                  onPress={() => handleReportComment(item.id)}
                  hitSlop={8}
                  style={styles.deleteButton}
                >
                  <Ionicons name="flag-outline" size={16} color={Colors.textLight} />
                </Pressable>
              )}
            </View>
          )}
        />
      )}

      {/* Input */}
      <View style={styles.inputContainer}>
        <Avatar uri={profile?.avatar_url ?? null} size={32} />
        <TextInput
          style={styles.input}
          placeholder="Kommentar schreiben..."
          placeholderTextColor={Colors.textLight}
          value={newComment}
          onChangeText={setNewComment}
          multiline
          maxLength={500}
        />
        <Pressable
          onPress={handleSend}
          disabled={!newComment.trim() || isSending}
          style={[styles.sendButton, !newComment.trim() && styles.sendButtonDisabled]}
        >
          {isSending ? (
            <ActivityIndicator size="small" color={Colors.surface} />
          ) : (
            <Ionicons name="send" size={18} color={Colors.surface} />
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    maxHeight: 400,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  loadingContainer: {
    padding: 24,
    alignItems: 'center',
  },
  list: {
    maxHeight: 260,
  },
  listContent: {
    padding: 12,
    gap: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  emptySubtext: {
    fontSize: 13,
    color: Colors.textLight,
    marginTop: 4,
  },
  commentItem: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  commentContent: {
    flex: 1,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  commentUsername: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  commentTime: {
    fontSize: 11,
    color: Colors.textLight,
  },
  commentText: {
    fontSize: 14,
    color: Colors.text,
    lineHeight: 19,
    marginTop: 2,
  },
  deleteButton: {
    padding: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.borderLight,
    gap: 10,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
    maxHeight: 80,
    backgroundColor: Colors.surfaceVariant,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
});
