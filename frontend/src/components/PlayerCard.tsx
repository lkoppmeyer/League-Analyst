import { useState } from 'react';
import { Player } from '../types';

type Props = {
  player: Player;
  onClick: (player: Player) => void;
};

function buildChampionUrl(championName?: string) {
  if (!championName) return '';
  // Normalize: remove spaces and non-alphanumeric characters
  const key = championName.replace(/[^a-zA-Z0-9]/g, '');
  // Use a recent CDN version; could be made dynamic later
  const version = '13.16.1';
  return `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${key}.png`;
}

export default function PlayerCard({ player, onClick }: Props) {
  const [imgError, setImgError] = useState(false);
  const src = player.portraitUrl || buildChampionUrl(player.championName);

  return (
    <button className="player-card" onClick={() => onClick(player)}>
      <div className="player-avatar">
        {!imgError && src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={player.championName || player.name}
            onError={() => setImgError(true)}
            style={{ width: 48, height: 48, borderRadius: 6, objectFit: 'cover' }}
          />
        ) : (
          <div className="player-initial">{player.championName ? player.championName.charAt(0) : player.name.charAt(0)}</div>
        )}
      </div>
      <div className="player-info">
        <span className="player-name">{player.name}</span>
        <span className="player-role">{player.role}{player.championName ? ` · ${player.championName}` : ''}</span>
      </div>
    </button>
  );
}
