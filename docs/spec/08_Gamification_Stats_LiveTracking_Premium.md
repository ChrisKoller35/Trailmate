# TrailMate – Dokument 8: Gamification, Statistiken, Live-Tracking, Push & Premium

> **Ziel:** Alle Engagement-Features implementieren – Abzeichen-System mit allen Kategorien und Vergabe-Logik, Challenges & Events, Jahres-/Saisonstatistiken mit Heatmap und Jahresrückblick, Live-Tracking für Vertrauenspersonen, die komplette Push-Notification-Strategie und die Free/Premium-Trennung. Nach diesem Dokument ist TrailMate feature-complete.

> **Voraussetzung:** Alle Dokumente 01–07 sind abgearbeitet. Alle Basis-Features funktionieren.

---

## 8.1 Abzeichen-System

### Konzept
Abzeichen sind das spielerische Herzstück von TrailMate. Sie belohnen sportliche Leistungen, soziale Erlebnisse und witzige Momente. Abzeichen werden automatisch vergeben sobald die Bedingung erfüllt ist.

### Seltenheitsstufen
| Stufe | Bedeutung |
|---|---|
| **Normal** | Standard-Abzeichen, leicht erreichbar |
| **Selten** | Schwierigere Bedingungen |
| **Episch** | Aussergewöhnliche Leistungen |

### Alle Abzeichen mit Bedingungen

#### 🏔️ Gipfel & Routen

| ID | Name | Bedingung | Seltenheit |
|---|---|---|---|
| `first_summit` | Erster Gipfel | 1 Gipfel erreicht | Normal |
| `5_summits` | 5 Gipfel | 5 Gipfel erreicht | Normal |
| `10_summits` | 10 Gipfel | 10 Gipfel erreicht | Selten |
| `50_summits` | 50 Gipfel | 50 Gipfel erreicht | Episch |
| `summit_2000` | Über 2000m | Gipfel über 2000m erreicht | Normal |
| `summit_3000` | Über 3000m | Gipfel über 3000m erreicht | Selten |
| `summit_4000` | Viertausender | Gipfel über 4000m erreicht | Episch |
| `all_cantons` | Alle Kantone | In jedem Kanton gewandert | Episch |
| `5_canton_peaks` | Kantonshöchste | Höchster Punkt in 5 Kantonen | Episch |

#### 📏 Sportliche Leistungen

| ID | Name | Bedingung | Seltenheit |
|---|---|---|---|
| `100km_total` | 100 Kilometer | 100 km Gesamtdistanz | Normal |
| `500km_total` | 500 Kilometer | 500 km Gesamtdistanz | Selten |
| `1000km_total` | 1000 Kilometer | 1'000 km Gesamtdistanz | Episch |
| `5000hm_total` | 5000 Höhenmeter | 5'000 hm aufwärts gesamt | Normal |
| `10000hm_total` | 10000 Höhenmeter | 10'000 hm aufwärts gesamt | Selten |
| `50000hm_total` | 50000 Höhenmeter | 50'000 hm aufwärts gesamt | Episch |
| `10_tours` | 10 Touren | 10 Touren aufgezeichnet | Normal |
| `50_tours` | 50 Touren | 50 Touren aufgezeichnet | Selten |
| `100_tours` | 100 Touren | 100 Touren aufgezeichnet | Episch |
| `tour_6h` | Langstreckenwanderer | Tour über 6 Stunden | Selten |
| `tour_10h` | Ultramarsch | Tour über 10 Stunden | Episch |

#### 👥 Soziale Abzeichen

| ID | Name | Bedingung | Seltenheit |
|---|---|---|---|
| `first_group_tour` | Gemeinsam unterwegs | Erste Tour mit App-Nutzer | Normal |
| `5_partners` | 5 Wanderpartner | 5 verschiedene Begleiter | Selten |
| `group_10` | Grossgruppe | Wanderung mit 10 Leuten | Selten |
| `group_20` | Massentour | Wanderung mit 20 Leuten | Episch |
| `3_events` | Eventgänger | 3 Community-Events besucht | Normal |

