# TrailMate – Dokument 6: Social Features (Folgen, DMs, Gruppen, Communities, Moderation)

> **Ziel:** Alle sozialen Interaktions-Features implementieren – Folgen-System, Direktnachrichten (DMs), Post-Postfach, Gruppen (öffentlich/privat mit Rängen und Events), Communities, Blockieren und das dreistufige Moderationssystem inkl. Admin-Dashboard. Nach diesem Dokument ist die komplette Social-Schicht funktionsfähig.

> **Voraussetzung:** Dokument 01–05 sind abgearbeitet. Nutzer haben Profile, der Feed funktioniert, Posts können erstellt werden.

---

## 6.1 Folgen-System

### Konzept
- **Asymmetrisches Folgen:** Man kann jemandem folgen ohne dass dieser zurückfolgen muss
- Feed zeigt Posts von allen gefolgten Nutzern
- **Gegenseitiges Folgen** schaltet DMs frei

### Funktionen

| Aktion | Verhalten |
|---|---|
| Folgen | Ein Klick, jederzeit entfolgbar |
| Feed | Zeigt chronologisch Posts aller gefolgten Nutzer |
| Follower/Following | Listen auf dem Profil sichtbar |
| DMs | Nur wenn beide einander folgen |
| Benachrichtigung | Bei neuem Follower |
| Blockieren | Follower können blockiert oder entfernt werden |
| Private Profile | Folgeanfrage nötig, Admin genehmigt |
| Benachrichtigungen | Likes und Kommentare in Einstellungen konfigurierbar (an/aus) |

### Follow-Logic

```typescript
// hooks/useFollow.ts

const follow = async (targetUserId: string) => {
  const targetUser = await getUser(targetUserId);
  
  if (targetUser.is_private) {
    // Private Profile: Folgeanfrage stellen
    await supabase.from('follow_requests').insert({
      requester_id: currentUserId,
      target_id: targetUserId,
      status: 'pending',
    });
    // Notification an Target-User
  } else {
    // Öffentliche Profile: Direkt folgen
    await supabase.from('follows').insert({
      follower_id: currentUserId,
      following_id: targetUserId,
    });
    // Notification an Target-User
  }
};

const unfollow = async (targetUserId: string) => {
  await supabase.from('follows').delete()
    .eq('follower_id', currentUserId)
    .eq('following_id', targetUserId);
};

// Gegenseitiges Folgen prüfen (für DM-Freischaltung)
const isMutualFollow = async (userId1: string, userId2: string): Promise<boolean> => {
  const { data } = await supabase.from('follows')
    .select()
    .or(`and(follower_id.eq.${userId1},following_id.eq.${userId2}),and(follower_id.eq.${userId2},following_id.eq.${userId1})`);
  return data?.length === 2;
};
```

### Folgeanfragen-Screen (Private Profile)

```
┌──────────────────────────────────┐
│  📩 Folgeanfragen (3)            │
│                                  │
│  👤 @wanderlust_ch               │
│  Emmental, T2                    │
│  [✓ Annehmen] [✗ Ablehnen]      │
│                                  │
│  👤 @bergfex_sarah               │
│  Berner Oberland, T3             │
│  [✓ Annehmen] [✗ Ablehnen]      │
│                                  │
│  👤 @alpinist_2000               │
│  Wallis, T4-T6                   │
│  [✓ Annehmen] [✗ Ablehnen]      │
└──────────────────────────────────┘
```

---

## 6.2 Blockieren

### Verhalten (Instagram-Modell)
- Blockierter Nutzer sieht **gar nichts** – kein Profil, keine Posts, als würde der Account nicht existieren
- Blockierter Nutzer kann nicht nach dem Blocker suchen
- Alle bestehenden Follow-Beziehungen werden aufgelöst

### Implementierung

```typescript
const blockUser = async (blockedUserId: string) => {
  // 1. Block-Eintrag erstellen
  await supabase.from('blocks').insert({
    blocker_id: currentUserId,
    blocked_id: blockedUserId,
  });
  
  // 2. Gegenseitige Follow-Beziehungen auflösen
  await supabase.from('follows').delete()
    .or(`and(follower_id.eq.${currentUserId},following_id.eq.${blockedUserId}),and(follower_id.eq.${blockedUserId},following_id.eq.${currentUserId})`);
};
```

