import { useState, useEffect } from 'react';
import { MatchData, Player, ItemData } from '../types';
import ItemTooltip from './ItemTooltip';
import RuneTooltip from './RuneTooltip';
import { BACKEND_URL } from '../config';

const DDRAGON_VERSION = '16.11.1';
const DDRAGON_BASE = 'https://ddragon.leagueoflegends.com';

function champImageUrl(championName: string) {
  const key = championName.replace(/[^a-zA-Z0-9]/g, '');
  return `${DDRAGON_BASE}/cdn/${DDRAGON_VERSION}/img/champion/${key}.png`;
}

type Props = {
  player: Player;
  matchData: MatchData | null;
  laneScore?: number;
};

function FallbackImg({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [err, setErr] = useState(false);
  if (err) return <div className={`img-placeholder ${className ?? ''}`}>{alt[0]}</div>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className={className} onError={() => setErr(true)} />;
}

// Module-level cache so we fetch items.json only once across all PlayerDetail renders
let itemMapCache: Map<number, ItemData> | null = null;
let itemMapPromise: Promise<Map<number, ItemData>> | null = null;

function loadItemMap(): Promise<Map<number, ItemData>> {
  if (itemMapCache) return Promise.resolve(itemMapCache);
  if (!itemMapPromise) {
    itemMapPromise = fetch(`${BACKEND_URL}/api/items`)
      .then((r) => r.json())
      .then((items: ItemData[]) => {
        itemMapCache = new Map(items.map((i) => [i.id, i]));
        return itemMapCache;
      });
  }
  return itemMapPromise;
}

export default function PlayerDetail({ player, matchData, laneScore }: Props) {
  const [itemMap, setItemMap] = useState<Map<number, ItemData>>(itemMapCache ?? new Map());

  useEffect(() => {
    if (itemMapCache) return;
    loadItemMap().then(setItemMap);
  }, []);

  const teamName =
    player.team === 'blue' ? matchData?.blueTeam.name : matchData?.redTeam.name;

  const csPerMin =
    player.minionsKilled && matchData?.gameDuration
      ? (player.minionsKilled / (matchData.gameDuration / 60)).toFixed(1)
      : null;

  return (
    <div className="player-detail-card">
      {/* Header */}
      <div className="pd-header">
        {player.championName && (
          <FallbackImg
            src={champImageUrl(player.championName)}
            alt={player.championName}
            className="pd-champ-icon"
          />
        )}
        <div className="pd-header-info">
          <span className="pd-player-name">{player.name}</span>
          <span className="pd-meta">
            {player.role}
            {player.championName ? ` · ${player.championName}` : ''}
            {player.champLevel ? ` · Lvl ${player.champLevel}` : ''}
          </span>
          {teamName && <span className="pd-team">{teamName}</span>}
        </div>
      </div>

      {/* Stats */}
      {player.kills !== undefined && (
        <div className="pd-stats">
          <div className="pd-stat">
            <span className="pd-stat-label">KDA</span>
            <span className="pd-stat-value">
              {player.kills}/{player.deaths}/{player.assists}
            </span>
          </div>
          {player.goldEarned !== undefined && (
            <div className="pd-stat">
              <span className="pd-stat-label">Gold</span>
              <span className="pd-stat-value">{(player.goldEarned / 1000).toFixed(1)}k</span>
            </div>
          )}
          {csPerMin && (
            <div className="pd-stat">
              <span className="pd-stat-label">CS/min</span>
              <span className="pd-stat-value">{csPerMin}</span>
            </div>
          )}
          {laneScore !== undefined && (
            <div className="pd-stat">
              <span className="pd-stat-label">Lane</span>
              <span className="pd-stat-value pd-lane-score" title={`${laneScore}/5`}>
                {[1,2,3,4,5].map((i) => (
                  <span key={i} className={i <= laneScore ? 'dot dot--filled' : 'dot dot--empty'}>●</span>
                ))}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Runes */}
      {player.runes && (player.runes.keystone || player.runes.secondaryTree) && (
        <div className="pd-section">
          <span className="pd-section-label">Runen</span>
          <div className="pd-runes">
            {player.runes.keystone && (
              <div className="pd-rune-entry">
                <RuneTooltip rune={player.runes.keystone} className="pd-rune-icon" />
                <span className="pd-rune-name">{player.runes.keystone.name}</span>
              </div>
            )}
            {player.runes.secondaryTree && (
              <div className="pd-rune-entry secondary">
                <RuneTooltip rune={player.runes.secondaryTree} className="pd-rune-icon small" small />
                <span className="pd-rune-name muted">{player.runes.secondaryTree.name}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Items with tooltips */}
      {player.items && player.items.length > 0 && (
        <div className="pd-section">
          <span className="pd-section-label">Items</span>
          <div className="pd-items">
            {player.items.map((id) => (
              <ItemTooltip key={id} itemId={id} itemMap={itemMap} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
