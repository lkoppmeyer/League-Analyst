import { RiotApiClient } from '../data/riotApiClient.js';
import { Cache } from '../data/cache.js';
import { MatchMapper } from './matchMapper.js';
import { MatchData } from '../types/app.js';

/**
 * Return a mapped MatchData for the given id, serving from cache when possible
 * and otherwise fetching from Riot, normalizing, mapping and caching the result.
 */
export async function getOrFetchMatch(
  matchId: string,
  client: RiotApiClient,
  cache: Cache<MatchData>
): Promise<MatchData> {
  const cached = cache.get(matchId);
  if (cached) {
    console.log(`[CACHE HIT] Match ${matchId}`);
    return cached;
  }

  console.log(`[API FETCH] Match ${matchId}`);
  let riotMatch = await client.getMatch(matchId);

  // Normalize shape: some responses might already be the `info` object
  if (!('info' in riotMatch) && riotMatch) {
    riotMatch = {
      metadata: (riotMatch as any).metadata || { matchId },
      info: riotMatch as any,
    } as any;
  }

  const appMatch = MatchMapper.mapRiotToApp(riotMatch as any);
  cache.set(matchId, appMatch);
  return appMatch;
}

/** Run async tasks with a bounded concurrency to stay within Riot rate limits. */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  task: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += limit) {
    const batch = items.slice(i, i + limit);
    results.push(...(await Promise.all(batch.map(task))));
  }
  return results;
}
