# TrailMate – Dokument 5: Feed, Posts & Medien

> **Ziel:** Den sozialen Feed implementieren (Hauptfeed + Entdecken-Tab), Post-Erstellung mit allen Medientypen (Fotos, Videos, Text, Routen), Like/Kommentar-System, Video-Strategie Phase 1, Cloudflare R2 Upload-Pipeline und Bookmark-Funktion. Nach diesem Dokument ist das soziale Herz der App funktionsfähig.

> **Voraussetzung:** Dokument 01 (Setup) und Dokument 02 (Auth/Profil) sind abgearbeitet. Nutzer können sich anmelden und haben ein Profil.

---

## 5.1 Feed-Konzept

### Zwei Feed-Bereiche

**Hauptfeed** – Chronologisch, nur Posts von gefolgten Nutzern
- Klar und übersichtlich
- **Kein Algorithmus** der entscheidet was man sieht
- Zeigt Posts von allen Nutzern denen man folgt, sortiert nach Erstellungsdatum

**Entdecken-Tab** – Kuratierte und beliebte Posts aus der ganzen Community
- Ähnlich Instagram Explore oder TikTok For You
- Hier können neue Wanderer und Routen entdeckt werden
- Nutzt Score-Algorithmus für Sortierung

### Hauptfeed Query

```sql
SELECT p.*, u.username, u.display_name, u.avatar_url
FROM posts p
JOIN users u ON p.user_id = u.id
WHERE p.user_id IN (
    SELECT following_id FROM follows WHERE follower_id = $currentUserId
)
AND p.group_id IS NULL       -- Keine Gruppen-Posts
AND p.community_id IS NULL   -- Keine Community-Posts
AND p.user_id NOT IN (
    SELECT blocked_id FROM blocks WHERE blocker_id = $currentUserId
    UNION
    SELECT blocker_id FROM blocks WHERE blocked_id = $currentUserId
)
ORDER BY p.created_at DESC
LIMIT 20 OFFSET $offset;
```

### Entdecken-Tab Score-Algorithmus

```
Score = (likes × 2 + comments × 3 + saves × 4)
        × recency_decay(post_age_hours)
        × region_boost(user_region == post_region ? 1.5 : 1.0)
        × difficulty_match(user_level, route_difficulty)
```

**Was der Entdecken-Tab bei wenig Content zeigt (Cold Start):**
- **Routen in deiner Nähe** – basierend auf Heimatregion aus dem Onboarding
- **Saisonale Empfehlungen** – "Touren die jetzt gut begehbar sind" (Höhe + Jahreszeit)
- **Trending diese Woche** – sobald es Aktivität gibt, die aktivsten Posts zeigen
- **Neue Nutzer in deiner Region** – "Diese Wanderer sind auch im Berner Oberland unterwegs"

### Entdecken-Tab Query

```sql
SELECT p.*, u.username, u.display_name, u.avatar_url,
    (p.likes_count * 2 + p.comments_count * 3 + p.saves_count * 4) 
    * (1.0 / (1.0 + EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 3600.0 * 0.05))
    * CASE WHEN u.home_region = $userRegion THEN 1.5 ELSE 1.0 END
    AS score
FROM posts p
JOIN users u ON p.user_id = u.id
WHERE p.group_id IS NULL
AND p.community_id IS NULL
AND u.is_private = false
AND p.user_id NOT IN (
    SELECT blocked_id FROM blocks WHERE blocker_id = $currentUserId
    UNION
    SELECT blocker_id FROM blocks WHERE blocked_id = $currentUserId
)
ORDER BY score DESC
LIMIT 20 OFFSET $offset;
```

---

## 5.2 Post-Erstellung

### Inhaltstypen

| Typ | Details |
|---|---|
| 📷 Fotos | Einzeln oder Galerie bis 10 Bilder |
| 🎥 Kurze Videos | Max. 15 Sekunden, 720p, 20 MB (Phase 1) |
| 📝 Text-Posts | Tourenberichte, Erlebnisse |
| 🗺️ Geteilte Routen | GPX-Track mit Vorschaukarte und Statistiken |

### Post-Erstellen-Screen

