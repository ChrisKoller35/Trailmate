import { useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import type { ReportReason } from '../types';

// ─── Constants ─────────────────────────────────────────────
// Muss zu den Triggern in supabase/migrations/015_limits.sql passen.
export const MAX_POSTS_PER_HOUR = 5;
export const MAX_DMS_PER_DAY = 50;

// Word filter (insults, spam keywords, etc.)
export const BLOCKED_WORDS = [
  'spam',
  'scam',
  'fake',
  'betrug',
  'idiot',
  'arschloch',
  'hurensohn',
  'nazi',
  'heil',
  'scheiss',
  'fick',
  'wichser',
];

interface ReportParams {
  reportedUserId?: string;
  postId?: string;
  commentId?: string;
  messageId?: string;
  reason: ReportReason;
  description?: string;
}

// ─── Standalone word filter (importable without hook) ────
export function validatePostContent(content: string): { status: 'approved' | 'blocked'; blockedWord?: string } {
  const lower = content.toLowerCase();
  for (const word of BLOCKED_WORDS) {
    const regex = new RegExp(`\\b${word}\\b`, 'i');
    if (regex.test(lower)) {
      return { status: 'blocked', blockedWord: word };
    }
  }
  return { status: 'approved' };
}

// ─── Standalone rate-limit check (requires userId as parameter) ──────
export async function checkRateLimit(type: 'post' | 'dm', userId: string): Promise<boolean> {
  if (type === 'post') {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from('posts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', oneHourAgo);
    return (count ?? 0) < MAX_POSTS_PER_HOUR;
  }
  if (type === 'dm') {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from('direct_messages')
      .select('id', { count: 'exact', head: true })
      .eq('sender_id', userId)
      .gte('created_at', oneDayAgo);
    return (count ?? 0) < MAX_DMS_PER_DAY;
  }
  return true;
}

export function useModeration() {
  const userId = useAuthStore((s) => s.user?.id);

  // ─── Report content ─────────────────────────────────────
  const reportContent = useCallback(
    async (params: ReportParams) => {
      if (!userId) return;

      const { error } = await supabase
        .from('reports')
        .insert({
          reporter_id: userId,
          reported_user_id: params.reportedUserId ?? null,
          post_id: params.postId ?? null,
          comment_id: params.commentId ?? null,
          message_id: params.messageId ?? null,
          reason: params.reason,
          description: params.description ?? null,
          status: 'pending',
        });

      // 23505: schon gemeldet (eindeutige Meldung pro Person, Migration 013) – kein Fehler
      if (error && error.code !== '23505') console.error('Report submission failed:', error);
    },
    [userId],
  );

  // ─── Validate word filter ──────────────────────────────
  const validatePostContent = useCallback(
    (content: string): { valid: boolean; blockedWord?: string } => {
      const lower = content.toLowerCase();

      for (const word of BLOCKED_WORDS) {
        // Check word boundaries to avoid matching partial words
        const regex = new RegExp(`\\b${word}\\b`, 'i');
        if (regex.test(lower)) {
          return { valid: false, blockedWord: word };
        }
      }

      return { valid: true };
    },
    [],
  );

  // ─── Check rate limits ─────────────────────────────────
  const checkRateLimit = useCallback(
    async (type: 'post' | 'dm'): Promise<{ allowed: boolean; remaining: number }> => {
      if (!userId) return { allowed: false, remaining: 0 };

      if (type === 'post') {
        // Count posts in the last hour
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

        const { count } = await supabase
          .from('posts')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .gte('created_at', oneHourAgo);

        const used = count ?? 0;
        return {
          allowed: used < MAX_POSTS_PER_HOUR,
          remaining: Math.max(0, MAX_POSTS_PER_HOUR - used),
        };
      }

      if (type === 'dm') {
        // Count DMs in the last 24 hours
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        const { count } = await supabase
          .from('direct_messages')
          .select('id', { count: 'exact', head: true })
          .eq('sender_id', userId)
          .gte('created_at', oneDayAgo);

        const used = count ?? 0;
        return {
          allowed: used < MAX_DMS_PER_DAY,
          remaining: Math.max(0, MAX_DMS_PER_DAY - used),
        };
      }

      return { allowed: true, remaining: 0 };
    },
    [userId],
  );

  return {
    reportContent,
    validatePostContent,
    checkRateLimit,
    BLOCKED_WORDS,
    MAX_POSTS_PER_HOUR,
    MAX_DMS_PER_DAY,
  };
}