### Block-Filter in allen Queries
```sql
-- Muss in JEDER Query eingebaut werden die Nutzer anzeigt
AND user_id NOT IN (
    SELECT blocked_id FROM blocks WHERE blocker_id = $currentUserId
    UNION
    SELECT blocker_id FROM blocks WHERE blocked_id = $currentUserId
)
```

---

## 6.3 Post-Postfach

### Konzept
Zwei getrennte Kommunikationswege:
1. **Post-Postfach** – Jeder Post hat ein eigenes privates Postfach. Andere können dem Post-Ersteller zu diesem Post schreiben, **ohne zu folgen**.
2. **DMs** – Klassische Direktnachrichten, nur bei gegenseitigem Folgen.

### Post-Postfach UI

```
┌──────────────────────────────────┐
│  📬 Nachrichten zu deinen Posts   │
│                                  │
│  Post: "Eiger Trail Tour"        │
│  ├── @wanderlust_ch · 3h         │
│  │   "Wie war die Schneelage     │
│  │    am Eiger Trail?"           │
│  │   [Antworten]                 │
│  ├── @gipfelstuermer · 5h        │
│  │   "Grandios! Kann ich den    │
│  │    GPX-Track haben?"          │
│  │   [Antworten]                 │
│                                  │
│  Post: "Oeschinensee Rundweg"    │
│  ├── @alpinist_2000 · 1d         │
│  │   "Barrierefrei?"             │
│  │   [Antworten]                 │
└──────────────────────────────────┘
```

### Regeln
- Jeder Post bekommt ein eigenes, privates Postfach
- "Nachricht senden"-Button am Post
- Post-Nachrichten erscheinen NICHT im allgemeinen DM-Bereich → gebunden an den jeweiligen Post
- **Beim Löschen eines Posts werden alle zugehörigen Nachrichten ebenfalls gelöscht** (CASCADE)
- Nachrichten können gemeldet und blockiert werden
- Kein fixes Limit – weiches Limit empfohlen (ältere Nachrichten nach 6 Monaten archivieren, Aufwand prüfen)

---

## 6.4 DMs (Direktnachrichten)

### Voraussetzung
DMs nur möglich wenn **beide einander folgen** (gegenseitiges Folgen)

### DM-Übersicht

```
┌──────────────────────────────────┐
│  💬 Nachrichten                   │
│                                  │
│  [DMs] [Post-Postfach]           │
│                                  │
│  👤 @bergfex_sarah          · 2h │
│  "Hast du Lust auf eine Tour     │
│   nächsten Samstag?"             │
│                                  │
│  👤 @wanderlust_ch          · 1d │
│  "Die Route war genial, danke!" │
│                                  │
│  👤 @gipfelstuermer        · 3d │
│  "Treffen wir uns am Bahnhof?" │
└──────────────────────────────────┘
```

### Chat-Screen

```
┌──────────────────────────────────┐
│  ← @bergfex_sarah                │
│                                  │
│       Hast du Lust auf eine Tour │
│       nächsten Samstag?     14:30│
│                                  │
│  Ja klar! Wohin?                 │
│                            14:32 │
│                                  │
│       Vielleicht Oeschinensee?   │
│       T2, ca. 3h            14:35│
│                                  │
│  [Nachricht schreiben...]        │
│  [Senden]                        │
└──────────────────────────────────┘
```

### Realtime Chat (Supabase Realtime)

```typescript
// DM-Subscription
const channel = supabase.channel(`dm:${conversationId}`);

channel.on('broadcast', { event: 'new_message' }, (payload) => {
  // Neue Nachricht anzeigen
  addMessage(payload.data);
});

channel.subscribe();

// Nachricht senden
const sendMessage = async (receiverId: string, content: string) => {
  // 1. In DB speichern
  await supabase.from('direct_messages').insert({
    sender_id: currentUserId,
    receiver_id: receiverId,
    content: content,
  });
  
  // 2. Realtime Broadcast
  channel.send({
    type: 'broadcast',
    event: 'new_message',
    payload: { sender_id: currentUserId, content, created_at: new Date() },
  });
  
  // 3. Push Notification an Empfänger
};
```

---

## 6.5 Gruppen

### Konzept
Kleine, persönlich organisierte Einheiten – z.B. eine SAC-Sektion, ein Freundeskreis oder ein Wanderclub.

### Zwei Gruppentypen

