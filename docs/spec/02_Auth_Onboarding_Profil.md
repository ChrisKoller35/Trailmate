# TrailMate – Dokument 2: Auth, Onboarding & Nutzerprofil

> **Ziel:** Registrierung/Login, den kompletten 5-Schritt Onboarding-Flow und das Nutzerprofil mit allen Elementen implementieren. Nach diesem Dokument können sich Nutzer registrieren, einloggen, das Onboarding durchlaufen und ihr vollständiges Profil sehen und bearbeiten.

> **Voraussetzung:** Dokument 01 (Projekt-Setup) ist vollständig abgearbeitet. Supabase ist konfiguriert, DB-Schema steht.

---

## 2.1 Supabase Auth – Registrierung & Login

### Auth-Methoden
- E-Mail + Passwort (Hauptmethode)
- Social Login kann später ergänzt werden (Apple, Google)

### Screens

**Login-Screen:**
- E-Mail-Feld
- Passwort-Feld
- "Anmelden" Button
- "Passwort vergessen?" Link
- "Noch kein Konto? Registrieren" Link

**Register-Screen:**
- E-Mail-Feld
- Passwort-Feld (min. 8 Zeichen)
- Passwort bestätigen
- "Konto erstellen" Button
- "Bereits registriert? Anmelden" Link

### Auth-Flow
```
Register → E-Mail-Bestätigung → Onboarding (5 Schritte) → Entdecken-Tab
Login → Hauptfeed (wenn Onboarding bereits abgeschlossen)
```

### Implementierung
```typescript
// Auth-Funktionen in lib/supabase.ts oder hooks/useAuth.ts

// Registrierung
const signUp = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signUp({ email, password });
  // Nach erfolgreicher Registrierung → Onboarding starten
};

// Login
const signIn = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
};

// Logout
const signOut = async () => {
  await supabase.auth.signOut();
};

// Session-Listener
supabase.auth.onAuthStateChange((event, session) => {
  useAuthStore.getState().setSession(session);
});
```

---

## 2.2 Onboarding-Flow (5 Schritte)

> Der Onboarding-Flow wird bei Erstregistrierung angezeigt und dauert max. 60 Sekunden. Danach landet der Nutzer im Entdecken-Tab (nicht im leeren Following-Feed).

### Schritt 1: Willkommen
```
┌──────────────────────────┐
│  🏔️ Willkommen bei        │
│     TrailMate!            │
│                           │
│  Entdecke Wanderungen,    │
│  teile Erlebnisse, finde  │
│  Wanderpartner.           │
│                           │
│  [Los geht's]             │
└──────────────────────────┘
```
- Einfacher Splash/Welcome-Screen
- Ein Button "Los geht's" → weiter zu Schritt 2

### Schritt 2: Profil-Basics
```
┌──────────────────────────┐
│  Wie heisst du?           │
│  [Name]                   │
│                           │
│  Profilbild (optional)    │
│  [📷 Foto wählen]         │
│  [Später]                 │
└──────────────────────────┘
```
- `display_name` eingeben (Pflichtfeld)
- `username` eingeben (Pflichtfeld, unique, Prüfung live)
- Profilbild optional über `expo-image-picker`
- Upload nach Cloudflare R2 → `avatar_url` in users-Tabelle speichern

### Schritt 3: Wanderlevel
```
┌──────────────────────────┐
│  Wie erfahren bist du?    │
│                           │
│  🟢 Einsteiger (T1–T2)    │
│  🟡 Fortgeschritten (T3)  │
│  🔴 Alpin (T4–T6)         │
│                           │
│  (Kann später geändert    │
│   werden)                 │
└──────────────────────────┘
```
- 3 grosse Karten/Buttons zum Antippen
- Speichert `hiking_level` in users-Tabelle
- Wird für Routenempfehlungen und Follow-Suggestions genutzt

