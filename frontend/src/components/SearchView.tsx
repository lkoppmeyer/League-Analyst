import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BACKEND_URL, REGIONS, queueName, formatDuration, relativeDate } from '../config';
import { ApiResponse, MatchSummary, RiotAccount } from '../types';

export default function SearchView() {
  const navigate = useNavigate();
  const [riotId, setRiotId] = useState('Giarth#0000');
  const [region, setRegion] = useState<string>('europe');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [account, setAccount] = useState<RiotAccount | null>(null);
  const [matches, setMatches] = useState<MatchSummary[]>([]);

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const [gameName, tagLine] = riotId.split('#').map((s) => s.trim());
    if (!gameName || !tagLine) {
      setError('Bitte Riot-ID im Format Name#Tag eingeben, z.B. Giarth#0000');
      return;
    }

    setLoading(true);
    setError(null);
    setMatches([]);
    setAccount(null);

    try {
      const accRes = await fetch(
        `${BACKEND_URL}/api/summoner/account/${encodeURIComponent(gameName)}/${encodeURIComponent(
          tagLine
        )}?region=${region}`
      );
      const accJson: ApiResponse<RiotAccount> = await accRes.json();
      if (!accJson.success || !accJson.data) {
        throw new Error(accJson.error || 'Spieler nicht gefunden');
      }
      const acc = accJson.data;
      setAccount(acc);

      const histRes = await fetch(
        `${BACKEND_URL}/api/summoner/history/${acc.puuid}?region=${region}`
      );
      const histJson: ApiResponse<MatchSummary[]> = await histRes.json();
      if (!histJson.success || !histJson.data) {
        throw new Error(histJson.error || 'Match-History konnte nicht geladen werden');
      }
      setMatches(histJson.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler bei der Suche');
    } finally {
      setLoading(false);
    }
  }

  function openMatch(matchId: string) {
    if (!account) return;
    const params = new URLSearchParams({
      gameName: account.gameName,
      tagLine: account.tagLine,
      puuid: account.puuid,
      region,
    });
    navigate(`/match/${matchId}?${params.toString()}`);
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>LoL Match Analyst</h1>
        <p>Gib deine Riot-ID ein, wähle ein Spiel und lass es analysieren.</p>
      </header>

      <form className="search-form" onSubmit={handleSearch}>
        <input
          value={riotId}
          onChange={(e) => setRiotId(e.target.value)}
          placeholder="Riot-ID, z.B. Giarth#0000"
          aria-label="Riot-ID"
        />
        <select value={region} onChange={(e) => setRegion(e.target.value)} aria-label="Region">
          {REGIONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        <button type="submit" disabled={loading}>
          {loading ? 'Lädt…' : 'Match-History laden'}
        </button>
      </form>

      {error && <div className="error-banner">⚠️ {error}</div>}

      {account && !loading && matches.length === 0 && !error && (
        <p className="muted">Keine Summoner’s-Rift-Spiele in den letzten Matches gefunden.</p>
      )}

      <div className="match-history">
        {matches.map((m) => (
          <button
            key={m.matchId}
            className={`history-card ${m.win ? 'win' : 'loss'}`}
            onClick={() => openMatch(m.matchId)}
          >
            <span className="history-result">{m.win ? 'Sieg' : 'Niederlage'}</span>
            <span className="history-champ">{m.championName || 'Unbekannt'}</span>
            <span className="history-role">{m.role}</span>
            <span className="history-kda">
              {m.kills}/{m.deaths}/{m.assists}
            </span>
            <span className="history-meta">
              {queueName(m.queueId)} · {formatDuration(m.gameDuration)} · {relativeDate(m.gameCreation)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
