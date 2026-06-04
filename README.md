# LoL Match Analyst

KI-gestütztes Match-Analyse Tool für League of Legends. Lade eine Match-ID, sieh die Spielerdaten und frag eine KI-Persona was sie davon hält.

---

## Quickstart

### Voraussetzungen

- Node.js ≥ 18
- npm
- Riot Developer API Key → [developer.riotgames.com](https://developer.riotgames.com/) *(kostenlos, läuft nach 24h ab)*
- OpenAI API Key → [platform.openai.com](https://platform.openai.com/api-keys)

---

### 1. Keys eintragen

Datei `backend/.env` bearbeiten (wird nicht committed):

```env
RIOT_API_KEY=RGAPI-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxx
PORT=3001
NODE_ENV=development
```

> **Beispiel Match-ID zum Testen:** `EUW1_7870134327`

> **Datenquelle:** Alle Matchdaten kommen aktuell aus der **Riot Match-V5 API**.
> Doku: [developer.riotgames.com/apis#match-v5](https://developer.riotgames.com/apis#match-v5)

---

### 2. Backend starten

```bash
cd backend
npm install      # einmalig
npm run dev      # startet auf http://localhost:3001
```

Erwartete Ausgabe:

```
✓ Backend server running on http://localhost:3001
✓ Match endpoint: GET http://localhost:3001/api/match/:matchId
✓ Health check:   GET http://localhost:3001/health
```

---

### 3. Frontend starten *(neues Terminal)*

```bash
cd frontend
npm install      # einmalig
npm run dev      # startet auf http://localhost:5173
```

Dann im Browser: **http://localhost:5173**

---

### 4. Ausprobieren

1. Match-ID eingeben: `EUW1_7870134327`
2. Auf **Laden** klicken
3. Spielerkarten erscheinen mit Champion-Bildern, KDA, Gold
4. Unten eine Frage eintippen, Persona wählen, Modell wählen → **Fragen**

---

### Troubleshooting

| Problem | Lösung |
|---|---|
| `Cannot find module` | `npm install` im jeweiligen Ordner |
| `EADDRINUSE :::3001` | `lsof -ti :3001 \| xargs kill -9` |
| `Invalid API key` | Neuen Key holen — Riot Keys laufen nach 24h ab |
| `Match not found` | Match-ID Format prüfen (`EUW1_...`, `NA1_...`, `KR_...`) |
| KI antwortet nicht | `OPENAI_API_KEY` in `backend/.env` prüfen |

---

## Architektur

Das vollständige, editierbare Diagramm liegt als draw.io-Datei unter
[docs/architecture.drawio](docs/architecture.drawio). Öffne es direkt in VS Code
(Extension *Draw.io Integration* ist installiert) oder auf
[app.diagrams.net](https://app.diagrams.net/).

**Es zeigt:**

- **Frontend** (React + Vite, Port 5173) und **Backend** (Express, Port 3001) als
  zwei getrennte Applikationen, verbunden nur über HTTP.
- Das Backend in mehreren **Ebenen**: API Layer → Data Layer + KI Layer → Domain Layer.
- Den **KI Layer** mit den **3 Personas** (Profi Esports Analyst, Challenger SoloQ,
  Leidenschaftlicher Low Elo) und der Modell-Wahl (gpt-3.5-turbo / gpt-4o).
- Die externen Services **Riot Match-V5 API** (Datenquelle) und **OpenAI Chat API**.

Im Diagramm sind drei Zonen farbig markiert:

| Markierung | Bedeutung |
|---|---|
| ✏️ **gelb gestrichelt** | Editier-Zonen — *Frontend / UI verändern* und *KI-Prompts, Wortlaut & Fine-Tuning ändern* |
| ✚ **grün gestrichelt** | Erweiterungs-Zone — *hier weitere APIs (z. B. Esports-/Turnier-Daten) anbinden* |
| 🌐 **grau gestrichelt** | Externe Services außerhalb der App |

---

### Wo was ist — auf einen Blick

| Was du tun willst | Wo du hinschaust |
|---|---|
| UI Layout, Farben, Komponenten verändern | `frontend/src/components/` |
| Neue Felder im UI anzeigen | `frontend/src/types.ts` + zugehörige Component |
| Prompt-Text einer Persona ändern | `backend/src/routes/aiRoutes.ts` → `personaMap` |
| Neue Persona hinzufügen | `backend/src/routes/aiRoutes.ts` → `personaMap` + `ChatPanel.tsx` Dropdown |
| Andere KI-Modelle nutzen | `backend/src/routes/aiRoutes.ts` → `model`-Zeile |
| Neue externe API anbinden (Esports, Turnier-Daten) | `backend/src/data/` → neue Datei analog zu `riotApiClient.ts` |
| Neue App-Datentypen definieren | `backend/src/types/app.ts` + `frontend/src/types.ts` |
