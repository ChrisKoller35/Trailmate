# TrailMate – Dokument 9: Wanderpartner finden (Offene Touren, Matching, Vertrauen & Sicherheit)

> **Ziel:** Die Kernidee von TrailMate umsetzen: Menschen finden, die zusammen wandern wollen. Nach diesem Dokument können Nutzer offene Touren ausschreiben und finden, sich anfragen und zusagen, in einem Tour-Chat absprechen, sich über den Spontan-Modus automatisch zu Gruppen zusammenführen lassen, und nach der Tour gegenseitig bewerten. Ein Vertrauensprofil mit verifiziertem Level und Tempo-Faktor macht das Matching ehrlich, eine durchgehende Sicherheitsarchitektur macht es sicher.

> **Voraussetzung:** Dokument 01–04 sind abgearbeitet (Nutzer, Profil, Karte, Routing, Aufzeichnung). Aus Dokument 07 wird die ÖV-Integration (7.5), das Wetter (7.4) und die Wegzustände (7.6) genutzt, aus Dokument 08 das Live-Tracking (8.4) und die Push-Infrastruktur (8.5). Wo diese noch fehlen, werden die entsprechenden Elemente ausgeblendet und später aktiviert (Feature-Flags, siehe 9.18).

> **Stellenwert:** Dieses Dokument beschreibt den **Mittelpunkt der App**. Die Startseite, das Onboarding und das Profil werden darauf ausgerichtet (siehe Anhang A: Änderungen an Dokument 01–08). Empfohlene neue Reihenfolge: 01 → 02 → 03 → 04 → **09** → 07 → 05 → 06 → 08.

---

## 9.1 Konzept & Grundprinzipien

### Das Problem
Viele Menschen würden mehr wandern, tun es aber nicht, weil Freunde nicht mitkommen oder ein anderes Niveau haben, weil sie neu in der Region sind, oder weil sie allein unsicher sind. Heute sucht man über Facebook-Gruppen, Meetup oder Vereine. Keine dieser Lösungen kennt Level, Tempo, Route, Wetter oder ÖV.

### Die fünf Grundprinzipien

| # | Prinzip | Bedeutung für die Umsetzung |
|---|---|---|
| 1 | **Touren matchen, nicht Personen** | Das zentrale Objekt ist die *offene Tour*. Es gibt kein Durchwischen von Profilen, keine "Likes" auf Personen. Man meldet sich für eine Wanderung an. |
| 2 | **Sicherheit ist Architektur** | Öffentliche Treffpunkte, Verifizierung, Bewertungen, automatisches Live-Tracking. Kein Sicherheitsfeature liegt hinter der Bezahlschranke. |
| 3 | **Ehrliche Daten statt Selbsteinschätzung** | Level und Tempo werden aus aufgezeichneten Touren abgeleitet und als "bestätigt" gekennzeichnet. |
| 4 | **Die Tour wird gleich mitgeplant** | Jede offene Tour enthält Route, ÖV-Verbindung, Wetter und Wegzustand. Matching und Planung sind ein Produkt. |
| 5 | **Gratis-Kern** | Eine Tour finden, anfragen und mitkommen ist immer kostenlos. Sonst wird das Netz zu dünn. |

### Abgrenzung zu bestehenden Features

| Feature | Zweck | Unterschied |
|---|---|---|
| **Offene Tour** (neu) | Mit neuen Leuten wandern | Öffentlich oder regional auffindbar, Anfrage an Organisierende, Tour-Chat |
| Gruppen-Event (Dok. 06) | Termin innerhalb einer bestehenden Gruppe | Nur für Gruppenmitglieder sichtbar. Ein Gruppen-Event kann optional zusätzlich als offene Tour veröffentlicht werden (siehe 9.14). |
| DMs (Dok. 06) | Privates Gespräch zwischen Bekannten | Tour-Chat ersetzt die Notwendigkeit von DMs für die Organisation |

### Begriffe

| Begriff | Bedeutung |
|---|---|
| **Offene Tour** | Eine ausgeschriebene Wanderung mit Datum, Route, Treffpunkt und freien Plätzen |
| **Organisierende Person (Host)** | Erstellt die offene Tour, nimmt Anfragen an oder lehnt ab |
| **Teilnehmende** | Nutzer mit bestätigter Zusage |
| **Spontan-Signal** | "Ich habe an Tag X Zeit" ohne konkrete Tour; die App bildet daraus Gruppen |
| **Vertrauensprofil** | Der Teil des Profils, der für das Matching relevant ist (Level, Tempo, Sprachen, Zuverlässigkeit, Bewertungen) |
| **Tempo-Faktor** | Verhältnis der eigenen Gehzeit zur Richtzeit. 1.00 = genau Richtzeit, 0.85 = 15 % schneller |

---

## 9.2 Datenbank-Schema

> Alle Tabellen in diesem Abschnitt sind neu und werden als eigene Migration angelegt (`supabase/migrations/xxxx_partner_matching.sql`). RLS-Policies sind **vollständig** angegeben und nicht nur exemplarisch, weil hier Fremde miteinander in Kontakt kommen.

### Erweiterung `users`
```sql
ALTER TABLE users
    ADD COLUMN birth_year SMALLINT,                       -- Pflicht für Matching (18+), nie öffentlich
    ADD COLUMN gender_identity VARCHAR(20),               -- 'female', 'male', 'non_binary', 'prefer_not'; nur für FLINTA-Filter, nie öffentlich
    ADD COLUMN languages VARCHAR(5)[] DEFAULT '{de}',     -- ISO-Codes: 'de','fr','it','rm','en'
    ADD COLUMN home_station_id VARCHAR(20),               -- ÖV-Haltestelle (Didok/UIC-Nummer), Basis für Distanz
    ADD COLUMN home_station_name VARCHAR(100),
    ADD COLUMN home_station_location GEOMETRY(Point, 4326),
    ADD COLUMN hiking_style JSONB DEFAULT '{}',           -- siehe 9.3 "Wanderstil"
    ADD COLUMN has_ga BOOLEAN DEFAULT FALSE,              -- Generalabonnement
    ADD COLUMN has_halbtax BOOLEAN DEFAULT FALSE,
    ADD COLUMN phone_verified_at TIMESTAMPTZ,             -- Verifizierungsstufe 2
    ADD COLUMN id_verified_at TIMESTAMPTZ,                -- Verifizierungsstufe 3 (Phase 2)
    ADD COLUMN matching_enabled BOOLEAN DEFAULT FALSE,    -- erst nach Sicherheits-Intro + 18+ + Telefon
    ADD COLUMN matching_suspended_until TIMESTAMPTZ;      -- Sperre durch Moderation
```

### `hiking_profiles` – berechnetes Vertrauensprofil
Wird nicht vom Client geschrieben, sondern ausschliesslich durch die Funktion `refresh_hiking_profile()` (siehe 9.3).
```sql
CREATE TABLE hiking_profiles (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    verified_level VARCHAR(2),               -- höchste bestätigte SAC-Stufe 'T1'..'T6', NULL = keine
    verified_level_count INTEGER DEFAULT 0,  -- Anzahl Touren auf dieser Stufe
    pace_factor NUMERIC(4,2),                -- Median der letzten 10 auswertbaren Touren
    pace_sample_size INTEGER DEFAULT 0,
    typical_duration_min INTEGER,            -- Median der Tourdauer
    tours_total INTEGER DEFAULT 0,
    hikes_attended INTEGER DEFAULT 0,        -- Offene Touren, bei denen Check-in erfolgte
    hikes_hosted INTEGER DEFAULT 0,          -- Selbst organisierte, stattgefundene Touren
    no_shows INTEGER DEFAULT 0,
    late_cancellations INTEGER DEFAULT 0,    -- Absage < 12h vor Start
    reliability_score NUMERIC(4,3),          -- 0.000–1.000, NULL bis 3 Touren
    review_count INTEGER DEFAULT 0,
    review_pace_ok_ratio NUMERIC(4,3),       -- Anteil "Tempo passte"
    review_pleasant_ratio NUMERIC(4,3),      -- Anteil "angenehme Begleitung"
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### `hike_invites` – Offene Touren
```sql
CREATE TABLE hike_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    host_id UUID REFERENCES users(id) ON DELETE CASCADE,
    route_id UUID REFERENCES routes(id),                  -- Pflicht ausser bei 'route_tbd'
    route_tbd BOOLEAN DEFAULT FALSE,                      -- Route wird gemeinsam entschieden (nur Spontan-Modus)
    title VARCHAR(120) NOT NULL,
    description TEXT,

    starts_at TIMESTAMPTZ NOT NULL,                       -- Treffzeit
    expected_end_at TIMESTAMPTZ,                          -- aus Route + ÖV-Rückreise berechnet
    meeting_point_name VARCHAR(150) NOT NULL,             -- z.B. "Bern HB, Gleis 6, vorderster Wagen"
    meeting_station_id VARCHAR(20),                       -- ÖV-Haltestelle (empfohlen)
    meeting_location GEOMETRY(Point, 4326) NOT NULL,
    meeting_is_public_place BOOLEAN NOT NULL DEFAULT TRUE,
    transport JSONB,                                      -- gewählte ÖV-Verbindung hin/zurück (Snapshot aus Dok. 07)

    region VARCHAR(100),                                  -- aus Routen-Startpunkt abgeleitet
    sac_scale VARCHAR(2),                                 -- aus Route übernommen
    pace VARCHAR(20) NOT NULL DEFAULT 'normal',           -- 'gemuetlich', 'normal', 'zuegig', 'sportlich'
    style_tags VARCHAR(30)[] DEFAULT '{}',                -- siehe 9.4
    languages VARCHAR(5)[] NOT NULL DEFAULT '{de}',

    max_participants SMALLINT NOT NULL CHECK (max_participants BETWEEN 1 AND 19), -- ohne Host
    approval_mode VARCHAR(20) NOT NULL DEFAULT 'manual',  -- 'manual', 'auto_verified'
    min_verified_level VARCHAR(2),                        -- optional: z.B. 'T3' verlangt bestätigtes T3
    flinta_only BOOLEAN DEFAULT FALSE,                    -- nur Frauen, nicht-binäre Personen etc.
    beginners_welcome BOOLEAN DEFAULT FALSE,              -- Mentoring-Tour (9.13)
    dogs_allowed BOOLEAN DEFAULT FALSE,
    visibility VARCHAR(20) NOT NULL DEFAULT 'public',     -- 'public', 'region', 'followers', 'group', 'link'
    group_id UUID REFERENCES groups(id) ON DELETE SET NULL,
    community_id UUID REFERENCES communities(id) ON DELETE SET NULL,
    share_token VARCHAR(24) UNIQUE,                       -- für visibility = 'link'

    recurrence_rule TEXT,                                 -- RRULE für Wanderstamm (9.12), NULL = einmalig
    parent_invite_id UUID REFERENCES hike_invites(id),    -- Instanz einer Serie
    origin VARCHAR(20) NOT NULL DEFAULT 'manual',         -- 'manual', 'spontaneous', 'group_event', 'organization', 'seed'

    status VARCHAR(20) NOT NULL DEFAULT 'open',           -- 'open','full','cancelled','in_progress','completed'
    cancelled_reason TEXT,
    participant_count SMALLINT DEFAULT 0,                 -- per Trigger gepflegt
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT starts_in_future CHECK (starts_at > created_at + INTERVAL '2 hours')
);