#### ☕ Fun & Hütten-Abzeichen

| ID | Name | Bedingung | Seltenheit |
|---|---|---|---|
| `first_hut_coffee` | Erster Hüttenkaffee | Kaffee auf einer Berghütte | Normal |
| `5_hut_coffees` | Hüttenkaffee-Kenner | Kaffee auf 5 verschiedenen Hütten | Selten |
| `3_hut_cakes` | Hüttenkuchen-Fan | Kuchen auf 3 verschiedenen Hütten | Normal |
| `10_hut_cakes` | Tortenmönch | Kuchen auf 10 verschiedenen Hütten | Selten |
| `first_overnight` | Erste Übernachtung | Erste Hüttenübernachtung | Normal |
| `hut_fondue` | Fondue-Wanderer | Fondue auf einer Hütte | Normal |

#### 🌦️ Wetter & Jahreszeiten

| ID | Name | Bedingung | Seltenheit |
|---|---|---|---|
| `snow_hike` | Schneewanderer | Tour bei Schnee | Normal |
| `rain_hike` | Regenfrosch | Tour bei Regen | Normal |
| `winter_hike` | Winterwanderer | Tour in Wintermonaten | Normal |
| `4_seasons_trail` | Vier Jahreszeiten | Alle 4 Jahreszeiten auf demselben Trail | Episch |

#### ⏰ Aktivitäts-Abzeichen

| ID | Name | Bedingung | Seltenheit |
|---|---|---|---|
| `7_day_streak` | 7-Tage-Streak | 7 Tage in Folge aktiv | Selten |
| `30_tours_year` | Jahreswanderer | 30 Touren in einem Jahr | Selten |
| `early_bird` | Frühaufsteher | Tour vor 7:00 Uhr gestartet | Normal |

#### Spezial-Abzeichen

| ID | Name | Bedingung | Seltenheit |
|---|---|---|---|
| `early_adopter` | Early Adopter | Unter den ersten 1000 Nutzern | Episch |
| `first_post` | Erster Post | Erster Beitrag erstellt | Normal |
| `trail_reporter_5` | Trail Reporter | 5 Zustandsmeldungen | Normal |
| `trail_reporter_25` | Pfadfinder | 25 Zustandsmeldungen | Selten |

### Abzeichen-Vergabe-Engine

```typescript
// lib/badgeEngine.ts

interface BadgeCondition {
  badgeId: string;
  check: (userId: string) => Promise<boolean>;
}

const conditions: BadgeCondition[] = [
  {
    badgeId: '100km_total',
    check: async (userId) => {
      const { data } = await supabase
        .from('recordings')
        .select('distance_m')
        .eq('user_id', userId);
      const totalKm = data?.reduce((sum, r) => sum + (r.distance_m || 0), 0)! / 1000;
      return totalKm >= 100;
    },
  },
  {
    badgeId: '10_tours',
    check: async (userId) => {
      const { count } = await supabase
        .from('recordings')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);
      return (count ?? 0) >= 10;
    },
  },
  {
    badgeId: 'early_bird',
    check: async (userId) => {
      const { count } = await supabase
        .from('recordings')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .lt('started_at', '07:00:00'); // Vor 7 Uhr
      return (count ?? 0) >= 1;
    },
  },
  // ... weitere Conditions
];

// Nach jeder Tour-Aufzeichnung prüfen
async function checkAndAwardBadges(userId: string) {
  const { data: existing } = await supabase
    .from('user_badges')
    .select('badge_id')
    .eq('user_id', userId);
  
  const earnedIds = new Set(existing?.map(b => b.badge_id));
  
  for (const condition of conditions) {
    if (earnedIds.has(condition.badgeId)) continue; // Bereits verdient
    
    const earned = await condition.check(userId);
    if (earned) {
      await supabase.from('user_badges').insert({
        user_id: userId,
        badge_id: condition.badgeId,
      });
      
      // Push-Notification senden
      await sendBadgeNotification(userId, condition.badgeId);
    }
  }
}
```