```
┌──────────────────────────────────┐
│  📝 Neuer Post                   │
│                                  │
│  [Text eingeben...]              │
│  ___________________________     │
│  ___________________________     │
│                                  │
│  📷 Fotos/Videos:                │
│  [+] [Bild 1] [Bild 2] [Bild 3] │
│                                  │
│  🗺️ Route verknüpfen:            │
│  [Route auswählen ▼]             │
│  ┌───────────────────────┐       │
│  │ Mini-Karte + Stats    │       │
│  │ 12.4km | ↑850m | T3   │       │
│  └───────────────────────┘       │
│                                  │
│  📍 Standort:                    │
│  [Grindelwald, BE]               │
│                                  │
│  Posten in:                      │
│  ○ Öffentlicher Feed             │
│  ○ Gruppe: [▼ Wählen]            │
│  ○ Community: [▼ Wählen]         │
│                                  │
│  [Veröffentlichen]               │
└──────────────────────────────────┘
```

---

## 5.3 Video-Strategie Phase 1

### Einschränkungen (MVP)
- **Max. 15 Sekunden** Dauer
- **Max. 720p** Auflösung
- **Max. 20 MB** Dateigrösse (15s @ 720p ≈ 8–15 MB)
- Format: **MP4/H.264** – universell abspielbar, kein serverseitiges Transcoding nötig
- Client-seitige Komprimierung vor Upload

### Technischer Flow

```
Client (React Native):
├── react-native-image-picker → Video aufnehmen/auswählen
├── ffmpeg-kit-react-native → Client-seitig komprimieren auf 720p, 15s max
└── Upload via tus-Protokoll (resumable) an Supabase Edge Function

Backend:
├── Supabase Edge Function → Validierung (Dauer ≤ 15s, Grösse ≤ 20MB, Format MP4)
├── Direkter Upload nach Cloudflare R2
└── Video-URL in posts.media_urls speichern

Wiedergabe:
├── expo-av oder react-native-video
├── Autoplay im Feed (stumm, wie Instagram)
└── Lazy Loading – nur laden wenn im Viewport
```

### Video-Komprimierung

```typescript
// lib/videoCompression.ts
import { FFmpegKit } from 'ffmpeg-kit-react-native';

async function compressVideo(inputUri: string): Promise<string> {
  const outputUri = `${FileSystem.cacheDirectory}compressed_${Date.now()}.mp4`;
  
  // Auf 720p komprimieren, max 15s
  const command = `-i ${inputUri} -vf "scale=-2:720" -t 15 -c:v libx264 -preset fast -crf 28 -c:a aac -b:a 128k ${outputUri}`;
  
  await FFmpegKit.execute(command);
  return outputUri;
}
```

### Video-Wiedergabe im Feed
- **Autoplay stumm** im Feed (wie Instagram)
- Sound bei Tap
- **Lazy Loading** – nur laden wenn im Viewport
- Video-Thumbnail wird automatisch aus erstem Frame generiert

### Resumable Upload
- Upload via **tus-Protokoll** (bei schlechtem Netz fortsetzen statt neu starten)
- Besonders wichtig für Videos in Berggebieten mit schlechtem Empfang

### Phase 2 (nach Launch, wenn Nachfrage besteht)
- Erweiterung auf **60 Sekunden**
- Serverseitiges Transcoding via Cloudflare Workers + FFmpeg (oder Cloudflare Stream als Managed Service)
- Adaptive Bitrates für unterschiedliche Netzqualitäten (HLS/DASH)

---

## 5.4 Foto-Upload Pipeline

### Flow

```typescript
// lib/mediaUpload.ts
import * as ImagePicker from 'expo-image-picker';

// Foto auswählen (Galerie bis 10 Bilder)
const pickImages = async () => {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsMultipleSelection: true,
    selectionLimit: 10,
    quality: 0.8, // Komprimierung
  });
  
  if (!result.canceled) {
    // Jedes Bild nach Cloudflare R2 hochladen
    const urls = await Promise.all(
      result.assets.map(asset => uploadToR2(asset.uri, 'image'))
    );
    return urls;
  }
};
```

### Cloudflare R2 Upload

```typescript
// lib/storage.ts

async function uploadToR2(
  localUri: string, 
  type: 'image' | 'video',
  postId: string
): Promise<string> {
  // 1. Presigned URL vom Backend holen
  const { data: presignedUrl } = await supabase.functions.invoke('get-upload-url', {
    body: { type, postId },
  });
  
  // 2. Datei hochladen
  await FileSystem.uploadAsync(presignedUrl, localUri, {
    httpMethod: 'PUT',
    headers: { 'Content-Type': type === 'image' ? 'image/jpeg' : 'video/mp4' },
  });
  
  // 3. Öffentliche URL zurückgeben
  return `${process.env.EXPO_PUBLIC_R2_PUBLIC_URL}/posts/${postId}/${filename}`;
}
```

