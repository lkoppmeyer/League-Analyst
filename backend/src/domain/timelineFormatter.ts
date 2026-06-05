import { MatchData, Player } from '../types/app.js';
import { RawKillEvent, RawObjectiveEvent, RawFightCluster } from '../types/timeline.js';

// ---------------------------------------------------------------------------
// Output types — what the timeline analysis agent receives
// ---------------------------------------------------------------------------

export type PlayerRef = {
  champion: string;
  role: string;
  team: 'blue' | 'red';
};

export type LaneMatchup = {
  role: string;
  blue: { champion: string; goldAt10?: number; csAt10?: number; goldAt15?: number; csAt15?: number };
  red:  { champion: string; goldAt10?: number; csAt10?: number; goldAt15?: number; csAt15?: number };
  goldDiffAt10?: number;   // blue - red, positive = blue ahead
  csDiffAt10?: number;
  goldDiffAt15?: number;
  csDiffAt15?: number;
};

export type FormattedObjective = {
  time: string;           // "@ 5:12"
  team: 'blue' | 'red';
  type: string;           // "Dragon", "Baron", "Tower"
  detail?: string;        // "Fire Drake", "Top Lane Tower", "Elder Drake"
};

export type FormattedFight = {
  time: string;           // "@ 14:22"
  duration: string;       // "8s" or "< 1s"
  label: 'Teamfight' | 'Skirmish';
  kills: number;
  blueKills: number;
  redKills: number;
  participants: string[]; // e.g. ["Jinx killed Yasuo", "Lee Sin + Orianna killed Darius"]
};

export type FormattedLevel6 = {
  time: string;
  champion: string;
  role: string;
  team: 'blue' | 'red';
};