| Typ | Sichtbarkeit | Beitritt |
|---|---|---|
| **Öffentlich** | In der Suche auffindbar | Per Anfrage, Admin genehmigt |
| **Privat** | Nicht auffindbar, nicht sichtbar | Nur per direktem Einladungslink |

### Ränge & Rechte

| Rang | Rechte |
|---|---|
| **Admin** | Volle Rechte: Gruppe erstellen/löschen, Mitglieder entfernen, Posts löschen, Admins/Moderatoren ernennen. Mehrere Admins möglich. |
| **Moderator** | Mitglieder entfernen, Posts löschen. NICHT: Gruppe löschen, Admins ernennen. |
| **Mitglied** | Posts und Fotos in der Gruppe teilen. |

### Gruppen-Post-Verhalten
- Alle Inhalte bleiben innerhalb der Gruppe
- Gruppen-Posts erscheinen **NICHT** im allgemeinen Feed

### Gruppen-UI

```
┌──────────────────────────────────┐
│  [Gruppen-Titelbild]              │
│                                  │
│  🏔️ SAC Sektion Bern             │
│  24 Mitglieder                   │
│  "Die offizielle SAC Sektion..." │
│                                  │
│  [Posts] [Events] [Mitglieder]   │
│                                  │
│  ┌──────────────────────────┐    │
│  │ Post von @bergfex_sarah  │    │
│  │ "Wer kommt nächsten      │    │
│  │  Samstag mit auf den..." │    │
│  └──────────────────────────┘    │
│                                  │
│  [Neuer Post]                    │
└──────────────────────────────────┘
```

### Gruppen-Events

```
┌──────────────────────────────────┐
│  📅 Gruppen-Event erstellen       │
│                                  │
│  Titel: [_______________]        │
│  Beschreibung: [________]        │
│  Datum: [📅 15.07.2026]          │
│  Uhrzeit: [⏰ 08:00]             │
│  Treffpunkt: [📍 Bahnhof Bern]  │
│                                  │
│  [Event erstellen]               │
└──────────────────────────────────┘
```

**Events-Funktionen:**
- Events mit Datum, Uhrzeit und Treffpunkt erstellen
- **In-App-Kalender** mit allen Events aus Gruppen/Communities
- **Zu-/Absage-Funktion** (attending / declined / maybe)
- Kein Export in externen Kalender zum MVP (zu aufwändig)

**Events-Anzeige:**
```
┌──────────────────────────────────┐
│  📅 Nächste Events               │
│                                  │
│  Sa 15.07. – Wanderung Niesen   │
│  🕐 08:00 · 📍 Bahnhof Bern     │
│  ✅ 8 zusagen · ❌ 2 absagen     │
│  [✅ Zusagen] [❌ Absagen]       │
│                                  │
│  So 23.07. – Fondue-Wanderung   │
│  🕐 09:30 · 📍 Parking Biel     │
│  ✅ 12 zusagen · ❌ 1 absage     │
│  [Zugesagt ✓]                    │
└──────────────────────────────────┘
```

### Einladungslink (Private Gruppen)