CREATE INDEX hike_invites_meeting_gix ON hike_invites USING GIST (meeting_location);
CREATE INDEX hike_invites_open_idx ON hike_invites (status, starts_at) WHERE status IN ('open','full');
CREATE INDEX hike_invites_host_idx ON hike_invites (host_id);
```

### `hike_participants` – Anfragen & Teilnahmen
```sql
CREATE TABLE hike_participants (
    invite_id UUID REFERENCES hike_invites(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'requested',
        -- 'requested','accepted','declined','waitlisted','withdrawn','cancelled_late','removed'
    request_message VARCHAR(500),                         -- "Hallo, ich bin Lena, ..."
    carpool_seats_offered SMALLINT DEFAULT 0,             -- 9.15
    carpool_needs_seat BOOLEAN DEFAULT FALSE,
    checked_in_at TIMESTAMPTZ,                            -- Check-in am Treffpunkt (9.6)
    attendance VARCHAR(20),                               -- 'attended','no_show', NULL = offen
    attendance_marked_by UUID REFERENCES users(id),
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    decided_at TIMESTAMPTZ,
    PRIMARY KEY (invite_id, user_id)
);
CREATE INDEX hike_participants_user_idx ON hike_participants (user_id, status);
```

### `hike_chat_messages` – Tour-Chat
```sql
CREATE TABLE hike_chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invite_id UUID REFERENCES hike_invites(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES users(id) ON DELETE SET NULL,   -- NULL = Systemnachricht
    kind VARCHAR(20) NOT NULL DEFAULT 'text',                 -- 'text','system','location','photo'
    content TEXT NOT NULL,
    data JSONB,                                               -- z.B. Gleisänderung, Foto-URL
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX hike_chat_invite_idx ON hike_chat_messages (invite_id, created_at);
```

### `hike_questions` – Fragen vor der Anfrage
Damit man vor einer Anfrage etwas klären kann ("Ist die Tour mit Kinderwagen möglich?"), ohne dass ein freier DM-Kanal zu Fremden entsteht.
```sql
CREATE TABLE hike_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invite_id UUID REFERENCES hike_invites(id) ON DELETE CASCADE,
    asker_id UUID REFERENCES users(id) ON DELETE CASCADE,
    question VARCHAR(300) NOT NULL,
    answer VARCHAR(500),
    is_public BOOLEAN DEFAULT TRUE,          -- Host entscheidet: öffentlich (FAQ) oder privat beantworten
    created_at TIMESTAMPTZ DEFAULT NOW(),
    answered_at TIMESTAMPTZ
);
```

### `availability_signals` – Spontan-Modus
```sql
CREATE TABLE availability_signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    earliest_start TIME NOT NULL DEFAULT '06:00',
    latest_return TIME NOT NULL DEFAULT '20:00',
    start_station_id VARCHAR(20) NOT NULL,
    start_location GEOMETRY(Point, 4326) NOT NULL,
    max_travel_min SMALLINT NOT NULL DEFAULT 90,          -- maximale ÖV-Anreise
    level_min VARCHAR(2) NOT NULL DEFAULT 'T1',
    level_max VARCHAR(2) NOT NULL DEFAULT 'T3',
    duration_min_h NUMERIC(3,1) DEFAULT 3,
    duration_max_h NUMERIC(3,1) DEFAULT 6,
    group_size_max SMALLINT DEFAULT 6,
    preferences JSONB DEFAULT '{}',                       -- z.B. {"bergsee": true, "huette": true}
    flinta_only BOOLEAN DEFAULT FALSE,
    status VARCHAR(20) NOT NULL DEFAULT 'active',         -- 'active','proposed','matched','expired','withdrawn'
    matched_invite_id UUID REFERENCES hike_invites(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT one_signal_per_day UNIQUE (user_id, date)
);
CREATE INDEX availability_active_idx ON availability_signals (date, status) WHERE status = 'active';
CREATE INDEX availability_location_gix ON availability_signals USING GIST (start_location);
```

### `match_proposals` – Gruppenvorschläge aus dem Spontan-Modus
```sql
CREATE TABLE match_proposals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    route_id UUID REFERENCES routes(id),
    meeting_station_id VARCHAR(20),
    meeting_location GEOMETRY(Point, 4326),
    starts_at TIMESTAMPTZ,
    member_signal_ids UUID[] NOT NULL,
    score NUMERIC(5,3),
    reasoning JSONB,                          -- warum diese Route/Gruppe (für UI: "sonnig, alle ≤ 70 Min Anreise")
    status VARCHAR(20) DEFAULT 'pending',     -- 'pending','confirmed','expired','declined'
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE match_proposal_responses (
    proposal_id UUID REFERENCES match_proposals(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    response VARCHAR(20) NOT NULL,            -- 'accept','decline'
    responded_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (proposal_id, user_id)
);
```

### `hike_reviews` – Gegenseitige Bewertung
```sql
CREATE TABLE hike_reviews (
    invite_id UUID REFERENCES hike_invites(id) ON DELETE CASCADE,
    reviewer_id UUID REFERENCES users(id) ON DELETE CASCADE,
    reviewee_id UUID REFERENCES users(id) ON DELETE CASCADE,
    showed_up BOOLEAN NOT NULL,
    pace_ok BOOLEAN,
    pleasant BOOLEAN,
    would_hike_again BOOLEAN,
    private_note VARCHAR(500),                -- nur für Moderation sichtbar, nie für reviewee
    safety_concern BOOLEAN DEFAULT FALSE,     -- löst Moderations-Fall aus (9.10)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (invite_id, reviewer_id, reviewee_id),
    CHECK (reviewer_id <> reviewee_id)
);
```

### `hike_again_votes` – "Nochmal zusammen?"
```sql
CREATE TABLE hike_again_votes (
    invite_id UUID REFERENCES hike_invites(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    wants_group BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (invite_id, user_id)
);
```

### Erweiterungen bestehender Tabellen
```sql
-- Aufzeichnung mit offener Tour verknüpfen (für soziale Abzeichen + Tempo-Abgleich)
ALTER TABLE recordings ADD COLUMN hike_invite_id UUID REFERENCES hike_invites(id) ON DELETE SET NULL;

-- Live-Tracking an Tour koppeln (9.10)
ALTER TABLE live_tracking_sessions
    ADD COLUMN hike_invite_id UUID REFERENCES hike_invites(id) ON DELETE SET NULL,
    ADD COLUMN auto_started BOOLEAN DEFAULT FALSE;

-- Neue Meldegründe und Bezug auf Touren
ALTER TABLE reports
    ADD COLUMN hike_invite_id UUID REFERENCES hike_invites(id),
    ADD COLUMN priority VARCHAR(10) DEFAULT 'normal';     -- 'normal','high' (Sicherheit)
-- reason erweitert um: 'harassment','unsafe_behavior','no_show','unwanted_advances','misrepresented_level','fake_profile'

-- Organisationen (9.14): Communities/Gruppen als Organisation kennzeichnen
ALTER TABLE communities ADD COLUMN org_type VARCHAR(30);  -- 'sac_section','club','tourism','guide','university','other'
```

### Trigger: Teilnehmerzahl & Status pflegen
```sql
CREATE OR REPLACE FUNCTION sync_invite_participants() RETURNS TRIGGER AS $$
DECLARE
    v_invite_id UUID := COALESCE(NEW.invite_id, OLD.invite_id);
    v_count INTEGER;
    v_max INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count FROM hike_participants
     WHERE invite_id = v_invite_id AND status = 'accepted';
    SELECT max_participants INTO v_max FROM hike_invites WHERE id = v_invite_id;

    UPDATE hike_invites
       SET participant_count = v_count,
           status = CASE
               WHEN status IN ('open','full') AND v_count >= v_max THEN 'full'
               WHEN status = 'full' AND v_count < v_max THEN 'open'
               ELSE status END,
           updated_at = NOW()
     WHERE id = v_invite_id;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER hike_participants_sync
AFTER INSERT OR UPDATE OF status OR DELETE ON hike_participants
FOR EACH ROW EXECUTE FUNCTION sync_invite_participants();
```

Wenn ein Platz frei wird (`full` → `open`), wird die erste Person auf der Warteliste (`waitlisted`, älteste `requested_at`) per Edge Function benachrichtigt und bei `approval_mode = 'auto_verified'` direkt nachgerückt.

### Row Level Security (vollständig)

```sql
ALTER TABLE hiking_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE hike_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE hike_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE hike_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE hike_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_proposal_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE hike_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE hike_again_votes ENABLE ROW LEVEL SECURITY;

-- Hilfsfunktionen
CREATE OR REPLACE FUNCTION is_blocked_between(a UUID, b UUID) RETURNS BOOLEAN AS $$
    SELECT EXISTS (SELECT 1 FROM blocks
                   WHERE (blocker_id = a AND blocked_id = b)
                      OR (blocker_id = b AND blocked_id = a));
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_hike_member(p_invite UUID, p_user UUID) RETURNS BOOLEAN AS $$
    SELECT EXISTS (SELECT 1 FROM hike_invites WHERE id = p_invite AND host_id = p_user)
        OR EXISTS (SELECT 1 FROM hike_participants
                   WHERE invite_id = p_invite AND user_id = p_user AND status = 'accepted');
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION can_use_matching(p_user UUID) RETURNS BOOLEAN AS $$
    SELECT matching_enabled
       AND (matching_suspended_until IS NULL OR matching_suspended_until < NOW())
      FROM users WHERE id = p_user;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- hiking_profiles: für alle eingeloggten Matching-Nutzer lesbar, niemand schreibt direkt
CREATE POLICY "hiking_profiles readable"
ON hiking_profiles FOR SELECT
USING (auth.uid() IS NOT NULL AND NOT is_blocked_between(auth.uid(), user_id));

-- hike_invites: Sichtbarkeit nach visibility, Block-Filter, FLINTA-Filter
CREATE POLICY "invites visible"
ON hike_invites FOR SELECT
USING (
    host_id = auth.uid()
    OR is_hike_member(id, auth.uid())
    OR (
        can_use_matching(auth.uid())
        AND NOT is_blocked_between(auth.uid(), host_id)
        AND (NOT flinta_only OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid()
                                        AND u.gender_identity IN ('female','non_binary')))
        AND (
            visibility IN ('public','region')
            OR (visibility = 'followers' AND EXISTS (SELECT 1 FROM follows
                    WHERE follower_id = auth.uid() AND following_id = host_id))
            OR (visibility = 'group' AND EXISTS (SELECT 1 FROM group_members
                    WHERE group_id = hike_invites.group_id AND user_id = auth.uid()))
            -- 'link': nur über RPC get_invite_by_token(), nicht über direkte SELECTs
        )
    )
);

CREATE POLICY "invites insert by matching users"
ON hike_invites FOR INSERT
WITH CHECK (host_id = auth.uid() AND can_use_matching(auth.uid()));

CREATE POLICY "invites update by host"
ON hike_invites FOR UPDATE
USING (host_id = auth.uid())
WITH CHECK (host_id = auth.uid());
-- Löschen nicht erlaubt: Touren werden abgesagt (status = 'cancelled'), damit Bewertungen und Meldungen erhalten bleiben.

-- hike_participants
CREATE POLICY "participants visible to members and self"
ON hike_participants FOR SELECT
USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM hike_invites WHERE id = invite_id AND host_id = auth.uid())
    OR (status = 'accepted' AND is_hike_member(invite_id, auth.uid()))
);

CREATE POLICY "users request themselves"
ON hike_participants FOR INSERT
WITH CHECK (
    user_id = auth.uid()
    AND status = 'requested'
    AND can_use_matching(auth.uid())
    AND EXISTS (SELECT 1 FROM hike_invites i
                WHERE i.id = invite_id AND i.status = 'open' AND i.host_id <> auth.uid()
                  AND NOT is_blocked_between(auth.uid(), i.host_id))
);
-- Statuswechsel (accept/decline/withdraw/attendance) laufen ausschliesslich über RPCs (9.6),
-- daher keine UPDATE-Policy für Clients.

-- hike_chat_messages: nur Host + bestätigte Teilnehmende, Schreiben bis 7 Tage nach Tour
CREATE POLICY "chat read by members"
ON hike_chat_messages FOR SELECT
USING (is_hike_member(invite_id, auth.uid()));

CREATE POLICY "chat write by members while active"
ON hike_chat_messages FOR INSERT
WITH CHECK (
    sender_id = auth.uid()
    AND kind IN ('text','location','photo')
    AND is_hike_member(invite_id, auth.uid())
    AND EXISTS (SELECT 1 FROM hike_invites WHERE id = invite_id
                AND status <> 'cancelled'
                AND COALESCE(expected_end_at, starts_at) > NOW() - INTERVAL '7 days')
);

-- hike_questions
CREATE POLICY "questions visible"
ON hike_questions FOR SELECT
USING (asker_id = auth.uid()
       OR EXISTS (SELECT 1 FROM hike_invites WHERE id = invite_id AND host_id = auth.uid())
       OR (is_public AND answer IS NOT NULL));

