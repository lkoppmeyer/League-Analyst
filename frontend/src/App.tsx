import { useState } from 'react';
import MatchInput from './components/MatchInput';
import LoadingScreen from './components/LoadingScreen';
import ChatPanel from './components/ChatPanel';
import { ChatMessage, MatchData, Player } from './types';

const BACKEND_URL = 'http://localhost:3001';

function App() {
  const [matchId, setMatchId] = useState('');
  const [matchData, setMatchData] = useState<MatchData | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 'm1', author: 'assistant', text: 'Gib eine Match-ID ein, um die Teams zu sehen.' },
  ]);

  async function handleLoadMatch() {
    if (!matchId.trim()) {
      setError('Bitte eine Match-ID eingeben');
      return;
    }

    console.log('Lade Match:', matchId);
    setLoading(true);
    setError(null);
    setSelectedPlayer(null);

    try {
      const response = await fetch(`${BACKEND_URL}/api/match/${matchId}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.success || !data.data) {
        throw new Error(data.error || 'Invalid response from server');
      }

      setMatchData(data.data);
      setMessages((current) => [
        ...current,
        { id: `m${current.length + 1}`, author: 'assistant', text: `Match ${matchId} erfolgreich geladen!` },
      ]);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Fehler beim Laden der Match-Daten';
      setError(errorMsg);
      setMessages((current) => [
        ...current,
        { id: `m${current.length + 1}`, author: 'assistant', text: `Fehler: ${errorMsg}` },
      ]);
      console.error('Error loading match:', err);
    } finally {
      setLoading(false);
    }
  }

  function handlePlayerClick(player: Player) {
    console.log('Player clicked', player);
    setSelectedPlayer(player);
    setMessages((current) => [
      ...current,
      {
        id: `m${current.length + 1}`,
        author: 'assistant',
        text: `Spieler ausgewählt: ${player.name}. Rolle: ${player.role}. Champion: ${player.championName || 'Unbekannt'}.`,
      },
    ]);
  }

  async function handleSendPrompt(prompt: string, persona: string, modelMode: 'economy' | 'best') {
    console.log('Chat prompt:', prompt, persona, modelMode);
    // Append user message immediately
    setMessages((current) => [
      ...current,
      { id: `m${current.length + 1}`, author: 'user', text: prompt },
      { id: `m${current.length + 2}`, author: 'assistant', text: 'Antwort wird generiert…' },
    ]);

    try {
      const body = {
        userPrompt: prompt,
        persona,
        modelMode,
        matchData,
      };

      const res = await fetch(`${BACKEND_URL}/api/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const text = await res.text();
      const assistantText = res.ok ? text : `Fehler vom AI-Service: ${text}`;

      setMessages((current) => [
        // replace the last assistant placeholder
        ...current.slice(0, -1),
        { id: `m${current.length}`, author: 'assistant', text: assistantText },
      ]);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unbekannter Fehler';
      setMessages((current) => [
        ...current.slice(0, -1),
        { id: `m${current.length}`, author: 'assistant', text: `Fehler: ${errorMsg}` },
      ]);
      console.error('AI request failed', err);
    }
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <h1>LoL E-Sports Team Explorer</h1>
          <p>Match-ID eingeben, Teams ansehen und Fragen zum Spiel stellen.</p>
        </div>
      </header>

      <MatchInput 
        matchId={matchId} 
        setMatchId={setMatchId} 
        onLoadMatch={handleLoadMatch}
        loading={loading}
      />

      {error && (
        <div style={{
          padding: '12px 16px',
          margin: '0 16px',
          backgroundColor: '#fee',
          color: '#c33',
          borderRadius: '4px',
          border: '1px solid #fcc',
        }}>
          ⚠️ {error}
        </div>
      )}

      <main className="main-grid">
        <div className="left-panel">
          <LoadingScreen matchData={matchData} onPlayerClick={handlePlayerClick} />
          {selectedPlayer ? (
            <div className="player-detail-card">
              <h2>{selectedPlayer.name}</h2>
              <p>Rolle: {selectedPlayer.role}</p>
              <p>Team: {selectedPlayer.team === 'blue' ? matchData?.blueTeam.name : matchData?.redTeam.name}</p>
              {selectedPlayer.championName && <p>Champion: {selectedPlayer.championName}</p>}
              {selectedPlayer.kills !== undefined && (
                <p>KDA: {selectedPlayer.kills}/{selectedPlayer.deaths}/{selectedPlayer.assists}</p>
              )}
              {selectedPlayer.goldEarned !== undefined && (
                <p>Gold: {(selectedPlayer.goldEarned / 1000).toFixed(1)}k</p>
              )}
            </div>
          ) : (
            <div className="player-detail-card empty">Klicke auf einen Spieler, um Details anzuzeigen.</div>
          )}
        </div>

        <div className="right-panel">
          <ChatPanel messages={messages} onSend={handleSendPrompt} />
        </div>
      </main>
    </div>
  );
}

export default App;
