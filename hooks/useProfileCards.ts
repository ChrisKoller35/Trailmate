// hooks/useProfileCards.ts
// Profilkarten und Personensuche über die RPCs aus Migration 019.
// Eine Karte gibt es auch für private Profile (users_select blendet sie für
// Nicht-Follower aus); bei Blockierung in einer Richtung fehlt sie.

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';

export interface ProfileCard {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  is_private: boolean;
  is_verified: boolean;
}

/** Mindestlänge der Suche nach trim, wie in search_profiles. */
export const MIN_SEARCH_LENGTH = 2;

/** Suchbegriff ohne Leerzeichen am Rand und ohne führendes @ («@anna» → «anna»). */
export function normalizeSearchTerm(query: string): string {
  return query.trim().replace(/^@+/, '').trim();
}

/** Lädt Profilkarten mit einem einzigen RPC-Aufruf. Leere Liste: kein Aufruf. */
export async function fetchProfileCards(ids: (string | null | undefined)[]): Promise<ProfileCard[]> {
  const unique = [...new Set(ids.filter((id): id is string => !!id))];
  if (unique.length === 0) return [];

  const { data, error } = await supabase.rpc('get_profile_cards', { p_ids: unique });
  if (error) throw error;
  return (data ?? []) as ProfileCard[];
}

/** Sucht Personen nach Username oder Anzeigename. Unter 2 Zeichen: kein Aufruf. */
export async function searchProfiles(query: string): Promise<ProfileCard[]> {
  const term = normalizeSearchTerm(query);
  if (term.length < MIN_SEARCH_LENGTH) return [];

  const { data, error } = await supabase.rpc('search_profiles', { p_query: term });
  if (error) throw error;
  return (data ?? []) as ProfileCard[];
}

export function useProfileSearch(query: string) {
  const userId = useAuthStore((s) => s.user?.id);
  const term = normalizeSearchTerm(query);

  return useQuery({
    queryKey: ['profiles', 'search', userId ?? '', term.toLowerCase()] as const,
    queryFn: () => searchProfiles(term),
    enabled: !!userId && term.length >= MIN_SEARCH_LENGTH,
    staleTime: 30_000,
  });
}
