import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  SafeAreaView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors } from '../constants';
import { showInfoToast, showSuccessToast } from '../lib/toast';
import { useDMs } from '../hooks/useDMs';
import { useModeration } from '../hooks/useModeration';
import { checkRateLimit } from '../hooks/useModeration';
import { useAuthStore } from '../stores/authStore';
import { supabase } from '../lib/supabase';
import Avatar from '../components/ui/Avatar';
import type { DirectMessage } from '../types';

export default function ChatScreen() {
  const router = useRouter();
  const { userId: otherUserId } = useLocalSearchParams<{ userId: string }>();
  const currentUser = useAuthStore((s) => s.user);
  const { messages, fetchMessages, sendMessage, markAsRead, subscribeToMessages, canDM } = useDMs();
  const { reportContent } = useModeration();

  const [text, setText] = useState('');
  const [otherUser, setOtherUser] = useState<{
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [canSendDM, setCanSendDM] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!otherUserId) return;

    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('users')
        .select('username, display_name, avatar_url')
        .eq('id', otherUserId)
        .single();
      if (data) setOtherUser(data);

      // Check mutual follow before allowing DMs
      const mutual = await canDM(otherUserId);
      setCanSendDM(mutual);

      await fetchMessages(otherUserId);
      await markAsRead(otherUserId);
      setLoading(false);
    };
    load();

    const unsubscribe = subscribeToMessages(otherUserId);
    return () => { unsubscribe(); };
  }, [otherUserId, fetchMessages, markAsRead, subscribeToMessages]);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || !otherUserId || sending || !canSendDM) return;

    // Rate limit check
    const allowed = await checkRateLimit('dm', currentUser!.id);
    if (!allowed) {
      showInfoToast('Du hast das Tageslimit für Nachrichten erreicht.');
      return;
    }

    setSending(true);
    setText('');
    await sendMessage(otherUserId, trimmed);
    setSending(false);
  };

  const handleReport = (messageId: string) => {
    Alert.alert('Nachricht melden', 'Möchtest du diese Nachricht melden?', [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Melden',
        style: 'destructive',
        onPress: () => {
          reportContent({ messageId, reason: 'abuse' });
          showSuccessToast('Die Nachricht wurde gemeldet.');
        },
      },
    ]);
  };

  const renderMessage = ({ item }: { item: DirectMessage }) => {
    const isOwn = item.sender_id === currentUser?.id;

    return (
      <Pressable
        onLongPress={() => handleReport(item.id)}
        style={[styles.bubbleWrapper, isOwn ? styles.bubbleRight : styles.bubbleLeft]}
      >
        <View style={[styles.bubble, isOwn ? styles.bubbleOwn : styles.bubbleOther]}>
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
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </Pressable>
        <Pressable style={styles.headerUser}>
          <Avatar uri={otherUser?.avatar_url ?? null} size={32} />
          <Text style={styles.headerName} numberOfLines={1}>
            {otherUser?.display_name || otherUser?.username || '...'}
          </Text>
        </Pressable>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            inverted
            contentContainerStyle={styles.messageList}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="chatbubble-ellipses-outline" size={48} color={Colors.textLight} />
                <Text style={styles.emptyText}>Schreib die erste Nachricht!</Text>
              </View>
            }
          />
        )}

        {/* Input Bar */}
        {canSendDM ? (
          <View style={styles.inputBar}>
            <TextInput
              style={styles.input}
              placeholder="Nachricht..."
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
        ) : (
          <View style={styles.mutualFollowNotice}>
            <Ionicons name="lock-closed-outline" size={16} color={Colors.textSecondary} />
            <Text style={styles.mutualFollowText}>
              Gegenseitiges Folgen nötig, um Nachrichten zu senden
            </Text>
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  headerUser: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginLeft: 12,
  },
  headerName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageList: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  bubbleWrapper: {
    marginVertical: 2,
    maxWidth: '80%',
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
  },
  bubbleOwn: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: Colors.surfaceVariant,
    borderBottomLeftRadius: 4,
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
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
    transform: [{ scaleY: -1 }],
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
  mutualFollowNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: Colors.surfaceVariant,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  mutualFollowText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
});
