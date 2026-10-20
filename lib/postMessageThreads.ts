// lib/postMessageThreads.ts
// Pure logic for the private inbox per post: group messages into
// conversations (post + other person) and decide who receives a reply.

import type { PostMessage } from '../types';

export interface PostMessageGroup {
  postId: string;
  otherUserId: string;
  /** Chronologically sorted (oldest first) */
  messages: PostMessage[];
  unreadCount: number;
  lastMessageAt: string;
}

/** Groups messages by post and conversation partner, newest conversation first. */
export function groupPostMessages(messages: PostMessage[], userId: string): PostMessageGroup[] {
  const map = new Map<string, PostMessageGroup>();

  for (const msg of messages) {
    const otherUserId = msg.sender_id === userId ? msg.receiver_id : msg.sender_id;
    const key = `${msg.post_id}:${otherUserId}`;
    let group = map.get(key);
    if (!group) {
      group = { postId: msg.post_id, otherUserId, messages: [], unreadCount: 0, lastMessageAt: msg.created_at };
      map.set(key, group);
    }
    group.messages.push(msg);
    if (!msg.is_read && msg.receiver_id === userId) group.unreadCount++;
  }

  const time = (s: string) => new Date(s).getTime();
  return Array.from(map.values())
    .map((g) => {
      g.messages.sort((a, b) => time(a.created_at) - time(b.created_at));
      g.lastMessageAt = g.messages[g.messages.length - 1].created_at;
      return g;
    })
    .sort((a, b) => time(b.lastMessageAt) - time(a.lastMessageAt));
}

/**
 * Picks the conversation of a post that a reply belongs to.
 * - explicit `otherUserId` → that conversation (or null if unknown)
 * - exactly one conversation → that one
 * - several and nothing chosen → null (the screen shows a list first)
 */
export function selectPostThread<T extends { postId: string; otherUserId: string }>(
  threads: T[],
  postId: string,
  otherUserId?: string | null,
): T | null {
  const forPost = threads.filter((t) => t.postId === postId);
  if (otherUserId) return forPost.find((t) => t.otherUserId === otherUserId) ?? null;
  return forPost.length === 1 ? forPost[0] : null;
}

/** Receiver of a reply: always the other person of the chosen conversation. */
export function replyRecipient(thread: { otherUserId: string } | null): string | null {
  return thread?.otherUserId ?? null;
}
