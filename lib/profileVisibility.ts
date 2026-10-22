// lib/profileVisibility.ts
// Entscheidet, was der Screen für ein fremdes Profil zeigt.
// Reine Funktion, damit sie ohne Supabase getestet werden kann.

export type FollowStatus = 'following' | 'requested' | 'none';

export type ProfileMode = 'own' | 'unavailable' | 'private' | 'full';

export interface ProfileVisibilityInput {
  viewerId: string | null | undefined;
  profileId: string;
  /** null, wenn RLS nichts liefert (blockiert oder gelöscht). */
  profile: { is_private: boolean | null } | null;
  followStatus: FollowStatus;
  /** Ergebnis von canDM (gegenseitiges Folgen). */
  isMutual: boolean;
}

export interface ProfileVisibility {
  mode: ProfileMode;
  showPosts: boolean;
  showMessage: boolean;
}

export function getProfileVisibility({
  viewerId,
  profileId,
  profile,
  followStatus,
  isMutual,
}: ProfileVisibilityInput): ProfileVisibility {
  if (viewerId && viewerId === profileId) {
    return { mode: 'own', showPosts: false, showMessage: false };
  }
  if (!profile) {
    return { mode: 'unavailable', showPosts: false, showMessage: false };
  }
  if (profile.is_private && followStatus !== 'following') {
    return { mode: 'private', showPosts: false, showMessage: false };
  }
  return { mode: 'full', showPosts: true, showMessage: !!viewerId && isMutual };
}
