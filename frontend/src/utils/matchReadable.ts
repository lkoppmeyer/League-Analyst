// Pure field-rename/reorder transformation for EnrichedMatchData.
// No values are changed — only keys and ordering.

type Obj = Record<string, unknown>;

function pick(src: Obj, key: string): unknown {
  return src[key];
}

function defined(v: unknown): boolean {
  return v !== undefined && v !== null;
}

function renameTeam(team: unknown): Obj {
  if (!team || typeof team !== 'object') return {};
  const t = team as Obj;
  const out: Obj = {};
  if (defined(t.side))      out['Seite']          = t.side;
  if (defined(t.win))       out['Gewonnen']        = t.win;
  if (defined(t.bans))      out['Bans']            = t.bans;
  if (defined(t.baron))     out['Baron-Kills']     = t.baron;
  if (defined(t.dragon))    out['Dragon-Kills']    = t.dragon;
  if (defined(t.tower))     out['Türme']           = t.tower;
  if (defined(t.inhibitor)) out['Inhibitor-Kills'] = t.inhibitor;
  if (defined(t.riftHerald))out['Herald-Kills']    = t.riftHerald;
  return out;
}

function renameItem(item: unknown): Obj {
  if (!item || typeof item !== 'object') return {};
  const i = item as Obj;
  const out: Obj = {};
  if (defined(i.name))    out['Item']    = i.name;
  if (defined(i.boughtAt))out['Min']     = i.boughtAt;
  if (defined(i.general)) out['Notiz']   = i.general;
  return out;
}

function renamePlayer(player: unknown): Obj {
  if (!player || typeof player !== 'object') return {};
  const p = player as Obj;
  const out: Obj = {};

  // Identity
  if (defined(p.name))             out['Spieler']              = p.name;
  if (defined(p.team))             out['Team']                 = p.team;
  if (defined(p.role))             out['Rolle']                = p.role;
  if (defined(p.champion))         out['Champion']             = p.champion;
  if (defined(p.champLevel))       out['Champ-Level']          = p.champLevel;

  // Combat
  if (defined(p.kda))              out['K/D/A']                = p.kda;
  if (defined(p.killParticipation))out['Kill-Beteiligung']     = p.killParticipation;
  if (defined(p.multikills))       out['Multikills']           = p.multikills;
  if (defined(p.damage))           out['Schaden an Champs']    = p.damage;
  if (defined(p.damageTaken))      out['Erlittener Schaden']   = p.damageTaken;
  if (defined(p.cc))               out['CC ausgeteilt (Sek.)'] = p.cc;

  // Economy
  if (defined(p.gold))             out['Gesamtgold']           = p.gold;
  if (defined(p.goldAt10))         out['Gold @ Min 10']        = p.goldAt10;
  if (defined(p.goldAt15))         out['Gold @ Min 15']        = p.goldAt15;

  // CS / Level
  if (defined(p.csPerMin))         out['CS/min']               = p.csPerMin;
  if (defined(p.csAt10))           out['CS @ Min 10']          = p.csAt10;
  if (defined(p.csAt15))           out['CS @ Min 15']          = p.csAt15;
  if (defined(p.levelAt10))        out['Level @ Min 10']       = p.levelAt10;

  // Timeline milestones
  if (defined(p.level6At))         out['Level 6 erreicht']     = p.level6At;
  if (defined(p.bootsAt))          out['Boots fertig']         = p.bootsAt;

  // Vision
  if (defined(p.visionScore))      out['Vision Score']         = p.visionScore;
  if (defined(p.wardsPlaced))      out['Wards gesetzt']        = p.wardsPlaced;
  if (defined(p.wardsKilled))      out['Wards zerstört']       = p.wardsKilled;
  if (defined(p.turretKills))      out['Türme zerstört']       = p.turretKills;

  // Items & Runes
  if (Array.isArray(p.items))
    out['Items'] = (p.items as unknown[]).map(renameItem);
  if (defined(p.keystone))         out['Keystone']             = p.keystone;
  if (defined(p.secondaryTree))    out['Sekundärbaum']         = p.secondaryTree;

  // Context
  if (defined(p.championContext))  out['Champion-Hinweise']    = p.championContext;

  return out;
}

export function toReadable(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  const e = raw as Obj;
  const out: Obj = {};

  if (defined(pick(e, 'matchId')))    out['Match-ID']       = e.matchId;
  if (defined(pick(e, 'duration')))   out['Spieldauer']     = e.duration;
  if (defined(pick(e, 'queue')))      out['Spielmodus']     = e.queue;

  if (defined(e.blueTeam))  out['Blaues Team'] = renameTeam(e.blueTeam);
  if (defined(e.redTeam))   out['Rotes Team']  = renameTeam(e.redTeam);

  if (Array.isArray(e.players))
    out['Spieler'] = (e.players as unknown[]).map(renamePlayer);

  if (defined(e.firstBlood))  out['First Blood']  = e.firstBlood;
  if (defined(e.firstTower))  out['Erster Turm']  = e.firstTower;
  if (defined(e.firstDragon)) out['Erster Dragon'] = e.firstDragon;
  if (defined(e.firstBaron))  out['Erster Baron']  = e.firstBaron;
  if (defined(e.firstHerald)) out['Erster Herald'] = e.firstHerald;

  return out;
}
