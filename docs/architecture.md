# Architektur — LoL Match Analyst

## System-Überblick

```mermaid
graph TD
  User["Browser / User"]

  subgraph Frontend["Frontend (React + Vite)"]
    ProfileSearch["ProfileSearch\nSummoner-Suche"]
    MatchHistory["MatchHistory\nMatch-Liste"]
    MatchView["MatchView\nOrchestrator"]
    ChatPanel["ChatPanel\nChat + Modell-Dropdown\n+ Smart Context Toggle"]
    PlayerDetail["PlayerDetail\nSpieler-Stats"]
    DebugOverlay["Match Data Debug\nEnriched JSON-View"]
  end

  subgraph Backend["Backend (Express + TypeScript)"]
    MatchRoutes["matchRoutes\nGET /api/match/:id"]
    SummonerRoutes["summonerRoutes\nGET /api/summoner/…"]
    AiRoutes["aiRoutes\nPOST /api/ask\nPOST /api/ask/analyze\nPOST /api/ask/debug/enriched"]
  end

  subgraph DataLayer["Data Layer"]
    RiotAPI["Riot API\n(Match V5 + Timeline)"]
    DiskCache["Disk Cache\ncache/*.json"]
    MemCache["Memory Cache"]
    ChampionDB["championDb.ts\nchampions.json\nitems.json\nrunes.json"]
  end

  subgraph AILayer["AI Layer (OpenAI)"]
    PreAnalysisLLM["Pre-Analyse LLM\npreanalysis.md\ngewähltes Modell"]
    ContextFilterLLM["Context-Filter LLM\ncontextfilter.md\ngpt-4o-mini"]
    ChatLLM["Chat LLM\nPersona + Dataset\ngewähltes Modell"]
  end

  User --> ProfileSearch
  ProfileSearch --> SummonerRoutes
  MatchHistory --> MatchView
  MatchView --> MatchRoutes
  MatchView --> ChatPanel
  MatchView --> PlayerDetail
  MatchView --> DebugOverlay

  MatchRoutes --> MemCache
  MemCache --> DiskCache
  DiskCache --> RiotAPI

  MatchView -- "auto beim Load" --> AiRoutes
  ChatPanel -- "useContextFilter bool" --> MatchView
  MatchView --> AiRoutes

  AiRoutes --> ChampionDB
  AiRoutes --> DiskCache
  AiRoutes --> PreAnalysisLLM
  AiRoutes --> ContextFilterLLM
  AiRoutes --> ChatLLM
```

## Pre-Analyse Pipeline

Startet automatisch wenn ein Match geladen wird. Ergebnis gecacht.

```mermaid
sequenceDiagram
  participant FE as Frontend (MatchView)
  participant BE as Backend (/api/ask/analyze)
  participant Cache as Disk Cache
  participant Enrich as matchEnricher
  participant DB as championDb
  participant LLM as OpenAI (preanalysis.md)

  FE->>BE: POST /analyze {matchId, matchData, modelMode}
  BE->>Cache: readDiskCache(preanalysis_<matchId>)
  alt Cache Hit
    Cache-->>BE: {analysis}
    BE-->>FE: {analysis, cached: true}
  else Cache Miss
    BE->>Enrich: enrichMatchData(matchData)
    Note over Enrich: Items → {name, boughtAt?}<br/>firstBlood/Tower/Dragon/…<br/>item general context
    Enrich->>DB: extractChampionContext + extractItemContext
    DB-->>Enrich: context lines
    Enrich-->>BE: EnrichedMatchData
    BE->>DB: buildChampionContextBlock
    DB-->>BE: champion context text
    BE->>LLM: system: preanalysis.md + champCtx<br/>user: enriched JSON
    LLM-->>BE: analysis text
    BE->>Cache: writeDiskCache(preanalysis_<matchId>)
    BE-->>FE: {analysis, cached: false}
  end
  FE->>FE: setPreAnalysis(analysis)
```

## Chat Pipeline (mit Context Filter)

