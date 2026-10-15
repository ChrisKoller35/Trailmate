# TrailMate – Dokument 1: Projekt-Setup & Fundament

> **Ziel:** Das komplette Projekt-Grundgerüst aufbauen – Expo-Projekt, alle Dependencies, Supabase-Backend mit komplettem Datenbankschema, Cloudflare R2 Konfiguration, Projektstruktur und Realtime-Abstraktion. Nach diesem Dokument ist das Fundament stabil und alle folgenden Dokumente bauen darauf auf.

---

## 1.1 Expo-Projekt initialisieren

### Setup Schritt für Schritt
1. **Node.js** installieren (nodejs.org)
2. Expo Projekt initialisieren: `npx create-expo-app TrailMate`
3. Direkt mit **Expo Development Builds** starten (nicht Expo Go) – einmalig über EAS Build erstellen, auf dem Gerät installieren
4. App starten mit `npx expo start` → QR-Code scannen → App läuft live auf dem Gerät

### Warum Development Builds statt Expo Go
Expo Go schränkt native Features ein – MapLibre Offline-Caching und GPS-Tracking funktionieren damit nicht vollständig. Development Builds geben von Anfang an vollen nativen Zugriff, ohne auf die komfortable Live-Entwicklung verzichten zu müssen.

### Apple Developer Lizenz
Für die Veröffentlichung im App Store wird die Apple Developer Lizenz benötigt: **\$99/Jahr** (~CHF 90). Wird erst für die Veröffentlichung gebraucht – nicht zum Entwickeln. Kleine Investition für den Zugang zu allen iPhone-Nutzern.

### Test-Matrix

| Plattform | Wie |
|---|---|
| iPhone / iPad | Development Build, QR-Code scannen |
| Android | Development Build, QR-Code scannen |
| Web | Im Browser direkt via `npx expo start --web` |

---

## 1.2 Projektstruktur

```
TrailMate/
├── app/                    → alle Screens (Expo Router)
│   ├── (tabs)/             → Tab-Navigation (Feed, Karte, Profil etc.)
│   ├── (auth)/             → Login/Register Screens
│   ├── (onboarding)/       → Onboarding Flow
│   └── _layout.tsx         → Root Layout
├── components/             → wiederverwendbare UI-Teile
│   ├── ui/                 → Buttons, Inputs, Cards
│   ├── feed/               → Feed-spezifische Komponenten
│   ├── map/                → Karten-Komponenten
│   └── profile/            → Profil-Komponenten
├── lib/                    → Bibliotheken & Service-Layer
│   ├── supabase.ts         → Supabase Client Initialisierung
│   ├── realtime.ts         → Realtime Abstraktion
│   └── storage.ts          → Cloudflare R2 Upload-Helfer
├── hooks/                  → eigene React Hooks
├── stores/                 → Zustand State Management
├── constants/              → Farben, Texte, Config
├── types/                  → TypeScript Typen
└── assets/                 → Bilder, Icons, Fonts
```

---

## 1.3 Alle Dependencies installieren

```json
{
  "dependencies": {
    "expo": "~52.0.0",
    "@maplibre/maplibre-react-native": "^10.0.0",
    "expo-location": "~17.0.0",
    "expo-notifications": "~0.28.0",
    "expo-image-picker": "~15.0.0",
    "expo-av": "~14.0.0",
    "expo-file-system": "~17.0.0",
    "expo-secure-store": "~13.0.0",
    "@supabase/supabase-js": "^2.39.0",
    "@react-navigation/native": "^7.0.0",
    "react-native-reanimated": "~3.16.0",
    "react-native-gesture-handler": "~2.20.0",
    "ffmpeg-kit-react-native": "^6.0.0",
    "react-native-svg": "^15.0.0",
    "zustand": "^5.0.0",
    "@tanstack/react-query": "^5.0.0"
  }
}
```

**Installation:**
```bash
npx expo install @maplibre/maplibre-react-native expo-location expo-notifications expo-image-picker expo-av expo-file-system expo-secure-store @supabase/supabase-js @react-navigation/native react-native-reanimated react-native-gesture-handler react-native-svg
npm install ffmpeg-kit-react-native zustand @tanstack/react-query
```

---

## 1.4 Supabase-Projekt einrichten

### Supabase Client (`lib/supabase.ts`)

```typescript
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: {
      getItem: (key: string) => SecureStore.getItemAsync(key),
      setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
      removeItem: (key: string) => SecureStore.deleteItemAsync(key),
    },
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
```

