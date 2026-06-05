#!/usr/bin/env python3
"""
One-time script: fetches champion and item data from the LoL Data Dragon API
and writes champions.json + items.json to backend/src/data/.

Usage:
    python backend/scripts/fetch_game_data.py

Existing files are backed up to backend/src/data/old/ with a timestamp suffix.
Requires Python 3.9+, no third-party dependencies.

--- Tag / key reference -------------------------------------------------

champions.json keys (per champion entry):
  id              Champion-ID (integer, Riot API)
  name            Display name (string)
  attack_type     "melee" or "ranged" — derived from attackrange in Riot API
  tags            Riot class tags: Fighter | Tank | Mage | Assassin | Marksman | Support
  general         Free-text context injected whenever the champion is in the game
  role_top        Context specific to this champion on Top lane
  role_jungle     Context specific to this champion as Jungler
  role_mid        Context specific to this champion on Mid lane
  role_adc        Context specific to this champion as ADC
  role_support    Context specific to this champion as Support
  matchup_<name>  Context when BOTH this champion and <name> are in the game.
                  <name> = Riot name lowercase, spaces as underscores.
                  Examples: matchup_zed, matchup_miss_fortune, matchup_lee_sin
  item_<key>      Context injected when this champion has BUILT this item.
                  <key> comes from items.json. Examples: item_trinity_force
  item_core_<key> Context injected whenever this champion is in the game,
                  regardless of whether they built the item or not.
                  Use for: fundamental synergies, items the champ should always
                  consider / avoid, powerspike explanations.
                  Examples: item_core_trinity_force, item_core_sunfire_aegis

items.json keys (per item entry):
  id              Item-ID (integer, Riot API)
  name            Display name (string)
  key             Slug used in champion entries: item_<key> / item_core_<key>
                  Lowercase, special chars removed, spaces as underscores.
                  Examples: trinity_force, zhonyas_hourglass
  tags            Riot item tags: Damage | CriticalStrike | SpellDamage | Armor |
                  SpellBlock | Health | Mana | AttackSpeed | LifeSteal | NonbootsMovement
  notes           Optional human-written note (not AI-injected)

------------------------------------------------------------------------
"""

import json
import os
import re
import shutil
import urllib.request
from datetime import datetime
from pathlib import Path


# Maps DDragon stat keys → (human label, is_percent)
# is_percent=True means value is a decimal fraction (e.g. 0.15) → displayed as 15%
_STAT_LABELS: dict[str, tuple[str, bool]] = {
    'FlatPhysicalDamageMod':        ('Attack Damage',   False),
    'FlatMagicDamageMod':           ('Ability Power',   False),
    'FlatArmorMod':                 ('Armor',           False),
    'FlatSpellBlockMod':            ('Magic Resist',    False),
    'FlatHPPoolMod':                ('Health',          False),
    'FlatMPPoolMod':                ('Mana',            False),
    'PercentAttackSpeedMod':        ('Attack Speed',    True),
    'FlatCritChanceMod':            ('Crit Chance',     True),
    'FlatMovementSpeedMod':         ('Move Speed',      False),
    'PercentMovementSpeedMod':      ('Move Speed',      True),
    'FlatHPRegenMod':               ('HP Regen',        False),
    'PercentLifeStealMod':          ('Life Steal',      True),
    'FlatArmorPenetrationMod':      ('Lethality',       False),
    'PercentArmorPenetrationMod':   ('Armor Pen',       True),
    'FlatMagicPenetrationMod':      ('Magic Pen',       False),
    'PercentMagicPenetrationMod':   ('Magic Pen',       True),
    'FlatMPRegenMod':               ('Mana Regen',      False),
    'FlatEXPBonus':                 ('Bonus XP',        True),
}


def _format_stat_value(value: float, is_percent: bool) -> str:
    if is_percent:
        pct = round(value * 100)
        return f"+{pct}%"
    int_val = int(value)
    return f"+{int_val}" if int_val == value else f"+{value:.1f}"


def _parse_stats(raw_stats: dict) -> list[dict]:
    result = []
    for key, value in raw_stats.items():
        if key not in _STAT_LABELS or value == 0:
            continue
        label, is_percent = _STAT_LABELS[key]
        result.append({"label": label, "value": _format_stat_value(value, is_percent)})
    return result


