import { FormEvent, useEffect, useRef, useState } from 'react';
import { ChatMessage, ModelOption, Persona } from '../types';

type Props = {
  messages: ChatMessage[];
  personas: Persona[];
  models: ModelOption[];
  onSend: (message: string, persona: string, modelMode: string, useContextFilter: boolean) => void;
};

export default function ChatPanel({ messages, personas, models, onSend }: Props) {
  const [prompt, setPrompt] = useState('');
  const [persona, setPersona] = useState('');
  const [modelMode, setModelMode] = useState('');
  const [useContextFilter, setUseContextFilter] = useState(false);
  const historyRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!persona && personas.length > 0) setPersona(personas[0].id);
  }, [personas, persona]);

  useEffect(() => {
    if (!modelMode && models.length > 0) {
      const preferred = models.find((m) => m.id === 'balanced') ?? models[0];
      setModelMode(preferred.id);
    }
  }, [models, modelMode]);

  useEffect(() => {
    const el = historyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!prompt.trim()) return;
    onSend(prompt.trim(), persona, modelMode, useContextFilter);
    setPrompt('');
  }

  return (
    <section className="chat-panel">
      <div className="chat-header">Match Chat</div>
      <div className="chat-controls">
        <label className="ctrl-label">
          Persona
          <select value={persona} onChange={(e) => setPersona(e.target.value)}>
            {personas.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </label>
        <label className="ctrl-label">
          Modell
          <select value={modelMode} onChange={(e) => setModelMode(e.target.value)}>
            {models.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </label>
        <label className="ctrl-label ctrl-label--inline">
          <input
            type="checkbox"
            checked={useContextFilter}
            onChange={(e) => setUseContextFilter(e.target.checked)}
          />
          Smart Context
          <span className="info-icon" data-tooltip="Nutzt einen AI-Agent um nur relevante Daten für die Frage auszuwählen">ⓘ</span>
        </label>
      </div>

      <div className="chat-history" ref={historyRef}>
        {messages.map((message) => (
          <div key={message.id} className={`chat-message ${message.author}`}>
            <span>{message.text}</span>
          </div>
        ))}
      </div>
      <form className="chat-form" onSubmit={handleSubmit}>
        <input
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="Frage zum Spiel: z.B. Wer ist Favorit?"
        />
        <button type="submit">Senden</button>
      </form>
    </section>
  );
}