### Umgebungsvariablen (`.env`)
```
EXPO_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJI...
EXPO_PUBLIC_R2_PUBLIC_URL=https://media.trailmate.ch
```

---

## 1.5 Komplettes Datenbank-Schema

> **Alle Tabellen die TrailMate braucht.** Dieses Schema wird einmalig hier definiert und von allen folgenden Dokumenten referenziert.

### Extensions aktivieren
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "pgrouting";
```

### `users` – Nutzer
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(30) UNIQUE NOT NULL,
    display_name VARCHAR(50),
    email VARCHAR(255) UNIQUE NOT NULL,
    avatar_url TEXT,
    cover_image_url TEXT,
    bio TEXT,
    home_region VARCHAR(100),
    hiking_level VARCHAR(10),              -- 'T1-T2', 'T3-T4', 'T5-T6'
    is_premium BOOLEAN DEFAULT FALSE,
    is_private BOOLEAN DEFAULT FALSE,
    is_verified BOOLEAN DEFAULT FALSE,     -- Für Community-Erstellung
    notification_prefs JSONB DEFAULT '{}',
    push_token TEXT,                        -- FCM/APNs Token
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### `posts` – Beiträge
```sql
CREATE TABLE posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    content TEXT,
    media_urls JSONB,                      -- [{url, type: 'image'|'video', width, height}]
    route_id UUID REFERENCES routes(id),
    location GEOMETRY(Point, 4326),
    group_id UUID REFERENCES groups(id),   -- NULL = öffentlicher Feed
    community_id UUID REFERENCES communities(id), -- NULL = öffentlicher Feed
    created_at TIMESTAMPTZ DEFAULT NOW(),
    likes_count INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    saves_count INTEGER DEFAULT 0
);
```

### `comments` – Kommentare
```sql
CREATE TABLE comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### `likes` – Likes
```sql
CREATE TABLE likes (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, post_id)
);
```

### `bookmarks` – Gespeicherte Posts/Routen
```sql
CREATE TABLE bookmarks (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, post_id)
);

CREATE TABLE route_bookmarks (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    route_id UUID REFERENCES routes(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, route_id)
);
```

### `follows` – Folgen-System
```sql
CREATE TABLE follows (
    follower_id UUID REFERENCES users(id) ON DELETE CASCADE,
    following_id UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (follower_id, following_id)
);
```

### `follow_requests` – Folgeanfragen (private Profile)
```sql
CREATE TABLE follow_requests (
    requester_id UUID REFERENCES users(id) ON DELETE CASCADE,
    target_id UUID REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending',  -- 'pending', 'accepted', 'rejected'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (requester_id, target_id)
);
```

### `blocks` – Blockierungen
```sql
CREATE TABLE blocks (
    blocker_id UUID REFERENCES users(id) ON DELETE CASCADE,
    blocked_id UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (blocker_id, blocked_id)
);
```