CREATE POLICY "questions insert"
ON hike_questions FOR INSERT
WITH CHECK (asker_id = auth.uid() AND can_use_matching(auth.uid()));

CREATE POLICY "questions answered by host"
ON hike_questions FOR UPDATE
USING (EXISTS (SELECT 1 FROM hike_invites WHERE id = invite_id AND host_id = auth.uid()));

-- availability_signals: nur eigene; Matching-Job läuft mit service_role
CREATE POLICY "own signals" ON availability_signals FOR ALL
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid() AND can_use_matching(auth.uid()));

-- match_proposals: nur sichtbar für Mitglieder des Vorschlags
CREATE POLICY "proposal visible to members"
ON match_proposals FOR SELECT
USING (EXISTS (SELECT 1 FROM availability_signals s
               WHERE s.id = ANY(member_signal_ids) AND s.user_id = auth.uid()));

CREATE POLICY "own proposal responses" ON match_proposal_responses FOR ALL
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- hike_reviews: niemand liest einzelne Bewertungen über sich; nur Aggregat in hiking_profiles
CREATE POLICY "reviewer sees own reviews"
ON hike_reviews FOR SELECT USING (reviewer_id = auth.uid());

CREATE POLICY "review after attended hike"
ON hike_reviews FOR INSERT
WITH CHECK (
    reviewer_id = auth.uid()
    AND is_hike_member(invite_id, auth.uid())
    AND is_hike_member(invite_id, reviewee_id)
    AND EXISTS (SELECT 1 FROM hike_invites WHERE id = invite_id AND status = 'completed'
                AND COALESCE(expected_end_at, starts_at) > NOW() - INTERVAL '14 days')
);

CREATE POLICY "own again votes" ON hike_again_votes FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid() AND is_hike_member(invite_id, auth.uid()));
```

> **Wichtig:** `users.birth_year`, `users.gender_identity`, `users.phone` und `users.home_station_location` dürfen nie über die öffentliche Profil-Policy ausgeliefert werden. Dafür eine View `public_profiles` anlegen, die nur unkritische Spalten enthält, und Client-Queries für fremde Profile ausschliesslich über diese View laufen lassen. Die Heimathaltestelle wird anderen nie angezeigt, nur die Distanz in Reisezeit ("ca. 40 Min von dir").

---

## 9.3 Vertrauensprofil

### Konzept
Das Vertrauensprofil beantwortet die drei Fragen, die man sich vor einer Tour mit Fremden stellt: **Kann die Person das? Passt das Tempo? Kann ich mich auf sie verlassen?** Es erscheint auf jeder Tourkarte (Host) und bei jeder Anfrage (Anfragende).

### Profil-Abschnitt "Als Wanderpartner"
```
┌──────────────────────────────────────┐
│  🥾 Als Wanderpartnerin               │
│                                       │
│  Level    T3 ✓ bestätigt (9 Touren)   │
│           Selbsteinschätzung: T3–T4    │
│  Tempo    zügig · 12 % schneller als  │
│           die Wegweiser-Zeit          │
│  Dauer    meist 4–6 h                 │
│  Sprachen 🇩🇪 Deutsch · 🇬🇧 Englisch    │
│  Stil     Fotostopps · gesprächig ·   │
│           Hüttenhalt                  │
│                                       │
│  ✓ Telefon verifiziert                │
│  🤝 14 gemeinsame Touren, 5 organisiert│
│  ⏱️ Zuverlässig (100 %)                │
│  👍 Tempo passte: 13 von 14           │
│     Angenehme Begleitung: 14 von 14   │
└──────────────────────────────────────┘
```

### Bestätigtes Level

Eine Tour zählt für das bestätigte Level, wenn:
- sie aufgezeichnet wurde (Dokument 04) und mindestens 60 Minuten Bewegungszeit hat,
- sie entweder mit einer Route verknüpft ist (`recordings.route_id`) **oder** zu mindestens 70 % auf Kanten des Wandernetzes (`hiking_network`) verläuft, deren SAC-Stufe bekannt ist,
- die massgebende SAC-Stufe = die höchste Stufe, die auf mindestens 500 m Länge begangen wurde (damit ein kurzes Stück T4 nicht die ganze Tour zur T4 macht).

**Regel:** `verified_level` = höchste Stufe mit **mindestens 2** zählenden Touren in den letzten 36 Monaten. Darunter steht nur die Selbsteinschätzung aus dem Onboarding mit dem Hinweis "noch nicht bestätigt".

```sql
-- Teil von refresh_hiking_profile(p_user UUID)
WITH tour_levels AS (
    SELECT r.id,
           COALESCE(rt.sac_scale, (
               SELECT hn.sac_scale
                 FROM hiking_network hn
                WHERE ST_DWithin(hn.geom::geography, r.geom::geography, 15)
                GROUP BY hn.sac_scale
               HAVING SUM(ST_Length(ST_Intersection(ST_Buffer(r.geom::geography, 15)::geometry, hn.geom)::geography)) >= 500
                ORDER BY hn.sac_scale DESC
                LIMIT 1
           )) AS level
      FROM recordings r
      LEFT JOIN routes rt ON rt.id = r.route_id
     WHERE r.user_id = p_user
       AND r.moving_time_seconds >= 3600
       AND r.started_at > NOW() - INTERVAL '36 months'
)
SELECT level, COUNT(*) AS n
  FROM tour_levels
 WHERE level IS NOT NULL
 GROUP BY level
HAVING COUNT(*) >= 2
 ORDER BY level DESC
 LIMIT 1;
```

> **Hinweis an den Agent:** Die 70 %-Abdeckungsprüfung ist rechenintensiv. Sie läuft asynchron nach jeder neuen Aufzeichnung als Edge Function (`on_recording_finished`) und schreibt das Ergebnis in eine Spalte `recordings.matched_sac_scale`. Die obige Query liest dann nur noch diese Spalte. Das Beispiel oben zeigt die Logik, nicht die finale Performance-Lösung.

### Tempo-Faktor

Der Tempo-Faktor vergleicht die eigene Bewegungszeit mit der **Richtzeit**. Richtzeit-Quelle in dieser Reihenfolge:
1. Offizielle Wanderzeit der Route (`routes.estimated_duration_min`, aus Swisstopo/SchweizMobil),
2. sonst berechnet nach der Formel der Schweizer Wanderwege (Näherung nach DIN 33466):

```typescript
// lib/matching/pace.ts

/** Richtzeit in Minuten. Horizontal 4.2 km/h, Aufstieg 300 hm/h, Abstieg 500 hm/h. */
export function referenceTimeMinutes(distanceM: number, gainM: number, lossM: number): number {
  const horizontal = (distanceM / 1000) / 4.2 * 60;
  const vertical = (gainM / 300) * 60 + (lossM / 500) * 60;
  return Math.max(horizontal, vertical) + Math.min(horizontal, vertical) / 2;
}

/** Tempo-Faktor einer Tour. < 1 = schneller als Richtzeit. */
export function paceFactor(movingTimeSec: number, reference: number): number | null {
  if (reference < 60) return null;                       // zu kurz für eine Aussage
  const f = (movingTimeSec / 60) / reference;
  return f < 0.4 || f > 2.5 ? null : Math.round(f * 100) / 100; // Ausreisser (GPS-Fehler, Seilbahn) verwerfen
}

