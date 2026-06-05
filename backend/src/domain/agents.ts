// ---------------------------------------------------------------------------
// agents.ts
//
// One function per agent. Each agent = one system prompt (.md) + one LLM call.
// To change what an agent does: edit the corresponding file in prompts/
//
//   timelineAgent      → prompts/timelineanalysis.md
//   preAnalysisAgent   → prompts/preanalysis.md
//   contextFilterAgent → prompts/contextfilter.md
//   chatAgent          → prompts/personas/* + prompts/core.md + prompts/dataset.md
// ---------------------------------------------------------------------------

import axios from 'axios';
import {
  preanalysisPrompt,
  contextFilterPrompt,
  timelineAnalysisPrompt,
  laneScorePrompt,
  buildSystemPrompt,
} from '../prompts/promptLoader.js';
import type { EnrichedMatchData } from './matchEnricher.js';
import type { TimelineContext } from './timelineFormatter.js';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

type Message = { role: 'system' | 'user'; content: string };

async function callLLM(
  key: string,
  model: string,
  messages: Message[],
  maxTokens: number,
  json = false,
  temperature = 0.3,
): Promise<string> {
  const body: Record<string, unknown> = { model, messages, max_tokens: maxTokens, temperature };
  if (json) body.response_format = { type: 'json_object' };
  const res = await axios.post(OPENAI_URL, body, {
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    timeout: 45000,
  });
  return res.data?.choices?.[0]?.message?.content ?? '';
}

// ── Timeline Agent ─────────────────────────────────────────────────────────────
// Receives structured timeline facts (lane gold diffs, fights, objectives).
// Produces a narrative that is injected into the pre-analysis context.
export async function timelineAgent(ctx: TimelineContext, key: string): Promise<string> {
  console.log(`[AGENT timeline]     start  model=gpt-4o-mini  fights=${ctx.fights?.length ?? 0}  objectives=${ctx.objectiveTimeline?.length ?? 0}`);
  const t = Date.now();
  const result = await callLLM(key, 'gpt-4o-mini', [
    { role: 'system', content: timelineAnalysisPrompt },
    { role: 'user',   content: JSON.stringify(ctx, null, 2) },
  ], 700);
  console.log(`[AGENT timeline]     done   ${Date.now() - t}ms`);
  return result;
}

// ── Pre-Analysis Agent ─────────────────────────────────────────────────────────
// Receives enriched match data + optional champion context + optional timeline narrative.
// Produces the main match analysis stored in cache and shown to the user.
export async function preAnalysisAgent(
  enriched: EnrichedMatchData,
  champContext: string,
  timelineNarrative: string,
  modelId: string,
  key: string,
): Promise<string> {
  const systemParts = [preanalysisPrompt];
  if (champContext)      systemParts.push(champContext);
  if (timelineNarrative) systemParts.push(`## Timeline-Analyse\n\n${timelineNarrative}`);

  const extras = [champContext && 'champCtx', timelineNarrative && 'timeline'].filter(Boolean).join('+') || 'base';
  console.log(`[AGENT preanalysis]  start  model=${modelId}  context=${extras}`);
  const t = Date.now();
  const result = await callLLM(key, modelId, [
    { role: 'system', content: systemParts.join('\n\n---\n\n') },
    { role: 'user',   content: `Spieldaten:\n${JSON.stringify(enriched, null, 2)}` },
  ], 1000);
  console.log(`[AGENT preanalysis]  done   ${Date.now() - t}ms`);
  return result;
}

// ── Lane Score Agent ───────────────────────────────────────────────────────────
// Receives enriched match data and returns a per-player lane score (1–5) as JSON.
// Uses gpt-4o-mini with json mode — fails gracefully (returns {}) on parse errors.
export async function laneScoreAgent(
  enriched: EnrichedMatchData,
  key: string,
): Promise<Record<string, number>> {
  try {
    console.log(`[AGENT lanescore]    start  model=gpt-4o-mini  players=${enriched.players?.length ?? 0}`);
    const t = Date.now();
    const raw = await callLLM(key, 'gpt-4o-mini', [
      { role: 'system', content: laneScorePrompt },
      { role: 'user',   content: JSON.stringify(enriched, null, 2) },
    ], 300, true);
    console.log(`[AGENT lanescore]    done   ${Date.now() - t}ms`);
    return JSON.parse(raw) as Record<string, number>;
  } catch (err) {
    console.warn(`[AGENT lanescore]    failed: ${(err as Error).message}`);
    return {};
  }
}

// ── Context Filter Agent ───────────────────────────────────────────────────────
// Selects the subset of match data relevant to the user's question.
// Falls back to full data on any error — this agent is a best-effort optimisation.
export async function contextFilterAgent(
  question: string,
  enriched: EnrichedMatchData,
  key: string,
): Promise<unknown> {
  try {
    const q = question.length > 50 ? question.slice(0, 50) + '…' : question;
    console.log(`[AGENT contextfilter] start  model=gpt-4o-mini  q="${q}"`);
    const t = Date.now();
    const raw = await callLLM(key, 'gpt-4o-mini', [
      { role: 'system', content: contextFilterPrompt },
      { role: 'user',   content: `Frage: ${question}\n\nSpieldaten:\n${JSON.stringify(enriched, null, 2)}` },
    ], 2000, true);
    console.log(`[AGENT contextfilter] done   ${Date.now() - t}ms`);
    return JSON.parse(raw);
  } catch {
    return enriched;
  }
}

// ── Chat Agent ─────────────────────────────────────────────────────────────────
// Answers a user question. System prompt is built from the selected persona +
// core rules + dataset guide + optional champion context, viewer context, and pre-analysis.
export async function chatAgent(
  question: string,
  context: unknown,
  persona: string,
  champContext: string,
  viewerContext: string,
  preAnalysis: string,
  modelId: string,
  key: string,
): Promise<{ answer: string; systemPrompt: string; userMessage: string }> {
  const systemPrompt = buildSystemPrompt(persona, champContext, viewerContext, preAnalysis);
  const userMessage  = `Frage: ${question}\n\nSpieldaten:\n${JSON.stringify(context, null, 2)}`;

  const q = question.length > 50 ? question.slice(0, 50) + '…' : question;
  console.log(`[AGENT chat]          start  model=${modelId}  persona=${persona || 'default'}  q="${q}"`);
  const t = Date.now();
  const answer = await callLLM(key, modelId, [
    { role: 'system', content: systemPrompt },
    { role: 'user',   content: userMessage },
  ], 300, false, 0.5);
  console.log(`[AGENT chat]          done   ${Date.now() - t}ms`);

  return { answer, systemPrompt, userMessage };
}