### `routes` – Routen
```sql
CREATE TABLE routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),     -- NULL = kuratierte/System-Route
    title VARCHAR(200),
    description TEXT,
    gpx_url TEXT,
    geom GEOMETRY(LineString, 4326),
    distance_m FLOAT,
    elevation_gain_m FLOAT,
    elevation_loss_m FLOAT,
    max_elevation_m FLOAT,
    estimated_duration_min INTEGER,
    sac_scale VARCHAR(2),                  -- T1-T6
    is_published BOOLEAN DEFAULT FALSE,    -- Community-Route veröffentlicht?
    is_curated BOOLEAN DEFAULT FALSE,      -- TrailMate-Team kuratiert?
    region VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### `recordings` – Tour-Aufzeichnungen
```sql
CREATE TABLE recordings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    route_id UUID REFERENCES routes(id),   -- Verknüpfung falls Route nachgefahren
    title VARCHAR(200),
    gpx_url TEXT,
    geom GEOMETRY(LineString, 4326),
    distance_m FLOAT,
    elevation_gain_m FLOAT,
    elevation_loss_m FLOAT,
    duration_seconds INTEGER,
    moving_time_seconds INTEGER,
    avg_speed_kmh FLOAT,
    steps INTEGER,
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    is_hidden BOOLEAN DEFAULT FALSE        -- Auf Profil versteckt
);
```

### `hiking_network` – Wanderweg-Netzwerk (pgRouting)
```sql
CREATE TABLE hiking_network (
    id SERIAL PRIMARY KEY,
    geom GEOMETRY(LineString, 4326),
    source INTEGER,                        -- pgRouting Knoten
    target INTEGER,                        -- pgRouting Knoten
    length_m FLOAT,                        -- Segmentlänge
    elevation_gain FLOAT,                  -- Höhenmeter aufwärts
    elevation_loss FLOAT,                  -- Höhenmeter abwärts
    sac_scale VARCHAR(2),                  -- T1-T6
    surface VARCHAR(50),                   -- Belag
    cost FLOAT                             -- Gewichtung: Distanz × Schwierigkeitsfaktor
);
```

### `weather_forecasts` – Wetterdaten
```sql
CREATE TABLE weather_forecasts (
    id SERIAL PRIMARY KEY,
    station_id VARCHAR(20),
    location GEOMETRY(Point, 4326),
    station_elevation_m FLOAT,
    forecast_time TIMESTAMPTZ,
    temperature FLOAT,
    precipitation FLOAT,
    wind_speed FLOAT,
    cloud_cover FLOAT,
    weather_symbol_code VARCHAR(10),
    source VARCHAR(20) DEFAULT 'meteoswiss', -- 'meteoswiss' oder 'yrno'
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_weather_location ON weather_forecasts USING GIST(location);
CREATE INDEX idx_weather_forecast_time ON weather_forecasts(forecast_time);
```

### `trail_conditions` – Wegzustandsberichte
```sql
CREATE TABLE trail_conditions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route_id UUID REFERENCES routes(id),
    user_id UUID REFERENCES users(id),
    reported_at TIMESTAMPTZ DEFAULT NOW(),
    conditions JSONB,                      -- {"open": true, "snow": false, "wet": true, ...}
    snow_line_meters INTEGER,              -- Schneegrenze
    comment TEXT,
    photo_urls TEXT[],
    location GEOMETRY(Point, 4326),        -- Wo genau auf der Route
    helpfulness_score INTEGER DEFAULT 0,   -- Upvotes von anderen Nutzern
    expires_at TIMESTAMPTZ                 -- Auto-Archivierung nach 14 Tagen
);
```

### `groups` – Gruppen
```sql
CREATE TABLE groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    cover_image_url TEXT,
    is_private BOOLEAN DEFAULT FALSE,      -- true = unsichtbar, nur per Einladungslink
    invite_code VARCHAR(20) UNIQUE,        -- Für private Gruppen
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### `group_members` – Gruppenmitgliedschaft
```sql
CREATE TABLE group_members (
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'member',     -- 'admin', 'moderator', 'member'
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (group_id, user_id)
);
```

### `group_join_requests` – Beitrittsanfragen
```sql
CREATE TABLE group_join_requests (
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending',  -- 'pending', 'accepted', 'rejected'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (group_id, user_id)
);
```

