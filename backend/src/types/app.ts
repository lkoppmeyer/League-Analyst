import type { TimelineInsights } from './timeline.js';
export type { TimelineInsights };

// App Types - same as frontend
export type ResolvedRune = {
  id: number;
  name: string;
  iconUrl: string;
};

export type Player = {
  id: string;
  participantId: number;   // 1-10, key for timeline correlation
  name: string;
  role: string;
  team: 'blue' | 'red';
  portraitUrl?: string;
  championId?: number;
  championName?: string;
  champLevel?: number;
  kills?: number;
  deaths?: number;
  assists?: number;
  goldEarned?: number;
  minionsKilled?: number;
  items?: number[];
  runes?: {
    keystone?: ResolvedRune;
    primaryTree?: ResolvedRune;
    secondaryTree?: ResolvedRune;
  };
  // Combat stats
  totalDamageToChampions?: number;
  totalDamageTaken?: number;
  totalHeal?: number;
  timeCCingOthers?: number;
  turretKills?: number;
  // Vision
  visionScore?: number;
  wardsPlaced?: number;
  wardsKilled?: number;
  // Multi-kills / sprees
  multiKills?: {
    double: number;
    triple: number;
    quadra: number;
    penta: number;
    largestSpree: number;
  };
};

export type TeamInfo = {
  id: string;
  name: string;
  side: 'blue' | 'red';
  win?: boolean;
  bans?: number[];
  objectives?: {
    baron: number;
    dragon: number;
    tower: number;
    inhibitor: number;
    riftHerald: number;
  };
};

export type MatchData = {
  matchId: string;
  blueTeam: TeamInfo;
  redTeam: TeamInfo;
  players: Player[];
  gameMode?: string;
  gameDuration?: number;
  gameVersion?: string;
  timestamp?: number;
  mapId?: number;
  queueId?: number;
  gameCreation?: number;
  timeline?: TimelineInsights;
};

export type ChatMessage = {
  id: string;
  author: 'user' | 'assistant';
  text: string;
};

// Compact summary of a single match for the history list.
export type MatchSummary = {
  matchId: string;
  championName?: string;
  role: string;
  win: boolean;
  kills: number;
  deaths: number;
  assists: number;
  queueId?: number;
  gameDuration?: number;
  gameCreation?: number;
};

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode?: number;
}
