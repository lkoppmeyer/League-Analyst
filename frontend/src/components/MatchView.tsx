import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import LoadingScreen from './LoadingScreen';
import ChatPanel from './ChatPanel';
import PlayerDetail from './PlayerDetail';
import { BACKEND_URL } from '../config';
import { ChatMessage, MatchData, ModelOption, Persona, Player } from '../types';
import { toReadable } from '../utils/matchReadable';

export default function MatchView() {
  const { matchId = '' } = useParams();
  const [searchParams] = useSearchParams();

  const gameName = searchParams.get('gameName') || '';
  const tagLine  = searchParams.get('tagLine')  || '';
  const puuid    = searchParams.get('puuid')    || '';
  const summoner = gameName && tagLine ? `${gameName}#${tagLine}` : '';

  const [matchData, setMatchData]       = useState<MatchData | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [personas, setPersonas]         = useState<Persona[]>([]);
  const [models, setModels]             = useState<ModelOption[]>([]);
  const [messages, setMessages]         = useState<ChatMessage[]>([
    { id: 'm1', author: 'assistant', text: 'Match wird geladen…' },
  ]);
  const [preAnalysis, setPreAnalysis]   = useState<string>('');
  const [laneScores, setLaneScores]     = useState<Record<string, number>>({});
  const [analyzeState, setAnalyzeState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [analyzeStep, setAnalyzeStep]         = useState<string>('');
  const [analyzeProgress, setAnalyzeProgress] = useState<number>(0);
  const [analyzeError, setAnalyzeError]       = useState<string>('');
  const [selectedPersona, setSelectedPersona] = useState<string>('');
  const [selectedModel, setSelectedModel]     = useState<string>('balanced');
  const [debugData, setDebugData]       = useState<string | null>(null);
  const [readableData, setReadableData] = useState<string | null>(null);
  const [debugMode, setDebugMode]       = useState<'raw' | 'readable'>('readable');
  const [defaultReadable, setDefaultReadable] = useState(true);

  // Abort controller for the in-flight analyze request
  const analyzeAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/ask/personas`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: Persona[]) => setPersonas(data))
      .catch((err) => console.error('Konnte Personas nicht laden', err));
    fetch(`${BACKEND_URL}/api/ask/models`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: ModelOption[]) => setModels(data))
      .catch((err) => console.error('Konnte Modelle nicht laden', err));
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res  = await fetch(`${BACKEND_URL}/api/match/${matchId}`);
        const json = await res.json();
        if (!res.ok || !json.success || !json.data) {
          throw new Error(json.error || `HTTP ${res.status}`);
        }
        if (cancelled) return;
        setMatchData(json.data);
        setMessages([{
          id: 'm1',
          author: 'assistant',
          text: summoner
            ? `Spiel geladen. Frag mich was zu diesem Match, ${summoner}.`
            : 'Spiel geladen. Frag mich was zu diesem Match.',
        }]);
        runAnalysis(json.data, 'balanced');
        fetchEnrichedData(json.data);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Fehler beim Laden');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [matchId, summoner]);

  // Clean up on unmount
  useEffect(() => () => { analyzeAbortRef.current?.abort(); }, []);

  async function fetchEnrichedData(data: MatchData) {
    try {
      const res      = await fetch(`${BACKEND_URL}/api/ask/debug/enriched`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchData: data }),
      });
      const enriched = await res.json();
      setDebugData(JSON.stringify(enriched, null, 2));
      setReadableData(JSON.stringify(toReadable(enriched), null, 2));
    } catch (err) {
      console.warn('[enriched] fetch failed:', err instanceof Error ? err.message : err);
    }
  }

  function handlePlayerClick(player: Player) {
    setSelectedPlayer(player);
  }

  function handleShowMatchData() {
    if (!matchData) return;
    if (!debugData) {
      // Fallback: eager fetch didn't complete yet, trigger now
      setDebugData('// Wird geladen…');
      fetchEnrichedData(matchData).then(() => {
        setDebugMode(defaultReadable && readableData ? 'readable' : 'raw');
      });
    } else {
      setDebugMode(defaultReadable ? 'readable' : 'raw');
    }
  }

  async function runAnalysis(data: MatchData, modelMode: string) {
    analyzeAbortRef.current?.abort();
    const controller = new AbortController();
    analyzeAbortRef.current = controller;

    setAnalyzeState('loading');
    setAnalyzeStep('Starte Analyse…');
    setAnalyzeProgress(0);

    try {
      const res = await fetch(`${BACKEND_URL}/api/ask/analyze`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ matchId: data.matchId, matchData: data, modelMode }),
        signal:  controller.signal,
      });

      if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status}`);
      }

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let   buffer  = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Split on double newline (SSE event separator)
        const events = buffer.split('\n\n');
        buffer = events.pop() ?? '';

        for (const event of events) {
          const dataLine = event.split('\n').find((l) => l.startsWith('data: '));
          if (!dataLine) continue;
          try {
            const payload = JSON.parse(dataLine.slice(6)) as {
              step: string;
              progress: number;
              analysis?: string;
              laneScores?: Record<string, number>;
              cached?: boolean;
              error?: string;
            };

            setAnalyzeStep(payload.step);
            setAnalyzeProgress(payload.progress);

            if (payload.progress === 100 && payload.analysis !== undefined) {
              setPreAnalysis(payload.analysis);
              if (payload.laneScores) setLaneScores(payload.laneScores);
              setAnalyzeState('done');
            } else if (payload.error) {
              setAnalyzeError(payload.error);
              setAnalyzeState('error');
            }
          } catch {
            // Malformed event — ignore
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      const msg = err instanceof Error ? err.message : String(err);
      console.error('Analyse fehlgeschlagen', msg);
      setAnalyzeError(msg);
      setAnalyzeState('error');
      setAnalyzeStep('Fehler bei der Analyse');
    }
  }

  async function handleSendPrompt(prompt: string, persona: string, modelMode: string, useContextFilter: boolean) {
    setSelectedPersona(persona);
    setSelectedModel(modelMode);
    setMessages((current) => [
      ...current,
      { id: `m${current.length + 1}`, author: 'user',      text: prompt },
      { id: `m${current.length + 2}`, author: 'assistant', text: 'Antwort wird generiert…' },
    ]);

    try {
      const res = await fetch(`${BACKEND_URL}/api/ask`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ userPrompt: prompt, persona, modelMode, matchData, summoner, puuid, preAnalysis: preAnalysis || undefined, useContextFilter }),
      });
      const text          = await res.text();
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

  // ── Render ─────────────────────────────────────────────────────────────────

  const isAnalyzing = analyzeState === 'loading';

  function renderAnalyzeArea() {
    if (!matchData) return null;

    if (analyzeState === 'loading') {
      return (
        <div className="analyze-progress-wrapper">
          <span className="analyze-progress-label">{analyzeStep}</span>
          <div className="analyze-progress-track">
            <div
              className="analyze-progress-fill"
              style={{ width: `${analyzeProgress}%` }}
            />
          </div>
        </div>
      );
    }

    if (analyzeState === 'done') {
      return (
        <button
          className="analyze-btn analyze-btn--done"
          onClick={async () => {
            if (!window.confirm('Analyse neu starten? Der Cache wird gelöscht und alles wird frisch generiert.')) return;
            await fetch(`${BACKEND_URL}/api/ask/analyze/${matchData.matchId}`, { method: 'DELETE' });
            setPreAnalysis('');
            setLaneScores({});
            setReadableData(null);
            runAnalysis(matchData, selectedModel);
          }}
          title="Klicken um Analyse neu zu starten"
        >
          ✓ Analyse bereit
        </button>
      );
    }

    if (analyzeState === 'error') {
      return (
        <div className="analyze-error-wrapper">
          <button
            className="analyze-btn analyze-btn--error"
            onClick={() => { setAnalyzeError(''); runAnalysis(matchData, selectedModel); }}
          >
            ⚠ Wiederholen
          </button>
          {analyzeError && (
            <div className="analyze-error-popup">
              <span className="analyze-error-label">Fehler:</span> {analyzeError}
            </div>
          )}
        </div>
      );
    }

    return (
      <button
        className="analyze-btn"
        onClick={() => runAnalysis(matchData, selectedModel)}
      >
        Analyse starten
      </button>
    );
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
          <div className="header-actions">
            {renderAnalyzeArea()}
            {matchData && (
              <div className="debug-btn-group">
                <button
                  className="debug-btn"
                  onClick={handleShowMatchData}
                  disabled={isAnalyzing}
                >
                  Match Data
                </button>
                <label className="debug-readable-toggle" data-tooltip="Öffnet Match Data standardmäßig im lesbaren Format">
                  <input
                    type="checkbox"
                    checked={defaultReadable}
                    onChange={(e) => setDefaultReadable(e.target.checked)}
                  />
                  Lesbar
                </label>
              </div>
            )}
            <Link className="back-link" to="/">
              ← Zurück zur Suche
            </Link>
          </div>
        </div>
      </header>

      {error && <div className="error-banner">⚠️ {error}</div>}
      {loading && <div className="muted">Lade Match-Daten…</div>}

      <main className="main-grid">
        <div className="left-panel">
          <LoadingScreen matchData={matchData} onPlayerClick={handlePlayerClick} />
          {selectedPlayer ? (
            <PlayerDetail player={selectedPlayer} matchData={matchData} laneScore={laneScores[selectedPlayer.name]} />
          ) : (
            <div className="player-detail-card empty">
              Klicke auf einen Spieler, um Details anzuzeigen.
            </div>
          )}
        </div>

        <div className="right-panel">
          <ChatPanel messages={messages} personas={personas} models={models} onSend={handleSendPrompt} />
        </div>
      </main>

      {debugData !== null && (
        <div className="debug-overlay" onClick={() => { setDebugData(null); setReadableData(null); setDebugMode('raw'); }}>
          <div className="debug-panel" onClick={(e) => e.stopPropagation()}>
            <div className="debug-panel-header">
              <span>Match Data</span>
              <div className="debug-toggle">
                <button
                  className={`debug-toggle-btn${debugMode === 'raw' ? ' active' : ''}`}
                  onClick={() => setDebugMode('raw')}
                >
                  Raw
                </button>
                <button
                  className={`debug-toggle-btn${debugMode === 'readable' ? ' active' : ''}`}
                  onClick={() => {
                    setDebugMode('readable');
                    if (!readableData && debugData) {
                      try {
                        setReadableData(JSON.stringify(toReadable(JSON.parse(debugData)), null, 2));
                      } catch {
                        setReadableData('// Fehler beim Parsen der Daten');
                      }
                    }
                  }}
                >
                  Lesbares Format
                </button>
                <span className="info-icon" data-tooltip="Feldnamen werden ins Deutsche übersetzt und logisch sortiert — Werte bleiben unverändert">ⓘ</span>
              </div>
              <button onClick={() => { setDebugData(null); setReadableData(null); setDebugMode('raw'); }}>✕</button>
            </div>
            <pre className="debug-panel-content">
              {debugMode === 'readable' ? (readableData ?? '') : debugData}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
