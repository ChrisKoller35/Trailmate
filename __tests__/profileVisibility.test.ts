import { getProfileVisibility, ProfileVisibilityInput } from '../lib/profileVisibility';

const base: ProfileVisibilityInput = {
  viewerId: 'me',
  profileId: 'other',
  profile: { is_private: false },
  followStatus: 'none',
  isMutual: false,
};

describe('getProfileVisibility', () => {
  it('erkennt das eigene Profil', () => {
    expect(getProfileVisibility({ ...base, profileId: 'me' }).mode).toBe('own');
  });

  it('zeigt «nicht verfügbar», wenn RLS nichts liefert', () => {
    const v = getProfileVisibility({ ...base, profile: null, isMutual: true });
    expect(v).toEqual({ mode: 'unavailable', showPosts: false, showMessage: false });
  });

  it('zeigt «privat», wenn RLS nichts liefert, aber eine private Karte da ist', () => {
    const v = getProfileVisibility({ ...base, profile: null, card: { is_private: true }, isMutual: true });
    expect(v).toEqual({ mode: 'private', showPosts: false, showMessage: false });
  });

  it('zeigt «nicht verfügbar» ohne Karte (blockiert oder gelöscht)', () => {
    expect(getProfileVisibility({ ...base, profile: null, card: null }).mode).toBe('unavailable');
  });

  it('zeigt «nicht verfügbar» bei öffentlicher Karte ohne Profil', () => {
    expect(getProfileVisibility({ ...base, profile: null, card: { is_private: false } }).mode).toBe('unavailable');
  });

  it('zeigt bei privatem Profil ohne Folgen nur den Kopf', () => {
    const v = getProfileVisibility({ ...base, profile: { is_private: true } });
    expect(v).toEqual({ mode: 'private', showPosts: false, showMessage: false });
  });

  it('behandelt eine offene Anfrage wie nicht folgen', () => {
    const v = getProfileVisibility({ ...base, profile: { is_private: true }, followStatus: 'requested' });
    expect(v.mode).toBe('private');
  });

  it('zeigt privates Profil vollständig, wenn ich folge', () => {
    const v = getProfileVisibility({ ...base, profile: { is_private: true }, followStatus: 'following' });
    expect(v).toEqual({ mode: 'full', showPosts: true, showMessage: false });
  });

  it('zeigt «Nachricht» nur bei gegenseitigem Folgen', () => {
    expect(getProfileVisibility(base).showMessage).toBe(false);
    expect(getProfileVisibility({ ...base, followStatus: 'following' }).showMessage).toBe(false);
    expect(getProfileVisibility({ ...base, followStatus: 'following', isMutual: true }).showMessage).toBe(true);
  });

  it('zeigt ohne Anmeldung keine Nachricht', () => {
    expect(getProfileVisibility({ ...base, viewerId: null, isMutual: true }).showMessage).toBe(false);
  });
});