### Abzeichen-Vitrine (Profil)
- Kompakte Anzeige der **letzten 6 Abzeichen** auf dem Profil
- Tap → öffnet vollständige Abzeichen-Sammlung als eigene Seite
- Neue Abzeichen können im Feed geteilt werden

### Abzeichen-Sammlung Seite

```
┌──────────────────────────────────┐
│  🏆 Meine Abzeichen (14/32)     │
│                                  │
│  🏔️ Gipfel & Routen              │
│  [🏔️✓] [🏔️✓] [🏔️✓] [🏔️○] [🏔️○] │
│                                  │
│  📏 Sportliche Leistungen        │
│  [📏✓] [📏✓] [📏○] [📏○] [📏○]  │
│                                  │
│  👥 Soziale Abzeichen            │
│  [👥✓] [👥○] [👥○] [👥○]         │
│                                  │
│  ☕ Fun & Hütten                  │
│  [☕✓] [☕✓] [☕○] [☕○] [☕○]     │
│                                  │
│  🌦️ Wetter & Jahreszeiten        │
│  [🌦️✓] [🌦️○] [🌦️○] [🌦️○]      │
│                                  │
│  ⏰ Aktivität                     │
│  [⏰✓] [⏰✓] [⏰○]               │
└──────────────────────────────────┘
```

---

## 8.2 Challenges & Events

> 🧠 **Status: Brainstorming** – Muss noch priorisiert und konkretisiert werden. Für den MVP reicht eine Basis-Implementierung.

### Challenge-Typen

**🏃 Sportliche Challenges:**
- "100km im März" – 100km in einem Monat
- "5000 Höhenmeter in 2 Wochen"
- "10 Touren im Sommer"
- "Jeden Samstag im Oktober wandern"
- Schrittzähler-Challenge: 500'000 Schritte im Monat

**👥 Soziale Challenges:**
- "Wandere 3x mit jemandem den du noch nicht kanntest"
- "Nimm an 3 Community-Events teil"
- "Bringe einen Freund zum ersten Mal zum Wandern"
- "Wandere mit jemandem aus einer anderen Region"

**☕ Fun Challenges:**
- "Kaffee auf 5 verschiedenen Hütten"
- "Finde 3 Wasserfälle"
- "Wandere bei Sonnenaufgang"
- "Mache eine Tour die du noch nie gemacht hast"
- "Wandere in einem Kanton den du noch nie besucht hast"

**🏔️ Saisonale & regionale Challenges:**
- Sommer: "Gipfelsammler Juli"
- Winter: "Schneeschuhwandern Februar"
- Regional: "Berner Oberland Explorer"
- B2B: "Entdecke die Titlis-Region" (von Bergbahn gesponsert)

### Challenge-UI

```
┌──────────────────────────────────┐
│  🏆 Aktive Challenges             │
│                                  │
│  ┌──────────────────────────┐    │
│  │ 🏃 100km im März          │    │
│  │ ████████░░░ 78/100 km    │    │
│  │ Noch 12 Tage             │    │
│  │ 🥇 Platz 23 von 145      │    │
│  └──────────────────────────┘    │
│                                  │
│  ┌──────────────────────────┐    │
│  │ ☕ Hütten-Kaffee-Tour     │    │
│  │ ███░░░░░░░ 3/5 Hütten   │    │
│  │ Noch 20 Tage             │    │
│  └──────────────────────────┘    │
│                                  │
│  [Mehr Challenges entdecken]     │
└──────────────────────────────────┘
```