def _strip_html(html: str) -> str:
    """Strip DDragon HTML to readable plain text, removing the stats block (shown separately)."""
    # Remove the <stats> block — we display stats separately
    text = re.sub(r'<stats>.*?</stats>', '', html, flags=re.IGNORECASE | re.DOTALL)
    text = re.sub(r'<br\s*/?>', '\n', text, flags=re.IGNORECASE)
    text = re.sub(r'<li>', '\n• ', text, flags=re.IGNORECASE)
    text = re.sub(r'</li>', '', text, flags=re.IGNORECASE)
    text = re.sub(r'<passive>', 'Passive: ', text, flags=re.IGNORECASE)
    text = re.sub(r'</passive>', '', text, flags=re.IGNORECASE)
    text = re.sub(r'<active>', 'Active: ', text, flags=re.IGNORECASE)
    text = re.sub(r'</active>', '', text, flags=re.IGNORECASE)
    text = re.sub(r'<[^>]+>', '', text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()


SCRIPT_DIR = Path(__file__).parent
BACKEND_DIR = SCRIPT_DIR.parent
DATA_DIR = BACKEND_DIR / "src" / "data"
OLD_DIR = DATA_DIR / "old"
GITIGNORE_PATH = BACKEND_DIR / ".gitignore"

CHAMPIONS_FILE = DATA_DIR / "champions.json"
ITEMS_FILE = DATA_DIR / "items.json"
RUNES_FILE = DATA_DIR / "runes.json"

DDRAGON_BASE = "https://ddragon.leagueoflegends.com"
SR_MAP_ID = "11"
RANGED_THRESHOLD = 350  # attackrange >= this → ranged


def fetch_json(url: str) -> dict:
    print(f"    GET {url}")
    with urllib.request.urlopen(url) as resp:
        return json.loads(resp.read().decode())


def get_latest_version() -> str:
    return fetch_json(f"{DDRAGON_BASE}/api/versions.json")[0]


def make_slug(name: str) -> str:
    slug = name.lower()
    for ch in ["'", ":", ".", ",", "!", "?", "&", "/"]:
        slug = slug.replace(ch, "")
    slug = slug.replace(" ", "_").replace("-", "_")
    while "__" in slug:
        slug = slug.replace("__", "_")
    return slug.strip("_")


def backup_file(path: Path) -> None:
    if not path.exists():
        return
    OLD_DIR.mkdir(parents=True, exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    dest = OLD_DIR / f"{path.stem}_{ts}{path.suffix}"
    # Avoid rare same-second collisions
    counter = 1
    while dest.exists():
        dest = OLD_DIR / f"{path.stem}_{ts}_{counter}{path.suffix}"
        counter += 1
    shutil.move(str(path), str(dest))
    print(f"  Backed up  {path.name}  →  old/{dest.name}")


def ensure_gitignore_entry() -> None:
    entry = "src/data/old/"
    if GITIGNORE_PATH.exists():
        lines = GITIGNORE_PATH.read_text().splitlines()
        if entry in lines:
            return
        with open(GITIGNORE_PATH, "a") as f:
            f.write(f"\n{entry}\n")
    else:
        GITIGNORE_PATH.write_text(f"{entry}\n")
    print(f"  Added '{entry}' to .gitignore")


def fetch_champions(version: str) -> list:
    data = fetch_json(f"{DDRAGON_BASE}/cdn/{version}/data/en_US/champion.json")
    champions = []
    for champ in data["data"].values():
        attack_range = champ["stats"].get("attackrange", 0)
        champions.append({
            "id": int(champ["key"]),
            "name": champ["name"],
            "attack_type": "ranged" if attack_range >= RANGED_THRESHOLD else "melee",
            "tags": champ.get("tags", []),
        })
    champions.sort(key=lambda c: c["name"])
    return champions


def fetch_items(version: str) -> list:
    data = fetch_json(f"{DDRAGON_BASE}/cdn/{version}/data/en_US/item.json")
    all_items = data["data"]
    items = []
    seen_slugs: set = set()

    for item_id, item in all_items.items():
        # Only Summoner's Rift
        if not item.get("maps", {}).get(SR_MAP_ID, False):
            continue
        # Skip consumables like potions
        if item.get("consumed", False):
            continue
        # Skip items with no name
        if not item.get("name", "").strip():
            continue

        name = item["name"]
        slug = make_slug(name)
        base = slug
        n = 2
        while slug in seen_slugs:
            slug = f"{base}_{n}"
            n += 1
        seen_slugs.add(slug)

        stats = _parse_stats(item.get("stats") or {})
        description = _strip_html(item.get("description") or "")
        # depth: 1 = basic/starter, 2 = component, 3 = completed/legendary/mythic
        # Items without "from" get depth 1 (starters). depth field may not always be present.
        depth = item.get("depth", 1 if not item.get("from") else 2)

        items.append({
            "id": int(item_id),
            "name": name,
            "key": slug,
            "tags": item.get("tags", []),
            "image_url": f"{DDRAGON_BASE}/cdn/{version}/img/item/{item_id}.png",
            "depth": depth,
            "stats": stats,
            "description": description,
        })

    items.sort(key=lambda i: i["name"])
    return items


CHAMPIONS_SCHEMA = {
    "_description": (
        "Champion-Datenbank fuer AI-Kontext-Injection. "
        "Jeder Champion-Eintrag ist ein freies Key-Value Objekt. "
        "Nur 'id' und 'name' sind Pflicht. "
        "Alle anderen Felder sind optional — fehlende Felder bedeuten weniger AI-Kontext, nicht Fehler. "
        "'attack_type' und 'tags' kommen aus der Riot API und sollten nicht manuell veraendert werden."
    ),
    "_keys": {
        "id": "Champion-ID gemaess Riot API (integer)",
        "name": "Anzeigename des Champions (string)",
        "attack_type": "Angriffstyp aus Riot API: 'melee' oder 'ranged' (attackrange >= 350 = ranged)",
        "tags": (
            "Riot-Klassen-Tags (array, aus Riot API). "
            "Moegliche Werte: Fighter, Tank, Mage, Assassin, Marksman, Support"
        ),
        "general": (
            "Allgemeiner Freitext-Kontext. "
            "Immer injected wenn der Champion im Spiel ist, unabhaengig von Lane oder Items."
        ),
        "role_top": "Kontext spezifisch fuer diesen Champion auf der Top-Lane.",
        "role_jungle": "Kontext spezifisch fuer diesen Champion als Jungler.",
        "role_mid": "Kontext spezifisch fuer diesen Champion auf der Mid-Lane.",
        "role_adc": "Kontext spezifisch fuer diesen Champion als ADC.",
        "role_support": "Kontext spezifisch fuer diesen Champion als Support.",
        "matchup_<champname>": (
            "Kontext wenn BEIDE Champions gleichzeitig im Spiel sind. "
            "champname ist der Riot-Name lowercase, Leerzeichen als Unterstrich. "
            "Beispiele: matchup_zed, matchup_miss_fortune, matchup_lee_sin"
        ),
        "item_<itemkey>": (
            "Kontext injected wenn der Champion dieses Item GEBAUT hat. "
            "itemkey kommt aus items.json (.key Feld). "
            "Beispiele: item_trinity_force, item_zhonyas_hourglass"
        ),
        "item_core_<itemkey>": (
            "Kontext der IMMER injected wird wenn der Champion im Spiel ist, "
            "egal ob das Item gebaut wurde oder nicht. "
            "Gedacht fuer: Items die so fundamental fuer das Spielverstaendnis des Champions sind "
            "dass der Kontext immer relevant ist — z.B. 'dieser Champion sollte nie X kaufen', "
            "'X ist der wichtigste Powerspike', 'ohne X funktioniert das Kit nicht'. "
            "itemkey kommt aus items.json (.key Feld). "
            "Beispiele: item_core_trinity_force, item_core_sunfire_aegis"
        ),
    },
}

ITEMS_SCHEMA = {
    "_description": (
        "Item-Datenbank fuer ID-Aufloesung und AI-Kontext-Injection. "
        "Gleiche Architektur wie champions.json. "
        "'key' ist der Slug der als Lookup-Key in Champion-Eintraegen verwendet wird "
        "(item_<key> oder item_core_<key>). "
        "Neue Items koennen manuell als Objekt hinzugefuegt werden."
    ),
    "_keys": {
        "id": "Item-ID gemaess Riot API (integer)",
        "name": "Anzeigename des Items (string)",
        "key": (
            "Slug fuer Champion-Eintraege: item_<key> oder item_core_<key>. "
            "Lowercase, Sonderzeichen entfernt, Leerzeichen als Unterstrich. "
            "Beispiele: trinity_force, zhonyas_hourglass, infinity_edge"
        ),
        "tags": (
            "Riot-Item-Tags (array, aus Riot API). "
            "Moegliche Werte: Damage, CriticalStrike, SpellDamage, Armor, SpellBlock, "
            "Health, Mana, AttackSpeed, LifeSteal, NonbootsMovement, ArmorPenetration, "
            "MagicPenetration, AbilityHaste, Tenacity, OnHit, Consumable"
        ),
        "image_url": (
            "Vollstaendige URL zum Item-Icon auf dem Riot Data Dragon CDN. "
            "Format: https://ddragon.leagueoflegends.com/cdn/{version}/img/item/{id}.png"
        ),
        "notes": (
            "Optionale manuelle Anmerkung zum Item. "
            "Nur fuer Menschen — wird NICHT automatisch in AI-Kontext injected."
        ),
    },
}

RUNES_SCHEMA = {
    "_description": (
        "Rune-Datenbank mit allen Rune-Trees und einzelnen Runen aus der Riot Data Dragon API. "
        "Wird fuer ID-Aufloesung im Backend-Mapper verwendet. "
        "Nicht manuell bearbeiten — wird vom fetch-Script regeneriert."
    ),
    "_keys": {
        "trees": "Liste aller Rune-Trees (id, name, icon_url).",
        "runes": "Flache Liste aller Runen (id, name, icon_url).",
    },
}


def fetch_runes(version: str) -> dict:
    data = fetch_json(f"{DDRAGON_BASE}/cdn/{version}/data/en_US/runesReforged.json")
    trees = []
    runes = []
    for tree in data:
        trees.append({
            "id": tree["id"],
            "name": tree["name"],
            "icon_url": f"{DDRAGON_BASE}/cdn/img/{tree['icon']}",
        })
        for slot in tree.get("slots", []):
            for rune in slot.get("runes", []):
                runes.append({
                    "id": rune["id"],
                    "name": rune["name"],
                    "icon_url": f"{DDRAGON_BASE}/cdn/img/{rune['icon']}",
                })
    return {"trees": trees, "runes": runes}


def main() -> None:
    print("=== fetch_game_data.py ===\n")

    print("1. Fetching latest LoL patch version...")
    version = get_latest_version()
    print(f"   Version: {version}\n")

    print("2. Backing up existing files...")
    backup_file(CHAMPIONS_FILE)
    backup_file(ITEMS_FILE)
    backup_file(RUNES_FILE)
    ensure_gitignore_entry()
    print()

    print("3. Fetching champion data...")
    champions = fetch_champions(version)
    print(f"   {len(champions)} champions loaded\n")

    print("4. Fetching item data...")
    items = fetch_items(version)
    print(f"   {len(items)} SR items loaded (incl. components + starters)\n")

    print("5. Fetching rune data...")
    runes = fetch_runes(version)
    print(f"   {len(runes['trees'])} trees, {len(runes['runes'])} runes loaded\n")

    print("6. Writing files...")
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    with open(CHAMPIONS_FILE, "w", encoding="utf-8") as f:
        json.dump({"_schema": CHAMPIONS_SCHEMA, "champions": champions}, f, ensure_ascii=False, indent=2)
    print(f"   Written: {CHAMPIONS_FILE}")

    with open(ITEMS_FILE, "w", encoding="utf-8") as f:
        json.dump({"_schema": ITEMS_SCHEMA, "items": items}, f, ensure_ascii=False, indent=2)
    print(f"   Written: {ITEMS_FILE}")

    with open(RUNES_FILE, "w", encoding="utf-8") as f:
        json.dump({"_schema": RUNES_SCHEMA, **runes}, f, ensure_ascii=False, indent=2)
    print(f"   Written: {RUNES_FILE}")

    print("\nDone.")


if __name__ == "__main__":
    main()
