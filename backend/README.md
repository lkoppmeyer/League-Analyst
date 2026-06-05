# Backend — LoL Match Analyst

Express + TypeScript API-Server. Holt Matchdaten von Riot, reichert sie für den AI-Prompt an und schickt sie an OpenAI.

## Setup

```bash
cp .env.example .env   # RIOT_API_KEY + OPENAI_API_KEY eintragen
npm install
npm run dev            # läuft auf :3001
```

## API-Endpunkte

| Methode | Pfad | Beschreibung |
|---|---|---|
| GET | `/api/match/:matchId` | Einzelnes Match (Riot-Daten → App-Format, gecacht) |
| GET | `/api/summoner/account/:gameName/:tagLine?region=` | Riot-ID → puuid |
| GET | `/api/summoner/history/:puuid?region=` | Letzte 20 SR-Matches als Summaries |
| GET | `/api/ask/personas` | Verfügbare Personas für das Frontend-Dropdown |
| GET | `/api/ask/models` | Verfügbare Modelle für das Frontend-Dropdown |
| POST | `/api/ask/analyze` | Pre-Analyse-Agent — läuft automatisch beim Match-Load, wird gecacht |
| POST | `/api/ask` | Chat — beantwortet Nutzerfragen zum Match |
| POST | `/api/ask/debug/enriched` | Debug — gibt EnrichedMatchData als JSON zurück |
| GET | `/health` | Healthcheck |

### POST /api/ask — Request Body

```json
{
  "userPrompt": "Wer war der MVP?",
  "persona": "soloq",
  "modelMode": "balanced",
  "matchData": { "..." },
  "summoner": "Giarth#0000",
  "puuid": "optional-für-viewer-kontext",
  "preAnalysis": "Ergebnis des letzten /analyze-Calls",
  "useContextFilter": false
}
```

`useContextFilter: true` → Ein zusätzlicher LLM-Call (gpt-4o-mini) filtert die Spieldaten auf die für die Frage relevante Teilmenge, bevor der Haupt-LLM antwortet. Spart Token bei sehr spezifischen Fragen.

## Datei-Struktur

```
src/
├── main.ts                     Express-Setup, Route-Mounting
├── routes/
│   ├── matchRoutes.ts          GET /api/match/:id
│   ├── summonerRoutes.ts       GET /api/summoner/…
│   └── aiRoutes.ts             GET+POST /api/ask/…  · Modell-Registry · Context-Filter
├── data/
│   ├── riotApiClient.ts        Riot API-Client (match + timeline + account + history)
│   ├── diskCache.ts            Disk-Cache (cache/*.json, überlebt Neustarts)
│   ├── championDb.ts           Lädt champions.json + items.json + runes.json
│   │                           extractChampionContext(entry, role, others, items)
│   │                           extractItemContext(itemIds)  ← neu: item general context
│   ├── champions.json          Champion-Datenbank (manuell pflegen, s.u.)
│   ├── items.json              Item-ID → Name + Key + general context
│   └── runes.json              Rune-Datenbank (auto-generiert)
├── domain/
│   ├── matchMapper.ts          RiotMatchDto → MatchData
│   ├── matchService.ts         getOrFetchMatch (3-stufiger Cache: Memory→Disk→API)
│   ├── timelineProcessor.ts    RiotTimelineDto → TimelineInsights
│   │                           Item-Kaufzeitpunkte in Sekunden, Gold/CS/Level@10/15
│   ├── matchEnricher.ts        MatchData → EnrichedMatchData für AI
│   │                           Items mit boughtAt-Minute, firstBlood/Tower/Dragon/…
│   └── conversationLogger.ts   Loggt Q&A nach logs/<matchId>.log
├── prompts/
│   ├── promptLoader.ts         buildSystemPrompt + preanalysisPrompt + contextFilterPrompt
│   ├── core.md                 Universelle Output-Regeln (immer injiziert)
│   ├── dataset.md              Erklärung des EnrichedMatchData-Formats
│   ├── preanalysis.md          Pre-Analyse-Agent (konfigurierbar, s.u.)
│   ├── contextfilter.md        Context-Filter-Agent (frage-spezifische Datenselektion)
│   └── personas/               Dynamisch geladene Persona-Dateien
│       ├── soloq.md
│       └── ...
└── types/
    ├── riot.ts                 Riot API-Typen
    ├── timeline.ts             Timeline + ParticipantTimeline
    └── app.ts                  App-Typen (MatchData, Player, …)
```

## AI-Pipeline: Pre-Analyse

Läuft automatisch wenn ein Match geladen wird. Ergebnis wird gecacht (`cache/preanalysis_<matchId>.json`).

```
POST /api/ask/analyze
         │
         ▼
   Cache-Hit? ──ja──→ return cached
         │ nein
         ▼
  enrichMatchData()            ← Items mit boughtAt, firstBlood/Tower/…
         │
  buildChampionContextBlock()  ← Champion + Matchup-Infos aus champions.json
         │
  [LLM: preanalysis.md]        ← Konfigurierbar: Muster-Erkennung, Kategorien
         │
  writeDiskCache()
         │
         ▼
  analysis (Text)
```