### Schritt 4: Heimatregion
```
┌──────────────────────────┐
│  Wo wanderst du am        │
│  liebsten?                │
│                           │
│  📍 Automatisch erkennen  │
│  🔍 Region suchen         │
│                           │
│  [Berner Oberland ✓]      │
│  [Zentralschweiz]         │
│  [Ostschweiz]             │
│  [Wallis]                 │
│  ...                      │
└──────────────────────────┘
```
- GPS-basierte automatische Erkennung (über `expo-location`)
- Oder manuelle Auswahl aus vordefinierten Regionen
- Speichert `home_region` in users-Tabelle
- Falls übersprungen: Region wird aus GPS abgeleitet

**Vordefinierte Regionen (Schweiz):**
- Berner Oberland
- Wallis
- Graubünden / Engadin
- Zentralschweiz
- Ostschweiz
- Tessin
- Jura
- Zürich & Umgebung
- Basel & Umgebung
- Emmental
- Fribourg / Freiburg
- Weitere Regionen...

### Schritt 5: Follow-Suggestions
```
┌──────────────────────────┐
│  Wanderer in deiner Nähe  │
│                           │
│  👤 @bergfex_sarah  [+]   │
│     Berner Oberland, T3   │
│  👤 @gipfelstuermer [+]   │
│     Berner Oberland, T4   │
│  👤 @wanderlust_ch  [+]   │
│     Emmental, T2          │
│                           │
│  [Allen folgen]           │
│  [Überspringen]           │
└──────────────────────────┘
```
- 10–15 Vorschläge basierend auf `home_region` UND `hiking_level`
- Jeder Vorschlag zeigt: Avatar, Username, Region, Level
- "Folge allen" Button → folgt allen auf einmal
- Einzeln mit [+] folgbar
- "Überspringen" möglich

**Query für Follow-Suggestions:**
```sql
SELECT id, username, display_name, avatar_url, home_region, hiking_level
FROM users
WHERE home_region = $userRegion
  AND hiking_level = $userLevel
  AND id != $userId
  AND id NOT IN (SELECT following_id FROM follows WHERE follower_id = $userId)
ORDER BY created_at DESC
LIMIT 15;
```

### Nach Onboarding
- Nutzer landet im **Entdecken-Tab** (nicht im leeren Following-Feed)
- Onboarding-Status speichern (z.B. Flag in users oder in localStorage)

---

## 2.3 Nutzerprofil

### Profil-Aufbau (von oben nach unten)

```
┌──────────────────────────────────────────┐
│ ╔══════════════════════════════════════╗  │
│ ║         TITELBILD (breit)           ║  │
│ ╚══════════════════════════════════════╝  │
│                                          │
│    (●)  Display Name                     │
│    Profil  @username                     │
│    bild                                  │
│                                          │
│    Bio: "Unterwegs im Berner Oberland    │
│    | T1–T4 | Gipfelsammler"             │
│    📍 Berner Oberland                    │
│                                          │
│    42 Touren | 687 km | 45'200 hm       │
│                                          │
│    [Profil bearbeiten] oder [Folgen]     │
│                                          │
│  ┌─────────────────────────────────────┐ │
│  │ ⭐ Highlight-Touren (bis zu 5)      │ │
│  │ [Foto1] [Foto2] [Foto3] [Foto4]    │ │
│  │  Route   Route   Route   Route     │ │
│  └─────────────────────────────────────┘ │
│                                          │
│  ┌─────────────────────────────────────┐ │
│  │ 📋 Posts (chronologisch)             │ │
│  │ [Post 1...]                         │ │
│  │ [Post 2...]                         │ │
│  └─────────────────────────────────────┘ │
│                                          │
│  ┌─────────────────────────────────────┐ │
│  │ 🏆 Abzeichen (letzte 6)             │ │
│  │ [🏔️] [📏] [👥] [☕] [🌦️] [⏰]      │ │
│  │ → Alle anzeigen                     │ │
│  └─────────────────────────────────────┘ │
└──────────────────────────────────────────┘
```

