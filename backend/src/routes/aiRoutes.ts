import { Router, Request, Response } from 'express';
import axios from 'axios';
import { buildSystemPrompt, listPersonas } from '../prompts/promptLoader.js';

/**
 * If we know which player the viewer is in this match, build a sentence that
 * lets the model analyse from that player's perspective.
 */
function buildViewerContext(matchData: any, summoner?: string, puuid?: string): string {
  if (!matchData?.players || (!puuid && !summoner)) return '';

  const player = matchData.players.find(
    (p: any) => (puuid && p.id === puuid) || (summoner && p.name === summoner)
  );
  if (!player) return '';

  const side = player.team === 'blue' ? 'blauen' : 'roten';
  const name = summoner || player.name;
  const champ = player.championName ? ` und spielt ${player.championName}` : '';
  return `Der Nutzer, der dir Fragen stellt, ist ${name}. Er ist im Spiel ${player.role} im ${side} Team${champ}. Wenn es passt, sprich ihn direkt an und analysiere das Spiel auch aus seiner Perspektive, ohne andere Spieler zu ignorieren.`;
}

export function createAiRoutes() {
  const router = Router();

  // Personas available for the frontend dropdown.
  router.get('/personas', (_req: Request, res: Response) => {
    return res.json(listPersonas());
  });

  router.post('/', async (req: Request, res: Response) => {
    const { userPrompt, persona, modelMode, matchData, summoner, puuid } = req.body as any;

    if (!userPrompt) {
      return res.status(400).send('userPrompt required');
    }

    const openaiKey = process.env.OPENAI_API_KEY || process.env.OPENAI || process.env.OPENAI_KEY;
    if (!openaiKey) {
      return res.status(500).send('OpenAI API key not configured on server');
    }

    const systemPrompt = buildSystemPrompt(persona ?? '', buildViewerContext(matchData, summoner, puuid));

    const userMessage = `Frage: ${userPrompt}\n\nSpieldaten:\n${JSON.stringify(matchData, null, 2)}`;

    const model = modelMode === 'best' ? 'gpt-4o' : 'gpt-3.5-turbo';

    try {
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
          max_tokens: 800,
        },
        {
          headers: {
            Authorization: `Bearer ${openaiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 20000,
        }
      );

      const text = response.data?.choices?.[0]?.message?.content;
      return res.status(200).send(text || 'Keine Antwort');
    } catch (err: any) {
      console.error('OpenAI call failed', err?.response?.data || err.message || err);
      const msg = err?.response?.data || err.message || 'OpenAI request failed';
      return res.status(502).send(typeof msg === 'string' ? msg : JSON.stringify(msg));
    }
  });

  return router;
}

export default createAiRoutes;
