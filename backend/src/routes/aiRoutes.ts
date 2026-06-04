import { Router, Request, Response } from 'express';
import axios from 'axios';
import { buildSystemPrompt } from '../prompts/promptLoader.js';

export function createAiRoutes() {
  const router = Router();

  router.post('/', async (req: Request, res: Response) => {
    const { userPrompt, persona, modelMode, matchData } = req.body as any;

    if (!userPrompt) {
      return res.status(400).send('userPrompt required');
    }

    const openaiKey = process.env.OPENAI_API_KEY || process.env.OPENAI || process.env.OPENAI_KEY;
    if (!openaiKey) {
      return res.status(500).send('OpenAI API key not configured on server');
    }

    const systemPrompt = buildSystemPrompt(persona ?? '');

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