---

## 5.5 Post-Anzeige im Feed

### Post-Karte (Feed-Item)

```
┌──────────────────────────────────┐
│  (●) @bergfex_sarah              │
│       Berner Oberland · 2h       │
│                                  │
│  ┌──────────────────────────┐    │
│  │                          │    │
│  │     [Foto / Video /      │    │
│  │      Bildergalerie]      │    │
│  │                          │    │
│  └──────────────────────────┘    │
│                                  │
│  🗺️ Route: Grindelwald → Kl.Sch. │
│  📊 12.4km | ↑850m | T3          │
│                                  │
│  Traumhafter Tag am Eiger Trail! │
│  Schneefrei bis 2800m. 🏔️        │
│                                  │
│  ❤️ 42  💬 8  🔖 12               │
│                                  │
│  [❤️ Like] [💬 Kommentar]         │
│  [📩 Nachricht] [🔖 Speichern]   │
└──────────────────────────────────┘
```

### Bildergalerie
- Horizontal scrollbar (Swipe-Galerie)
- Punkt-Indikator unten (wie Instagram)
- Tap → Vollbild

### Route-Vorschau bei geteilter Route
- Mini-Karte mit Track-Linie
- Statistiken: Distanz, Höhenmeter, SAC-Grad
- Tap → Route-Detail öffnen

---

## 5.6 Like-System

```typescript
// Like-Toggle
const toggleLike = async (postId: string) => {
  const { data: existing } = await supabase
    .from('likes')
    .select()
    .eq('user_id', userId)
    .eq('post_id', postId)
    .single();

  if (existing) {
    await supabase.from('likes').delete()
      .eq('user_id', userId).eq('post_id', postId);
    // likes_count dekrementieren
  } else {
    await supabase.from('likes').insert({ user_id: userId, post_id: postId });
    // likes_count inkrementieren
  }
};
```

### Counter-Update (DB-Funktion)
```sql
-- Trigger für likes_count
CREATE OR REPLACE FUNCTION update_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE posts SET likes_count = likes_count - 1 WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_likes_count
AFTER INSERT OR DELETE ON likes
FOR EACH ROW EXECUTE FUNCTION update_likes_count();
```

---

## 5.7 Kommentar-System

### Kommentar-Bereich
```
┌──────────────────────────────────┐
│  💬 Kommentare (8)               │
│                                  │
│  @gipfelstuermer · 1h           │
│  Geniale Tour! Wie war der Eiger │
│  Trail bei dem Wetter?           │
│  ❤️ 3 · Antworten               │
│                                  │
│  @wanderlust_ch · 45min         │
│  Die Aussicht ist der Wahnsinn! │
│  ❤️ 1                            │
│                                  │
│  [Kommentar schreiben...]        │
│  [Senden]                        │
└──────────────────────────────────┘
```

### Kommentare können gemeldet werden (Melde-Button)

---

## 5.8 Melden-Funktion

### Flow
1. Nutzer tippt "Melden" bei einem Post/Kommentar
2. Grund auswählen: Spam, Unangemessen, Fake, Sonstiges
3. Optional: Beschreibung
4. Meldung wird in `reports`-Tabelle gespeichert
5. Ab 3 Meldungen von verschiedenen Nutzern → Post wird temporär ausgeblendet
6. TrailMate-Team prüft in der Review-Queue

```sql
-- Report erstellen
INSERT INTO reports (reporter_id, post_id, reason, description)
VALUES ($userId, $postId, 'spam', 'Dieser Post ist Werbung');

-- Prüfen ob Post ausgeblendet werden soll (3+ Reports)
SELECT COUNT(DISTINCT reporter_id) AS report_count
FROM reports
WHERE post_id = $postId AND status = 'pending';
-- Wenn report_count >= 3 → Post temporär ausblenden
```

---

## 5.9 Bookmark / Speichern

### Funktionalität
- Posts und Routen speichern in einer persönlichen Merkliste
- Bookmark-Button (🔖) an jedem Post
- Gespeicherte Posts in eigenem Bereich auffindbar