```typescript
// Einladungslink generieren
const generateInviteLink = (groupId: string, inviteCode: string) => {
  return `https://trailmate.ch/group/join/${inviteCode}`;
};
```

### Weitere Gruppen-Regeln
- Jeder Nutzer kann eine Gruppe erstellen
- Kein Mitgliederlimit
- Mitglieder können eine Gruppe jederzeit verlassen ohne Admin-Benachrichtigung
- Gruppe hat Titelbild, Name und Beschreibung

---

## 6.6 Communities

### Konzept
Grosse, thematische Bereiche – z.B. "Wanderer Schweiz", "T4-T6 Alpinisten" oder "Wanderer Berner Oberland". Auf grosse Mitgliederzahlen ausgelegt.

### Unterschied zu Gruppen
- Communities sind **thematisch** und auf grosse Mitgliederzahlen ausgelegt
- Gruppen sind **persönlich** und organisiert (Verein, Freundeskreis, Sektion)
- Technisch ähnlich, aber andere Nutzungsabsicht

### Erstellung eingeschränkt
- **Nur verifizierte Nutzer, Organisationen oder B2B-Partner** können Communities erstellen
- Verhindert Spam und leere Communities
- Verifizierung: `users.is_verified = true`
- Verifizierungsprozess: E-Mail-Verifikation einer Organisation, manuelle Prüfung durch TrailMate-Team

### B2B-Partner Communities
- Bergbahnen, Tourismusregionen und der SAC können eigene offizielle Communities betreiben
- `communities.is_official = true` → spezielles "Offiziell"-Badge

### Ränge & Rechte
Identisch mit Gruppen: Admin / Moderator / Mitglied

### Community-Beitritt
- Nur per Anfrage → Admin genehmigt
- Communities sind in der Suche auffindbar und nach Thema/Region filterbar

### Community-Vorschläge
- App schlägt Communities basierend auf Heimatregion und Wanderlevel vor

### Community-UI

```
┌──────────────────────────────────┐
│  🔍 Communities entdecken         │
│                                  │
│  Empfohlen für dich:             │
│  ┌──────────────────────────┐    │
│  │ 🏔️ Wanderer Berner Oberland│  │
│  │ 1'245 Mitglieder         │    │
│  │ [Beitreten]               │    │
│  └──────────────────────────┘    │
│  ┌──────────────────────────┐    │
│  │ ⛰️ T4-T6 Alpinisten      │    │
│  │ [Offiziell ✓]            │    │
│  │ 892 Mitglieder           │    │
│  │ [Beitreten]               │    │
│  └──────────────────────────┘    │
└──────────────────────────────────┘
```

---

## 6.7 Moderation (3-Stufen-System)

### Stufe 1: Automatische Filter (regelbasiert, keine KI)

| Filter | Verhalten |
|---|---|
| Spam-Filter | Links in Posts von neuen Accounts (< 7 Tage) → Review-Queue |
| Rate-Limiting | Max. 5 Posts pro Stunde, max. 50 DMs pro Tag |
| Wort-Filter | Blocklist für offensichtlichen Spam/Beleidigungen |
| Duplicate-Detection | Identische Posts/Nachrichten → automatisch blockiert |

```typescript
// Supabase Edge Function: Post-Validierung
const validatePost = async (post: NewPost, user: User) => {
  // Rate Limiting
  const recentPosts = await countRecentPosts(user.id, 1); // letzte Stunde
  if (recentPosts >= 5) throw new Error('Rate limit exceeded');
  
  // Spam-Filter für neue Accounts
  const accountAge = daysSince(user.created_at);
  if (accountAge < 7 && containsLinks(post.content)) {
    await addToReviewQueue(post);
    return { status: 'pending_review' };
  }
  
  // Wort-Filter
  if (containsBlockedWords(post.content)) {
    return { status: 'blocked' };
  }
  
  return { status: 'approved' };
};
```

### Stufe 2: Community-Moderation

- **Melde-Button** auf jedem Post, Kommentar, Nachricht, Profil
- **Ab 3 Meldungen** von verschiedenen Nutzern → Post wird temporär ausgeblendet
- Gruppen-/Community-Moderatoren können in ihrem Bereich moderieren
- **"Trusted User"-Status** nach 50+ Posts ohne Meldung → höheres Gewicht bei Reports

### Stufe 3: TrailMate-Team (manuell)

- **Review-Queue** für gemeldete Inhalte
- Entscheidung: Freigeben / Löschen / Verwarnung / Account-Sperre
- **Eskalationsprotokoll:** 1. Verwarnung → 2. 7-Tage-Sperre → 3. Permanenter Ban
- Am Anfang: **1 Person prüft 1× täglich** die Queue (reicht für < 5'000 Nutzer)

### Admin-Dashboard (Web-App)

```
┌─────────────────────────────────────────────┐
│  TrailMate Admin                             │
│                                              │
│  📊 Heute: 3 offene Reports | 0 kritisch     │
│                                              │
│  Offene Meldungen:                           │
│  ├── Post #4521 – 3× gemeldet – "Spam"      │
│  │   [Ansehen] [Freigeben] [Löschen+Warnung] │
│  ├── Profil @xyz – 2× gemeldet – "Fake"     │
│  │   [Ansehen] [Freigeben] [Sperren]         │
│  └── Kommentar #891 – 4× gemeldet            │
│      [Ansehen] [Freigeben] [Löschen]         │
│                                              │
│  Letzte 7 Tage: 12 Reports, 8 gelöscht      │
└─────────────────────────────────────────────┘
```

**Hinweis:** Das Admin-Dashboard ist eine Web-App (React). Es wird nach dem Mobile-Launch gebaut, für den MVP reicht eine einfache Supabase-Dashboard-Ansicht.

---

## Akzeptanzkriterien – Dokument 6

### Folgen-System
- [ ] Folgen mit einem Klick möglich, jederzeit entfolgbar
- [ ] Feed zeigt chronologisch die Posts aller gefolgten Nutzer
- [ ] Follower- und Following-Liste auf dem Profil sichtbar
- [ ] DMs nur wenn beide einander folgen
- [ ] Benachrichtigung wenn jemand neu folgt
- [ ] Follower können blockiert oder entfernt werden
- [ ] Bei privatem Profil muss eine Folgeanfrage gestellt und genehmigt werden
- [ ] Benachrichtigungen für Likes und Kommentare sind konfigurierbar (an/aus)

### Blockieren
- [ ] Blockierter Nutzer sieht gar nichts (kein Profil, keine Posts)
- [ ] Follow-Beziehungen werden bei Blockierung aufgelöst
- [ ] Block-Filter in allen relevanten Queries

### Post-Postfach
- [ ] Jeder Post hat ein eigenes, privates Postfach
- [ ] Andere Nutzer können am Post schreiben ohne zu folgen
- [ ] Post-Nachrichten sind gebunden an den jeweiligen Post
- [ ] Beim Löschen eines Posts werden zugehörige Nachrichten gelöscht
- [ ] Nachrichten können gemeldet werden

### DMs
- [ ] DMs nur bei gegenseitigem Folgen
- [ ] Realtime-Chat über Supabase Realtime
- [ ] Benachrichtigung bei neuer DM
- [ ] Nachrichten können gemeldet und blockiert werden

### Gruppen
- [ ] Jeder Nutzer kann eine Gruppe erstellen
- [ ] Gruppentyp wählbar: öffentlich oder privat
- [ ] Öffentliche Gruppen erscheinen in der Suche
- [ ] Beitritt bei öffentlichen Gruppen nur per Anfrage
- [ ] Private Gruppen nur per Einladungslink
- [ ] Gruppen-Posts erscheinen nicht im allgemeinen Feed
- [ ] Mehrere Admins pro Gruppe möglich
- [ ] Moderatoren können Mitglieder entfernen und Posts löschen
- [ ] Admin kann Gruppe löschen
- [ ] Gruppe hat Titelbild, Name und Beschreibung
- [ ] Kein Mitgliederlimit
- [ ] Gruppen-Events mit Datum, Uhrzeit und Treffpunkt
- [ ] In-App-Kalender mit Zu-/Absage-Funktion
- [ ] Mitglieder können jederzeit verlassen

### Communities
- [ ] Communities in der Suche auffindbar und nach Thema/Region filterbar
- [ ] Beitritt nur per Anfrage
- [ ] Community-Posts erscheinen nicht im allgemeinen Feed
- [ ] Mehrere Admins und Moderatoren möglich
- [ ] Community hat Titelbild, Name, Beschreibung und Themenkategorie
- [ ] App schlägt Communities basierend auf Region und Level vor
- [ ] Nur verifizierte Nutzer können Communities erstellen
- [ ] B2B-Partner können offizielle Communities betreiben (is_official Badge)

### Moderation
- [ ] Spam-Filter für neue Accounts (Links → Review-Queue)
- [ ] Rate-Limiting (5 Posts/h, 50 DMs/Tag)
- [ ] Wort-Filter (Blocklist)
- [ ] Duplicate-Detection
- [ ] Ab 3 Meldungen → Post temporär ausgeblendet
- [ ] Eskalationsprotokoll implementiert (Warnung → Sperre → Ban)

---

## Relevante Tabellen (aus Dokument 01)

- `follows` – Follow-Beziehungen
- `follow_requests` – Folgeanfragen (private Profile)
- `blocks` – Blockierungen
- `direct_messages` – DMs
- `post_messages` – Post-Postfach Nachrichten
- `groups` – Gruppen
- `group_members` – Gruppenmitgliedschaft + Ränge
- `group_join_requests` – Beitrittsanfragen
- `group_events` – Events mit Datum/Uhrzeit/Treffpunkt
- `event_responses` – Zu-/Absagen
- `communities` – Communities
- `community_members` – Mitgliedschaft + Ränge
- `community_join_requests` – Beitrittsanfragen
- `reports` – Meldungen
- `notifications` – Benachrichtigungen
