import { RiotApiClient } from '../data/riotApiClient.js';
import { Cache } from '../data/cache.js';
import { readDiskCache, writeDiskCache } from '../data/diskCache.js';
import { MatchMapper } from './matchMapper.js';
import { processTimeline } from './timelineProcessor.js';
import { MatchData } from '../types/app.js';

/**
 * Return a mapped MatchData for the given id.
 * Priority: in-memory cache → disk cache → Riot API (match + timeline in parallel).
 */
export async function getOrFetchMatch(
  matchId: string,
  client: RiotApiClient,
  cache: Cache<MatchData>
): Promise<MatchData> {
  // 1. In-memory cache (hot path)
  const inMemory = cache.get(matchId);
  if (inMemory) {
    console.log(`[CACHE HIT mem] ${matchId}`);
    return inMemory;
  }

  // 2. Disk cache (survives server restarts)
  const onDisk = readDiskCache<MatchData>(`match_${matchId}`);
  if (onDisk) {
    console.log(`[CACHE HIT disk] ${matchId}`);
    cache.set(matchId, onDisk);
    return onDisk;
  }

  // 3. Fetch from Riot API — match and timeline in parallel
  console.log(`[API FETCH] ${matchId}`);
  const [riotMatchRaw, riotTimeline] = await Promise.allSettled([
    client.getMatch(matchId),
    client.getTimeline(matchId),
  ]);

  if (riotMatchRaw.status === 'rejected') throw riotMatchRaw.reason;

  let riotMatch = riotMatchRaw.value;
  if (!('info' in riotMatch) && riotMatch) {
    riotMatch = {
      metadata: (riotMatch as any).metadata || { matchId },
      info: riotMatch as any,
    } as any;
  }

  const appMatch = MatchMapper.mapRiotToApp(riotMatch as any);

  // Attach timeline insights if the fetch succeeded
  if (riotTimeline.status === 'fulfilled') {
    try {
      appMatch.timeline = processTimeline(riotTimeline.value);
    } catch (err) {
      console.warn(`[TIMELINE] Processing failed for ${matchId}:`, err);
    }
  } else {
    console.warn(`[TIMELINE] Fetch failed for ${matchId}:`, riotTimeline.reason);
  }

  cache.set(matchId, appMatch);
  writeDiskCache(`match_${matchId}`, appMatch);
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