### Challenge-Mechanik
- Klares Ziel, Zeitraum und Belohnung
- **Fortschritt wird automatisch** aus aufgezeichneten Touren berechnet
- **Rangliste** aller Teilnehmer
- **Benachrichtigung** bei Abschluss und bei Meilensteinen
- **Exklusive Abzeichen** als Belohnung für abgeschlossene Challenges

### Offene Fragen (noch zu klären für spätere Iteration)
- Wer kann Challenges erstellen: nur TrailMate-Team, oder auch Community-Admins und B2B-Partner?
- Gibt es physische Preise oder nur digitale Abzeichen?
- Wie viele Challenges laufen gleichzeitig? Zu viele = überwältigend
- Regionale Challenges: nur für Nutzer einer bestimmten Region sichtbar?
- Team-Challenges möglich?
- Verifikation sozialer Challenges?

---

## 8.3 Jahres- & Saisonstatistiken

### Auswertungs-Zeiträume
- Diese Woche / dieser Monat / diese Saison / dieses Jahr
- Vergleich mit Vorjahr (z.B. "+15% Höhenmeter gegenüber 2025")
- Alle Zeit (Gesamtstatistik seit Registrierung)

### Angezeigte Kennzahlen
- Gesamtdistanz (km)
- Höhenmeter aufwärts und abwärts
- Anzahl Touren
- Gesamtzeit / durchschnittliche Tourdauer
- Durchschnittsgeschwindigkeit
- Lieblings-Region / meistbesuchter Kanton
- Aktivste Monate (Heatmap)
- Persönliche Rekorde (längste Tour, meiste Höhenmeter an einem Tag etc.)

### Statistik-Queries

```sql
-- Statistiken für einen Zeitraum
SELECT 
    COUNT(*) AS total_tours,
    COALESCE(SUM(distance_m), 0) / 1000.0 AS total_km,
    COALESCE(SUM(elevation_gain_m), 0) AS total_elevation_gain,
    COALESCE(SUM(elevation_loss_m), 0) AS total_elevation_loss,
    COALESCE(SUM(duration_seconds), 0) AS total_duration_s,
    COALESCE(AVG(duration_seconds), 0) AS avg_duration_s,
    COALESCE(AVG(avg_speed_kmh), 0) AS avg_speed,
    MAX(distance_m) AS longest_tour_m,
    MAX(elevation_gain_m) AS most_elevation_day
FROM recordings
WHERE user_id = $userId
  AND started_at BETWEEN $startDate AND $endDate
  AND is_hidden = false;

-- Vorjahresvergleich
-- Gleiche Query mit $startDate - INTERVAL '1 year' und $endDate - INTERVAL '1 year'

-- Aktivste Monate (für Heatmap)
SELECT 
    EXTRACT(MONTH FROM started_at) AS month,
    COUNT(*) AS tours,
    SUM(distance_m) / 1000.0 AS km
FROM recordings
WHERE user_id = $userId AND EXTRACT(YEAR FROM started_at) = $year
GROUP BY month
ORDER BY month;

-- Lieblings-Region
SELECT region, COUNT(*) AS tour_count
FROM recordings r
JOIN routes ro ON r.route_id = ro.id
WHERE r.user_id = $userId
GROUP BY region
ORDER BY tour_count DESC
LIMIT 1;
```

### Visualisierungen

**Heatmap** – Wo man gewandert ist (auf der Karte)
```typescript
// Alle recordings als LineStrings auf der Karte zeigen
// Mit Farbintensität nach Häufigkeit
<MapLibreGL.ShapeSource id="heatmap" shape={allTracksGeoJSON}>
  <MapLibreGL.LineLayer
    id="heatmapLines"
    style={{ lineColor: '#FF6B35', lineWidth: 2, lineOpacity: 0.6 }}
  />
</MapLibreGL.ShapeSource>
```

**Balkendiagramm** – Aktivität pro Monat (mit `react-native-svg`)

