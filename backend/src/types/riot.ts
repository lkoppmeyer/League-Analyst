// Riot API Types - Simplified for MVP
export interface RiotMatchDto {
  metadata: {
    dataVersion: string;
    matchId: string;
    participants: string[]; // PUUIDs
  };
  info: {
    endOfGameResult: string;
    gameCreation: number;
    gameDuration: number;
    gameEndTimestamp: number;
    gameId: number;
    gameMode: string;
    gameName: string;
    gameStartTimestamp: number;
    gameType: string;
    gameVersion: string;
    mapId: number;
    participants: RiotParticipant[];
    platformId: string;
    queueId: number;
    teams: RiotTeam[];
    tournamentCode?: string;
  };
}

export interface RiotParticipant {
  assists: number;
  baronKills: number;
  champExperience: number;
  champLevel: number;
  championId: number;
  championName: string;
  deaths: number;
  dragonKills: number;
  goldEarned: number;
  goldSpent: number;
  item0: number;
  item1: number;
  item2: number;
  item3: number;
  item4: number;
  item5: number;
  item6: number;
  kills: number;
  lane: string;
  largestKillingSpree: number;
  largestMultiKill: number;
  magicDamageDealt: number;
  magicDamageDealtToChampions: number;
  magicDamageTaken: number;
  minionsKilled: number;
  neutralMinionsKilled: number;
  participantId: number;
  pentaKills: number;
  physicalDamageDealt: number;
  physicalDamageDealtToChampions: number;
  physicalDamageTaken: number;
  profileIcon: number;
  puuid: string;
  quadraKills: number;
  riotIdGameName: string;
  riotIdTagline: string;
  role: string;
  summoner1Id: number;
  summoner2Id: number;
  summonerId: string;
  summonerLevel: number;
  summonerName: string;
  teamId: number;
  timePlayed: number;
  timeCCingOthers: number;
  totalDamageDealt: number;
  totalDamageDealtToChampions: number;
  totalDamageTaken: number;
  totalHeal: number;
  totalMinionsKilled: number;
  tripleKills: number;
  trueDamageDealt: number;
  trueDamageDealtToChampions: number;
  trueDamageTaken: number;
  turretKills: number;
  unrealKills: number;
  visionScore: number;
  wardsKilled: number;
  wardsPlaced: number;
  win: boolean;
  teamPosition: string; // TOP, JUNGLE, MIDDLE, ADC, SUPPORT
}

export interface RiotTeam {
  bans: RiotBan[];
  objectives: RiotObjectives;
  teamId: number; // 100 = Blue, 200 = Red
  win: boolean;
}

export interface RiotBan {
  championId: number;
  pickTurn: number;
}

export interface RiotObjectives {
  baron: { first: boolean; kills: number };
  champion: { first: boolean; kills: number };
  dragon: { first: boolean; kills: number };
  inhibitor: { first: boolean; kills: number };
  riftHerald: { first: boolean; kills: number };
  tower: { first: boolean; kills: number };
}
