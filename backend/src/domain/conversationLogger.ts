import { appendFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const logsDir = join(dirname(dirname(fileURLToPath(import.meta.url))), '..', 'logs');

mkdirSync(logsDir, { recursive: true });

export type ConversationEntry = {
  timestamp: string;
  matchId: string;
  summoner?: string;
  persona: string;
  model: string;
  systemPrompt: string;
  userMessage: string;
  response: string;
};

const SEP = '='.repeat(80);
const DIV = '─'.repeat(80);

function format(entry: ConversationEntry): string {
  const header = [entry.matchId, entry.summoner, entry.persona, entry.model]
    .filter(Boolean)
    .join(' | ');

  return [
    SEP,
    `[${entry.timestamp}]  ${header}`,
    SEP,
    '',
    'SYSTEM PROMPT:',
    DIV,
    entry.systemPrompt,
    '',
    'USER MESSAGE:',
    DIV,
    entry.userMessage,
    '',
    'RESPONSE:',
    DIV,
    entry.response,
    '',
    '',
  ].join('\n');
}

/**
 * Appends one Q&A entry to logs/<matchId>.log as human-readable text.
 * Never overwrites — always appends.
 * Silent on error so logging never breaks the response path.
 */
export function logConversation(entry: ConversationEntry): void {
  try {
    const file = join(logsDir, `${sanitize(entry.matchId)}.log`);
    appendFileSync(file, format(entry), 'utf-8');
  } catch (err) {
    console.error('[ConversationLogger] Failed to write log:', err);
  }
}

function sanitize(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, '_');
}