**Persönliche Rekorde:**
```
┌──────────────────────────────────┐
│  🏆 Persönliche Rekorde          │
│                                  │
│  📏 Längste Tour:    28.6 km     │
│     (12.08.2026, Jungfrau-Gebiet)│
│  ↑  Meiste Höhenmeter: 1'840 hm │
│     (03.09.2026, Schilthorn)     │
│  ⏱️  Längste Dauer:    9h 15min  │
│     (12.08.2026, Jungfrau-Gebiet)│
│  🚀 Höchste Geschw.: 5.8 km/h   │
│     (15.06.2026, Uetliberg)      │
└──────────────────────────────────┘
```

### Jahresrückblick (Spotify Wrapped Style)

```
┌──────────────────────────────────┐
│  🎉 Dein Wanderjahr 2026         │
│                                  │
│  Du hast in diesem Jahr...       │
│                                  │
│  🏔️ 42 Touren gemacht            │
│  📏 687 km zurückgelegt           │
│  ↑  45'200 Höhenmeter erklommen  │
│  ⏱️  186 Stunden gewandert        │
│                                  │
│  Dein Lieblingskanton: Bern      │
│  Dein aktivster Monat: August    │
│                                  │
│  Mehr als 89% aller TrailMate-   │
│  Nutzer! 🎊                      │
│                                  │
│  [📤 Im Feed teilen]             │
│  [💾 Als Bild speichern]         │
└──────────────────────────────────┘
```

- Automatischer Jahresrückblick im Dezember/Januar
- Kann als Post im Feed geteilt werden
- Kann als Bild gespeichert werden (Share-Card generieren)
- **Erweiterte Statistiken und Jahresrückblick sind Premium-Features**

---

## 8.4 Live-Tracking

### Konzept
Nutzer können ihren Standort während einer Tour mit Vertrauenspersonen teilen. **Zuverlässigkeit hat oberste Priorität** – wenn die Standortübertragung unzuverlässig ist, lieber weglassen als falsche Sicherheit vermitteln.

> ⚠️ **Wichtig:** Feature muss in der Beta-Phase ausgiebig getestet werden. Falls GPS-Tracking zu unzuverlässig → Feature streichen.

### Live-Tracking UI

```
┌──────────────────────────────────┐
│  📍 Live-Tracking                │
│                                  │
│  Vertrauenspersonen (max. 3):    │
│  [+ Person hinzufügen]           │
│  👤 Anna Schmidt   [📱 SMS]      │
│  👤 Peter Müller   [📧 E-Mail]   │
│                                  │
│  ⏱️ Tracking-Dauer:              │
│  ○ Bis Tour-Ende (automatisch)   │
│  ● Feste Dauer: [6 Stunden ▼]   │
│                                  │
│  📡 Update-Intervall:            │
│  [Alle 10 Minuten ▼]             │
│  (Häufiger = mehr Batterie)      │
│                                  │
│  🕐 Geplante Rückkehr:           │
│  [17:00 ▼]                       │
│  (Benachrichtigung bei           │
│   Überschreitung)                │
│                                  │
│  [Tracking starten]              │
│                                  │
│  ℹ️ Für echte Notfälle:          │
│  🚁 Rega-App (1414) verwenden    │
└──────────────────────────────────┘
```

### Tracking-Implementierung

**Standort-Updates als REST-POST mit Polling** (nicht Realtime WebSocket):
- Grund: Live-Tracking braucht kein Sub-Sekunden-Realtime
- Polling ist viel einfacher zu skalieren
- Empfänger (Vertrauensperson) pollt alle 30 Sekunden

