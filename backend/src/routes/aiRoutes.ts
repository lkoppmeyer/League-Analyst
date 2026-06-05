// ---------------------------------------------------------------------------
// aiRoutes.ts
//
// HTTP layer only. No analysis logic here.
// All data processing lives in domain/pipeline.ts and domain/agents.ts.
// ---------------------------------------------------------------------------

import { Router, Request, Response } from 'express';
import { listPersonas } from '../prompts/promptLoader.js';
import { runAnalysisPipeline, runChatPipeline, getOpenAIKey } from '../domain/pipeline.js';
import { enrichMatchData } from '../domain/matchEnricher.js';
import { readDiskCache, writeDiskCache, deleteDiskCache } from '../data/diskCache.js';
import type { MatchData } from '../types/app.js';

// ---------------------------------------------------------------------------
// Model registry — update labels/IDs here when new OpenAI models are released
// ---------------------------------------------------------------------------

const MODELS = [
  { id: 'economy',  label: 'Günstig (GPT-4o mini)', modelId: 'gpt-4o-mini' },
  { id: 'balanced', label: 'Standard (GPT-4o)',      modelId: 'gpt-4o'      },
  { id: 'best',     label: 'Bestes Modell (GPT-4.1)', modelId: 'gpt-4.1'   },
] as const;

const MODEL_MAP = new Map(MODELS.map((m) => [m.id, m]));
const resolveModel = (id: string) => MODEL_MAP.get(id as any) ?? MODEL_MAP.get('balanced')!;

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export function createAiRoutes() {
  const router = Router();

  router.get('/personas', (_req, res) => res.json(listPersonas()));
  router.get('/models',   (_req, res) => res.json(MODELS.map(({ id, label }) => ({ id, label }))));

  // Phase 1 only — returns enriched match data without any AI calls (debug use)
  router.post('/debug/enriched', (req: Request, res: Response) => {
    const { matchData } = req.body;
    if (!matchData) return res.status(400).json({ error: 'matchData required' });
    return res.json(enrichMatchData(matchData as MatchData));
  });

  // Clear cached pre-analysis so the next /analyze call regenerates it
  router.delete('/analyze/:matchId', (req: Request, res: Response) => {
    deleteDiskCache(`preanalysis_${req.params.matchId}`);
    return res.status(204).send();
  });

  // Pre-analysis — SSE stream so the frontend can show per-step progress
  router.post('/analyze', async (req: Request, res: Response) => {
    const { matchId, matchData, modelMode } = req.body;
    if (!matchId || !matchData) { res.status(400).json({ error: 'matchId and matchData required' }); return; }

    try { getOpenAIKey(); } catch {
      res.status(500).json({ error: 'OpenAI API key not configured' }); return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const send = (data: Record<string, unknown>) => res.write(`data: ${JSON.stringify(data)}\n\n`);

    send({ step: 'Cache wird geprüft…', progress: 5 });

    const cacheKey = `preanalysis_${matchId}`;
    const cached   = readDiskCache<{ analysis: string; laneScores?: Record<string, number> }>(cacheKey);
    if (cached) {
      console.log(`[ANALYZE] cache hit  ${matchId}`);
      send({ step: 'Fertig', progress: 100, analysis: cached.analysis, laneScores: cached.laneScores ?? {}, cached: true });
      res.end(); return;
    }

    try {
      const { modelId } = resolveModel(modelMode);
      console.log(`[ANALYZE] start  ${matchId}  model=${modelId}`);
      const { analysis, laneScores } = await runAnalysisPipeline(matchData as MatchData, modelId, (step, progress) => send({ step, progress }));
      writeDiskCache(cacheKey, { analysis, laneScores, matchId });
      console.log(`[ANALYZE] done   ${matchId}`);
      send({ step: 'Fertig', progress: 100, analysis, laneScores, cached: false });
    } catch (err: any) {
      console.error(`[ANALYZE] error  ${matchId}  ${err.message ?? err}`);
      send({ step: 'Fehler', progress: 0, error: err.message ?? 'Pipeline failed' });
    }
    res.end();
  });


// Chat — answers a user question about the loaded match
  router.post('/', async (req: Request, res: Response) => {
    const { userPrompt, persona, modelMode, matchData, summoner, puuid, preAnalysis, useContextFilter } = req.body;
    if (!userPrompt) { res.status(400).send('userPrompt required'); return; }

    try { getOpenAIKey(); } catch {
      res.status(500).send('OpenAI API key not configured'); return;
    }

    try {
      const { modelId } = resolveModel(modelMode);
      const mid = (matchData as MatchData)?.matchId ?? '?';
      console.log(`[CHAT] ${mid}  persona=${persona ?? '?'}  model=${modelId}  q="${userPrompt.slice(0, 60)}${userPrompt.length > 60 ? '…' : ''}"`);
      const answer = await runChatPipeline(userPrompt, matchData as MatchData, {
        persona, modelId, summoner, puuid,
        preAnalysis:      preAnalysis ?? '',
        useContextFilter: !!useContextFilter,
        matchId:          mid,
      });
      res.status(200).send(answer);
    } catch (err: any) {
      console.error(`[CHAT] error  ${err.message ?? err}`);
      res.status(502).send(err.message ?? 'Pipeline failed');
    }
  });

  return router;
}

export default createAiRoutes;