### 1. Titelbild
- Breites Foto oben
- Format wählbar: Querformat oder Hochformat
- Nach dem Hochladen optional zuschneidbar
- Upload: `expo-image-picker` → Cloudflare R2 → `cover_image_url`

### 2. Profilbild + Name
- Rundes Profilbild
- `display_name` und `@username`
- Upload: `expo-image-picker` → Cloudflare R2 → `avatar_url`

### 3. Bio
- Freitext (max. ~150 Zeichen)
- Editierbar im "Profil bearbeiten"-Screen
- Gespeichert in `users.bio`

### 4. Heimatregion
- z.B. "Berner Oberland"
- Aus `users.home_region`

### 5. Kennzahlen (automatisch berechnet)
- **Touren** – COUNT aus `recordings` WHERE `user_id = $userId AND is_hidden = false`
- **Kilometer** – SUM(`distance_m`) / 1000 aus `recordings`
- **Höhenmeter** – SUM(`elevation_gain_m`) aus `recordings`

**Query:**
```sql
SELECT 
    COUNT(*) AS total_tours,
    COALESCE(SUM(distance_m), 0) / 1000.0 AS total_km,
    COALESCE(SUM(elevation_gain_m), 0) AS total_elevation
FROM recordings
WHERE user_id = $userId AND is_hidden = false;
```

### 6. Highlight-Touren (bis zu 5)
- Selbst ausgewählte Top-Touren
- Jede zeigt: Foto, Routenname, Kurzinfo
- Sortierbar per Drag & Drop
- Gespeichert in `highlight_tours` Tabelle
- Ähnlich Instagram Story-Highlights (aber fix, nicht zeitlich begrenzt)

### 7. Post-Feed
- Chronologisch alle eigenen Posts
- Fotos, Videos, Tourenberichte

### 8. Abzeichen-Vitrine
- Kompakte Anzeige der letzten 6 Abzeichen
- Tap → öffnet vollständige Abzeichen-Sammlung als eigene Seite

### Profil-Sichtbarkeit

**Öffentliches Profil (Standard):**
- Alle Elemente sind für jeden sichtbar
- Nutzer ist über Suche auffindbar wenn er mindestens einen Post gemacht hat ODER die Sichtbarkeit manuell aktiviert hat

**Privates Profil (`is_private = true`):**
- Nur für Follower sichtbar
- Bei privatem Profil: Folgeanfrage nötig (über `follow_requests` Tabelle)
- Nicht-Follower sehen nur: Profilbild, Name, Bio, Kennzahlen (Zahlen, keine Details)

### Vergangene Touren verstecken
- Einzelne Touren können auf dem Profil versteckt werden → `recordings.is_hidden = true`
- Versteckte Touren fliessen trotzdem in die Statistiken ein

---

## 2.4 Profil bearbeiten

**"Profil bearbeiten"-Screen:**
```
┌──────────────────────────┐
│  Profil bearbeiten        │
│                           │
│  Titelbild [📷 Ändern]    │
│  Profilbild [📷 Ändern]   │
│                           │
│  Name: [___________]      │
│  Username: [@________]    │
│  Bio: [_______________]   │
│  Heimatregion: [▼ Wählen] │
│  Wanderlevel: [▼ Wählen]  │
│                           │
│  Sichtbarkeit:            │
│  ○ Öffentlich             │
│  ● Privat                 │
│                           │
│  [Speichern]              │
└──────────────────────────┘
```

---

## 2.5 Follower / Following Listen

**Sichtbar auf dem Profil:**
- Anzahl Follower | Anzahl Following
- Tap → öffnet jeweilige Liste
- Jeder Eintrag zeigt: Avatar, Name, Username, [Folgen/Entfolgen] Button
- Eigene Follower können entfernt werden

---

## 2.6 Einstellungen

**Einstellungen-Screen:**
```
┌──────────────────────────┐
│  Einstellungen            │
│                           │
│  👤 Profil bearbeiten     │
│  🔔 Benachrichtigungen    │
│  🔒 Privatsphäre          │
│  📱 Konto                 │
│  ℹ️ Über TrailMate         │
│                           │
│  [Abmelden]               │
└──────────────────────────┘
```

