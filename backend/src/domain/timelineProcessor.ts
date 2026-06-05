import {
  RiotTimelineDto,
  RiotTimelineEvent,
  TimelineInsights,
  ParticipantTimeline,
  RawKillEvent,
  RawObjectiveEvent,
  RawFightCluster,
} from '../types/timeline.js';

const SEC = 1000; // ms → seconds divisor

// Kills within this window (seconds) are grouped as one fight
const FIGHT_WINDOW_SECONDS = 12;

// A cluster needs at least this many kills to be recorded
const MIN_KILLS_FOR_CLUSTER = 2;

function frameIndexForMinute(frameIntervalMs: number, minute: number): number {
  return Math.round((minute * 60 * SEC) / frameIntervalMs);
}

function csFromFrame(f: { minionsKilled: number; jungleMinionsKilled: number }): number {
  return f.minionsKilled + f.jungleMinionsKilled;
}

/**
 * Group sorted kill events into clusters where consecutive kills are within
 * FIGHT_WINDOW_SECONDS of each other.
 */
function detectFightClusters(kills: RawKillEvent[]): RawFightCluster[] {
  if (!kills.length) return [];

  const clusters: RawFightCluster[] = [];
  let current: RawKillEvent[] = [kills[0]];

  for (let i = 1; i < kills.length; i++) {
    const gap = kills[i].timestamp - current[current.length - 1].timestamp;
    if (gap <= FIGHT_WINDOW_SECONDS) {
      current.push(kills[i]);
    } else {
      if (current.length >= MIN_KILLS_FOR_CLUSTER) {
        clusters.push({ startTime: current[0].timestamp, endTime: current[current.length - 1].timestamp, kills: current });
      }
      current = [kills[i]];
    }
  }
  if (current.length >= MIN_KILLS_FOR_CLUSTER) {
    clusters.push({ startTime: current[0].timestamp, endTime: current[current.length - 1].timestamp, kills: current });
  }

  return clusters;
}

export function processTimeline(raw: RiotTimelineDto): TimelineInsights {
  const { frames, frameInterval } = raw.info;
  const interval = frameInterval || 60000;

  // Initialise per-participant state
  const participants: Record<number, ParticipantTimeline> = {};
  for (const p of raw.info.participants) {
    participants[p.participantId] = { levelTimings: [], itemsBought: [] };
  }

  // ---------------------------------------------------------------------------
  // Pass 1: extract per-minute snapshots from frames
  // ---------------------------------------------------------------------------
  const idx10 = frameIndexForMinute(interval, 10);
  const idx15 = frameIndexForMinute(interval, 15);

  for (const [idxStr, frame] of frames.entries()) {
    const idx = Number(idxStr);

    for (const [pidStr, pf] of Object.entries(frame.participantFrames)) {
      const pid = Number(pidStr);
      if (!participants[pid]) participants[pid] = { levelTimings: [], itemsBought: [] };
      const pt = participants[pid];

      if (idx === idx10) {
        pt.goldAt10  = pf.totalGold;
        pt.csAt10    = csFromFrame(pf);
        pt.levelAt10 = pf.level;
      }
      if (idx === idx15) {
        pt.goldAt15 = pf.totalGold;
        pt.csAt15   = csFromFrame(pf);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Pass 2: collect item undos (used in pass 3)
  // ---------------------------------------------------------------------------
  const undoMap = new Map<number, Set<number>>();
  for (const frame of frames) {
    for (const ev of frame.events as RiotTimelineEvent[]) {
      if (ev.type === 'ITEM_UNDO') {
        const pid = (ev as any).participantId as number;
        const removed = (ev as any).beforeId as number;
        if (!undoMap.has(pid)) undoMap.set(pid, new Set());
        undoMap.get(pid)!.add(removed);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Pass 3: process all events
  // ---------------------------------------------------------------------------
  let firstBloodAt:  number | undefined;
  let firstTowerAt:  number | undefined;
  let firstDragonAt: number | undefined;
  let firstBaronAt:  number | undefined;
  let firstHeraldAt: number | undefined;

  const allKills: RawKillEvent[] = [];
  const objectiveEvents: RawObjectiveEvent[] = [];

  for (const frame of frames) {
    for (const ev of frame.events as RiotTimelineEvent[]) {
      const ts = Math.round(ev.timestamp / SEC);

      switch (ev.type) {
        case 'ITEM_PURCHASED': {
          const e = ev as Extract<RiotTimelineEvent, { type: 'ITEM_PURCHASED' }>;
          const undone = undoMap.get(e.participantId);
          if (!undone?.has(e.itemId)) {
            participants[e.participantId]?.itemsBought.push({ itemId: e.itemId, timestamp: ts });
          }
          break;
        }

        case 'CHAMPION_KILL': {
          const e = ev as Extract<RiotTimelineEvent, { type: 'CHAMPION_KILL' }>;
          if (!firstBloodAt && e.killerId > 0) firstBloodAt = ts;
          allKills.push({
            timestamp: ts,
            killerId: e.killerId,
            victimId: e.victimId,
            assistIds: e.assistingParticipantIds ?? [],
          });
          break;
        }

        case 'ELITE_MONSTER_KILL': {
          const e = ev as Extract<RiotTimelineEvent, { type: 'ELITE_MONSTER_KILL' }>;
          if (!firstDragonAt && e.monsterType === 'DRAGON') firstDragonAt = ts;
          if (!firstBaronAt  && e.monsterType === 'BARON_NASHOR') firstBaronAt = ts;
          if (!firstHeraldAt && e.monsterType === 'RIFTHERALD') firstHeraldAt = ts;

          const type = e.monsterType as RawObjectiveEvent['type'];
          if (['DRAGON', 'BARON_NASHOR', 'RIFTHERALD', 'ATAKHAN'].includes(type)) {
            objectiveEvents.push({
              timestamp: ts,
              killerParticipantId: e.killerId,
              type,
              subtype: e.monsterSubType,
            });
          }
          break;
        }

        case 'BUILDING_KILL': {
          const e = ev as Extract<RiotTimelineEvent, { type: 'BUILDING_KILL' }>;
          if (!firstTowerAt && e.buildingType === 'TOWER_BUILDING') firstTowerAt = ts;

          const type: RawObjectiveEvent['type'] =
            e.buildingType === 'INHIBITOR_BUILDING' ? 'INHIBITOR' : 'TOWER';
          objectiveEvents.push({
            timestamp: ts,
            killerParticipantId: 0, // building kill; derive team from teamId below
            // teamId = team that OWNED the building → killerTeam = opposite
            // Store teamId in subtype so the formatter can derive team
            type,
            subtype: String(e.teamId), // "100" = blue owned → red killed; "200" = red owned → blue killed
            lane: e.laneType,
          });
          break;
        }

        case 'LEVEL_UP': {
          const e = ev as Extract<RiotTimelineEvent, { type: 'LEVEL_UP' }>;
          const pt = participants[e.participantId];
          if (pt) {
            pt.levelTimings[e.level - 2] = ts;
          }
          break;
        }
      }
    }
  }

  const fightClusters = detectFightClusters(allKills);

  return {
    participants,
    firstBloodAt,
    firstTowerAt,
    firstDragonAt,
    firstBaronAt,
    firstHeraldAt,
    allKills,
    objectiveEvents,
    fightClusters,
  };
}