```typescript
// Standort-Update senden (alle X Minuten)
const sendLocationUpdate = async (sessionId: string, location: LocationObject) => {
  await supabase.from('live_tracking_sessions').update({
    last_location: `SRID=4326;POINT(${location.coords.longitude} ${location.coords.latitude})`,
    last_updated_at: new Date().toISOString(),
  }).eq('id', sessionId);
};

// Tracking-Session erstellen
const startLiveTracking = async (contacts: Contact[], returnTime: string, intervalMin: number) => {
  const shareToken = generateSecureToken(); // Für Share-Link
  
  const { data } = await supabase.from('live_tracking_sessions').insert({
    user_id: currentUserId,
    share_token: shareToken,
    trusted_contacts: contacts, // max 3
    expected_return: returnTime,
    update_interval_minutes: intervalMin,
    is_active: true,
  }).select().single();
  
  // Link per SMS/E-Mail an Vertrauenspersonen senden
  const shareLink = `https://trailmate.ch/track/${shareToken}`;
  // Alle Kontakte bekommen denselben Link
  
  return data;
};
```

### Empfänger-Ansicht (Web-Seite, keine App nötig)

```
┌──────────────────────────────────┐
│  📍 Live-Standort von Sarah      │
│                                  │
│  [Karte mit aktuellem Standort]  │
│   📍 Letzte Position             │
│                                  │
│  Letztes Update: vor 8 Minuten  │
│  Geplante Rückkehr: 17:00       │
│                                  │
│  🟢 Alles in Ordnung             │
│  (oder 🔴 Rückkehrzeit           │
│   überschritten!)                │
└──────────────────────────────────┘
```

### Benachrichtigung bei Rückkehrzeit-Überschreitung
- Automatische Push-Notification an alle Vertrauenspersonen
- Vertrauensperson-Notification ist **nicht deaktivierbar** in den Einstellungen

### Einstellungen
- **Tracking-Dauer:** Automatisch Tour-Ende, manuell stoppen, oder feste Zeitdauer
- **Update-Intervall:** Alle 5, 10, 30 Minuten (beeinflusst Batterieverbrauch)
- **Vertrauenspersonen:** Bis zu 3, jede bekommt denselben Link
- **Rückkehrzeit:** Einstellbar
- **Live-Tracking ist ein Premium-Feature**

---

## 8.5 Push-Notification-Strategie

### Prinzip
Weniger ist mehr. Lieber eine wichtige Notification die man liest, als zehn die man wegwischt.

### Default-Einstellungen

**Default AN:**
| Kategorie | Typ |
|---|---|
| 💬 Nachrichten | DMs, Post-Postfach-Nachrichten |
| 👥 Soziales | Neuer Follower |
| 🏆 Aktivität | Neues Abzeichen verdient |
| 🗺️ Routen | Zustandsbericht für gemerkte Route, Wetter-Warnung |
| 🆘 Sicherheit | Vertrauensperson-Alert (NICHT deaktivierbar) |

**Default AUS:**
| Kategorie | Typ |
|---|---|
| 👥 Soziales | Likes auf eigene Posts, Kommentare auf eigene Posts |
| 📱 Feed | Neue Posts von Gefolgten |
| 👥 Gruppen | Gruppen-/Community-Aktivität |
| 🏆 Challenges | Challenge-Updates |

### Technische Umsetzung

```typescript
// Push-Token bei App-Start registrieren
import * as Notifications from 'expo-notifications';

