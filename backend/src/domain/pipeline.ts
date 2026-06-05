// ---------------------------------------------------------------------------
// pipeline.ts
//
// THE single place to understand how match data is processed end-to-end.
//
// Two phases, clearly separated:
//
//   Phase 1 │ LOGICAL PROCESSING  — pure TypeScript, deterministic, no AI
//           │ Extracts structured facts from raw data.
//           │ Change by editing the .ts source files.
//           │
//   Phase 2 │ AI INTERPRETATION   — LLM agents, defined by .md prompt files
//           │ Recognises patterns, produces narrative analysis.
//           │ Change by editing the .md files in prompts/
//
// ---------------------------------------------------------------------------

import { enrichMatchData, buildChampionContextBlock } from './matchEnricher.js';
import { buildTimelineContext } from './timelineFormatter.js';
import { timelineAgent, preAnalysisAgent, laneScoreAgent, contextFilterAgent, chatAgent } from './agents.js';
import { logConversation } from './conversationLogger.js';
import type { MatchData } from '../types/app.js';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

export function getOpenAIKey(): string {
  const key = process.env.OPENAI_API_KEY || process.env.OPENAI || process.env.OPENAI_KEY;
  if (!key) throw new Error('OpenAI API key not configured');
  return key;
}

function buildViewerContext(matchData: MatchData, summoner?: string, puuid?: string): string {
  const player = matchData.players?.find(
    (p) => (puuid && p.id === puuid) || (summoner && p.name === summoner),
  );
  if (!player) return '';
  const side  = player.team === 'blue' ? 'blauen' : 'roten';
  const champ = player.championName ? ` und spielt ${player.championName}` : '';
  return `Der Nutzer ist ${summoner || player.name}, spielt ${player.role} im ${side} Team${champ}. Wenn es passt, sprich ihn direkt an.`;
}

// ---------------------------------------------------------------------------
// Analysis Pipeline
// Called once per match. Result is cached by the caller (aiRoutes).
// ---------------------------------------------------------------------------

export type StepCallback = (step: string, progress: number) => void;

/**
 * Runs the full one-shot match analysis and returns a markdown string.
 *
 * @param matchData  Raw match data from Riot API (players, teams, optional timeline).
 *                   matchData.timeline is populated when the client fetched the timeline endpoint.
 *                   Without it, Phase 2 skips the timelineAgent and preAnalysisAgent
 *                   gets only end-of-game stats.
 *
 * @param modelId    OpenAI model ID used for the pre-analysis agent ("gpt-4o", "gpt-4o-mini", …).
 *                   The timeline agent always uses gpt-4o-mini regardless.
 *
 * @param onStep     Progress callback — called before each major step with a
 *                   German status label and a 0-100 progress value.
 *
 * Returns: `analysis` — markdown string with sections defined in prompts/preanalysis.md.
 *          `laneScores` — per-player lane score 1–5 keyed by player name (empty object if agent failed).
 *
 * DATA FLOW
 *   matchData
 *     → enrichMatchData()          Phase 1  structured facts per player/team
 *     → buildChampionContextBlock() Phase 1  DB context text for system prompt
 *     → buildTimelineContext()      Phase 1  fight/objective/lane facts (null if no timeline)
 *         → timelineAgent()         Phase 2  narrative text injected into pre-analysis
 *     → preAnalysisAgent()          Phase 2  final markdown analysis (return value)
 */
export async function runAnalysisPipeline(
  matchData: MatchData,
  modelId: string,
  onStep: StepCallback,
): Promise<{ analysis: string; laneScores: Record<string, number> }> {
  const key = getOpenAIKey();

  // ── Phase 1: Logical Processing ────────────────────────────────────────────
  onStep('Spieldaten werden aufbereitet…', 15);
  const enriched     = enrichMatchData(matchData);

  onStep('Champions werden identifiziert…', 25);
  const champContext = buildChampionContextBlock(matchData);
  const timelineCtx  = buildTimelineContext(matchData);     // null if no timeline data

  // ── Phase 2: AI Interpretation ─────────────────────────────────────────────
  let timelineNarrative = '';
  if (timelineCtx) {
    onStep('Timeline wird ausgewertet…', 35);
    try {
      timelineNarrative = await timelineAgent(timelineCtx, key);
    } catch (err) {
      console.warn('[pipeline] Timeline agent failed, skipping:', (err as Error).message);
    }
  }

  onStep('Spiel wird analysiert…', 65);
  const [analysis, laneScores] = await Promise.all([
    preAnalysisAgent(enriched, champContext, timelineNarrative, modelId, key),
    laneScoreAgent(enriched, key),
  ]);
  return { analysis, laneScores };
}

// ---------------------------------------------------------------------------
// Chat Pipeline
// Called for every user question in the chat.
// ---------------------------------------------------------------------------

export interface ChatOptions {
  /** Loaded persona text from prompts/personas/<name>.md — injected into system prompt */
  persona: string;
  /** OpenAI model ID ("gpt-4o", "gpt-4o-mini", …) */
  modelId: string;
  /** Display name of the viewing player — used to address them directly in the response */
  summoner?: string;
  /** PUUID of the viewing player — alternative lookup to summoner */
  puuid?: string;
  /** Pre-computed analysis string from runAnalysisPipeline — injected as additional context */
  preAnalysis?: string;
  /** When true, runs contextFilterAgent first to trim matchData to question-relevant fields */
  useContextFilter?: boolean;
  /** Match ID used for conversation logging only */
  matchId?: string;
}

/**
 * Runs one chat turn and returns the assistant reply.
 *
 * @param question   The user's message.
 * @param matchData  Same raw match data as for runAnalysisPipeline.
 * @param options    See ChatOptions fields.
 *
 * DATA FLOW
 *   matchData
 *     → enrichMatchData()           Phase 1  structured facts
 *     → buildChampionContextBlock()  Phase 1  DB context text
 *     → contextFilterAgent()?        Phase 2  trims enriched to relevant subset (optional)
 *     → chatAgent()                  Phase 2  answer using persona + context + pre-analysis
 */
export async function runChatPipeline(
  question: string,
  matchData: MatchData,
  options: ChatOptions,
): Promise<string> {
  const key = getOpenAIKey();

  // ── Phase 1: Logical Processing ────────────────────────────────────────────
  const enriched     = enrichMatchData(matchData);
  const champContext = buildChampionContextBlock(matchData);
  const viewerCtx    = buildViewerContext(matchData, options.summoner, options.puuid);

  // ── Phase 2: AI Interpretation ─────────────────────────────────────────────
  const context = options.useContextFilter
    ? await contextFilterAgent(question, enriched, key)
    : enriched;

  const { answer, systemPrompt, userMessage } = await chatAgent(
    question,
    context,
    options.persona   ?? '',
    champContext,
    viewerCtx,
    options.preAnalysis ?? '',
    options.modelId,
    key,
  );

  logConversation({
    timestamp:    new Date().toISOString(),
    matchId:      options.matchId ?? matchData.matchId ?? 'unknown',
    summoner:     options.summoner,
    persona:      options.persona ?? '',
    model:        options.modelId,
    systemPrompt,
    userMessage,
    response:     answer,
  });

  return answer;
}