/** Profilwert: Median der letzten 10 gültigen Touren, mindestens 3 nötig. */
export function profilePace(factors: number[]): number | null {
  const valid = factors.filter((f): f is number => f !== null).slice(0, 10);
  if (valid.length < 3) return null;
  const s = [...valid].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
```

**Darstellung in Worten** (nie nur als Zahl):

| Tempo-Faktor | Label | Anzeige |
|---|---|---|
| > 1.15 | gemütlich | "lässt sich Zeit, ca. X % langsamer als die Wegweiser-Zeit" |
| 0.95 – 1.15 | normal | "etwa Wegweiser-Tempo" |
| 0.80 – 0.95 | zügig | "ca. X % schneller als die Wegweiser-Zeit" |
| < 0.80 | sportlich | "deutlich schneller als die Wegweiser-Zeit" |

Bewegungszeit statt Gesamtzeit, damit Fotostopps und Hüttenpausen das Tempo nicht verfälschen. Strecken mit Bahn/Bus/Seilbahn werden über die Geschwindigkeit (> 15 km/h über > 2 Minuten) erkannt und aus der Berechnung entfernt.

### Wanderstil (`users.hiking_style`)
Selbst gewählte Tags, maximal 6:
```json
{
  "tags": ["fotostopps", "gespraechig", "huettenhalt", "fruehaufsteher"],
  "pause_style": "kurz"   // 'kurz', 'normal', 'ausgiebig'
}
```
Verfügbare Tags: `fotostopps`, `gespraechig`, `ruhig`, `huettenhalt`, `picknick`, `bergsee_baden`, `gipfel_muss_sein`, `fruehaufsteher`, `naturbeobachtung`, `mit_hund`, `trainieren`, `geniessen`.

### Zuverlässigkeit
```
reliability_score = attended / (attended + no_shows + 0.5 × late_cancellations)
```
- Wird erst ab **3 vergangenen Teilnahmen** angezeigt, vorher "neu dabei".
- Rechtzeitige Absagen (> 12 h vorher) zählen nicht negativ.
- Absagen der organisierenden Person zählen für sie als `late_cancellations`, wenn < 12 h und mindestens eine Person zugesagt hatte.
- Bei Unwetterwarnung (MeteoSwiss Stufe ≥ 3 für die Region, Dok. 07) sind Absagen für alle straffrei.

### Aktualisierung
`refresh_hiking_profile(user_id)` läuft:
- nach jeder neuen Aufzeichnung,
- nach Abschluss jeder offenen Tour (Attendance + Reviews),
- nächtlich für alle Nutzer mit Aktivität in den letzten 24 h.

---

## 9.4 Offene Tour erstellen

### Einstiegspunkte
1. Startseite "Touren" → Button **[+ Tour ausschreiben]**
2. Routendetail (Dok. 03) → **[Mit anderen gehen]** (Route ist vorausgefüllt)
3. Gruppen-Event (Dok. 06) → Option "Auch als offene Tour veröffentlichen"
4. Nach einer eigenen Aufzeichnung → "Diese Tour nochmal mit anderen machen?"

### Erstellungs-Flow (4 Schritte)

```
Schritt 1: Route & Datum            Schritt 2: Treffpunkt & Anreise
┌──────────────────────────────┐    ┌──────────────────────────────┐
│  🗺️ Route                     │    │  📍 Treffpunkt                │
│  [Niesen über Wimmis ▼]      │    │  ● Bern HB (empfohlen)       │
│  T2 · 12.4 km · ↑1'400 hm    │    │  ○ Thun                      │
│  Richtzeit 5 h 10 min        │    │  ○ Wimmis, Bahnhof           │
│                              │    │  ○ Anderer öffentlicher Ort  │
│  📅 Samstag, 18. Okt         │    │                              │
│  🕖 Treffen 07:00            │    │  🚂 Vorgeschlagene Verbindung │
│                              │    │  Bern ab 07:04 (IR, Gl. 6)   │
│  🌤️ Prognose: sonnig, 12°C   │    │  Wimmis an 07:52             │
│  ✅ Wegzustand: offen (gestern)│   │  Rückreise ab 15:41          │
│                              │    │  Bern an 16:56               │
│  [Weiter]                    │    │                              │
└──────────────────────────────┘    │  Detail: [Gleis 6, vorderster│
                                    │   Wagen_________________]    │
                                    │  [Weiter]                    │
                                    └──────────────────────────────┘

Schritt 3: Wer & wie                Schritt 4: Vorschau & Veröffentlichen
┌──────────────────────────────┐    ┌──────────────────────────────┐
│  👥 Plätze  [ 5 ] (+ du)      │    │  (Tourkarte wie in 9.5)      │
│  🏃 Tempo   ○ gemütlich       │    │                              │
│            ● normal          │    │  👁️ Sichtbar für              │
│            ○ zügig           │    │  ● Alle                       │
│            ○ sportlich       │    │  ○ Nur meine Region           │
│  🗣️ Sprachen [DE ✓][EN ✓][FR] │    │  ○ Nur Follower               │
│  🏷️ Stil [Fotostopps][Hütte]  │    │  ○ Nur Gruppe [Wanderstamm ▼]│
│                              │    │  ○ Nur mit Link              │
│  ☐ Einsteiger willkommen     │    │                              │
│  ☐ Hunde willkommen          │    │  ✅ Anfragen                  │
│  ☐ Nur FLINTA*               │    │  ● Ich entscheide selbst     │
│  ☐ Bestätigtes Level nötig   │    │  ○ Verifizierte automatisch  │
│                              │    │    annehmen                  │
│  📝 Beschreibung (optional)   │    │                              │
│  [_______________________]   │    │  🔁 Wiederholen (Wanderstamm) │
│                              │    │  [Nein ▼]                    │
│  [Weiter]                    │    │  [Tour veröffentlichen]      │
└──────────────────────────────┘    └──────────────────────────────┘
```

### Regeln & Validierung

| Feld | Regel |
|---|---|
| Datum | Frühestens 2 h, spätestens 60 Tage in der Zukunft |
| Treffpunkt | Standardmässig ÖV-Haltestelle. "Anderer öffentlicher Ort" verlangt eine Bestätigung "Dies ist ein öffentlicher Ort (Parkplatz, Dorfplatz, Restaurant)". **Private Adressen sind nicht erlaubt**; der Wortfilter (Dok. 06, Stufe 1) prüft das Feld zusätzlich auf Hausnummern-Muster. |
| Verbindung | Wird über Dok. 07 (`getConnections`) vorgeschlagen; gespeichert als Snapshot in `transport`. Bei Fahrplanänderung zeigt die Tourkarte die aktuelle Verbindung und markiert Abweichungen. |
| Plätze | 1–19 (Gruppe max. 20 inkl. Host). Ab 9 Plätzen Hinweis: "Grosse Gruppen sind auf schmalen Wegen und in Hütten schwierig". |
| Tempo | Vorauswahl aus dem Tempo-Faktor des Hosts. |
| Level | Wird aus der Route übernommen und kann nicht geändert werden. Liegt die Route über dem bestätigten Level des Hosts, erscheint ein Hinweis (kein Verbot): "Du hast T4 noch nicht bestätigt. Teilnehmende sehen das in deinem Profil." |
| FLINTA* | Nur wählbar, wenn der Host selbst `gender_identity IN ('female','non_binary')` angegeben hat. |
| Anzahl offener Touren | Free: max. 2 gleichzeitig ausgeschriebene Touren, Premium: unbegrenzt (siehe 9.17). Organisationen: unbegrenzt. |
| Rate-Limit | Max. 5 neue Touren pro Tag (Spam-Schutz) |

### Automatische Systemnachrichten
Beim Veröffentlichen wird im Tour-Chat eine Systemnachricht mit allen Eckdaten angelegt. Der Chat ist ab der ersten Zusage aktiv.

---

## 9.5 Offene Touren entdecken (neue Startseite)

### Navigation
Die Tab-Leiste wird umgebaut (siehe Anhang A):

| Tab | Inhalt |
|---|---|
| 🥾 **Touren** (Start) | Offene Touren, Spontan-Modus, eigene kommende Touren |
| 🗺️ Karte | Routenplanung (Dok. 03) |
| ⏺️ Aufzeichnen | Dok. 04 |
| 📰 Feed | Hauptfeed + Entdecken (Dok. 05) |
| 👤 Profil | Dok. 02 + Vertrauensprofil |

### Startseite "Touren"
```
┌──────────────────────────────────────┐
│  🥾 Touren                 [🔍][⚙️]   │
│                                       │
│  ┌─ Deine nächsten Touren ─────────┐  │
│  │ Sa 07:04 Niesen · 4/6 · Chat 💬3│  │
│  └─────────────────────────────────┘  │
│                                       │
│  ⚡ Spontan wandern?                   │
│  [Ich habe Samstag Zeit →]            │
│                                       │
│  Offene Touren in deiner Nähe         │
│  [Dieses Wochenende ▼] [T1–T3 ▼] [≡]  │
│                                       │
│  ┌──────────────────────────────────┐ │
│  │ 🥾 Niesen über Wimmis · Sa 18.10 │ │
│  │ T2 · 5 h · normal · DE/EN        │ │
│  │ 🚂 ab Bern HB 07:04 · 35 Min v.dir│ │
│  │ 👥 3 von 6 frei · Lena ✓ ⏱️100 %  │ │
│  │ 🌤️ sonnig · ✅ Weg offen          │ │
│  │ 💚 passt gut zu dir (Tempo, Level)│ │
│  └──────────────────────────────────┘ │
│  ┌──────────────────────────────────┐ │
│  │ 🥾 Hoher Kasten · So 19.10       │ │
│  │ ...                              │ │
│  └──────────────────────────────────┘ │
│                                       │
│  [Liste]  [Karte]                     │
└──────────────────────────────────────┘
```

### Filter
- Zeitraum: heute, morgen, dieses Wochenende, nächste 7 Tage, eigenes Datum
- SAC-Stufe (Mehrfachauswahl), Dauer, Tempo
- Max. Anreisezeit ab Heimathaltestelle (30 / 60 / 90 / 120 Min)
- Sprache
- Nur: Einsteiger willkommen, Hunde willkommen, FLINTA*, Organisationen, Plätze frei
- Filter-Einstellungen werden gespeichert (wie Dok. 03)

### Sortierung: Passungs-Score
Standardsortierung ist der **Passungs-Score**, nicht das Datum. Alternative Sortierungen: Datum, Anreisezeit.

```
fit_score =
    0.25 × level_fit         -- Route vs. bestätigtes Level (bzw. Selbsteinschätzung)
  + 0.20 × pace_fit          -- eigener Tempo-Faktor vs. Tour-Tempo bzw. Host-Tempo
  + 0.20 × travel_fit        -- Anreisezeit ab Heimathaltestelle zum Treffpunkt
  + 0.10 × language_fit      -- gemeinsame Sprache vorhanden (sonst Tour ausgeblendet)
  + 0.10 × host_trust        -- Zuverlässigkeit, Verifizierung, Bewertungen des Hosts
  + 0.10 × style_fit         -- Überschneidung der Stil-Tags
  + 0.05 × social_fit        -- gemeinsame Gruppen, bereits zusammen gewandert, folgt
```

```typescript
// lib/matching/fit.ts
const LEVELS = ['T1','T2','T3','T4','T5','T6'] as const;
const levelIdx = (l?: string | null) => (l ? LEVELS.indexOf(l as any) : -1);

export function levelFit(routeLevel: string, verified: string | null, selfReported: string): number {
  const user = Math.max(levelIdx(verified), levelIdx(selfReported.split('-')[0]));
  const diff = levelIdx(routeLevel) - user;
  if (diff <= -2) return 0.5;          // deutlich unter dem eigenen Niveau: passt, aber weniger spannend
  if (diff <= 0) return 1.0;
  if (diff === 1) return verified ? 0.6 : 0.3;  // eine Stufe höher: möglich, aber Hinweis anzeigen
  return 0;                             // zwei Stufen höher: nicht vorschlagen
}

const PACE_TARGET = { gemuetlich: 1.2, normal: 1.0, zuegig: 0.88, sportlich: 0.75 } as const;

export function paceFit(userPace: number | null, tourPace: keyof typeof PACE_TARGET): number {
  if (userPace === null) return 0.6;    // unbekannt: neutral
  const d = Math.abs(userPace - PACE_TARGET[tourPace]);
  return Math.max(0, 1 - d / 0.3);      // 0.3 Abweichung = kein Fit
}

export function travelFit(travelMin: number, maxMin = 120): number {
  return travelMin >= maxMin ? 0 : 1 - travelMin / maxMin;
}
```

**Harte Ausschlüsse** (Tour wird gar nicht angezeigt): keine gemeinsame Sprache, `level_fit = 0`, Block-Beziehung, Tour voll und Warteliste deaktiviert, FLINTA-Tour für nicht berechtigte Nutzer, `min_verified_level` nicht erfüllt (dann sichtbar, aber Button "Anfragen" deaktiviert mit Erklärung).

### Anreisezeit berechnen
Die exakte ÖV-Zeit pro Tour und Nutzer live abzufragen ist zu teuer. Stattdessen:
1. Nächtlicher Job berechnet eine **Reisezeit-Matrix** zwischen den ~300 wichtigsten Treffpunkt-Haltestellen (alle Haltestellen, die in den letzten 90 Tagen als Treffpunkt verwendet wurden, plus alle Bahnhöfe mit Fernverkehr) und speichert sie in `station_travel_times(from_id, to_id, minutes)`.
2. Für die Heimathaltestelle des Nutzers wird die nächste Matrix-Haltestelle + Fussweg/Bus-Zuschlag genommen.
3. Erst in der Tourdetail-Ansicht wird die echte Verbindung über Dok. 07 geladen.

```sql
CREATE TABLE station_travel_times (
    from_station_id VARCHAR(20),
    to_station_id VARCHAR(20),
    minutes SMALLINT NOT NULL,         -- typische Reisezeit Samstag 07:00
    transfers SMALLINT,
    computed_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (from_station_id, to_station_id)
);
```

### Query (vereinfacht)
```sql
SELECT i.*, hp.reliability_score, hp.verified_level AS host_level, hp.pace_factor AS host_pace,
       u.display_name, u.avatar_url, u.phone_verified_at IS NOT NULL AS host_phone_verified,
       st.minutes AS travel_min
  FROM hike_invites i
  JOIN public_profiles u ON u.id = i.host_id
  LEFT JOIN hiking_profiles hp ON hp.user_id = i.host_id
  LEFT JOIN station_travel_times st
         ON st.from_station_id = $userNearestMatrixStation AND st.to_station_id = i.meeting_station_id
 WHERE i.status IN ('open','full')
   AND i.starts_at BETWEEN $from AND $to
   AND i.languages && $userLanguages
   AND (st.minutes IS NULL OR st.minutes <= $maxTravel)
   AND ST_DWithin(i.meeting_location::geography, $userHomeLocation::geography, 150000)
 ORDER BY i.starts_at
 LIMIT 100;
-- Block-, FLINTA- und Sichtbarkeitsfilter greifen über RLS.
-- fit_score wird clientseitig (oder in einer Edge Function) aus den geladenen Daten berechnet und sortiert.
```

### Tourdetail
Zeigt: Route mit Karte und Höhenprofil, Wetter stündlich am Weg (Dok. 07), aktuelle Wegzustände, echte ÖV-Verbindung ab der eigenen Heimathaltestelle (inkl. Ticketpreis-Hinweis mit Halbtax/GA, Deep-Link SBB), Vertrauensprofil des Hosts, Liste der bestätigten Teilnehmenden (Avatar, Vorname, Level, Tempo; Profile für Nicht-Mitglieder nur in Kurzform), öffentliche Fragen & Antworten, Buttons **[Mitkommen anfragen]**, **[Frage stellen]**, **[Merken]**, **[Teilen]**, **[Melden]**.

---

## 9.6 Anfragen, Zusagen, Check-in

### Ablauf
```
Anfragen ──► Host entscheidet ──► Zusage ──► Erinnerungen ──► Check-in ──► Tour ──► Abschluss
   │              │                  │
   │              ├─ Ablehnen        └─ Absage (rechtzeitig / spät)
   │              └─ Warteliste
   └─ automatisch angenommen (approval_mode = 'auto_verified' und Kriterien erfüllt)
```

### Anfrage-Screen
```
┌──────────────────────────────────────┐
│  Mitkommen: Niesen, Sa 18.10.        │
│                                       │
│  Kurze Nachricht an Lena (Pflicht):   │
│  [Hallo! Ich bin neu in Bern und     │
│   wandere meist T2–T3, eher zügig.]  │
│                                       │
│  🚗 Ich kann ☐ Plätze im Auto anbieten │
│                                       │
│  ℹ️ Bei Zusage teilen wir automatisch  │
│  deinen Standort während der Tour mit │
│  deiner Vertrauensperson (änderbar).  │
│                                       │
│  [Anfrage senden]                     │
└──────────────────────────────────────┘
```

Die Nachricht ist Pflicht (min. 20 Zeichen). Das senkt Spontan-Klicks ohne Absicht und gibt dem Host einen ersten Eindruck.

### Host-Ansicht einer Anfrage
Zeigt Nachricht + vollständiges Vertrauensprofil der anfragenden Person + Hinweis bei Auffälligkeiten ("Level bisher T2 bestätigt, Tour ist T3"). Buttons: **[Annehmen]**, **[Warteliste]**, **[Ablehnen]**. Ablehnungen sind für die anfragende Person neutral formuliert ("Diesmal hat es nicht geklappt") und es wird kein Grund angezeigt.

### RPCs (alle Statuswechsel serverseitig)
```sql
CREATE OR REPLACE FUNCTION decide_hike_request(p_invite UUID, p_user UUID, p_decision TEXT)
RETURNS VOID AS $$
DECLARE v_inv hike_invites;
BEGIN
    SELECT * INTO v_inv FROM hike_invites WHERE id = p_invite FOR UPDATE;
    IF v_inv.host_id <> auth.uid() THEN RAISE EXCEPTION 'not host'; END IF;
    IF p_decision NOT IN ('accepted','declined','waitlisted') THEN RAISE EXCEPTION 'invalid'; END IF;
    IF p_decision = 'accepted' AND v_inv.participant_count >= v_inv.max_participants THEN
        RAISE EXCEPTION 'full';
    END IF;

    UPDATE hike_participants
       SET status = p_decision, decided_at = NOW()
     WHERE invite_id = p_invite AND user_id = p_user AND status IN ('requested','waitlisted');

    IF p_decision = 'accepted' THEN
        INSERT INTO hike_chat_messages (invite_id, sender_id, kind, content)
        VALUES (p_invite, NULL, 'system',
                (SELECT display_name FROM users WHERE id = p_user) || ' ist dabei 🎉');
    END IF;
    -- Notification via Trigger auf hike_participants (Edge Function send-push)
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION withdraw_from_hike(p_invite UUID) RETURNS TEXT AS $$
DECLARE v_starts TIMESTAMPTZ; v_status TEXT;
BEGIN
    SELECT starts_at INTO v_starts FROM hike_invites WHERE id = p_invite;
    v_status := CASE WHEN v_starts - NOW() < INTERVAL '12 hours' THEN 'cancelled_late' ELSE 'withdrawn' END;
    UPDATE hike_participants SET status = v_status, decided_at = NOW()
     WHERE invite_id = p_invite AND user_id = auth.uid() AND status IN ('requested','accepted','waitlisted');
    RETURN v_status;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

Weitere RPCs: `cancel_hike(p_invite, p_reason)` (Host), `remove_participant(p_invite, p_user)` (Host, mit Pflichtgrund an Moderation bei < 12 h), `check_in(p_invite, p_lat, p_lng)`, `mark_attendance(p_invite, p_user, p_attendance)`, `get_invite_by_token(p_token)`.

### Erinnerungen (Push)
| Zeitpunkt | Inhalt |
|---|---|
| 48 h vorher | "Sa 07:04 Niesen. Wetter: sonnig. Bist du noch dabei? [Ja] [Absagen]" |
| 18:00 am Vorabend | Wetter-Update, Wegzustand, Packliste-Hinweis, Treffpunkt |
| 60 Min vorher | Treffpunkt mit Gleis und aktueller Verbindung (Verspätungen aus Dok. 07) |
| Bei Fahrplanänderung | Systemnachricht im Chat + Push ("Gleisänderung: neu Gleis 4") |
| Bei Unwetterwarnung | Systemnachricht + Push an alle, Host bekommt Vorschlag [Tour verschieben] [Absagen ohne Folgen] |

### Check-in
- Ab 30 Min vor Treffzeit erscheint in der App **[Ich bin da ✓]**.
- Check-in ist nur möglich innerhalb von 300 m um den Treffpunkt (oder im Zug der gewählten Verbindung: Positionsabgleich mit der Bahnstrecke).
- Check-in startet auf Wunsch die Aufzeichnung (Dok. 04) mit Verknüpfung `recordings.hike_invite_id`.
- Gruppenansicht zeigt, wer schon eingecheckt hat ("Lena und Marco sind da").

### Abschluss & Anwesenheit
- 2 h nach `expected_end_at` setzt ein Cron-Job `status = 'completed'`.
- Wer eingecheckt hat → `attendance = 'attended'`.
- Wer nicht eingecheckt hat, wird beim Host abgefragt: "War Sandra dabei? [Ja] [Nein, nicht erschienen]". Ohne Antwort innerhalb von 72 h gilt `attended` (zugunsten der Teilnehmenden).
- Ein "nicht erschienen" kann die betroffene Person einmal mit kurzer Begründung bestreiten; Fälle mit Widerspruch gehen an die Moderation und zählen bis zur Klärung nicht.

---

## 9.7 Tour-Chat

### Konzept
Jede offene Tour hat **einen Gruppenchat** für Host und bestätigte Teilnehmende. Er ersetzt für die Organisation die DMs (die weiterhin nur bei gegenseitigem Folgen möglich sind, Dok. 06).

### Lebenszyklus
| Phase | Verhalten |
|---|---|
| Vor erster Zusage | Nicht vorhanden; Fragen laufen über `hike_questions` |
| Ab erster Zusage bis Tourende | Voll aktiv, Realtime (Supabase Realtime, Dok. 01 Abstraktion) |
| Bis 7 Tage nach Tour | Aktiv für Fotos und "Danke"-Nachrichten |
| Danach | Archiviert, nur lesbar; nach 12 Monaten gelöscht |
| Bei Austritt/Entfernung | Kein Zugriff mehr ab diesem Moment |

### Funktionen
- Text, Fotos (Upload-Pipeline aus Dok. 05), Standort teilen ("Ich bin im vordersten Wagen")
- Systemnachrichten: Zusagen, Absagen, Fahrplan, Wetter, Check-ins
- **Kein Austausch von Telefonnummern nötig**: Am Tourtag erscheint ein "Gruppe finden"-Knopf, der die Live-Positionen der eingecheckten Mitglieder im Umkreis von 1 km um den Treffpunkt auf einer Karte zeigt (nur während 60 Min vor bis 30 Min nach Treffzeit).
- Melden einzelner Nachrichten, Stummschalten, Verlassen
- Wort- und Link-Filter wie DMs (Dok. 06, Stufe 1). Telefonnummern und Links werden bei Konten jünger als 7 Tage bis zur ersten stattgefundenen Tour ausgeblendet ("Kontaktdaten werden nach eurer ersten gemeinsamen Tour sichtbar").

---

## 9.8 Spontan-Modus

### Konzept
"Ich habe Samstag Zeit, wer noch?" Der Nutzer muss keine Tour planen. Er setzt ein **Spontan-Signal**, die App findet andere mit passendem Signal und schlägt eine konkrete Tour vor, die für alle passt. Hier verschmelzen Matching und Planung.

### Signal setzen
```
┌──────────────────────────────────────┐
│  ⚡ Spontan wandern                   │
│                                       │
│  📅 Samstag, 18. Okt                  │
│  🚉 Start: Zürich HB                  │
│  ⏱️ Unterwegs: 06:30 – 19:00          │
│  🚂 Max. Anreise: 90 Min              │
│  🏔️ Level: T1 ──●────●── T6 (T2–T3)   │
│  ⌛ Wanderzeit: 3–6 h                 │
│  👥 Gruppe: bis 6 Personen            │
│  ✨ Wünsche: [Bergsee][Hütte][Aussicht]│
│  ☐ Nur FLINTA*                        │
│                                       │
│  [Signal setzen]                      │
│                                       │
│  Du bekommst bis Freitag 18:00 einen  │
│  Vorschlag, sobald es passt.          │
└──────────────────────────────────────┘
```

### Matching-Job (Edge Function `spontaneous-matcher`)
Läuft alle 15 Minuten und zusätzlich sofort nach jedem neuen Signal.

```
Für jedes Datum D mit aktiven Signalen:
  1. Kandidaten-Cluster bilden
     - Signale räumlich clustern: Startorte, deren gegenseitige ÖV-Zeit ≤ 45 Min (Matrix aus 9.5)
     - innerhalb Cluster: Level-Bereiche müssen sich überschneiden
     - Sprachen müssen eine gemeinsame Sprache haben
     - FLINTA-Signale nur mit FLINTA-berechtigten Signalen
     - keine Block-Beziehungen innerhalb der Gruppe
     - Tempo-Faktoren: max. Spannweite 0.25 (z.B. 0.85 – 1.10)

  2. Gruppe wählen (Greedy): grösste kompatible Teilmenge mit 2..min(group_size_max) Personen,
     bevorzugt Signale, die schon länger warten

  3. Route finden (Kandidaten aus routes, Dok. 03 + Lösungen 5):
     - SAC-Stufe = Schnittmenge der Level-Bereiche
     - Richtzeit, angepasst an den langsamsten Tempo-Faktor der Gruppe, im Dauerbereich aller
     - ÖV-Anreise vom gemeinsamen Treffpunkt ≤ min(max_travel_min) − Anreise der Mitglieder zum Treffpunkt
     - Rückreise erreicht alle vor min(latest_return)
     - Wegzustand nicht "gesperrt" (Dok. 07.6), keine Unwetterwarnung
     - Score: Wetter (Sonnenstunden, Niederschlag) 35 %, Wunsch-Tags 25 %,
              Anreise kurz 20 %, Route neu für alle (nicht in recordings) 10 %, Beliebtheit 10 %

  4. Treffpunkt: Haltestelle auf dem gemeinsamen ÖV-Weg, an der alle Mitglieder zusammenkommen
     (meist der Umsteigebahnhof, z.B. Zürich HB, Bern HB, Luzern)

  5. match_proposal anlegen (expires_at = min(D 00:00 − 12 h, jetzt + 12 h)),
     Signale auf 'proposed' setzen, Push an alle Mitglieder
```

### Vorschlag
```
┌──────────────────────────────────────┐
│  ⚡ Wir haben eine Tour für dich!      │
│                                       │
│  🥾 Klewenalp – Niederbauen           │
│  T2 · 4 h 40 · ↑ 650 hm              │
│  ☀️ Sa: sonnig über dem Nebel (1200 m) │
│  🚉 Treffen Luzern 07:35, Gleis 2     │
│                                       │
│  👥 Mit dir: 4 Personen               │
│  Anna (T3 ✓, normal) · Reto (T2 ✓,    │
│  normal) · Mia (T2, neu dabei)        │
│                                       │
│  Warum diese Tour? Sonnig, für alle   │
│  ≤ 70 Min Anreise, niemand war schon  │
│  dort, Bergsee-Wunsch erfüllt.        │
│                                       │
│  [Bin dabei]   [Passt nicht]          │
│  Antwort bis Fr 19:00                 │
└──────────────────────────────────────┘
```

### Bestätigung
- Sobald **mindestens 2 Personen** (inkl. sich selbst) zugesagt haben und die Frist abläuft oder alle geantwortet haben, wird automatisch eine `hike_invite` erzeugt (`origin = 'spontaneous'`, `visibility = 'link'`, Host = erste Person, die zugesagt hat, mit dem Hinweis "Du koordinierst diese Tour, du kannst die Rolle im Chat abgeben").
- Personen mit "Passt nicht" bekommen ihr Signal zurück auf `active` und werden im nächsten Lauf neu gematcht; dieselbe Gruppenkonstellation wird ihnen nicht nochmals vorgeschlagen.
- Wer bis zum Tag D 08:00 keinen Treffer hatte, bekommt: "Diesmal hat es nicht geklappt. Diese offenen Touren passen zu deinem Wunsch: …" (Fallback auf 9.5).

### Varianten
- **"Nimm mich mit"**: Signal ohne eigene Gruppenbildung, nur Benachrichtigung, sobald eine passende offene Tour ausgeschrieben wird (persistenter Suchauftrag, max. 3 gleichzeitig, Premium unbegrenzt).
- **Wiederkehrend**: "Ich habe jeden Sonntag Zeit" (Premium).

---

## 9.9 Sicherheitsarchitektur

> ⚠️ **Wichtig:** Hier treffen sich Fremde an abgelegenen Orten. Jede Entscheidung in diesem Abschnitt hat Vorrang vor Komfort und Wachstum. Kein Element dieses Abschnitts darf hinter die Bezahlschranke.

### Zugangsvoraussetzungen für das Matching
Bevor jemand eine Tour ausschreiben, anfragen oder ein Spontan-Signal setzen kann:

1. **Alter 18+** (`birth_year`, Selbstangabe; Phase 2: ID-Prüfung). Unter 18: Touren nur sichtbar, Teilnahme gesperrt, Hinweis auf Gruppen mit Erziehungsberechtigten (z.B. Familien-Gruppen).
2. **Telefonnummer verifiziert** (Supabase Phone Auth, SMS-OTP). Die Nummer ist nie für andere sichtbar.
3. **Profilbild** mit erkennbarem Gesicht empfohlen (Hinweis, keine automatische Prüfung).
4. **Sicherheits-Intro gelesen** (3 kurze Karten, einmalig):

```
Karte 1: Trefft euch an öffentlichen Orten
         Am besten am Bahnhof. Private Adressen sind nicht erlaubt.
Karte 2: Jemand weiss, wo du bist
         Bei Touren mit neuen Leuten teilen wir deinen Standort mit
         deiner Vertrauensperson. Du kannst das ändern.
Karte 3: Du darfst jederzeit umkehren
         Wenn sich etwas nicht gut anfühlt: Tour abbrechen, melden.
         Im Notfall: Rega 1414 / Notruf 112.
[Verstanden, los geht's]
```

Danach `matching_enabled = TRUE`.

### Verifizierungsstufen
| Stufe | Voraussetzung | Anzeige |
|---|---|---|
| 1 | E-Mail bestätigt | – |
| 2 | Telefon bestätigt (Pflicht für Matching) | ✓ Telefon verifiziert |
| 3 | ID geprüft (Phase 2, externer Anbieter) | ✓✓ Identität geprüft |
| Org | Organisation verifiziert (Dok. 06 Communities) | 🏛️ Offizielle Organisation |

### Automatisches Live-Tracking bei Touren mit Neuen
- Hat ein Nutzer mit mindestens einer Person der Tour noch **nie eine Tour abgeschlossen**, wird beim Check-in automatisch eine Live-Tracking-Session (Dok. 08.4) mit seinen Vertrauenspersonen gestartet (`auto_started = TRUE`, `hike_invite_id` gesetzt).
- Die Vertrauensperson bekommt einen Link mit: Position, Tourname, Route, Treffpunkt, erwartete Rückkehr, **Vornamen der Gruppenmitglieder**.
- Wer keine Vertrauensperson hinterlegt hat, wird beim ersten Anfragen einmalig gebeten, eine zu hinterlegen (überspringbar, aber mit klarer Empfehlung).
- Dieses Live-Tracking ist **kostenlos**, auch wenn Live-Tracking sonst Premium ist (Dok. 08.6 wird entsprechend angepasst).

### Unterwegs: Sicherheitsknopf
Während einer aktiven offenen Tour zeigt die Aufzeichnungsansicht einen **🛡️**-Knopf:
- **Ich verlasse die Gruppe** – meldet "X geht allein weiter/zurück" im Chat (ohne Begründung), Live-Tracking läuft weiter.
- **Ich fühle mich unwohl** – sendet der Vertrauensperson sofort Position + Hinweis, öffnet Meldeformular mit Priorität `high`.
- **Notfall** – Rega-App öffnen bzw. 1414 / 112 anrufen (Dok. 08).

### Meldungen & Moderation (Ergänzung zu Dok. 06.7)
| Meldegrund | Priorität | Sofortmassnahme |
|---|---|---|
| Belästigung, unerwünschte Annäherung | hoch | Gemeldete Person kann bis zur Prüfung keine neuen Anfragen stellen/Touren erstellen |
| Unsicheres Verhalten am Berg | hoch | wie oben |
| Falsches Level / Selbstüberschätzung | normal | Hinweis an Person, ab 2 Meldungen Moderation |
| Nicht erschienen | – | läuft über Anwesenheit (9.6), keine Meldung nötig |
| Fake-Profil | hoch | Profil temporär ausgeblendet |

- Meldungen mit Priorität `hoch` landen oben in der Moderations-Queue (Admin-Dashboard, Dok. 06) mit Ziel-Reaktionszeit **24 h**.
- `hike_reviews.safety_concern = TRUE` erzeugt automatisch eine Meldung mit Priorität `hoch`.
- Zwei unabhängige Meldungen mit hoher Priorität von verschiedenen Touren → automatische Matching-Sperre (`matching_suspended_until = NOW() + 30 days`) bis zur manuellen Prüfung.
- Blockieren (Dok. 06.2) wirkt auch hier: blockierte Personen sehen die Touren der anderen nicht und können nicht in derselben Tour sein. Wird jemand blockiert, der bereits in derselben Tour ist, bekommt die blockierende Person die Option, auszutreten (straffrei) oder die andere Person zu entfernen (wenn sie Host ist).

### Haltung zu Dating
TrailMate ist eine Wander-App, keine Dating-App. Das wird im Sicherheits-Intro und in den Community-Richtlinien klar gesagt. Konsequenzen:
- Meldegrund "unerwünschte Annäherung" (siehe oben).
- Keine Funktionen, die Personen unabhängig von Touren bewerten oder sortieren (kein "Gefällt mir" auf Profile, keine Altersfilter für Personen).
- Altersgruppe als Tour-Filter nur in groben Kategorien und nur durch den Host ("eher 20–35", "eher 50+"), nicht als Personenfilter.

### Rechtliches (Hinweis für Agent: Texte durch TrailMate-Team, nicht generieren)
- Nutzungsbedingungen: Jede Person ist für sich selbst verantwortlich, Hosts sind keine Bergführer (ausser bei verifizierten Guides, 9.14).
- Hinweis auf jeder Tourkarte ab T3: "Private Tour unter Wanderern, keine geführte Tour."

---

## 9.10 Bewertungen nach der Tour

### Ablauf
Push 3 h nach `expected_end_at`: "Wie war die Tour auf den Niesen?"

```
┌──────────────────────────────────────┐
│  Wie war's mit Lena?                  │
│                                       │
│  War dabei              [Ja] [Nein]   │
│  Tempo passte           [👍] [👎]     │
│  Angenehme Begleitung   [👍] [👎]     │
│  Wieder zusammen gehen? [👍] [👎]     │
│                                       │
│  🔒 Private Notiz an TrailMate         │
│  (sieht Lena nie)                     │
│  [_____________________________]      │
│  ☐ Ich hatte ein Sicherheitsproblem    │
│                                       │
│  [Weiter zu Marco →]                  │
└──────────────────────────────────────┘
```

### Regeln
- Bewertungen sind **einfach (Daumen)** und **nicht einzeln sichtbar**. Andere sehen nur das Aggregat ("Tempo passte: 13 von 14"), und erst ab 3 Bewertungen.
- Bewertungen werden erst sichtbar, wenn beide Seiten bewertet haben oder 14 Tage vergangen sind (verhindert Vergeltungsbewertungen, wie bei Airbnb).
- Keine Freitext-Bewertungen öffentlich (verhindert Blossstellung und Moderationsaufwand).
- Nach dem Bewerten: Abfrage **"Nochmal zusammen wandern?"** (9.12).

---

## 9.11 Benachrichtigungen (Ergänzung zu Dok. 08.5)

| Typ (`notifications.type`) | Auslöser | Default |
|---|---|---|
| `hike_request` | Neue Anfrage für meine Tour | an |
| `hike_accepted` / `hike_declined` | Entscheid über meine Anfrage | an |
| `hike_waitlist_promoted` | Platz frei geworden | an |
| `hike_chat` | Neue Nachricht im Tour-Chat (gebündelt, max. 1 Push / 10 Min) | an |
| `hike_reminder` | Erinnerungen (9.6) | an, nicht abschaltbar: 60-Min-Erinnerung |
| `hike_changed` | Host ändert Zeit/Treffpunkt | an, nicht abschaltbar |
| `hike_cancelled` | Tour abgesagt | an, nicht abschaltbar |
| `hike_transport_alert` | Gleis/Verspätung/Ausfall | an |
| `hike_weather_alert` | Unwetterwarnung für Tourgebiet | an, nicht abschaltbar |
| `match_proposal` | Spontan-Vorschlag | an |
| `saved_search_hit` | Neue Tour passt zu "Nimm mich mit" | an |
| `hike_review_request` | Bewertung nach Tour | an |
| `hike_question` / `hike_answer` | Frage zu meiner Tour / Antwort | an |

**Wichtig:** Änderungen an Zeit oder Treffpunkt durch den Host weniger als 24 h vor Start lösen bei allen Teilnehmenden eine straffreie Absagemöglichkeit aus.

---

## 9.12 Vom Match zur festen Gruppe

### "Nochmal zusammen?"
Nach der Bewertung: "Wollt ihr wieder zusammen wandern?" Wenn **mindestens 2 Personen** (inkl. Host) mit Ja stimmen:
- Alle Ja-Stimmenden bekommen den Vorschlag **"Gruppe gründen"** mit vorgefülltem Namen ("Niesen-Crew") → erstellt eine private Gruppe (Dok. 06) mit allen, die zustimmen.
- Alternativ: **gegenseitig folgen** mit einem Tipp (schaltet DMs frei, Dok. 06).
- Gemeinsame Touren werden auf den Profilen als "Zusammen gewandert" vermerkt (nur für die Beteiligten sichtbar).

### Wanderstamm (wiederkehrende Tour)
Ein Host (oder eine Gruppe) kann eine Tour als Serie anlegen:
- Wiederholung: wöchentlich, alle 2 Wochen, monatlich (z.B. "jeder 1. Sonntag") → `recurrence_rule` (RRULE)
- Route pro Termin: fix **oder** "wird jeweils bis Mittwoch festgelegt" (dann Instanz mit Erinnerung an Host)
- Eine Edge Function erzeugt jeweils 4 Wochen im Voraus die Instanzen (`parent_invite_id`).
- Stamm-Mitglieder (Gruppe) bekommen Vorrang: Anfragen werden 48 h nur für die Gruppe geöffnet, danach öffentlich (wenn gewünscht).

---

## 9.13 Mentoring: Einsteiger mitnehmen

- Tour-Flag **"Einsteiger willkommen"**: Host erklärt sich bereit, auf Einsteiger einzugehen. Tourkarte zeigt 🌱.
- Für Einsteiger (bestätigtes Level ≤ T2 oder < 3 Touren) werden 🌱-Touren im Passungs-Score um +0.15 bevorzugt.
- **"Nächste Stufe"-Touren**: Einsteiger können bei Touren eine Stufe über ihrem bestätigten Level nur anfragen, wenn die Tour 🌱 hat oder der Host mindestens 2 Stufen höher bestätigt ist. So wird der Schritt von T2 auf T3 begleitet statt allein gemacht.
- Abzeichen für Mentoren (siehe 9.16).
- Hosts von 🌱-Touren sehen vor der Tour eine kurze Checkliste (Tempo an Langsamste anpassen, Pausen ankündigen, Umkehrpunkt vereinbaren).

---

## 9.14 Organisationen & geführte Touren

### Organisationen (MVP)
SAC-Sektionen, Naturfreunde, Pro Senectute Wandergruppen, Hochschulsport, Expat-Vereine, Tourismusbüros. Sie sind über verifizierte Communities (Dok. 06.6) abgebildet, ergänzt um `org_type`.

Organisationen können:
- offene Touren im Namen der Organisation ausschreiben (`community_id` gesetzt, Anzeige mit Organisations-Logo und 🏛️),
- mehrere Personen als **Tourenleitende** berechtigen (Community-Rolle `admin`/`moderator`),
- unbegrenzt Touren ausschreiben,
- Touren aus einem Jahresprogramm **per CSV importieren** (Datum, Titel, Route-ID oder GPX, Treffpunkt, Plätze, Level),
- Teilnehmende ohne TrailMate-Konto als Zahl erfassen ("+ 3 per Anmeldung beim Verein"), damit Plätze stimmen.

### Geführte Touren mit Bezahlung (Phase 2, NICHT in diesem Dokument implementieren)
Für spätere Iteration dokumentiert:
- Verifizierte Wanderleitende und Bergführer (Nachweis Ausbildung, z.B. eidg. Fachausweis Wanderleiter/in, IVBV) bieten bezahlte Touren an.
- Zahlung in der App (Stripe Connect / TWINT), TrailMate-Provision 10–15 %.
- Klare Kennzeichnung "Geführte Tour" mit Haftung beim Anbieter.
- Stornoregeln, Rückerstattung bei Absage durch Anbieter.
- Das Datenmodell ist vorbereitet: `hike_invites.origin = 'organization'` + `community.org_type = 'guide'`. Für Phase 2 kommen `price_chf`, `payment_status` etc. hinzu.

---

## 9.15 Fahrgemeinschaften

Für Startpunkte, die mit ÖV schlecht oder gar nicht erreichbar sind (Treffpunkt ohne `meeting_station_id` oder letzte Verbindung zu früh):
- Teilnehmende können bei der Anfrage **Plätze anbieten** oder **einen Platz suchen** angeben.
- Die Tourdetail-Ansicht zeigt für Mitglieder: "Marco fährt ab Winterthur, 2 Plätze frei".
- Absprache im Tour-Chat. Kein eigenes Buchungssystem, keine Bezahlung.
- Hinweis bei ÖV-tauglichen Touren: "Diese Tour ist gut mit ÖV erreichbar" (ÖV wird bevorzugt dargestellt).

---

## 9.16 Abzeichen (Ergänzung zu Dok. 08.1)

| ID | Name | Bedingung | Seltenheit |
|---|---|---|---|
| `first_partner_hike` | Erste gemeinsame Tour | 1 offene Tour mit Check-in abgeschlossen | Normal |
| `5_partners` | 5 Wanderpartner | Mit 5 verschiedenen Personen gewandert (existiert bereits, jetzt über `hike_participants` berechnet) | Selten |
| `25_partners` | Gesellige Seele | Mit 25 verschiedenen Personen gewandert | Episch |
| `first_host` | Tourenleiterin / Tourenleiter | Erste selbst organisierte Tour fand statt (≥ 1 Teilnehmende erschienen) | Normal |
| `10_hosted` | Bergkamerad | 10 organisierte Touren fanden statt | Selten |
| `mentor` | Mentor | 3 🌱-Touren organisiert, mit insgesamt ≥ 3 Einsteigern | Selten |
| `next_level` | Nächste Stufe | Erste Tour eine Stufe über dem bisher bestätigten Level, in einer Gruppe | Selten |
| `reliable_10` | Auf mich ist Verlass | 10 Teilnahmen ohne No-Show und ohne späte Absage | Selten |
| `bridge_builder` | Röstigraben-Brücke | Tour mit jemandem, mit dem man keine Erstsprache teilt (z.B. DE + FR) | Selten |
| `spontaneous_3` | Spontan dabei | 3 Spontan-Vorschläge angenommen und gewandert | Normal |
| `stamm_10` | Stammgast | 10 Termine desselben Wanderstamms besucht | Episch |
| `crew_founder` | Crew-Gründung | Aus einer offenen Tour ist eine Gruppe entstanden | Normal |

Die bestehenden sozialen Abzeichen aus Dok. 08 ("Wanderung mit 10/20 Leuten gleichzeitig", "3 Community-Events besucht") werden auf Basis von `hike_participants` mit `attendance = 'attended'` berechnet.

**Kein Abzeichen für reine Anzahl an Anfragen oder Touren-Ausschreibungen** (verhindert Spam-Anreize).

---

## 9.17 Free / Premium (Ergänzung zu Dok. 08.6)

| Funktion | Free | Premium |
|---|---|---|
| Offene Touren finden, filtern, anfragen, mitkommen | ✅ | ✅ |
| Tour-Chat, Check-in, Bewertungen | ✅ | ✅ |
| **Alle Sicherheitsfunktionen** inkl. automatischem Live-Tracking bei Touren mit Neuen | ✅ | ✅ |
| Eigene Touren ausschreiben | max. 2 gleichzeitig | unbegrenzt |
| Spontan-Signal | 1 pro Woche | unbegrenzt + wiederkehrend |
| "Nimm mich mit"-Suchaufträge | 1 | 10 |
| Erweiterte Filter (Tempo, Stil, Anreisezeit, Altersgruppe) | – | ✅ |
| Passungs-Begründung ("passt gut zu dir, weil …") | Kurzform | ausführlich |
| Wanderstamm (Serien) | – | ✅ |

Organisationen: alle Organisationsfunktionen in der Basis kostenlos (sie sind die wichtigste Quelle für Touren). Später kostenpflichtige Pro-Funktionen (Teilnahmegebühren, Export, Statistiken) gemäss B2B-Abschnitt in Dok. 08.

---

## 9.18 Kaltstart & Launch-Mechanik

### Prinzip
Ein Match lässt sich nicht vortäuschen. Matching braucht **Dichte** an einem Ort und Tag. Darum regional starten und Angebot garantieren.

### Launch-Regionen (Feature-Flag `matching_regions`)
- Phase 1: **Zürich & Umgebung** und **Bern** (Heimathaltestelle in einem definierten Polygon).
- Ausserhalb: Touren-Tab zeigt alle Touren mit Treffpunkt in Reichweite (Anreise ≤ 120 Min) und einen Hinweis "TrailMate-Touren starten zuerst in Zürich und Bern. Schreib selbst eine Tour aus oder lass dich benachrichtigen, wenn es in deiner Region losgeht." + Warteliste pro Region.
- Neue Region wird freigeschaltet, wenn dort ≥ 30 Personen auf der Warteliste stehen und mindestens eine Organisation oder 3 Botschafter zugesagt haben.

### Garantiertes Angebot
- **Botschafter-Programm**: Rolle `ambassador` (Flag in `users`), vergeben durch das TrailMate-Team. Botschafter verpflichten sich zu mindestens 2 offenen Touren pro Monat in verschiedenen Niveaus.
- Ziel für jede aktive Region: **jedes Wochenende mindestens 3 offene Touren** (T1–T2, T2–T3, T3+). Das Admin-Dashboard zeigt pro Region und Wochenende eine Ampel; bei Rot werden Botschafter per Push angefragt.
- Touren von Organisationen werden ab Tag 1 importiert (CSV, 9.14).

### Admin-Dashboard (Ergänzung zu Dok. 06)
- Offene Touren pro Region/Wochenende (Ampel)
- Spontan-Signale ohne Treffer (wo fehlt Angebot?)
- Moderations-Queue für Touren und Tour-Chats mit Prioritätssortierung
- Botschafter und Organisationen verwalten
- Seed-Touren anlegen (`origin = 'seed'`, von echten Botschaftern geführt, keine Fake-Touren)

### Kennzahlen (Analytics-Events)
| Kennzahl | Definition | Ziel nach 3 Monaten |
|---|---|---|
| **Durchführungsquote** | Anteil offener Touren mit ≥ 1 erschienener Teilnahme | > 60 % |
| **Zweite-Tour-Quote** | Anteil der Personen, die nach ihrer ersten gemeinsamen Tour innerhalb von 60 Tagen eine zweite machen | > 40 % |
| Anfrage-Annahmequote | angenommen / gestellt | > 70 % |
| No-Show-Quote | no_show / accepted | < 8 % |
| Spontan-Trefferquote | Signale mit Vorschlag / Signale | > 50 % in aktiven Regionen |
| Sicherheitsvorfälle | Meldungen mit Priorität hoch / 100 Touren | < 1, jeder Fall wird ausgewertet |

Events: `invite_created`, `invite_viewed`, `request_sent`, `request_decided`, `checked_in`, `hike_completed`, `review_submitted`, `signal_set`, `proposal_shown`, `proposal_answered`, `crew_created`, `safety_button_used`.

---

## 9.19 Projektstruktur (Ergänzung)

```
app/
├── (tabs)/
│   ├── tours/                 → Startseite Touren (neu, Default-Tab)
│   │   ├── index.tsx          → Liste/Karte offener Touren
│   │   ├── [id].tsx           → Tourdetail
│   │   ├── [id]/chat.tsx      → Tour-Chat
│   │   ├── [id]/manage.tsx    → Host: Anfragen, Teilnehmende, Anwesenheit
│   │   ├── [id]/review.tsx    → Bewertung nach Tour
│   │   ├── create/            → 4-Schritt-Flow
│   │   └── spontaneous/       → Signal setzen, Vorschlag ansehen
│   ├── ...
├── matching-intro.tsx         → Sicherheits-Intro + 18+ + Telefon
components/matching/
│   ├── InviteCard.tsx
│   ├── TrustProfile.tsx
│   ├── FitBadge.tsx
│   ├── SafetyButton.tsx
│   └── CheckInButton.tsx
lib/matching/
│   ├── pace.ts                → Tempo-Faktor (9.3)
│   ├── fit.ts                 → Passungs-Score (9.5)
│   └── api.ts                 → RPC-Wrapper
supabase/functions/
│   ├── spontaneous-matcher/   → 9.8
│   ├── hike-lifecycle/        → Erinnerungen, Abschluss, Warteliste, Serien (Cron)
│   ├── refresh-hiking-profile/→ 9.3
│   └── travel-matrix/         → nächtliche Reisezeit-Matrix (9.5)
```

---

## Akzeptanzkriterien – Dokument 9

### Zugang & Sicherheit
- [ ] Matching ist erst nach 18+-Angabe, Telefon-Verifizierung und Sicherheits-Intro nutzbar
- [ ] Private Felder (Geburtsjahr, Geschlecht, Telefon, Heimathaltestelle) sind für andere nie abrufbar (geprüft per direkter Supabase-Query mit fremdem Token)
- [ ] Treffpunkte sind ÖV-Haltestellen oder bestätigte öffentliche Orte; Hausnummern-Muster werden abgelehnt
- [ ] Bei Touren mit Personen, mit denen man noch nie gewandert ist, startet beim Check-in automatisch Live-Tracking zur Vertrauensperson, auch ohne Premium
- [ ] Sicherheitsknopf mit "Gruppe verlassen", "Ich fühle mich unwohl" und "Notfall" funktioniert während einer aktiven Tour
- [ ] Meldungen mit hoher Priorität sperren die gemeldete Person sofort für neue Anfragen/Touren bis zur Prüfung
- [ ] Blockierte Personen sehen die Touren der anderen nicht und können nicht derselben Tour beitreten
- [ ] Alle RLS-Policies aus 9.2 sind aktiv; ein Test-Script prüft für jede Tabelle Lesen/Schreiben als Fremder, Teilnehmende, Host

### Vertrauensprofil
- [ ] Bestätigtes Level wird aus Aufzeichnungen berechnet (≥ 2 Touren, ≥ 500 m auf der Stufe) und als "bestätigt" vs. "Selbsteinschätzung" angezeigt
- [ ] Tempo-Faktor wird aus Bewegungszeit vs. Richtzeit berechnet (Median, ≥ 3 Touren, Ausreisser verworfen, ÖV-Abschnitte entfernt) und in Worten dargestellt
- [ ] Zuverlässigkeit erscheint ab 3 Teilnahmen; rechtzeitige Absagen und Unwetter-Absagen zählen nicht negativ
- [ ] Bewertungen sind nur als Aggregat sichtbar, ab 3 Bewertungen, und erst nach beidseitiger Abgabe oder 14 Tagen

### Offene Touren
- [ ] Tour in 4 Schritten erstellbar, Route aus Routendetail vorausfüllbar
- [ ] ÖV-Verbindung zum Startpunkt wird vorgeschlagen und als Snapshot gespeichert; Fahrplanänderungen werden angezeigt
- [ ] Sichtbarkeiten public/region/followers/group/link funktionieren
- [ ] Startseite "Touren" ist Default-Tab, zeigt eigene kommende Touren, Spontan-Einstieg und offene Touren nach Passungs-Score
- [ ] Filter (Zeitraum, Level, Dauer, Tempo, Anreise, Sprache, Flags) funktionieren und bleiben gespeichert
- [ ] Touren ohne gemeinsame Sprache oder mit unpassendem Level (2 Stufen zu hoch) werden nicht angezeigt
- [ ] Listen- und Kartenansicht

### Anfragen & Teilnahme
- [ ] Anfrage mit Pflichtnachricht; Host kann annehmen, ablehnen, auf Warteliste setzen
- [ ] Automatische Annahme für Verifizierte, wenn aktiviert und Kriterien erfüllt
- [ ] Warteliste rückt automatisch nach bzw. benachrichtigt
- [ ] Absage < 12 h wird als späte Absage gezählt, Host-Absage ebenso
- [ ] Erinnerungen 48 h, Vorabend, 60 Min; Fahrplan- und Wetterwarnungen
- [ ] Check-in nur im Umkreis von 300 m um den Treffpunkt; Gruppe-finden-Karte im Zeitfenster
- [ ] Anwesenheit wird nach Tour erfasst; Widerspruch gegen "nicht erschienen" möglich

### Tour-Chat
- [ ] Chat aktiv ab erster Zusage, nur für Host und Bestätigte, Realtime
- [ ] Systemnachrichten für Zusagen, Änderungen, Fahrplan, Wetter, Check-ins
- [ ] Schreibbar bis 7 Tage nach Tour, danach archiviert
- [ ] Kontaktdaten/Links werden bei neuen Konten bis zur ersten Tour ausgeblendet
- [ ] Fragen vor der Anfrage über `hike_questions`, öffentlich oder privat beantwortbar

### Spontan-Modus
- [ ] Signal mit Datum, Start, Zeitfenster, Anreise, Level, Dauer, Gruppengrösse, Wünschen setzbar (1 pro Tag)
- [ ] Matcher bildet kompatible Gruppen (Sprache, Level, Tempo, Anreise, FLINTA, Blocks) und schlägt Route + Treffpunkt mit Begründung vor
- [ ] Bei ≥ 2 Zusagen wird automatisch eine offene Tour mit Chat erzeugt
- [ ] Ablehnende werden neu gematcht, ohne dieselbe Konstellation erneut
- [ ] Fallback auf passende offene Touren, wenn kein Match zustande kommt

### Gruppenbildung & Mentoring
- [ ] "Nochmal zusammen?" nach Bewertung; bei ≥ 2 Ja Vorschlag zur Gruppengründung (private Gruppe Dok. 06)
- [ ] Wanderstamm als Serie (RRULE), Instanzen 4 Wochen im Voraus, 48 h Vorrang für Gruppenmitglieder
- [ ] 🌱-Touren werden für Einsteiger bevorzugt; Anfrage eine Stufe höher nur bei 🌱 oder erfahrenem Host

### Organisationen
- [ ] Verifizierte Organisationen schreiben Touren in ihrem Namen aus, mit mehreren Tourenleitenden
- [ ] CSV-Import eines Tourenprogramms
- [ ] Externe Anmeldungen als Zahl erfassbar

### Abzeichen, Premium, Launch
- [ ] Alle Abzeichen aus 9.16 werden automatisch vergeben
- [ ] Free/Premium-Grenzen aus 9.17 umgesetzt; keine Sicherheitsfunktion hinter Premium
- [ ] Feature-Flag `matching_regions`, Warteliste pro Region
- [ ] Admin-Dashboard: Ampel pro Region/Wochenende, Signale ohne Treffer, priorisierte Moderations-Queue, Botschafter-Verwaltung
- [ ] Analytics-Events aus 9.18 werden erfasst

---

## Entschiedene Fragen (Entscheidungsvorschläge, vom Agent so umzusetzen)

| Frage | Entscheidung |
|---|---|
| Personen-Swipen wie bei Tinder? | **Nein.** Nur Touren werden gematcht (Prinzip 1). |
| Mindestalter | 18 Jahre für Matching. |
| Telefon-Verifizierung Pflicht? | **Ja**, für alle Matching-Funktionen. ID-Prüfung optional in Phase 2. |
| Kann man ohne Anfrage direkt beitreten? | Nur bei `approval_mode = 'auto_verified'` und erfüllten Kriterien. |
| Öffentliche Sterne-Bewertungen? | **Nein.** Nur Daumen-Aggregate, keine öffentlichen Texte. |
| Maximale Gruppengrösse | 20 inkl. Host. |
| DMs für Matching? | **Nein.** Tour-Chat + Fragen. DMs bleiben bei gegenseitigem Folgen (Dok. 06). |
| Live-Tracking bei Touren mit Neuen | Automatisch, kostenlos, abschaltbar pro Tour. |
| FLINTA*-Touren | Ja, Selbstangabe, ohne Nachweis. Missbrauch wird über Meldungen moderiert. |
| Altersfilter auf Personen | **Nein.** Nur grobe Altersgruppe als Tour-Angabe durch Host. |
| Geführte Touren mit Bezahlung | Phase 2. Datenmodell vorbereitet. |
| Wer darf Organisationen anlegen? | Wie Communities (Dok. 06): nur nach Verifizierung durch TrailMate-Team. |
| Werden Spontan-Touren öffentlich? | Nein, `visibility = 'link'`; der Host kann sie nachträglich öffnen, um Plätze aufzufüllen. |

---

## Relevante Tabellen

**Neu (dieses Dokument):**
- `hiking_profiles` – berechnetes Vertrauensprofil
- `hike_invites` – offene Touren
- `hike_participants` – Anfragen, Teilnahmen, Anwesenheit, Fahrgemeinschaft
- `hike_chat_messages` – Tour-Chat
- `hike_questions` – Fragen vor der Anfrage
- `availability_signals` – Spontan-Signale
- `match_proposals`, `match_proposal_responses` – Spontan-Vorschläge
- `hike_reviews` – Bewertungen
- `hike_again_votes` – "Nochmal zusammen?"
- `station_travel_times` – Reisezeit-Matrix

**Erweitert:**
- `users` (Matching-Felder, Verifizierung)
- `recordings` (`hike_invite_id`, `matched_sac_scale`)
- `live_tracking_sessions` (`hike_invite_id`, `auto_started`)
- `reports` (`hike_invite_id`, `priority`, neue Gründe)
- `communities` (`org_type`)

**Genutzt (aus Dokument 01):**
- `routes`, `hiking_network`, `trail_conditions`, `weather_forecasts`, `groups`, `group_members`, `follows`, `blocks`, `notifications`, `badges`, `user_badges`

---

## Anhang A: Änderungen an Dokument 00–08

> Diese Änderungen sind nötig, damit die Wanderpartner-Suche der Mittelpunkt der App wird. Sie sind hier gesammelt, damit die Dokumente 01–08 nicht mehrfach angefasst werden müssen; der Agent setzt sie zusammen mit Dokument 9 um.

### Dokument 00 – Masterplan
- Dokument 9 in die Übersicht aufnehmen, Priorität 🔴 Kern.
- Reihenfolge: 01 → 02 → 03 → 04 → **09** → 07 → 05 → 06 → 08.
- Entschiedene Fragen ergänzen: "Wanderpartner-Suche ist der Kern der App", "Live-Tracking bei Touren mit Neuen ist kostenlos".

### Dokument 01 – Fundament
- Migration aus 9.2 ergänzen (neue Tabellen, Spalten, Trigger, vollständige RLS).
- View `public_profiles` anlegen; alle Client-Queries auf fremde Profile laufen über diese View.
- `notifications.type` um die Typen aus 9.11 erweitern.

### Dokument 02 – Auth, Onboarding & Profil
- **Willkommens-Screen** behält "finde Wanderpartner", jetzt mit Funktion dahinter.
- **Onboarding** neu (weiterhin 5 Schritte, Inhalte angepasst):
  1. Willkommen
  2. Profil-Basics (Name, Bild) + **Sprachen**
  3. Wanderlevel + **Tempo-Selbsteinschätzung** (gemütlich/normal/zügig/sportlich) + **Stil-Tags**
  4. Heimatregion + **Heimathaltestelle** (ÖV-Suche) + GA/Halbtax
  5. **"Mit anderen wandern?"**: zeigt 3 passende offene Touren in der Nähe + Button "Spontan-Signal setzen". Die bisherigen Follow-Suggestions werden darunter als optionaler Abschnitt "Wanderer in deiner Nähe" beibehalten.
- Nach dem Onboarding landet man im Tab **Touren** (statt Entdecken).
- **Profil**: neuer Abschnitt "Als Wanderpartner" (Vertrauensprofil, 9.3) direkt unter Bio/Heimatregion, **vor** den Kennzahlen und Highlight-Touren.
- **Einstellungen**: neuer Bereich "Wanderpartner" (Matching an/aus, Sprachen, Heimathaltestelle, Standard-Vertrauensperson, Auto-Live-Tracking an/aus, Benachrichtigungen 9.11).

### Dokument 03 – Karten & Routing
- Routendetail: Button **[Mit anderen gehen]** (öffnet 9.4 mit vorausgefüllter Route) und Liste "Offene Touren auf dieser Route".
- Karte: optionaler Layer "Offene Touren" (Treffpunkte als Pins).

### Dokument 04 – Aufzeichnung
- `recordings.hike_invite_id` setzen, wenn die Aufzeichnung per Check-in gestartet wurde.
- Nach jeder Aufzeichnung Edge Function `refresh-hiking-profile` auslösen; `matched_sac_scale` berechnen.
- Tour-Zusammenfassung bei gemeinsamer Tour: "Mit Lena, Marco und Sandra unterwegs" + Button zur Bewertung.
- Bahn-/Bus-/Seilbahnabschnitte erkennen und für den Tempo-Faktor ausschliessen (9.3).

### Dokument 05 – Feed
- Feed wird zweiter Tab; Default-Landing ist Touren (siehe 02).
- Neuer Post-Typ "Gemeinsame Tour" mit Verlinkung der Teilnehmenden (nur mit deren Zustimmung).
- Entdecken-Tab: Abschnitt "Offene Touren diese Woche" oben.

### Dokument 06 – Social
- DMs bleiben bei gegenseitigem Folgen; für das Kennenlernen gibt es Tour-Chat und Fragen (9.7). Akzeptanzkriterium "DMs nur bei gegenseitigem Folgen" bleibt bestehen.
- Gruppen-Event: Option "Auch als offene Tour veröffentlichen".
- Gruppen können aus "Nochmal zusammen?" entstehen (9.12).
- Communities: `org_type`, Tourenleitende, CSV-Import (9.14).
- Moderation: neue Meldegründe, Priorität `hoch`, 24-h-Ziel, automatische Matching-Sperre (9.9).
- Admin-Dashboard: Bereiche aus 9.18.

### Dokument 07 – Wetter, ÖV, Wegzustände
- `getConnections` und `findNearestStation` werden von 9.4, 9.5, 9.8 genutzt; ÖV-Integration damit faktisch 🔴 Must-have.
- Nächtliche Reisezeit-Matrix (9.5) als zusätzlicher Job.
- Fahrplan-Echtzeit (Verspätung, Gleisänderung) für die 60-Min-Erinnerung und den Tour-Chat.
- Unwetterwarnungen pro Region als Auslöser für straffreie Absagen.

### Dokument 08 – Gamification, Live-Tracking, Push, Premium
- Abzeichen aus 9.16 ergänzen; soziale Abzeichen über `hike_participants` berechnen.
- Live-Tracking: automatischer Start bei Touren mit Neuen, **kostenlos** in diesem Fall; Empfängerseite zeigt Tourname und Vornamen der Gruppe.
- Push: Typen und Regeln aus 9.11.
- Premium-Tabelle um 9.17 ergänzen; Zeile "Live-Tracking ⭐ Premium" präzisieren: "Live-Tracking für eigene Touren ⭐ Premium; bei offenen Touren mit Neuen immer kostenlos".
- Challenges: neue soziale Challenges ("3 Touren mit neuen Leuten im Mai", "Organisiere deine erste Tour").
