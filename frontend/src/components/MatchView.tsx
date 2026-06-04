import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import LoadingScreen from './LoadingScreen';
import ChatPanel from './ChatPanel';
import { BACKEND_URL } from '../config';
import { ChatMessage, MatchData, Persona, Player } from '../types';

export default function MatchView() {
  const { matchId = '' } = useParams();
  const [searchParams] = useSearchParams();

  const gameName = searchParams.get('gameName') || '';
  const tagLine = searchParams.get('tagLine') || '';
  const puuid = searchParams.get('puuid') || '';
  const summoner = gameName && tagLine ? `${gameName}#${tagLine}` : '';

  const [matchData, setMatchData] = useState<MatchData | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 'm1', author: 'assistant', text: 'Match wird geladen…' },
  ]);

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/ask/personas`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: Persona[]) => setPersonas(data))
      .catch((err) => console.error('Konnte Personas nicht laden', err));
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${BACKEND_URL}/api/match/${matchId}`);
        const json = await res.json();
        if (!res.ok || !json.success || !json.data) {
          throw new Error(json.error || `HTTP ${res.status}`);
        }
        if (cancelled) return;
        setMatchData(json.data);
        setMessages([
          {
            id: 'm1',
            author: 'assistant',
            text: summoner
              ? `Spiel geladen. Frag mich was zu diesem Match, ${summoner}.`
              : 'Spiel geladen. Frag mich was zu diesem Match.',
          },
        ]);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Fehler beim Laden');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [matchId, summoner]);

  function handlePlayerClick(player: Player) {
    setSelectedPlayer(player);
  }

  async function handleSendPrompt(prompt: string, persona: string, modelMode: 'economy' | 'best') {
    setMessages((current) => [
      ...current,
      { id: `m${current.length + 1}`, author: 'user', text: prompt },
      { id: `m${current.length + 2}`, author: 'assistant', text: 'Antwort wird generiert…' },
    ]);

    try {
      const res = await fetch(`${BACKEND_URL}/api/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userPrompt: prompt, persona, modelMode, matchData, summoner, puuid }),
      });
      const text = await res.text();
      const assistantText = res.ok ? text : `Fehler vom AI-Service: ${text}`;
      setMessages((current) => [
        ...current.slice(0, -1),
        { id: `m${current.length}`, author: 'assistant', text: assistantText },
      ]);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unbekannter Fehler';
      setMessages((current) => [
        ...current.slice(0, -1),
        { id: `m${current.length}`, author: 'assistant', text: `Fehler: ${errorMsg}` },
      ]);
    }
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="header-row">
          <div>
            <h1>Match Analyst</h1>
            <p>
              {summoner ? `${summoner} · ` : ''}
              Match {matchId}
            </p>
          </div>
          <Link className="back-link" to="/">
            ← Zurück zur Suche
          </Link>
        </div>
      </header>

      {error && <div className="error-banner">⚠️ {error}</div>}
      {loading && <div className="muted">Lade Match-Daten…</div>}

      <main className="main-grid">
        <div className="left-panel">
          <LoadingScreen matchData={matchData} onPlayerClick={handlePlayerClick} />
          {selectedPlayer ? (
            <div className="player-detail-card">
              <h2>{selectedPlayer.name}</h2>
              <p>Rolle: {selectedPlayer.role}</p>
              <p>
                Team:{' '}
                {selectedPlayer.team === 'blue'
                  ? matchData?.blueTeam.name
                  : matchData?.redTeam.name}
              </p>
              {selectedPlayer.championName && <p>Champion: {selectedPlayer.championName}</p>}
              {selectedPlayer.kills !== undefined && (
                <p>
                  KDA: {selectedPlayer.kills}/{selectedPlayer.deaths}/{selectedPlayer.assists}
                </p>
              )}
              {selectedPlayer.goldEarned !== undefined && (
                <p>Gold: {(selectedPlayer.goldEarned / 1000).toFixed(1)}k</p>
              )}
            </div>
          ) : (
            <div className="player-detail-card empty">
              Klicke auf einen Spieler, um Details anzuzeigen.
            </div>
          )}
        </div>

        <div className="right-panel">
          <ChatPanel messages={messages} personas={personas} onSend={handleSendPrompt} />
        </div>
      </main>
    </div>
  );
}
