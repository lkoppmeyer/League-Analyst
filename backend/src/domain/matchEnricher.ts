import { MatchData, TeamInfo, Player } from '../types/app.js';
import { ParticipantTimeline } from '../types/timeline.js';
import {
  getChampByName,
  getChampById,
  getItemById,
  resolveChampName,
  resolveItemName,
  extractChampionContext,
  isBootsItem,
} from '../data/championDb.js';

// ---------------------------------------------------------------------------
// Output types — what the AI model actually receives in the user message
// ---------------------------------------------------------------------------

export type EnrichedPlayer = {
  name: string;
  team: 'blue' | 'red';
  role: string;
  champion: string;
  champLevel?: number;
  kda: string;
  killParticipation?: string;
  gold: string;
  csPerMin: string | null;
  damage?: string;
  damageTaken?: string;
  visionScore?: number;
  wardsPlaced?: number;
  wardsKilled?: number;
  turretKills?: number;
  cc?: string;
  multikills?: string;
  // Timeline-based fields (only present when timeline was fetched)
  goldAt10?: string;        // e.g. "3.2k"
  goldAt15?: string;
  csAt10?: number;
  csAt15?: number;
  levelAt10?: number;
  level6At?: string;        // "Lvl 6 @ 6:12"
  bootsAt?: string;         // "@ 7:45" — when completed boots were first bought (requires timeline)
  items: Array<{ name: string; boughtAt?: number; general?: string }>;
  keystone?: string;
  secondaryTree?: string;
  championContext?: string[];
};

export type EnrichedTeam = {
  side: 'blue' | 'red';
  win: boolean;
  bans: string[];           // resolved champion names
  baron: number;
  dragon: number;
  tower: number;
  inhibitor: number;
  riftHerald: number;
};