**preanalysis.md anpassen:** Die Datei kann frei bearbeitet werden. Beispiele für konfigurierte Erkennungen:
- "Erkenne vollständig AD- oder AP-Kompositions"
- "Erkenne Armor- oder MR-Stacking"
- "Erkenne Engage- vs Poke-Kompositions"

## AI-Pipeline: Chat

```
POST /api/ask (userPrompt + matchData + preAnalysis)
         │
         ▼
  enrichMatchData()
         │
         ├── useContextFilter=true?
         │     │
         │     ▼
         │   [LLM: contextfilter.md, gpt-4o-mini]
         │   Frage-spezifischer Daten-Subset
         │     │
         │     └──→ contextForAnswer (gefiltert oder fallback: voll)
         │
         ├── useContextFilter=false?
         │     └──→ contextForAnswer = vollständige enriched Daten
         │
         ▼
  buildSystemPrompt(persona, champContext, viewerContext, preAnalysis)
         │
  [LLM: gewähltes Modell]
         │
  logConversation()
         │
         ▼
  Antwort-Text
```

## System-Prompt-Aufbau

```
[Persona aus personas/*.md]
---
[core.md — Output-Regeln]
---
[dataset.md — Datenformat-Erklärung]
---
[Champion-Kontext-Block — aus champions.json + game state]
  Je Spieler: general + role_<lane> + matchup_<gegner> + item_<key> + custom attrs
---
[Item-Kontext — aus items.json general-Felder]
  Je Item mit general-Feld: "Trinity Force: offensiv; Fighter/Bruiser; …"
---
[Viewer-Kontext — wenn summoner/puuid bekannt]
---
[Pre-Analyse — wenn vorhanden]
```

User-Message: `Frage: <prompt>\n\nSpieldaten: <contextForAnswer JSON>`

## EnrichedMatchData — was der AI-Context enthält

- Bans als Champion-Namen
- Items als `[{ name, boughtAt? }]` — `boughtAt` ist die Kaufminute aus dem Timeline
- Gold formatiert (14.2k), CS/min berechnet
- `championContext[]` pro Spieler (aus Champion-DB + items.json general)
- `firstBlood`, `firstTower`, `firstDragon`, `firstBaron`, `firstHerald` (falls Timeline vorhanden)

## Champions-Datenbank pflegen

`src/data/champions.json` — flaches Key-Value-System. `id`, `name`, `attack_type` und `tags` kommen aus der API. Alles andere ist manueller Kontext:

```json
{
  "id": 61,
  "name": "Orianna",
  "attack_type": "ranged",
  "tags": ["Mage", "Support"],
  "general": "Immer injiziert wenn Orianna im Spiel ist.",
  "role_mid": "Injiziert wenn Orianna Mid gespielt wird.",
  "matchup_zed": "Injiziert wenn Zed auch im Spiel ist.",
  "item_lich_bane": "Injiziert wenn Orianna Lich Bane gebaut hat.",
  "item_core_zhonyas_hourglass": "Injiziert IMMER wenn Orianna im Spiel ist.",
  "weakness": "Verliert gegen frühe All-ins und Disengage-Komps.",
  "draft_priority": "S-Tier Teamfight-Enabler, früh banen oder erstzugreifen"
}
```

| Key | Wann injiziert |
|---|---|
| `general` | Immer wenn Champion im Spiel ist |
| `role_<lane>` | Wenn Champion diese Lane spielt |
| `matchup_<champname>` | Wenn beide Champions gleichzeitig im Spiel sind |
| `item_<key>` | Wenn Champion dieses Item **gebaut hat** |
| `item_core_<key>` | **Immer** wenn Champion im Spiel ist |
| **Beliebige andere String-Keys** | **Immer injiziert** als `Label: Wert` |

Beliebige eigene Attribute wie `weakness`, `draft_priority`, `playstyle`, `win_condition` etc. werden automatisch als `{Label}: {Wert}` in den Kontext injiziert — ohne Code-Änderung.

## Items-Datenbank pflegen

`src/data/items.json` — wie Champions, aber nur `general` als immer-injizierter Kontext:

```json
{
  "id": 3078,
  "name": "Trinity Force",
  "key": "trinity_force",
  "general": "offensiv; Fighter/Bruiser; Spellblade; HP+AD+AS+AH"
}
```

`general` wird injiziert wenn ein Spieler dieses Item im Build hat.

## Modelle anpassen

In `src/routes/aiRoutes.ts` → `MODELS`-Array:

```typescript
const MODELS = [
  { id: 'economy',  label: 'Günstig (GPT-3.5 Turbo)',      modelId: 'gpt-3.5-turbo' },
  { id: 'balanced', label: 'Preis/Leistung (GPT-4o mini)', modelId: 'gpt-4o-mini'   },
  { id: 'best',     label: 'Bestes Modell (GPT-4.1)',       modelId: 'gpt-4.1'       },
];
```

Context-Filter verwendet immer `gpt-4o-mini` unabhängig von der Modellwahl.

## Game Data initialisieren

```bash
python3 scripts/fetch_game_data.py
```

Holt Name, ID, attack_type, Riot-Tags aus Data Dragon. Kein manueller Kontext, keine general-Felder. Die sind danach manuell zu pflegen. Bestehende JSONs werden nach `src/data/old/` (mit Timestamp) gesichert.
