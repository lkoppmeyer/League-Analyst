# League of Legends E-Sports Team Explorer

## Projektziel

Eine saubere, moderne Web App, in der man zu einem beliebigen League of Legends E-Sports Spiel Team- und Spielerinformationen abruft, aufbereitet und per Chat-Interface in natürlicher Sprache befragt.

Kernidee:
- Eingabe einer Spiel-ID oder Match-ID
- Ladebildschirm-Design mit den 10 Spielern beider Teams
- Spieler anklickbar für Detailinfo
- Chatfenster für Fragen zum Spiel und zu Spielern
- Datenebene aus freien APIs
- KI-Ebene als API-Frontend, das Daten in einen Prompt packt und Antworten formatiert

---

## Drei Ebenen: MVP, fertiges Produkt, Traumversion

### 1) MVP

Ziel: Schnell sichtbare Web App mit minimalem Funktionsumfang.

Funktionen:
- Eingabefeld für Spiel-ID / Match-ID
- Ladebildschirm mit 10 Spieler-Avataren und Team-Namen
- Klickbare Spieler (UI-only, mit Platzhalter-Logs)
- Chat-Input-Feld und Nachrichtenausgabe
- Backend- / Datenlayer: einfache Abfrage verfügbarer Spiel- und Spielerinfos
- KI-Layer: Anfrage an GPT-ähnliche API, Prompt-Building mit allen Daten
- Beispielprompt: „Wer ist Favorit in dem Spiel?“
- Antwort wird von der KI zurückgegeben und im Chat angezeigt

Nicht im MVP:
- Websearch / zusätzliche externe Recherche
- deep player scouting / weitere Narrative-Analyse
- komplexes Relevanz-Filtering
- umfangreiche Team-/Match-Historie
- persistent user state oder Login

### 2) Fertiges Produkt

Ziel: Ausgereifte App mit vernünftigem Datenumfang, UI/UX und AI-Beratung.

Zusatzfunktionen:
- echte Team- und Spielerprofile mit Rollen, Historie, aktuellen Stats
- Match-Detailseite mit Draft, Kills, Objectives, Ergebnis
- bessere Datenverarbeitung: Relevanz-Filter, Daten-Validierung, Caching
- Chat: Follow-up-Fragen, kontextbezogene Antworten, Spieler-Insights
- direkt klickbare Spielerkarte mit „Was macht den Spieler aus?“
- Admin-/Ops-Monitoring, Fehlerhandling
- sauber getrennte Architektur: UI, API, Datenadapter, KI-Prompt-Layer

Mögliche Ergänzungen:
- Teamvergleich: Champion-Picks, Summoner Spells, Winrates
- Szenario-Analyse: „Was sind die Stärken beider Teams?“
- Match-Prediction-Basics basierend auf historischen Daten

### 3) Traumversion

Ziel: erweiterte E-Sports-Scout-Plattform mit Live- und Research-Power.

Feature-Ideen:
- Multi-Source-Fusion: Riot, Esports API, Liquipedia, Wikipedia, News, Social Media
- Websearch als Fallback, wenn Daten unvollständig sind
- Live-Update-Feed für laufende Matches
- Video-/VOD-Verknüpfung und Highlight-Erkennung
- Analysen zu Pick/Ban-Meta, Spielerform, Teamdynamiken
- Team-/Spieler-Storytelling: Stärken, Schwächen, Archetyp
- Multi-User-Chat, Team-Workspaces, Session History
- Voice-Interface / Audio-Output
- KI-gestützte Spielzusammenfassung nach Match-Ende

---

## Anforderungsanalyse

### Benutzeranforderungen

- Als Nutzer möchte ich eine Spiel-ID eingeben und direkt die Teams sehen.
- Als Nutzer möchte ich auf Spieler klicken und mehr über sie erfahren.
- Als Nutzer möchte ich Fragen zum Match oder zur Favoritenrolle stellen.
- Als Nutzer möchte ich ein aufgeräumtes, thematisch passendes Interface.
- Als Nutzer möchte ich schnelle Antworten ohne lange Ladezeiten.

### Geschäftsanforderungen

- Klar getrennte UI- und Backend-Schichten.
- Einfache Erweiterbarkeit auf zusätzliche Datenquellen.
- Verlässliche Daten für E-Sports-Spieler und Matches.
- Skalierbare Chat-/Prompt-Verarbeitung.
- MVP schnell entwickelbar, später Ausbau möglich.

### Systemanforderungen

- Frontend: Web App, idealerweise React/Vite oder Next.js
- Backend: API-Server für Daten-Requests und KI-Proxy
- Datenquellen: offene E-Sports-APIs, Riot Esports Endpoints, ggf. Community-APIs
- KI: OpenAI / ChatGPT / Azure OpenAI oder vergleichbar
- Hosting: simple Web-App / Serverless für MVP
- Logging: Platzhalter-Logs im ersten UI-Build

### Qualitätsanforderungen