### `group_events` – Gruppen-Events
```sql
CREATE TABLE group_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    community_id UUID REFERENCES communities(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    event_date TIMESTAMPTZ NOT NULL,
    meeting_point TEXT,
    meeting_location GEOMETRY(Point, 4326),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### `event_responses` – Event Zu-/Absagen
```sql
CREATE TABLE event_responses (
    event_id UUID REFERENCES group_events(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    response VARCHAR(20) NOT NULL,         -- 'attending', 'declined', 'maybe'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (event_id, user_id)
);
```

### `communities` – Communities
```sql
CREATE TABLE communities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    cover_image_url TEXT,
    category VARCHAR(50),                  -- z.B. 'region', 'difficulty', 'theme'
    region VARCHAR(100),
    is_official BOOLEAN DEFAULT FALSE,     -- B2B-Partner Community
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### `community_members` – Community-Mitgliedschaft
```sql
CREATE TABLE community_members (
    community_id UUID REFERENCES communities(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'member',     -- 'admin', 'moderator', 'member'
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (community_id, user_id)
);
```

### `community_join_requests` – Beitrittsanfragen
```sql
CREATE TABLE community_join_requests (
    community_id UUID REFERENCES communities(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (community_id, user_id)
);
```

### `direct_messages` – DMs
```sql
CREATE TABLE direct_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID REFERENCES users(id) ON DELETE CASCADE,
    receiver_id UUID REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### `post_messages` – Post-Postfach Nachrichten
```sql
CREATE TABLE post_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES users(id) ON DELETE CASCADE,
    receiver_id UUID REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### `reports` – Meldungen
```sql
CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id UUID REFERENCES users(id) ON DELETE CASCADE,
    reported_user_id UUID REFERENCES users(id),
    post_id UUID REFERENCES posts(id),
    comment_id UUID REFERENCES comments(id),
    message_id UUID,                       -- DM oder Post-Message ID
    reason VARCHAR(50) NOT NULL,           -- 'spam', 'abuse', 'fake', 'inappropriate'
    description TEXT,
    status VARCHAR(20) DEFAULT 'pending',  -- 'pending', 'resolved', 'dismissed'
    resolved_by UUID REFERENCES users(id),
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### `notifications` – Benachrichtigungen
```sql
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,             -- 'follow', 'like', 'comment', 'dm', 'badge', etc.
    title TEXT,
    body TEXT,
    data JSONB,                            -- Zusätzliche Daten (post_id, user_id etc.)
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### `badges` – Abzeichen-Definitionen
```sql
CREATE TABLE badges (
    id VARCHAR(50) PRIMARY KEY,            -- 'first_summit', '100km_total', etc.
    name VARCHAR(100),
    description TEXT,
    icon_url TEXT,
    category VARCHAR(50),                  -- 'summit', 'distance', 'social', 'fun', 'weather', 'activity'
    rarity VARCHAR(20)                     -- 'normal', 'rare', 'epic'
);
```

### `user_badges` – Verdiente Abzeichen
```sql
CREATE TABLE user_badges (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    badge_id VARCHAR(50) REFERENCES badges(id),
    earned_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, badge_id)
);
```

### `challenges` – Challenges
```sql
CREATE TABLE challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(200) NOT NULL,
    description TEXT,
    type VARCHAR(20),                      -- 'sport', 'social', 'fun', 'seasonal'
    goal JSONB,                            -- {"type": "distance_km", "target": 100}
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    badge_id VARCHAR(50) REFERENCES badges(id),  -- Belohnungs-Abzeichen
    region VARCHAR(100),                   -- NULL = global
    created_by UUID REFERENCES users(id),
    is_sponsored BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### `challenge_participants` – Challenge-Teilnehmer
```sql
CREATE TABLE challenge_participants (
    challenge_id UUID REFERENCES challenges(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    progress FLOAT DEFAULT 0,              -- Aktueller Fortschritt
    completed_at TIMESTAMPTZ,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (challenge_id, user_id)
);
```

### `highlight_tours` – Profil Highlight-Touren
```sql
CREATE TABLE highlight_tours (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    recording_id UUID REFERENCES recordings(id) ON DELETE CASCADE,
    sort_order INTEGER DEFAULT 0,
    UNIQUE(user_id, recording_id)
);
```

### `live_tracking_sessions` – Live-Tracking
```sql
CREATE TABLE live_tracking_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    share_token VARCHAR(50) UNIQUE NOT NULL,  -- Für den Share-Link
    trusted_contacts JSONB,                    -- [{name, phone/email}] max 3
    expected_return TIMESTAMPTZ,
    update_interval_minutes INTEGER DEFAULT 10,
    last_location GEOMETRY(Point, 4326),
    last_updated_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    started_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 1.6 Row Level Security (RLS) – Basis-Policies

```sql
-- RLS aktivieren für alle Tabellen
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE direct_messages ENABLE ROW LEVEL SECURITY;

-- Beispiel: Users – jeder kann öffentliche Profile sehen, nur eigenes bearbeiten
CREATE POLICY "Public profiles are viewable by everyone"
ON users FOR SELECT
USING (is_private = false OR id = auth.uid());

CREATE POLICY "Users can update own profile"
ON users FOR UPDATE
USING (id = auth.uid());

-- Beispiel: Posts – öffentliche Posts für alle, Gruppen-Posts nur für Mitglieder
CREATE POLICY "Public posts viewable"
ON posts FOR SELECT
USING (
    group_id IS NULL AND community_id IS NULL
    OR EXISTS (SELECT 1 FROM group_members WHERE group_id = posts.group_id AND user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM community_members WHERE community_id = posts.community_id AND user_id = auth.uid())
);

CREATE POLICY "Users can create own posts"
ON posts FOR INSERT
WITH CHECK (user_id = auth.uid());

-- DMs – nur Sender und Empfänger
CREATE POLICY "DMs visible to participants"
ON direct_messages FOR SELECT
USING (sender_id = auth.uid() OR receiver_id = auth.uid());
```

> **Hinweis:** Vollständige RLS-Policies müssen für jede Tabelle und jeden Use-Case erstellt werden. Die obigen sind exemplarisch. Blockierte Nutzer müssen in allen SELECT-Policies berücksichtigt werden (blockierte Nutzer sehen nichts).

---

## 1.7 Realtime-Abstraktion

```typescript
// lib/realtime.ts

interface RealtimeProvider {
  subscribe(channel: string, callback: (data: any) => void): void;
  unsubscribe(channel: string): void;
  publish(channel: string, data: any): void;
}

// MVP: Alles über Supabase Realtime
class SupabaseRealtimeProvider implements RealtimeProvider {
  subscribe(channel: string, callback: (data: any) => void): void {
    // Supabase Realtime Subscription
  }
  unsubscribe(channel: string): void {
    // Cleanup
  }
  publish(channel: string, data: any): void {
    // Supabase Broadcast
  }
}

// Später bei Bedarf: eigener WebSocket-Server
class CustomWebSocketProvider implements RealtimeProvider {
  // Austauschbar ohne App-Änderungen
}

export const realtime: RealtimeProvider = new SupabaseRealtimeProvider();
```

**Supabase Realtime Limits:**
- Supabase Free: 200 gleichzeitige Connections
- Supabase Pro ($25/mo): 500 gleichzeitige Connections
- Für MVP reicht Supabase, Architektur ist austauschbar

---

## 1.8 Cloudflare R2 Setup

**Wofür R2 genutzt wird:**
- Profilbilder & Titelbilder
- Post-Fotos (Galerie bis 10 Bilder)
- Post-Videos (max. 15s, 720p, 20MB)
- GPX-Dateien
- Trail-Condition-Fotos
- Später optional: Swisstopo-Vektortiles selbst hosten

**Bucket-Struktur:**
```
trailmate-media/
├── avatars/{user_id}.jpg
├── covers/{user_id}.jpg
├── posts/{post_id}/{index}.jpg
├── posts/{post_id}/video.mp4
├── gpx/{recording_id}.gpx
├── trail-conditions/{report_id}/{index}.jpg
└── badges/{badge_id}.png
```

**Upload-Flow:**
```
Client → Supabase Edge Function (Validierung) → Cloudflare R2 (Speicherung)
                                                        ↓
                                              R2 Public Bucket URL
                                                        ↓
                                              URL wird in DB gespeichert
```

---

## 1.9 State Management (Zustand)

```typescript
// stores/authStore.ts
import { create } from 'zustand';

interface AuthState {
  user: User | null;
  session: Session | null;
  setUser: (user: User | null) => void;
  setSession: (session: Session | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  setUser: (user) => set({ user }),
  setSession: (session) => set({ session }),
}));
```

---

## Akzeptanzkriterien – Dokument 1

- [ ] Expo-Projekt ist initialisiert mit `npx create-expo-app TrailMate`
- [ ] Projektstruktur gemäss Spezifikation angelegt (app/, components/, lib/, hooks/, stores/, constants/, types/, assets/)
- [ ] Alle Dependencies aus der Paketliste installiert
- [ ] Supabase Client initialisiert mit SecureStore für Session-Persistenz
- [ ] Umgebungsvariablen (.env) konfiguriert
- [ ] Komplettes Datenbank-Schema in Supabase ausgeführt (alle Tabellen)
- [ ] PostGIS und pgRouting Extensions aktiviert
- [ ] Basis-RLS-Policies für die wichtigsten Tabellen erstellt
- [ ] Realtime-Abstraktion (RealtimeProvider Interface) implementiert
- [ ] Cloudflare R2 Bucket erstellt und Public URL konfiguriert
- [ ] Zustand Store für Auth erstellt
- [ ] App startet fehlerfrei auf Android, iOS und Web
- [ ] Development Build über EAS Build erstellt

---

## Offene Entscheidung für dieses Dokument

| Frage | Entscheidung |
|---|---|
| Expo Go oder Development Build? | Development Build (voller nativer Zugriff) |
| Mapbox oder MapLibre? | MapLibre (kostenlos, zuverlässiges Offline-Caching) |
| State Management? | Zustand (leichtgewichtig, einfach) |
| Swisstopo Tile-Server? | Option A: Offizieller Swisstopo Server direkt nutzen (kostenlos, kein eigenes Hosting) |
