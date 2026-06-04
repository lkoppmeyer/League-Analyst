// UNUSED — replaced by SearchView (Riot-ID search + match history flow)

import { FormEvent } from 'react';

type Props = {
  matchId: string;
  setMatchId: (value: string) => void;
  onLoadMatch: () => void;
  loading?: boolean;
};

export default function MatchInput({ matchId, setMatchId, onLoadMatch, loading = false }: Props) {
  return (
    <section className="match-input-panel">
      <label htmlFor="match-id">Match-ID eingeben (z.B. EUW1_...)</label>
      <div className="match-input-row">
        <input
          id="match-id"
          value={matchId}
          onChange={(event) => setMatchId(event.target.value)}
          placeholder="z.B. EUW1_12345_ABCDE"
          disabled={loading}
        />
        <button onClick={onLoadMatch} disabled={loading}>
          {loading ? 'Lädt...' : 'Laden'}
        </button>
      </div>
      <small style={{ color: '#666', marginTop: '8px', display: 'block' }}>
        Backend läuft auf http://localhost:3001 | Frontend auf http://localhost:5173
      </small>
    </section>
  );
}