- Saubere Code-Struktur, keine "Quick-and-Dirty"-Patches.
- UI konsistent und thematisch an einen League Loading Screen angelehnt.
- Einfache Data-Flow-Dokumentation.
- Fehlerrobustes Prompt-Building.

---

## Architekturübersicht

### 1) Frontend

Komponenten:
- `MatchInput`: Eingabe von Spiel-ID
- `LoadingScreen`: Teams + 10 Spieler anzeigen
- `PlayerCard`: Spielerinformationen / Klickbare Karte
- `ChatPanel`: Chat-Historie + Eingabefeld
- `AppState`: aktuelles Match, Spieler, Chat-Kontext

Technologie:
- React + TypeScript
- CSS / Tailwind oder Styled Components für optisches Layout
- einfache State-Logik

### 2) Backend / API

Schichten:
- `Data Layer`: API-Clients für League of Legends Esports, ggf. Liquipedia, Riot
- `Domain Layer`: Mapping der Rohdaten in App-Modelle
- `AI Layer`: Prompt-Builder, Anfrage an externe KI-API
- `Controller/Route Layer`: HTTP-Endpunkte

Mögliche Endpunkte:
- `GET /api/match/:id` -> Match + Team + Spielergrids
- `GET /api/player/:id` -> Spieler-Details
- `POST /api/chat` -> Frage + Kontext -> KI-Antwort

Technologie:
- Node.js + Express / Fastify oder Python + FastAPI
- optional Serverless 
- CORS für Frontend-Zugriff

### 3) Datenquellen

Wichtige Datenpunkte:
- Match-ID
- Teams, Team-Namen, Region, Liga
- Spieler: Name, Rolle, ID, Teamzugehörigkeit
- Basisstatistiken: Position, bisherige Erfolge, Team-Stats
- Matchkontext: Spieltag, Bo-Serie, aktueller Patch

Mögliche Quellen:
- Riot Games Esports API (offizielle Spiele- und Teamdaten)
- Community-APIs / Public endpoints
- Liquipedia / Wikis als sekundäre Quelle
- ggf. statische JSON für MVP

### 4) KI / Prompting

Ablauf:
- Nutzerprompt + relevante Match-/Spielerdaten sammeln
- Daten in Prompt strukturieren
- Anfrage an Text-API senden
- Antwort formatieren und an Frontend zurückgeben

Wichtige Punkte:
- Daten zuerst aggregieren, dann als Kontext übergeben
- MVP: komplette Datenmenge in einen Prompt packen
- Spätere Version: Relevanzfilter, Kontext-Fenster-Optimierung, Fallbacks

---

## Route to MVP

1) UI-Prototyp bauen
   - Statisches Layout mit Match-ID-Eingabe
   - Loading-Screen mit 10 Platzhalter-Spielern
   - Chatfenster mit Platzhalter-Nachrichten
   - Click-Handler mit `console.log("player clicked", id)`

2) Datenmodell definieren
   - Spiel-, Team- und Spieler-Interfaces
   - Beispiel-Mockdaten
   - API-Vertrag für `GET /api/match/:id`

3) Minimaler Backend-Stub
   - Dummy-Endpunkt `GET /api/match/:id` liefert Mockdaten
   - `POST /api/chat` liefert statische Antwort oder Echo
   - Verbindung Frontend <-> Backend testen

4) KI-Integration
   - Prompt-Template für Fragen wie „Wer ist Favorit?“
   - Einfache KI-API-Anbindung
   - Ergebnisse im Chat darstellen

5) Datenquelle anschließen
   - Erste echte API integrieren
   - Spiel- und Spielerinfos aus freier Datenquelle laden
   - Backend und Domain-Mapping vervollständigen

6) UI-Verbesserungen
   - Spielerdetail-Drawer / Modal
   - bessere visuelle Darstellung als League Loading Screen
   - Chat-Historie und UX-Feinschliff

---

## Umsetzungsschritte in Reihenfolge

1) `docs/project-plan.md` erstellen
2) `frontend/` Skeleton aufsetzen
   - React App
   - Komponenten-Layout
3) `backend/` Minimaler API-Stub
   - Match- und Chat-Routen
4) UI mit Platzhalter-Logik verbinden
5) Datenmodelle und Mockdaten definieren
6) KI-Prompt-Layer implementieren
7) Erste echte Datenquelle anschließen
8) MVP testen und abnehmen

---

## Bemerkungen zu Datenverfügbarkeit

Für das MVP sollte man zunächst die frei zugänglichen Daten nutzen, die sich einfach per API abfragen lassen:
- Team-Roster
- Spielername
- Rolle/Position
- Team- und Match-Metadat
- Basisinfos zum Wettbewerb

Wenn diese Quellen nicht reichen, kommt erst später eine Websearch- oder Scraper-Schicht dazu.

---

## Nächste Schritte

1) Frontend-Routing / UI-Komponenten bauen
2) Mock-Backend und Daten-Contracts festlegen
3) KI-API-Prototyp mit Prompt-Building anlegen
4) Erste echte API testen und Datenqualität prüfen
