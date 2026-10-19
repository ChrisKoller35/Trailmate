import { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  SafeAreaView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors } from '../constants';
import { usePostMessages } from '../hooks/usePostMessages';
import { useAuthStore } from '../stores/authStore';
import { supabase } from '../lib/supabase';
import { showErrorToast } from '../lib/toast';
import { selectPostThread, replyRecipient } from '../lib/postMessageThreads';
import Avatar from '../components/ui/Avatar';
import type { PostMessage } from '../types';

export default function PostMessagesScreen() {
  const router = useRouter();
  const { postId, userId } = useLocalSearchParams<{ postId: string; userId?: string }>();
  const currentUser = useAuthStore((s) => s.user);
  const { postInbox, fetchPostInbox, replyToPostMessage, markPostMessagesRead } = usePostMessages();

  const [text, setText] = useState('');
  const [postTitle, setPostTitle] = useState<string>('Beitrag');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  // Conversation partner; via param or chosen from the list below
  const [selectedUserId, setSelectedUserId] = useState<string | null>(userId ?? null);

  // All threads for this post; with several senders the user picks one first
  const threads = postInbox.filter((t) => t.postId === postId);
  const thread = postId ? selectPostThread(postInbox, postId, selectedUserId) : null;
  const showThreadList = !thread && threads.length > 1;

  const allMessages = (thread?.messages ?? []).map((m) => ({
    ...m,
    otherUsername: thread?.username ?? '',
    otherAvatar: thread?.avatar_url ?? null,
    otherUserId: thread?.otherUserId ?? '',
  }));

  const handleBack = () => {
    if (thread && threads.length > 1 && !userId) setSelectedUserId(null);
    else router.back();
  };

  useEffect(() => {
    if (!postId) return;

    const load = async () => {
      setLoading(true);

      // Load post title
      const { data: post } = await supabase
        .from('posts')
        .select('content')
        .eq('id', postId)
        .single();
      if (post?.content) {
        setPostTitle(post.content.substring(0, 60) + (post.content.length > 60 ? '...' : ''));
      }

      await fetchPostInbox();
      await markPostMessagesRead(postId);
      setLoading(false);
    };
    load();
  }, [postId, fetchPostInbox, markPostMessagesRead]);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || !postId || sending) return;

    // Reply to the sender of the chosen conversation
    const otherUser = replyRecipient(thread);
    if (!otherUser) return;

    setSending(true);
    setText('');
    try {
      await replyToPostMessage(postId, otherUser, trimmed);
    } catch (err) {
      // z. B. Tageslimit (Migration 013): Text zurückgeben statt still zu verlieren
      setText(trimmed);
      const message = (err as { message?: unknown } | null)?.message;
      showErrorToast(typeof message === 'string' && message ? message : 'Nachricht konnte nicht gesendet werden.');
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({
    item,
  }: {
    item: PostMessage & { otherUsername: string; otherAvatar: string | null; otherUserId: string };
  }) => {
    const isOwn = item.sender_id === currentUser?.id;

    return (
      <View style={[styles.bubbleWrapper, isOwn ? styles.bubbleRight : styles.bubbleLeft]}>
        {!isOwn && (
          <Avatar uri={item.otherAvatar} size={28} />
        )}
        <View style={[styles.bubble, isOwn ? styles.bubbleOwn : styles.bubbleOther]}>
          {!isOwn && (
            <Text style={styles.senderName}>{item.otherUsername}</Text>
          )}
          <Text style={[styles.bubbleText, isOwn && styles.bubbleTextOwn]}>
            {item.content}
          </Text>
          <Text style={[styles.bubbleTime, isOwn && styles.bubbleTimeOwn]}>
            {new Date(item.created_at).toLocaleTimeString('de-CH', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={handleBack} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </Pressable>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>Post-Nachrichten</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {postTitle}
          </Text>
        </View>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : showThreadList ? (
          <FlatList
            data={threads}
            keyExtractor={(t) => t.otherUserId}
            renderItem={({ item: t }) => (
              <Pressable style={styles.threadRow} onPress={() => setSelectedUserId(t.otherUserId)}>
                <Avatar uri={t.avatar_url} size={40} />
                <View style={styles.headerInfo}>
                  <Text style={styles.threadName} numberOfLines={1}>
                    {t.display_name ?? `@${t.username}`}
                  </Text>
                  <Text style={styles.headerSubtitle} numberOfLines={1}>
                    {t.messages[t.messages.length - 1]?.content}
                  </Text>
                </View>
                {t.unreadCount > 0 && <View style={styles.unreadDot} />}
              </Pressable>
            )}
          />
        ) : (
          <FlatList
            data={allMessages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            ListEmptyComponent={
              <View style={styles.center}>
                <Ionicons name="mail-open-outline" size={48} color={Colors.textLight} />
                <Text style={styles.emptyText}>Keine Nachrichten</Text>
              </View>
            }
            contentContainerStyle={allMessages.length === 0 ? { flex: 1 } : styles.messageList}
          />
        )}

        {/* Input Bar */}
        {thread && (
          <View style={styles.inputBar}>
            <TextInput
              style={styles.input}
              placeholder="Antworten..."
              placeholderTextColor={Colors.textLight}
              value={text}
              onChangeText={setText}
              multiline
              maxLength={2000}
            />
            <Pressable
              style={[styles.sendButton, !text.trim() && styles.sendButtonDisabled]}
              onPress={handleSend}
              disabled={!text.trim() || sending}
            >
              {sending ? (
                <ActivityIndicator size="small" color={Colors.textOnPrimary} />
              ) : (
                <Ionicons name="send" size={20} color={Colors.textOnPrimary} />
              )}
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  headerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  headerSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  threadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  threadName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
  },
  messageList: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  bubbleWrapper: {
    flexDirection: 'row',
    marginVertical: 3,
    maxWidth: '80%',
    gap: 6,
    alignItems: 'flex-end',
  },
  bubbleRight: {
    alignSelf: 'flex-end',
  },
  bubbleLeft: {
    alignSelf: 'flex-start',
  },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    flexShrink: 1,
  },
  bubbleOwn: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: Colors.surfaceVariant,
    borderBottomLeftRadius: 4,
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primaryDark,
    marginBottom: 2,
  },
  bubbleText: {
    fontSize: 15,
    color: Colors.text,
    lineHeight: 20,
  },
  bubbleTextOwn: {
    color: Colors.textOnPrimary,
  },
  bubbleTime: {
    fontSize: 10,
    color: Colors.textLight,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  bubbleTimeOwn: {
    color: 'rgba(255,255,255,0.7)',
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textLight,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.surfaceVariant,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: Colors.text,
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});