### Bookmark-Counter
```sql
-- Analog zu likes_count: saves_count Trigger
CREATE OR REPLACE FUNCTION update_saves_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts SET saves_count = saves_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE posts SET saves_count = saves_count - 1 WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_saves_count
AFTER INSERT OR DELETE ON bookmarks
FOR EACH ROW EXECUTE FUNCTION update_saves_count();
```

### Merkliste-Screen
```
┌──────────────────────────────────┐
│  🔖 Gespeichert                  │
│                                  │
│  [Posts] [Routen]                │
│                                  │
│  ┌──────────────────────┐        │
│  │ @bergfex_sarah        │        │
│  │ Eiger Trail Post      │        │
│  │ [Foto-Thumbnail]      │        │
│  └──────────────────────┘        │
│  ┌──────────────────────┐        │
│  │ @gipfelstuermer       │        │
│  │ Oeschinensee Route    │        │
│  │ [Karten-Thumbnail]    │        │
│  └──────────────────────┘        │
└──────────────────────────────────┘
```

---

## 5.10 Cold-Start / Seed Content

### Seed Content (vor Launch vorbereiten)
- 50–100 hochwertige Touren-Posts: Fotos, Beschreibungen, GPX-Tracks
- "TrailMate Official"-Account + 5–10 Seed-Accounts (echte Wanderer)
- Jeder Seed-Account postet 10–20 Touren aus verschiedenen Regionen
- Content deckt alle SAC-Stufen ab (T1 bis T4 mindestens)

### Content-Anreize in den ersten 3 Monaten
- **"Early Adopter"-Badge** für die ersten 1000 Nutzer (exklusiv, nie wieder verfügbar)
- **"Erster Post"-Badge** sofort nach erstem Beitrag
- Push-Notification nach erster Tour: "Teile deine Tour und inspiriere andere!"
- Wöchentliche **"Featured Hiker"-Auswahl** auf dem Entdecken-Tab

---

## Akzeptanzkriterien – Dokument 5

### Feed
- [ ] Hauptfeed zeigt chronologisch Posts von gefolgten Nutzern
- [ ] Entdecken-Tab zeigt beliebte und kuratierte Posts der gesamten Community
- [ ] Entdecken-Tab nutzt Score-Algorithmus (likes×2 + comments×3 + saves×4 × recency × region × difficulty)
- [ ] Posts von blockierten Nutzern werden nicht angezeigt
- [ ] Pagination / Infinite Scroll funktioniert

### Posts
- [ ] Fotos (bis 10 pro Post) uploadbar und als Galerie angezeigt
- [ ] Videos (max. 15s, 720p, 20MB) uploadbar
- [ ] Client-seitige Komprimierung vor Upload (ffmpeg-kit)
- [ ] Resumable Upload (bei schlechtem Netz fortsetzen statt neu starten)
- [ ] Text-Posts möglich
- [ ] Routen können mit Posts verknüpft werden (Mini-Karte + Stats)
- [ ] Standort kann zum Post hinzugefügt werden

### Interaktion
- [ ] Posts können geliked werden (Toggle)
- [ ] Posts können kommentiert werden
- [ ] Posts können gemeldet werden (Spam, Unangemessen, Fake)
- [ ] Ab 3 Meldungen wird Post temporär ausgeblendet
- [ ] Bookmark/Speichern-Button funktioniert
- [ ] Merkliste mit gespeicherten Posts und Routen

### Video
- [ ] Autoplay stumm im Feed, Sound bei Tap
- [ ] Video-Thumbnail wird automatisch aus erstem Frame generiert
- [ ] Lazy Loading – nur laden wenn im Viewport

### Medien-Upload
- [ ] Fotos werden nach Cloudflare R2 hochgeladen
- [ ] Videos werden nach Cloudflare R2 hochgeladen
- [ ] Presigned URLs für sicheren Upload
- [ ] Upload-Fortschritt wird angezeigt

---

## Relevante Tabellen (aus Dokument 01)

- `posts` – Beiträge mit media_urls, route_id, group_id, community_id
- `comments` – Kommentare zu Posts
- `likes` – Like-Beziehungen
- `bookmarks` – Gespeicherte Posts
- `route_bookmarks` – Gespeicherte Routen
- `reports` – Meldungen
- `follows` – Für Hauptfeed-Query
- `blocks` – Für Blockier-Filter
