export type ItemData = {
  id: number;
  name: string;
  image_url?: string;
  stats?: { label: string; value: string }[];
  description?: string;
};

export type ResolvedRune = {
  id: number;
  name: string;
  iconUrl: string;
};

export type Player = {
  id: string;
  name: string;
  role: string;
  team: 'blue' | 'red';
  portraitUrl?: string;
  championName?: string;
  championId?: number;
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
};

export type TeamInfo = {
  id: string;
  name: string;
  side: 'blue' | 'red';
  win?: boolean;
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
  gameDuration?: number;
  queueId?: number;
};

export type ChatMessage = {
  id: string;
  author: 'user' | 'assistant';
  text: string;
};

export type Persona = {
  id: string;
  label: string;
};

export type ModelOption = {
  id: string;
  label: string;
};

export type RiotAccount = {
  puuid: string;
  gameName: string;
  tagLine: string;
};

export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
  statusCode?: number;
};

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
