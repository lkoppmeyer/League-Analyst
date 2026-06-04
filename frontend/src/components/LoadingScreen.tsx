import { Player, MatchData } from '../types';
import PlayerCard from './PlayerCard';

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

  return (
    <div className="loading-screen">
      <div className="team-row blue-team">
        <div className="team-title">Blue Side: {matchData.blueTeam.name}</div>
        <div className="players-grid">
          {matchData.players
            .filter((player) => player.team === 'blue')
            .map((player) => (
              <PlayerCard key={player.id} player={player} onClick={onPlayerClick} />
            ))}
        </div>
      </div>

      <div className="team-row red-team">
        <div className="team-title">Red Side: {matchData.redTeam.name}</div>
        <div className="players-grid">
          {matchData.players
            .filter((player) => player.team === 'red')
            .map((player) => (
              <PlayerCard key={player.id} player={player} onClick={onPlayerClick} />
            ))}
        </div>
      </div>
    </div>
  );
}
