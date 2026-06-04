import { Router, Request, Response } from 'express';
import { RiotApiClient, RiotRegion } from '../data/riotApiClient.js';
import { Cache, RateLimiter } from '../data/cache.js';
import { getOrFetchMatch, mapWithConcurrency } from '../domain/matchService.js';
import { ApiResponse, MatchData, MatchSummary } from '../types/app.js';

export interface SummonerRouteConfig {
  riotApiClient: RiotApiClient;
  cache: Cache<MatchData>;
  rateLimiter: RateLimiter;
}

const VALID_REGIONS: RiotRegion[] = ['americas', 'europe', 'asia'];

function parseRegion(raw: unknown): RiotRegion {
  return VALID_REGIONS.includes(raw as RiotRegion) ? (raw as RiotRegion) : 'europe';
}

// How many recent matches to inspect, and how many SR games to return.
const FETCH_COUNT = 20;
const CONCURRENCY = 6;

function isSummonersRift(match: MatchData): boolean {
  return match.mapId === 11 && match.gameMode === 'CLASSIC';
}

function toSummary(match: MatchData, puuid: string): MatchSummary | null {
  const player = match.players.find((p) => p.id === puuid);
  if (!player) return null;

  const team = player.team === 'blue' ? match.blueTeam : match.redTeam;
  return {
    matchId: match.matchId,
    championName: player.championName,
    role: player.role,
    win: team.win ?? false,
    kills: player.kills ?? 0,
    deaths: player.deaths ?? 0,
    assists: player.assists ?? 0,
    queueId: match.queueId,
    gameDuration: match.gameDuration,
    gameCreation: match.gameCreation,
  };
}

export function createSummonerRoutes(config: SummonerRouteConfig): Router {
  const router = Router();
  const { riotApiClient, cache, rateLimiter } = config;

  function rateLimited(res: Response): boolean {
    if (rateLimiter.isAllowed()) return false;
    const response: ApiResponse<null> = {
      success: false,
      error: 'Rate limit exceeded. Please try again later.',
      statusCode: 429,
    };
    res.status(429).json(response);
    return true;
  }

  function handleError(res: Response, error: unknown, label: string) {
    console.error(`${label} failed:`, error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    let statusCode = 500;
    if (message.includes('not found')) statusCode = 404;
    else if (message.includes('Rate limited')) statusCode = 429;
    else if (message.includes('Invalid or expired API key')) statusCode = 401;
    const response: ApiResponse<null> = { success: false, error: message, statusCode };
    res.status(statusCode).json(response);
  }

  // Resolve a Riot ID to a puuid.
  router.get('/account/:gameName/:tagLine', async (req: Request, res: Response) => {
    if (rateLimited(res)) return;
    const { gameName, tagLine } = req.params;
    const region = parseRegion(req.query.region);

    try {
      const account = await riotApiClient.getAccountByRiotId(gameName, tagLine, region);
      const response: ApiResponse<typeof account> = { success: true, data: account };
      return res.json(response);
    } catch (error) {
      return handleError(res, error, 'Account lookup');
    }
  });

  // Recent Summoner's Rift matches for a puuid, as compact summaries.
  router.get('/history/:puuid', async (req: Request, res: Response) => {
    if (rateLimited(res)) return;
    const { puuid } = req.params;
    const region = parseRegion(req.query.region);

    try {
      const ids = await riotApiClient.getMatchIdsByPuuid(puuid, region, { count: FETCH_COUNT });

      const matches = await mapWithConcurrency(ids, CONCURRENCY, (id) =>
        getOrFetchMatch(id, riotApiClient, cache).catch((err) => {
          console.error(`Skipping match ${id}:`, err?.message || err);
          return null;
        })
      );

      const summaries = matches
        .filter((m): m is MatchData => m !== null && isSummonersRift(m))
        .map((m) => toSummary(m, puuid))
        .filter((s): s is MatchSummary => s !== null)
        .sort((a, b) => (b.gameCreation ?? 0) - (a.gameCreation ?? 0));

      const response: ApiResponse<MatchSummary[]> = { success: true, data: summaries };
      return res.json(response);
    } catch (error) {
      return handleError(res, error, 'Match history');
    }
  });

  return router;
}

export default createSummonerRoutes;
