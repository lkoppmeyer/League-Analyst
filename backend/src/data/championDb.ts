import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Champion entry — flat key-value object.
 * Known key patterns (all optional beyond id/name):
 *   general               Always-injected context text.
 *   role_top/jungle/mid/adc/support  Role-specific context.
 *   matchup_<champname>   Context when both champions are in the same game.
 *                         champname = Riot display name, lowercase, spaces -> underscore.
 *                         e.g. matchup_zed, matchup_miss_fortune, matchup_lee_sin
 *   item_<itemkey>        Context when the player has this item.
 *                         itemkey comes from items.json .key field.
 *                         e.g. item_trinity_force, item_zhonyas_hourglass
 */
export type ChampionEntry = {
  id: number;
  name: string;
  attack_type?: string;
  tags?: string[];
  general?: string;
  [key: string]: string | number | string[] | undefined;
};

export type ItemStat = { label: string; value: string };

export type ItemEntry = {
  id: number;
  name: string;
  key: string;
  image_url?: string;
  depth?: number;       // 1=starter, 2=component, 3=completed/legendary
  tags?: string[];      // Riot item tags, e.g. ["Boots", "AttackSpeed"]
  stats?: ItemStat[];
  description?: string;
  general?: string;
};

export type RuneEntry = {
  id: number;
  name: string;
  icon_url: string;
};

export type RuneTreeEntry = {
  id: number;
  name: string;
  icon_url: string;
};

type ChampionDbFile = { champions: ChampionEntry[] };
type ItemDbFile = { items: ItemEntry[] };
type RuneDbFile = { trees: RuneTreeEntry[]; runes: RuneEntry[] };

// ---------------------------------------------------------------------------
// Load once at module init
// ---------------------------------------------------------------------------

const champRaw = JSON.parse(
  readFileSync(join(__dirname, 'champions.json'), 'utf-8')
) as ChampionDbFile;

const itemRaw = JSON.parse(
  readFileSync(join(__dirname, 'items.json'), 'utf-8')
) as ItemDbFile;

// runes.json may not exist yet (before first fetch-script run)
let runeRaw: RuneDbFile = { trees: [], runes: [] };
try {
  runeRaw = JSON.parse(readFileSync(join(__dirname, 'runes.json'), 'utf-8')) as RuneDbFile;
} catch {
  // silently skip — runes won't resolve until fetch script is run
}

const champById = new Map<number, ChampionEntry>(champRaw.champions.map((c) => [c.id, c]));
const champByName = new Map<string, ChampionEntry>(
  champRaw.champions.map((c) => [c.name.toLowerCase(), c])
);

const itemById = new Map<number, ItemEntry>(itemRaw.items.map((i) => [i.id, i]));
const runeById = new Map<number, RuneEntry>(runeRaw.runes.map((r) => [r.id, r]));
const runeTreeById = new Map<number, RuneTreeEntry>(runeRaw.trees.map((t) => [t.id, t]));

// ---------------------------------------------------------------------------
// Champion lookups
// ---------------------------------------------------------------------------

export function getChampById(id: number): ChampionEntry | undefined {
  return champById.get(id);
}

export function getChampByName(name: string): ChampionEntry | undefined {
  return champByName.get(name.toLowerCase());
}

export function resolveChampName(id: number): string {
  return champById.get(id)?.name ?? `Unbekannt (ID ${id})`;
}

// ---------------------------------------------------------------------------
// Item lookups
// ---------------------------------------------------------------------------

export function getItemById(id: number): ItemEntry | undefined {
  return itemById.get(id);
}

export function getAllItems(): ItemEntry[] {
  return itemRaw.items;
}

/**
 * Returns true for completed boot items (tag "Boots", depth > 1).
 * Excludes the basic "Boots" starter (depth 1) — only matches the upgraded version.
 */
export function isBootsItem(id: number): boolean {
  const item = itemById.get(id);
  return (item?.tags?.includes('Boots') ?? false) && (item?.depth ?? 0) > 1;
}

export function resolveItemName(id: number): string {
  return itemById.get(id)?.name ?? `Item ${id}`;
}

// ---------------------------------------------------------------------------
// Rune lookups
// ---------------------------------------------------------------------------

export function getRuneById(id: number): RuneEntry | undefined {
  return runeById.get(id);
}

export function getRuneTreeById(id: number): RuneTreeEntry | undefined {
  return runeTreeById.get(id);
}

// ---------------------------------------------------------------------------
// Dynamic context extraction
// ---------------------------------------------------------------------------

/**
 * Convert a champion display name to the key slug used in matchup_* lookups.
 * "Lee Sin" -> "lee_sin", "Miss Fortune" -> "miss_fortune"
 */
export function champNameToKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

// Keys that are structural or handled explicitly — not treated as custom attributes.
const KNOWN_KEYS = new Set(['id', 'name', 'attack_type', 'tags', 'general']);
const KNOWN_PREFIXES = ['role_', 'matchup_', 'item_', 'item_core_'];

function isKnownKey(key: string): boolean {
  if (KNOWN_KEYS.has(key)) return true;
  return KNOWN_PREFIXES.some((p) => key.startsWith(p));
}

function labelFromKey(key: string): string {
  return key.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

/**
 * Extract all context lines from a champion entry that are relevant for a
 * specific game state.
 *
 * Injects:
 *  - general (always)
 *  - role_<role> (if role matches)
 *  - matchup_<name> (for each opponent/ally name that exists as a key)
 *  - item_<key>     (for each item the player holds that has a key in the entry)
 *  - Any other string-valued custom key (always injected verbatim)
 */
export function extractChampionContext(
  entry: ChampionEntry,
  role: string,
  otherChampNames: string[],
  itemIds: number[]
): string[] {
  const lines: string[] = [];

  const typeParts: string[] = [];
  if (entry.attack_type) typeParts.push(entry.attack_type === 'ranged' ? 'Ranged' : 'Melee');
  if (entry.tags?.length) typeParts.push((entry.tags as string[]).join('/'));
  if (typeParts.length) lines.push(`Typ: ${typeParts.join(', ')}`);

  if (entry.general) lines.push(`Allgemein: ${entry.general}`);

  const roleKey = `role_${role.toLowerCase()}`;
  if (entry[roleKey]) lines.push(`Als ${role}: ${entry[roleKey]}`);

  for (const name of otherChampNames) {
    const matchupKey = `matchup_${champNameToKey(name)}`;
    if (entry[matchupKey]) lines.push(`vs ${name}: ${entry[matchupKey]}`);
  }

  for (const itemId of itemIds) {
    const item = itemById.get(itemId);
    if (!item) continue;
    const itemKey = `item_${item.key}`;
    if (entry[itemKey]) lines.push(`mit ${item.name}: ${entry[itemKey]}`);
  }

  // Custom attributes: any string-valued key not covered by the patterns above
  for (const [key, value] of Object.entries(entry)) {
    if (isKnownKey(key)) continue;
    if (typeof value !== 'string' || !value.trim()) continue;
    lines.push(`${labelFromKey(key)}: ${value}`);
  }

  return lines;
}

/**
 * Extract general context lines for a list of item IDs.
 * Only items with a non-empty `general` field are included.
 * Format: "Trinity Force: offensiv; ADC-Carry; …"
 */
export function extractItemContext(itemIds: number[]): string[] {
  return itemIds
    .map((id) => itemById.get(id))
    .filter((item): item is ItemEntry => !!item?.general)
    .map((item) => `${item.name}: ${item.general}`);
}