async function registerPushToken() {
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return;
  
  const token = (await Notifications.getExpoPushTokenAsync()).data;
  
  // Token im Backend speichern
  await supabase.from('users').update({ push_token: token })
    .eq('id', currentUserId);
}
```

### Notification-Versand (Backend)

```typescript
// Supabase Edge Function: send-notification
const sendPushNotification = async (userId: string, type: string, title: string, body: string, data?: any) => {
  // 1. Notification-Preferences prüfen
  const { data: user } = await supabase.from('users')
    .select('push_token, notification_prefs')
    .eq('id', userId).single();
  
  if (!user?.push_token) return;
  
  // Prüfen ob dieser Notification-Typ aktiviert ist
  const prefs = user.notification_prefs || {};
  if (prefs[type] === false && type !== 'safety') return; // Safety nie deaktivierbar
  
  // 2. In notifications-Tabelle speichern
  await supabase.from('notifications').insert({
    user_id: userId, type, title, body, data,
  });
  
  // 3. Push senden via Expo Push API
  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: user.push_token,
      title, body, data,
    }),
  });
};
```

### Batching
- Wenn 5 Likes in 10 Minuten kommen → eine Notification: "5 Personen gefällt dein Post"
- Verhindert Notification-Spam

### In-App Notification-Center
```
┌──────────────────────────────────┐
│  🔔 Benachrichtigungen           │
│                                  │
│  Heute                           │
│  👤 @bergfex_sarah folgt dir  2h │
│  🏆 Neues Abzeichen: 100km!  3h │
│  📢 Neuer Zustandsbericht     4h │
│      für "Eiger Trail"           │
│                                  │
│  Gestern                         │
│  💬 @wanderlust_ch hat dir    1d │
│      eine Nachricht gesendet     │
│  ❤️ 5 Personen gefällt dein   1d │
│      Post "Oeschinensee"         │
└──────────────────────────────────┘
```

---

## 8.6 Free / Premium Trennung

### Free-Tier (genug um Leute zu halten)

| Feature | Free |
|---|---|
| Feed, Profil, Folgen, Posten | ✅ Komplett kostenlos |
| Routensuche und -planung | ✅ Kostenlos |
| Routenaufzeichnung | ✅ Unbegrenzt |
| Zustandsberichte lesen/schreiben | ✅ Kostenlos |
| Gruppen und Communities | ✅ Kostenlos |
| Wetter – Basisanzeige | ✅ Kostenlos |
| Abzeichen sammeln | ✅ Kostenlos |

### Premium (CHF 1.99/Monat)

| Feature | Premium |
|---|---|
| Offline-Karten (Regionaldownload) | ⭐ Premium |
| Erweiterte Statistiken & Jahresrückblick | ⭐ Premium |
| Höhenprofil-Detail & Höhenkorrektur Wetter | ⭐ Premium |
| Live-Tracking | ⭐ Premium |
| GPX-Export | ⭐ Premium |
| Werbefreier Feed (falls Free später Werbung) | ⭐ Premium |
| Premium-Badge auf dem Profil | ⭐ Premium |

### Premium-Check Implementierung

```typescript
// hooks/usePremium.ts
const usePremium = () => {
  const user = useAuthStore(state => state.user);
  const isPremium = user?.is_premium ?? false;
  
  const requirePremium = (featureName: string) => {
    if (!isPremium) {
      // Premium-Upgrade-Screen anzeigen
      router.push('/premium');
      return false;
    }
    return true;
  };
  
  return { isPremium, requirePremium };
};

// Nutzung:
const handleGpxExport = () => {
  if (!requirePremium('GPX-Export')) return;
  // GPX exportieren...
};
```

### Premium-Screen

```
┌──────────────────────────────────┐
│  ⭐ TrailMate Premium             │
│  CHF 1.99 / Monat                │
│                                  │
│  ✅ Offline-Karten               │
│  ✅ Erweiterte Statistiken       │
│  ✅ Live-Tracking                │
│  ✅ GPX-Export                    │
│  ✅ Höhenkorrektur Wetter        │
│  ✅ Premium-Badge                │
│                                  │
│  [Premium aktivieren]            │
│                                  │
│  Jederzeit kündbar.              │
│  15% App-Store-Gebühr (Small     │
│  Business Program)               │
└──────────────────────────────────┘
```

### In-App-Purchase
- iOS: Apple In-App Purchase (StoreKit)
- Android: Google Play Billing
- Expo: `expo-in-app-purchases` oder `react-native-iap`

### Wirtschaftsrechnung
```
Jahr 1 Ziel: 5'000 zahlende Nutzer (von ~25'000 registrierten = 20% Conversion)

