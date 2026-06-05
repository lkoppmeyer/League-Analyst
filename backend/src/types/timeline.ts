// ---------------------------------------------------------------------------
// Raw Riot API – Match V5 Timeline
// ---------------------------------------------------------------------------

export interface RiotTimelineDto {
  metadata: { matchId: string; participants: string[] };
  info: {
    frameInterval: number; // ms between frames (typically 60000)
    frames: RiotTimelineFrame[];
    gameId: number;
    participants: Array<{ participantId: number; puuid: string }>;
  };
}

export interface RiotTimelineFrame {
  timestamp: number; // ms since game start
  participantFrames: Record<string, RiotParticipantFrame>; // key = participantId as string
  events: RiotTimelineEvent[];
}

export interface RiotParticipantFrame {
  participantId: number;
  position: { x: number; y: number };
  currentGold: number;   // unspent gold
  totalGold: number;     // total gold earned so far
  goldPerSecond: number;
  level: number;
  xp: number;
  minionsKilled: number;
  jungleMinionsKilled: number;
  timeEnemySpentControlled: number;
}

// Only the event types we actually use
export type RiotTimelineEvent =
  | { type: 'ITEM_PURCHASED';      timestamp: number; participantId: number; itemId: number }
  | { type: 'ITEM_SOLD';           timestamp: number; participantId: number; itemId: number }
  | { type: 'ITEM_UNDO';           timestamp: number; participantId: number; afterId: number; beforeId: number }
  | { type: 'CHAMPION_KILL';       timestamp: number; killerId: number; victimId: number; assistingParticipantIds?: number[] }
  | { type: 'ELITE_MONSTER_KILL';  timestamp: number; killerId: number; killerTeamId?: number; monsterType: string; monsterSubType?: string }
  | { type: 'BUILDING_KILL';       timestamp: number; teamId: number; buildingType: string; laneType?: string; towerType?: string }
  | { type: 'LEVEL_UP';            timestamp: number; participantId: number; level: number }
  | { type: string;                timestamp: number; [key: string]: unknown };

// ---------------------------------------------------------------------------
// Processed timeline insights stored in MatchData
// ---------------------------------------------------------------------------

export type ParticipantTimeline = {
  // Snapshots at key minutes
  goldAt10?: number;       // totalGold at 10 min
  goldAt15?: number;
  csAt10?: number;         // minions + jungle at 10 min
  csAt15?: number;
  levelAt10?: number;
  // Level-up timings (index = level - 1, value = seconds since game start)
  // levelTimings[5] = time to reach level 6
  levelTimings: number[];
  // Item purchase log (seconds since game start, undoes removed)
  itemsBought: Array<{ itemId: number; timestamp: number }>;
};

// A single champion kill event
export type RawKillEvent = {
  timestamp: number;   // seconds
  killerId: number;    // participantId (0 = executed/environment)
  victimId: number;
  assistIds: number[];
};

// An objective secured by a team
export type RawObjectiveEvent = {
  timestamp: number;           // seconds
  killerParticipantId: number; // participantId who got credit; 0 for buildings
  type: 'DRAGON' | 'BARON_NASHOR' | 'RIFTHERALD' | 'ATAKHAN' | 'TOWER' | 'INHIBITOR';
  subtype?: string;            // e.g. FIRE_DRAGON, ELDER_DRAGON, OUTER_TURRET
  lane?: string;               // BOT_LANE, MID_LANE, TOP_LANE (towers/inhibitors)
};

// A cluster of kills close in time — teamfight or skirmish
export type RawFightCluster = {
  startTime: number;    // seconds, first kill
  endTime: number;      // seconds, last kill
  kills: RawKillEvent[];
};

export type TimelineInsights = {
  // Per-participant data keyed by participantId (1-10)
  participants: Record<number, ParticipantTimeline>;
  // First-event timestamps in seconds
  firstBloodAt?: number;
  firstTowerAt?: number;
  firstDragonAt?: number;
  firstBaronAt?: number;
  firstHeraldAt?: number;
  // All events (optional — old cached data won't have these)
  allKills?: RawKillEvent[];
  objectiveEvents?: RawObjectiveEvent[];
  fightClusters?: RawFightCluster[];
};
