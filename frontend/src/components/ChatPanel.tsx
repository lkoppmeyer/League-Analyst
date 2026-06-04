import { FormEvent, useEffect, useRef, useState } from 'react';
import { ChatMessage, Persona } from '../types';

type Props = {
  messages: ChatMessage[];
  personas: Persona[];
  onSend: (message: string, persona: string, modelMode: 'economy' | 'best') => void;
};

export default function ChatPanel({ messages, personas, onSend }: Props) {
  const [prompt, setPrompt] = useState('');
  const [persona, setPersona] = useState('');
  const [modelMode, setModelMode] = useState<'economy' | 'best'>('economy');
  const historyRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Default to the first persona once they're loaded.
    if (!persona && personas.length > 0) {
      setPersona(personas[0].id);
    }
  }, [personas, persona]);

  useEffect(() => {
    // Auto-scroll to bottom when messages change
    const el = historyRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!prompt.trim()) return;
    onSend(prompt.trim(), persona, modelMode);
    setPrompt('');
  }

  return (
    <section className="chat-panel">
      <div className="chat-header">Match Chat</div>
      <div className="chat-controls">
        <label>
          Persona:
          <select value={persona} onChange={(e) => setPersona(e.target.value)}>
            {personas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label style={{ marginLeft: 12 }}>
          Modell:
          <select value={modelMode} onChange={(e) => setModelMode(e.target.value as any)}>
            <option value="economy">Sparsames Modell</option>
            <option value="best">Bestmögliches Modell</option>
          </select>
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