```mermaid
sequenceDiagram
  participant User
  participant FE as Frontend (MatchView)
  participant BE as Backend (/api/ask)
  participant Enrich as matchEnricher
  participant FilterLLM as Context Filter LLM
  participant ChatLLM as Chat LLM
  participant Logger as conversationLogger

  User->>FE: Frage eingeben
  FE->>BE: POST /ask {userPrompt, persona, modelMode,<br/>matchData, preAnalysis, useContextFilter}

  BE->>Enrich: enrichMatchData(matchData)
  Enrich-->>BE: EnrichedMatchData

  alt useContextFilter = true
    BE->>FilterLLM: system: contextfilter.md<br/>user: Frage + EnrichedMatchData
    FilterLLM-->>BE: gefilterte Daten (JSON-Subset)
    Note over BE: contextForAnswer = gefiltertes JSON
  else useContextFilter = false
    Note over BE: contextForAnswer = volle enriched Daten
  end

  BE->>BE: buildSystemPrompt(persona, champCtx, viewerCtx, preAnalysis)
  BE->>ChatLLM: system: systemPrompt<br/>user: Frage + contextForAnswer
  ChatLLM-->>BE: Antwort-Text
  BE->>Logger: logConversation(...)
  BE-->>FE: Antwort-Text
  FE->>User: Antwort anzeigen
```

## Daten-Anreicherung (matchEnricher)

```mermaid
graph LR
  subgraph Input
    MD["MatchData\n(Riot-Format)"]
    TL["Timeline\nItemsBought Timestamps\nGold@10/15, Level@10"]
  end

  subgraph enrichMatchData
    direction TB
    A["Player Items\n[itemId] → {name, boughtAt?}"]
    B["Kill Participation\nTeamKills berechnen"]
    C["Gold formatieren\n14.2k"]
    D["CS/min berechnen"]
    E["extractChampionContext\n+ extractItemContext"]
    F["firstBlood/Tower/Dragon/Baron/Herald\nin @ MM:SS formatiert"]
  end

  subgraph Output["EnrichedMatchData (→ AI Context)"]
    EP["EnrichedPlayer\nkda, gold, csPerMin\nitemsWithTiming\nchampionContext[]"]
    ET["EnrichedTeam\nban-Namen, objectives"]
    EV["Timeline-Events\nfirstBlood @ 3:12 etc."]
  end

  MD --> A
  MD --> B
  MD --> C
  MD --> D
  MD --> E
  TL --> A
  TL --> F
  A --> EP
  B --> EP
  C --> EP
  D --> EP
  E --> EP
  F --> EV
```

## Champion-Kontext-Injection

```mermaid
graph TD
  CJ["champions.json\n{id, name, general,\nrole_mid, matchup_zed,\nitem_trinity_force,\nweakness, draft_priority, …}"]

  subgraph extractChampionContext
    T["Typ: Ranged/Melee + Tags"]
    G["Allgemein: general"]
    R["Als Mid: role_mid"]
    M["vs Zed: matchup_zed"]
    I["mit Trinity Force: item_trinity_force"]
    C["Weakness: weakness-Wert\n(beliebige custom attrs)"]
  end

  IJ["items.json\n{id, name, general}"]

  subgraph extractItemContext
    IC["Trinity Force: offensiv; …\n(für jedes item mit general)"]
  end

  CJ --> T
  CJ --> G
  CJ --> R
  CJ --> M
  CJ --> I
  CJ --> C

  IJ --> IC

  T --> CTX["championContext[]\nim EnrichedPlayer"]
  G --> CTX
  R --> CTX
  M --> CTX
  I --> CTX
  C --> CTX
  IC --> CTX
```

## Caching-Strategie

```
GET /api/match/:matchId
         │
         ▼
  MemoryCache (Map)  ─── HIT ──→ return
         │ MISS
         ▼
  DiskCache (cache/*.json)  ─── HIT ──→ populate MemCache → return
         │ MISS
         ▼
  Riot API (match + timeline parallel)
         │
  matchMapper.ts → MatchData
  timelineProcessor.ts → TimelineInsights
         │
  → populate DiskCache + MemCache → return

POST /api/ask/analyze
         │
         ▼
  DiskCache (cache/preanalysis_<matchId>.json)  ─── HIT ──→ return
         │ MISS
         ▼
  enrichMatchData() → LLM → writeDiskCache → return
```

## Frontend-Komponenten

```
App
├── ProfileSearch          Summoner-Suche (gameName + tagLine → puuid)
└── MatchHistory           Match-Liste für einen Summoner
    └── MatchView           Haupt-Ansicht für ein Match
        ├── LoadingScreen   Match-Übersicht (Spieler-Raster)
        ├── PlayerDetail    Statistik-Overlay für einen Spieler
        ├── ChatPanel       Chat-Interface
        │   ├── Persona-Dropdown
        │   ├── Modell-Dropdown
        │   └── Smart Context Toggle (useContextFilter)
        └── Debug-Overlay   Raw EnrichedMatchData (Match Data Button)
```
