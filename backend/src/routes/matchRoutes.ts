import { Router, Request, Response } from 'express';
import { RiotApiClient } from '../data/riotApiClient.js';
import { Cache, RateLimiter } from '../data/cache.js';
import { MatchMapper } from '../domain/matchMapper.js';
import { ApiResponse, MatchData } from '../types/app.js';

export interface MatchRouteConfig {
  riotApiClient: RiotApiClient;
  cache: Cache<MatchData>;
  rateLimiter: RateLimiter;
}

export function createMatchRoutes(config: MatchRouteConfig): Router {
  const router = Router();
  const { riotApiClient, cache, rateLimiter } = config;

  // Cache stats endpoint (useful for debugging) - keep before dynamic routes
  router.get('/stats/cache', (_req: Request, res: Response) => {
    res.json({
      cacheSize: cache.size(),
      message: 'Cache stats endpoint',
    });
  });

  router.get('/:matchId', async (req: Request, res: Response) => {
    const { matchId } = req.params;

    // Rate limiting check
    if (!rateLimiter.isAllowed()) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Rate limit exceeded. Please try again later.',
        statusCode: 429,
      };
      return res.status(429).json(response);
    }

    try {
      // Check cache first
      const cachedMatch = cache.get(matchId);
      if (cachedMatch) {
        console.log(`[CACHE HIT] Match ${matchId}`);
        const response: ApiResponse<MatchData> = {
          success: true,
          data: cachedMatch,
        };
        return res.json(response);
      }

      console.log(`[API FETCH] Match ${matchId}`);
      
      // Fetch from Riot API
      let riotMatch = await riotApiClient.getMatch(matchId);

      // Normalize shape: some responses might already be the `info` object
      if (!('info' in riotMatch) && riotMatch) {
        riotMatch = {
          metadata: (riotMatch as any).metadata || { matchId },
          info: riotMatch as any,
        } as any;
      }

      // Map to app format
      const appMatch = MatchMapper.mapRiotToApp(riotMatch as any);
      
      // Store in cache
      cache.set(matchId, appMatch);

      const response: ApiResponse<MatchData> = {
        success: true,
        data: appMatch,
      };
      return res.json(response);
    } catch (error) {
      console.error(`Error fetching match ${matchId}:`, error);

      let statusCode = 500;
      let errorMessage = 'Internal server error';

      if (error instanceof Error) {
        if (error.message.includes('Match not found')) {
          statusCode = 404;
          errorMessage = error.message;
        } else if (error.message.includes('Rate limited')) {
          statusCode = 429;
          errorMessage = error.message;
        } else if (error.message.includes('Invalid or expired API key')) {
          statusCode = 401;
          errorMessage = error.message;
        } else {
          errorMessage = error.message;
        }
      }

      const response: ApiResponse<null> = {
        success: false,
        error: errorMessage,
        statusCode,
      };
      return res.status(statusCode).json(response);
    }
  });



  return router;
}