Revenue: 5'000 × CHF 1.99 × 12 = CHF 119'400/Jahr
- App Store Fee (15% Small Business): - CHF 17'910
- Infrastruktur (Supabase Pro + R2 + Domain): ~CHF 6'000/Jahr
= Netto: ~CHF 95'000/Jahr
```

---

## Akzeptanzkriterien – Dokument 8

### Abzeichen
- [ ] Abzeichen werden automatisch vergeben sobald Bedingung erfüllt
- [ ] Benachrichtigung bei neuem Abzeichen
- [ ] Abzeichen-Vitrine auf dem Profil (letzte 6, Tap → alle)
- [ ] Neue Abzeichen können im Feed geteilt werden
- [ ] Seltenheitsstufen (Normal, Selten, Episch) unterscheidbar
- [ ] Mindestens 20+ Abzeichen zum Launch implementiert
- [ ] Badge-Engine prüft nach jeder Tour-Aufzeichnung

### Challenges
- [ ] Challenges haben klares Ziel, Zeitraum und Belohnung
- [ ] Fortschritt wird automatisch aus Touren berechnet
- [ ] Rangliste aller Teilnehmer
- [ ] Benachrichtigung bei Abschluss und Meilensteinen

### Statistiken
- [ ] Statistiken für Woche, Monat, Saison, Jahr und Gesamtzeit
- [ ] Vergleich mit Vorjahr
- [ ] Heatmap der gewanderten Gebiete
- [ ] Persönliche Rekorde werden angezeigt und bei neuem Rekord gefeiert
- [ ] Automatischer Jahresrückblick (teilbar als Post) – Premium
- [ ] Balkendiagramm Aktivität pro Monat

### Live-Tracking
- [ ] Tracking-Dauer einstellbar
- [ ] Update-Intervall einstellbar (5/10/30 Minuten)
- [ ] Standort per Link geteilt – Empfänger braucht keine App
- [ ] Bis zu 3 Vertrauenspersonen
- [ ] Automatische Benachrichtigung bei Rückkehrzeit-Überschreitung
- [ ] Rückkehrzeit einstellbar
- [ ] Prominenter Hinweis auf Rega-App (1414)
- [ ] Tracking läuft batteriesparend im Hintergrund
- [ ] Premium-Feature

### Push Notifications
- [ ] Push-Token bei App-Start registriert
- [ ] Alle Default-AN Notifications funktionieren
- [ ] Alle Notification-Typen einzeln konfigurierbar (ausser Sicherheit)
- [ ] Batching (5 Likes → eine Notification)
- [ ] In-App Notification-Center

### Premium
- [ ] Free/Premium-Trennung umgesetzt
- [ ] Premium-Upgrade-Screen
- [ ] In-App-Purchase für iOS und Android
- [ ] Premium-Badge auf dem Profil
- [ ] Premium-Check vor geschützten Features

---

## Relevante Tabellen (aus Dokument 01)

- `badges` – Abzeichen-Definitionen
- `user_badges` – Verdiente Abzeichen pro Nutzer
- `challenges` – Challenge-Definitionen
- `challenge_participants` – Teilnehmer + Fortschritt
- `recordings` – Für Statistiken und Badge-Berechnung
- `live_tracking_sessions` – Live-Tracking Sessions
- `notifications` – Alle Benachrichtigungen
- `users` – push_token, notification_prefs, is_premium

---

## Optionale B2B-Einnahmen (mittelfristig, NICHT in diesem Dokument implementieren)

Für spätere Iteration dokumentiert:
- Bergbahnen, Tourismusregionen, Hütten können "Promoted Routes" kaufen
- Offizielle Communities für B2B-Partner (CHF 50–100/Monat)
- Sponsored Challenges ("Titlis Gipfel-Challenge" – Bergbahn zahlt)
- Eigene B2B-Abzeichen (z.B. "Titlis-Gipfelstürmer")
- KEINE Werbung im klassischen Sinn, sondern native Integration