**Benachrichtigungs-Einstellungen (Details in Dokument 08):**
```
Benachrichtigungen
├── 💬 Nachrichten           [AN]
│   ├── DMs                  [AN]
│   └── Post-Postfach        [AN]
├── 👥 Soziales              
│   ├── Neuer Follower       [AN]
│   ├── Likes                [AUS]
│   └── Kommentare           [AUS]
├── 🏆 Aktivität             
│   ├── Neues Abzeichen      [AN]
│   └── Challenge-Update     [AUS]
├── 🗺️ Routen                
│   ├── Zustandsbericht      [AN]
│   └── Wetter-Warnung       [AN]
└── 🆘 Sicherheit            
    └── Vertrauensperson     [AN] (nicht deaktivierbar)
```

Gespeichert als `notification_prefs` JSONB in der users-Tabelle.

---

## Akzeptanzkriterien – Dokument 2

### Auth
- [ ] Registrierung mit E-Mail + Passwort funktioniert
- [ ] Login mit E-Mail + Passwort funktioniert
- [ ] Passwort-Reset per E-Mail funktioniert
- [ ] Session wird persistent gespeichert (SecureStore)
- [ ] Auto-Logout bei abgelaufener Session

### Onboarding
- [ ] Onboarding-Flow wird bei Erstregistrierung angezeigt
- [ ] Schritt 1: Willkommen-Screen mit "Los geht's" Button
- [ ] Schritt 2: Name, Username (unique-Check live), optionales Profilbild
- [ ] Schritt 3: Wanderlevel wählbar (T1-T2 / T3 / T4-T6)
- [ ] Schritt 4: Heimatregion wählbar (GPS-Erkennung oder manuelle Auswahl)
- [ ] Schritt 5: Follow-Suggestions (10-15 Nutzer basierend auf Region + Level)
- [ ] "Allen folgen" Button funktioniert
- [ ] Onboarding kann übersprungen werden – Heimatregion wird dann aus GPS abgeleitet
- [ ] Nach Onboarding landet der Nutzer im Entdecken-Tab
- [ ] Onboarding dauert max. 60 Sekunden
- [ ] Wanderlevel und Heimatregion werden in der DB gespeichert

### Profil
- [ ] Titelbild-Format wählbar: Querformat oder Hochformat
- [ ] Nach dem Hochladen kann der Ausschnitt optional angepasst werden
- [ ] Bio, Heimatregion und Profilbild editierbar
- [ ] Kennzahlen (Touren, km, Höhenmeter) werden automatisch berechnet
- [ ] Bis zu 5 Highlight-Touren selbst auswählbar und sortierbar
- [ ] Post-Feed auf dem Profil zeigt eigene Posts chronologisch
- [ ] Abzeichen-Vitrine zeigt letzte 6 Abzeichen, Tap → vollständige Sammlung
- [ ] Profil kann auf "privat" gestellt werden
- [ ] Nutzer ist über Suche nur auffindbar wenn er mindestens einen Post gemacht oder Sichtbarkeit aktiviert hat
- [ ] Vergangene Touren können einzeln versteckt werden
- [ ] Follower- und Following-Listen sichtbar und navigierbar

### Einstellungen
- [ ] Einstellungen-Screen mit allen Kategorien
- [ ] Benachrichtigungs-Einstellungen konfigurierbar (an/aus pro Kategorie)
- [ ] Notification-Preferences werden als JSONB gespeichert
- [ ] Abmelden-Funktion

---

## Relevante Tabellen (aus Dokument 01)

Dieses Dokument arbeitet mit folgenden Tabellen:
- `users` – Haupttabelle für alle Profildaten
- `follows` – Folgen-System
- `follow_requests` – Folgeanfragen für private Profile
- `highlight_tours` – Profil Highlight-Touren
- `recordings` – Für Kennzahlen-Berechnung
- `user_badges` – Für Abzeichen-Vitrine
