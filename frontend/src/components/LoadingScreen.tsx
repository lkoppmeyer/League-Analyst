import { Player, MatchData } from '../types';
import PlayerCard from './PlayerCard';

const QUEUE_NAMES: Record<number, string> = {
  400: 'Normal Draft',
  420: 'Ranked Solo/Duo',
  430: 'Normal Blind',
  440: 'Ranked Flex',
  480: 'Swiftplay',
  490: 'Quickplay',
  700: 'Clash',
};

function formatDuration(seconds?: number): string {
  if (!seconds) return '';
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

type Props = {
  matchData: MatchData | null;
  onPlayerClick: (player: Player) => void;
};

export default function LoadingScreen({ matchData, onPlayerClick }: Props) {
  if (!matchData) {
    return (
      <div className="loading-screen placeholder">
        Gib eine Match-ID ein und lade das Spiel.
      </div>
    );
  }

  const blue     = matchData.blueTeam;
  const red      = matchData.redTeam;
  const duration = formatDuration(matchData.gameDuration);
  const queue    = matchData.queueId ? (QUEUE_NAMES[matchData.queueId] ?? `Queue ${matchData.queueId}`) : '';
  const winner   = blue.win ? 'blue' : red.win ? 'red' : null;

  return (
    <div className="loading-screen">

      {/* Match summary bar */}
      {(queue || duration || winner) && (
        <div className="match-summary-bar">
          {queue && <span className="match-summary-queue">{queue}</span>}
          {queue && (duration || winner) && <span className="match-summary-sep">·</span>}
          {duration && <span className="match-summary-duration">{duration}</span>}
          {duration && winner && <span className="match-summary-sep">·</span>}
          {winner === 'blue' && <span className="match-summary-winner blue">Blau gewinnt</span>}
          {winner === 'red'  && <span className="match-summary-winner red">Rot gewinnt</span>}
        </div>
      )}

      {/* Blue team */}
      <div className="team-row">
        <div className="team-header blue">
          <div className="team-header-left">
            <span className="team-dot blue" />
            <span className="team-header-name">Blue Side{blue.name ? ` · ${blue.name}` : ''}</span>
          </div>
          <div className="team-header-right">
            {blue.win !== undefined && (
              <span className={`team-result ${blue.win ? 'victory' : 'defeat'}`}>
                {blue.win ? '✓ Sieg' : '✗ Niederlage'}
              </span>
            )}
            {blue.objectives && (
              <span className="team-objectives">
                {blue.objectives.dragon > 0 && <span>🐉 {blue.objectives.dragon}</span>}
                {blue.objectives.baron > 0  && <span>🟣 {blue.objectives.baron}</span>}
                {blue.objectives.tower > 0  && <span>🗼 {blue.objectives.tower}</span>}
              </span>
            )}
          </div>
        </div>
        <div className="players-grid">
          {matchData.players
            .filter((p) => p.team === 'blue')
            .map((p) => <PlayerCard key={p.id} player={p} onClick={onPlayerClick} />)}
        </div>
      </div>

      {/* Red team */}
      <div className="team-row">
        <div className="team-header red">
          <div className="team-header-left">
            <span className="team-dot red" />
            <span className="team-header-name">Red Side{red.name ? ` · ${red.name}` : ''}</span>
          </div>
          <div className="team-header-right">
            {red.win !== undefined && (
              <span className={`team-result ${red.win ? 'victory' : 'defeat'}`}>
                {red.win ? '✓ Sieg' : '✗ Niederlage'}
              </span>
            )}
            {red.objectives && (
              <span className="team-objectives">
                {red.objectives.dragon > 0 && <span>🐉 {red.objectives.dragon}</span>}
                {red.objectives.baron > 0  && <span>🟣 {red.objectives.baron}</span>}
                {red.objectives.tower > 0  && <span>🗼 {red.objectives.tower}</span>}
              </span>
            )}
          </div>
        </div>
        <div className="players-grid">
          {matchData.players
            .filter((p) => p.team === 'red')
            .map((p) => <PlayerCard key={p.id} player={p} onClick={onPlayerClick} />)}
        </div>
      </div>

    </div>
  );
}
