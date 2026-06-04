// App Types - same as frontend
export type Player = {
  id: string;
  name: string;
  role: string;
  team: 'blue' | 'red';
  portraitUrl?: string;
  championId?: number;
  championName?: string;
  kills?: number;
  deaths?: number;
  assists?: number;
  goldEarned?: number;
  minionsKilled?: number;
  items?: number[];
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
};

export type ChatMessage = {
  id: string;
  author: 'user' | 'assistant';
  text: string;
};

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode?: number;
}
