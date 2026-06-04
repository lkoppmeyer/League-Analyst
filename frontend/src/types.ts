export type Player = {
  id: string;
  name: string;
  role: string;
  team: 'blue' | 'red';
  portraitUrl?: string;
  championName?: string;
  championId?: number;
  kills?: number;
  deaths?: number;
  assists?: number;
  goldEarned?: number;
};

export type TeamInfo = {
  id: string;
  name: string;
  side: 'blue' | 'red';
};

export type MatchData = {
  matchId: string;
  blueTeam: TeamInfo;
  redTeam: TeamInfo;
  players: Player[];
};

export type ChatMessage = {
  id: string;
  author: 'user' | 'assistant';
  text: string;
};
