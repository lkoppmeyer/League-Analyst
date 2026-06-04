import { FormEvent, useEffect, useRef, useState } from 'react';
import { ChatMessage } from '../types';

type Props = {
  messages: ChatMessage[];
  onSend: (message: string, persona: string, modelMode: 'economy' | 'best') => void;
};

export default function ChatPanel({ messages, onSend }: Props) {
  const [prompt, setPrompt] = useState('');
  const [persona, setPersona] = useState('Profi Esports Analyst');
  const [modelMode, setModelMode] = useState<'economy' | 'best'>('economy');
  const historyRef = useRef<HTMLDivElement | null>(null);

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
            <option>Profi Esports Analyst</option>
            <option>Challenger Soloq Spieler</option>
            <option>Leidenschaftlicher Low Elo Spieler</option>
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
