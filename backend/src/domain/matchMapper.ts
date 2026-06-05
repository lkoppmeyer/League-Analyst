import { RiotMatchDto, RiotParticipant, RiotTeam } from "../types/riot.js";
import { MatchData, TeamInfo, Player, ResolvedRune } from "../types/app.js";
import { getRuneById, getRuneTreeById } from "../data/championDb.js";

export class MatchMapper {
  static mapRiotToApp(riotMatch: RiotMatchDto): MatchData {
    const { info, metadata } = riotMatch;

    // Find blue and red teams
    let blueTeamData = info.teams.find((t) => t.teamId === 100);
    let redTeamData = info.teams.find((t) => t.teamId === 200);

    // Fallback: some responses may not include standard teamId values, use indices
    if (!blueTeamData || !redTeamData) {
      if (info.teams && info.teams.length >= 2) {
        blueTeamData = info.teams[0];
        redTeamData = info.teams[1];
      } else {
        throw new Error("Invalid match data: teams not found");
      }
    }

    // Map participants to players, grouped by team
    const bluePlayers = info.participants
      .filter((p) => p.teamId === 100)
      .map((p, idx) => this.mapParticipantToPlayer(p, "blue", idx));

    const redPlayers = info.participants
      .filter((p) => p.teamId === 200)
      .map((p, idx) => this.mapParticipantToPlayer(p, "red", idx));

    const allPlayers = [...bluePlayers, ...redPlayers];

    // Map teams
    const blueTeam = this.mapTeamInfo(blueTeamData, "blue");
    const redTeam = this.mapTeamInfo(redTeamData, "red");

    return {
      matchId: metadata.matchId,
      blueTeam,
      redTeam,
      players: allPlayers,
      gameMode: info.gameMode,
      gameDuration: info.gameDuration,
      gameVersion: info.gameVersion,
      timestamp: info.gameStartTimestamp,
      mapId: info.mapId,
      queueId: info.queueId,
      gameCreation: info.gameCreation,
    };
  }

  private static mapParticipantToPlayer(
    participant: RiotParticipant,
    team: "blue" | "red",
    _index: number,
  ): Player {
    // Map role from teamPosition
    const roleMap: Record<string, string> = {
      TOP: "Top",
      JUNGLE: "Jungle",
      MIDDLE: "Mid",
      ADC: "ADC",
      SUPPORT: "Support",
      UTILITY: "Support", // fallback
    };

    const role =
      roleMap[participant.teamPosition] ||
      participant.teamPosition ||
      "Unknown";

    // Resolve runes from perks
    let runes: Player['runes'];
    const perks = participant.perks;
    if (perks?.styles?.length) {
      const primary = perks.styles.find((s) => s.description === 'primaryStyle');
      const sub = perks.styles.find((s) => s.description === 'subStyle');

      const resolveRune = (id: number): ResolvedRune | undefined => {
        const r = getRuneById(id);
        return r ? { id: r.id, name: r.name, iconUrl: r.icon_url } : undefined;
      };
      const resolveTree = (id: number): ResolvedRune | undefined => {
        const t = getRuneTreeById(id);
        return t ? { id: t.id, name: t.name, iconUrl: t.icon_url } : undefined;
      };

      const keystoneId = primary?.selections?.[0]?.perk;
      runes = {
        keystone: keystoneId ? resolveRune(keystoneId) : undefined,
        primaryTree: primary ? resolveTree(primary.style) : undefined,
        secondaryTree: sub ? resolveTree(sub.style) : undefined,
      };
    }

    return {
      id: participant.puuid,
      participantId: participant.participantId,
      name: participant.summonerName || participant.riotIdGameName || "Unknown",
      role,
      team,
      portraitUrl: undefined,
      championId: participant.championId,
      championName: participant.championName,
      champLevel: participant.champLevel,
      kills: participant.kills,
      deaths: participant.deaths,
      assists: participant.assists,
      goldEarned: participant.goldEarned,
      minionsKilled: participant.totalMinionsKilled,
      items: [
        participant.item0,
        participant.item1,
        participant.item2,
        participant.item3,
        participant.item4,
        participant.item5,
        participant.item6,
      ].filter((id) => id !== 0),
      runes,
      totalDamageToChampions: participant.totalDamageDealtToChampions,
      totalDamageTaken: participant.totalDamageTaken,
      totalHeal: participant.totalHeal,
      timeCCingOthers: participant.timeCCingOthers,
      turretKills: participant.turretKills,
      visionScore: participant.visionScore,
      wardsPlaced: participant.wardsPlaced,
      wardsKilled: participant.wardsKilled,
      multiKills: {
        double: participant.doubleKills,
        triple: participant.tripleKills,
        quadra: participant.quadraKills,
        penta: participant.pentaKills,
        largestSpree: participant.largestKillingSpree,
      },
    };
  }

  private static mapTeamInfo(team: RiotTeam, side: "blue" | "red"): TeamInfo {
    // Team name will be the side for now (UI can enhance this)
    const teamName = side === "blue" ? "Blue Team" : "Red Team";

    return {
      id: team.teamId.toString(),
      name: teamName,
      side,
      win: team.win,
      bans: team.bans.map((b) => b.championId),
      objectives: {
        baron: team.objectives.baron.kills,
        dragon: team.objectives.dragon.kills,
        tower: team.objectives.tower.kills,
        inhibitor: team.objectives.inhibitor.kills,
        riftHerald: team.objectives.riftHerald.kills,
      },
    };
  }
}