export type TimelineContext = {
  laneMatchups: LaneMatchup[];
  level6Timings: FormattedLevel6[];
  objectiveTimeline: FormattedObjective[];
  fights: FormattedFight[];
  dragonSoul?: { team: 'blue' | 'red'; type: string };
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(seconds: number): string {
  return `@ ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function dragonLabel(subtype?: string): string {
  if (!subtype) return 'Drake';
  const map: Record<string, string> = {
    FIRE_DRAGON:     'Fire Drake',
    WATER_DRAGON:    'Water Drake',
    AIR_DRAGON:      'Air Drake',
    EARTH_DRAGON:    'Earth Drake',
    HEXTECH_DRAGON:  'Hextech Drake',
    CHEMTECH_DRAGON: 'Chemtech Drake',
    ELDER_DRAGON:    'Elder Drake',
  };
  return map[subtype] ?? subtype.replace(/_/g, ' ').replace(/\bDRAGON\b/, 'Drake');
}

function laneLabel(lane?: string): string {
  if (!lane) return '';
  const map: Record<string, string> = {
    BOT_LANE: 'Bot',
    MID_LANE: 'Mid',
    TOP_LANE: 'Top',
  };
  return map[lane] ?? lane;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function buildTimelineContext(match: MatchData): TimelineContext | null {
  const tl = match.timeline;
  if (!tl) return null;

  // Build participantId → player map
  const playerById = new Map<number, Player>();
  for (const p of match.players) playerById.set(p.participantId, p);

  // Infer team for a participantId (fallback: pid 1-5 = blue, 6-10 = red)
  function teamOf(pid: number): 'blue' | 'red' {
    const p = playerById.get(pid);
    if (p) return p.team;
    return pid >= 1 && pid <= 5 ? 'blue' : 'red';
  }

  function championOf(pid: number): string {
    return playerById.get(pid)?.championName ?? `Participant ${pid}`;
  }

  // ── Lane Matchups ──────────────────────────────────────────────────────────

  const lanes = ['Top', 'Jungle', 'Mid', 'ADC', 'Support'];
  const laneMatchups: LaneMatchup[] = [];

  for (const role of lanes) {
    const blue = match.players.find((p) => p.team === 'blue' && p.role === role);
    const red  = match.players.find((p) => p.team === 'red'  && p.role === role);
    if (!blue && !red) continue;

    const ptBlue = blue ? (tl.participants as any)[String(blue.participantId)] : undefined;
    const ptRed  = red  ? (tl.participants as any)[String(red.participantId)]  : undefined;

    const goldDiffAt10 =
      ptBlue?.goldAt10 !== undefined && ptRed?.goldAt10 !== undefined
        ? ptBlue.goldAt10 - ptRed.goldAt10
        : undefined;
    const csDiffAt10 =
      ptBlue?.csAt10 !== undefined && ptRed?.csAt10 !== undefined
        ? ptBlue.csAt10 - ptRed.csAt10
        : undefined;
    const goldDiffAt15 =
      ptBlue?.goldAt15 !== undefined && ptRed?.goldAt15 !== undefined
        ? ptBlue.goldAt15 - ptRed.goldAt15
        : undefined;
    const csDiffAt15 =
      ptBlue?.csAt15 !== undefined && ptRed?.csAt15 !== undefined
        ? ptBlue.csAt15 - ptRed.csAt15
        : undefined;

    laneMatchups.push({
      role,
      blue: {
        champion: blue?.championName ?? '?',
        goldAt10:  ptBlue?.goldAt10,
        csAt10:    ptBlue?.csAt10,
        goldAt15:  ptBlue?.goldAt15,
        csAt15:    ptBlue?.csAt15,
      },
      red: {
        champion: red?.championName ?? '?',
        goldAt10:  ptRed?.goldAt10,
        csAt10:    ptRed?.csAt10,
        goldAt15:  ptRed?.goldAt15,
        csAt15:    ptRed?.csAt15,
      },
      ...(goldDiffAt10 !== undefined && { goldDiffAt10 }),
      ...(csDiffAt10  !== undefined && { csDiffAt10  }),
      ...(goldDiffAt15 !== undefined && { goldDiffAt15 }),
      ...(csDiffAt15  !== undefined && { csDiffAt15  }),
    });
  }

  // ── Level 6 Timings ───────────────────────────────────────────────────────

  const level6Timings: FormattedLevel6[] = [];
  for (const player of match.players) {
    const pt = (tl.participants as any)[String(player.participantId)];
    const secs = pt?.levelTimings?.[4]; // index 4 = level 6
    if (secs !== undefined) {
      level6Timings.push({
        time: formatTime(secs),
        champion: player.championName ?? `P${player.participantId}`,
        role: player.role,
        team: player.team,
      });
    }
  }
  level6Timings.sort((a, b) => {
    // sort by time ascending (format is "@ MM:SS")
    const toSecs = (s: string) => {
      const [m, sec] = s.replace('@ ', '').split(':').map(Number);
      return m * 60 + sec;
    };
    return toSecs(a.time) - toSecs(b.time);
  });

  // ── Objective Timeline ─────────────────────────────────────────────────────

  const objectiveTimeline: FormattedObjective[] = [];
  let dragonSoul: TimelineContext['dragonSoul'] | undefined;
  const dragonCounts: Record<'blue' | 'red', Map<string, number>> = {
    blue: new Map(),
    red: new Map(),
  };

  for (const ev of tl.objectiveEvents ?? []) {
    if (ev.type === 'DRAGON') {
      const team = teamOf(ev.killerParticipantId);
      const label = dragonLabel(ev.subtype);
      objectiveTimeline.push({ time: formatTime(ev.timestamp), team, type: 'Dragon', detail: label });

      // Track dragon soul (4 of same non-elder type)
      if (ev.subtype && ev.subtype !== 'ELDER_DRAGON') {
        const normalType = ev.subtype.replace('_DRAGON', '');
        const count = (dragonCounts[team].get(normalType) ?? 0) + 1;
        dragonCounts[team].set(normalType, count);
        if (count >= 4 && !dragonSoul) {
          dragonSoul = { team, type: label.replace(' Drake', '') };
        }
      }
    } else if (ev.type === 'BARON_NASHOR') {
      const team = teamOf(ev.killerParticipantId);
      objectiveTimeline.push({ time: formatTime(ev.timestamp), team, type: 'Baron' });
    } else if (ev.type === 'RIFTHERALD') {
      const team = teamOf(ev.killerParticipantId);
      objectiveTimeline.push({ time: formatTime(ev.timestamp), team, type: 'Rift Herald' });
    } else if (ev.type === 'ATAKHAN') {
      const team = teamOf(ev.killerParticipantId);
      objectiveTimeline.push({ time: formatTime(ev.timestamp), team, type: 'Atakhan' });
    } else if (ev.type === 'TOWER' || ev.type === 'INHIBITOR') {
      // subtype stores the owning team ID as a string
      const ownerTeamId = Number(ev.subtype);
      const killerTeam: 'blue' | 'red' = ownerTeamId === 100 ? 'red' : 'blue';
      const lane = laneLabel(ev.lane);
      const detail = lane ? `${lane} Lane ${ev.type === 'INHIBITOR' ? 'Inhibitor' : 'Tower'}` : (ev.type === 'INHIBITOR' ? 'Inhibitor' : 'Tower');
      objectiveTimeline.push({ time: formatTime(ev.timestamp), team: killerTeam, type: ev.type === 'INHIBITOR' ? 'Inhibitor' : 'Tower', detail });
    }
  }

  objectiveTimeline.sort((a, b) => {
    const toSecs = (s: string) => { const [m, sec] = s.replace('@ ', '').split(':').map(Number); return m * 60 + sec; };
    return toSecs(a.time) - toSecs(b.time);
  });

  // ── Fight Clusters ─────────────────────────────────────────────────────────

  const fights: FormattedFight[] = [];

  for (const cluster of tl.fightClusters ?? []) {
    const blueKills = cluster.kills.filter((k) => teamOf(k.killerId) === 'blue').length;
    const redKills  = cluster.kills.filter((k) => teamOf(k.killerId) === 'red').length;
    const totalKills = cluster.kills.length;
    const duration = cluster.endTime - cluster.startTime;
    const label: FormattedFight['label'] = totalKills >= 4 ? 'Teamfight' : 'Skirmish';

    // Build participant summary (max 4 notable kills)
    const participants: string[] = [];
    for (const kill of cluster.kills.slice(0, 4)) {
      const killer = kill.killerId > 0 ? championOf(kill.killerId) : 'Environment';
      const victim = championOf(kill.victimId);
      const assists = kill.assistIds
        .map((id) => championOf(id))
        .filter((n) => n !== killer)
        .slice(0, 2);
      const assistStr = assists.length ? ` (+${assists.join(', ')})` : '';
      participants.push(`${killer}${assistStr} → ${victim}`);
    }
    if (cluster.kills.length > 4) {
      participants.push(`+${cluster.kills.length - 4} weitere Kills`);
    }

    fights.push({
      time: formatTime(cluster.startTime),
      duration: duration <= 0 ? '< 1s' : `${duration}s`,
      label,
      kills: totalKills,
      blueKills,
      redKills,
      participants,
    });
  }

  return {
    laneMatchups,
    level6Timings,
    objectiveTimeline,
    fights,
    ...(dragonSoul && { dragonSoul }),
  };
}