export type EnrichedMatchData = {
  matchId: string;
  duration: string;
  queue: string;
  blueTeam: EnrichedTeam;
  redTeam: EnrichedTeam;
  players: EnrichedPlayer[];
  // Timeline-based events (only present when timeline was fetched)
  firstBlood?: string;   // "@ 3:21"
  firstTower?: string;
  firstDragon?: string;
  firstBaron?: string;
  firstHerald?: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const QUEUE_NAMES: Record<number, string> = {
  400: 'Normal (Draft)',
  420: 'Ranked Solo/Duo',
  430: 'Normal (Blind)',
  440: 'Ranked Flex',
  480: 'Swiftplay',
  490: 'Quickplay',
  700: 'Clash',
};

function formatDuration(seconds?: number): string {
  if (!seconds) return 'unbekannt';
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function formatGold(gold?: number): string {
  if (gold === undefined) return '?';
  return `${(gold / 1000).toFixed(1)}k`;
}

function calcCsPerMin(cs?: number, durationSec?: number): string | null {
  if (!cs || !durationSec) return null;
  return (cs / (durationSec / 60)).toFixed(1);
}

function resolveItemsWithTiming(
  itemIds: number[] | undefined,
  timingMap: Map<number, number> | undefined
): Array<{ name: string; boughtAt?: number; general?: string }> {
  if (!itemIds?.length) return [];
  return itemIds.map((id) => {
    const name    = resolveItemName(id);
    const ts      = timingMap?.get(id);
    const boughtAt = ts !== undefined ? Math.floor(ts / 60) : undefined;
    const general  = getItemById(id)?.general;
    return {
      name,
      ...(boughtAt !== undefined && { boughtAt }),
      ...(general  && { general }),
    };
  });
}

function formatEventTime(seconds: number): string {
  return `@ ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function enrichTeam(team: TeamInfo): EnrichedTeam {
  return {
    side: team.side,
    win: team.win ?? false,
    bans: (team.bans ?? []).map(resolveChampName),
    baron: team.objectives?.baron ?? 0,
    dragon: team.objectives?.dragon ?? 0,
    tower: team.objectives?.tower ?? 0,
    inhibitor: team.objectives?.inhibitor ?? 0,
    riftHerald: team.objectives?.riftHerald ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Main enrichment
// ---------------------------------------------------------------------------

function formatDamage(dmg?: number): string | undefined {
  if (!dmg) return undefined;
  return `${(dmg / 1000).toFixed(1)}k`;
}

function formatCC(seconds?: number): string | undefined {
  if (!seconds) return undefined;
  return `${seconds.toFixed(0)}s`;
}

function formatMultikills(mk?: Player['multiKills']): string | undefined {
  if (!mk) return undefined;
  const parts: string[] = [];
  if (mk.penta > 0) parts.push(`Penta x${mk.penta}`);
  if (mk.quadra > 0) parts.push(`Quadra x${mk.quadra}`);
  if (mk.triple > 0) parts.push(`Triple x${mk.triple}`);
  if (mk.double > 0) parts.push(`Double x${mk.double}`);
  return parts.length ? parts.join(', ') : undefined;
}

export function enrichMatchData(match: MatchData): EnrichedMatchData {
  const allChampNames = match.players
    .map((p) => p.championName)
    .filter((n): n is string => !!n);

  // Pre-compute team kill totals for kill participation
  const teamKills: Record<string, number> = { blue: 0, red: 0 };
  for (const p of match.players) teamKills[p.team] += p.kills ?? 0;

  // Build per-participant item timing lookup from timeline
  const itemTimingByParticipant = new Map<number, Map<number, number>>();
  if (match.timeline?.participants) {
    for (const [pidStr, pt] of Object.entries(
      match.timeline.participants as Record<string, ParticipantTimeline>
    )) {
      const pid = Number(pidStr);
      const lastBuy = new Map<number, number>();
      for (const { itemId, timestamp } of pt.itemsBought) {
        lastBuy.set(itemId, timestamp); // overwrite → last purchase wins
      }
      itemTimingByParticipant.set(pid, lastBuy);
    }
  }

  function enrichPlayer(player: Player): EnrichedPlayer {
    const entry = player.championName
      ? (getChampByName(player.championName) ?? (player.championId ? getChampById(player.championId) : undefined))
      : (player.championId ? getChampById(player.championId) : undefined);

    const otherChampNames = allChampNames.filter(
      (n) => n.toLowerCase() !== (player.championName ?? '').toLowerCase()
    );

    const itemIds = player.items ?? [];
    const context = entry
      ? extractChampionContext(entry, player.role, otherChampNames, itemIds)
      : [];

    const tkTeam = teamKills[player.team] ?? 0;
    const kp = tkTeam > 0
      ? `${Math.round(((player.kills ?? 0) + (player.assists ?? 0)) / tkTeam * 100)}%`
      : undefined;

    const multikills = formatMultikills(player.multiKills);

    // Timeline snapshots for this player
    const pt = (match.timeline?.participants as Record<string, ParticipantTimeline> | undefined)?.[String(player.participantId)];
    const level6Secs = pt?.levelTimings?.[4]; // levelTimings[4] = level 6 (index = level - 2)

    const firstBoots = pt?.itemsBought
      .filter(({ itemId }) => isBootsItem(itemId))
      .sort((a, b) => a.timestamp - b.timestamp)[0];

    return {
      name: player.name,
      team: player.team,
      role: player.role,
      champion: player.championName ?? (player.championId ? resolveChampName(player.championId) : 'Unbekannt'),
      champLevel: player.champLevel,
      kda: `${player.kills ?? 0}/${player.deaths ?? 0}/${player.assists ?? 0}`,
      ...(kp && { killParticipation: kp }),
      gold: formatGold(player.goldEarned),
      csPerMin: calcCsPerMin(player.minionsKilled, match.gameDuration),
      ...(pt?.goldAt10 !== undefined && { goldAt10: formatGold(pt.goldAt10) }),
      ...(pt?.goldAt15 !== undefined && { goldAt15: formatGold(pt.goldAt15) }),
      ...(pt?.csAt10 !== undefined && { csAt10: pt.csAt10 }),
      ...(pt?.csAt15 !== undefined && { csAt15: pt.csAt15 }),
      ...(pt?.levelAt10 !== undefined && { levelAt10: pt.levelAt10 }),
      ...(level6Secs !== undefined && { level6At: `Lvl 6 @ ${formatEventTime(level6Secs)}` }),
      ...(firstBoots && { bootsAt: formatEventTime(firstBoots.timestamp) }),
      ...(player.totalDamageToChampions && { damage: formatDamage(player.totalDamageToChampions) }),
      ...(player.totalDamageTaken && { damageTaken: formatDamage(player.totalDamageTaken) }),
      ...(player.visionScore !== undefined && { visionScore: player.visionScore }),
      ...(player.wardsPlaced !== undefined && { wardsPlaced: player.wardsPlaced }),
      ...(player.wardsKilled !== undefined && { wardsKilled: player.wardsKilled }),
      ...(player.turretKills && { turretKills: player.turretKills }),
      ...(player.timeCCingOthers && { cc: formatCC(player.timeCCingOthers) }),
      ...(multikills && { multikills }),
      items: resolveItemsWithTiming(player.items, itemTimingByParticipant.get(player.participantId)),
      ...(player.runes?.keystone && { keystone: player.runes.keystone.name }),
      ...(player.runes?.secondaryTree && { secondaryTree: player.runes.secondaryTree.name }),
      ...(context.length > 0 && { championContext: context }),
    };
  }

  return {
    matchId: match.matchId,
    duration: formatDuration(match.gameDuration),
    queue: match.queueId ? (QUEUE_NAMES[match.queueId] ?? "Summoner's Rift") : "Summoner's Rift",
    blueTeam: enrichTeam(match.blueTeam),
    redTeam: enrichTeam(match.redTeam),
    players: match.players.map(enrichPlayer),
    ...(match.timeline?.firstBloodAt !== undefined && { firstBlood: formatEventTime(match.timeline.firstBloodAt) }),
    ...(match.timeline?.firstTowerAt !== undefined && { firstTower: formatEventTime(match.timeline.firstTowerAt) }),
    ...(match.timeline?.firstDragonAt !== undefined && { firstDragon: formatEventTime(match.timeline.firstDragonAt) }),
    ...(match.timeline?.firstBaronAt !== undefined && { firstBaron: formatEventTime(match.timeline.firstBaronAt) }),
    ...(match.timeline?.firstHeraldAt !== undefined && { firstHerald: formatEventTime(match.timeline.firstHeraldAt) }),
  };
}

// ---------------------------------------------------------------------------
// Champion context block for the system prompt
// ---------------------------------------------------------------------------

/**
 * Build a readable text block about the champions in this match.
 * Appears in the system prompt so the AI has context before reading the data.
 * Only includes champions that have at least a 'general' entry in the DB.
 */
export function buildChampionContextBlock(match: MatchData): string {
  const allChampNames = match.players
    .map((p) => p.championName)
    .filter((n): n is string => !!n);

  const lines: string[] = [];

  for (const player of match.players) {
    const entry = player.championName
      ? (getChampByName(player.championName) ?? (player.championId ? getChampById(player.championId) : undefined))
      : (player.championId ? getChampById(player.championId) : undefined);

    if (!entry?.general) continue;

    const side = player.team === 'blue' ? 'Blau' : 'Rot';
    const otherChampNames = allChampNames.filter(
      (n) => n.toLowerCase() !== (player.championName ?? '').toLowerCase()
    );
    const context = extractChampionContext(entry, player.role, otherChampNames, player.items ?? []);

    lines.push(`${entry.name} (${player.role}, ${side}):`);
    for (const line of context) {
      lines.push(`  - ${line}`);
    }
  }

  if (lines.length === 0) return '';
  return `## Champion-Kontext fuer dieses Spiel\n\n${lines.join('\n')}`;
}
