import { Router, Request, Response } from 'express';
import axios from 'axios';

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

    // Base prompt template
    const base = `Du bist leidenschaftlicher League of Legends Spieler und Profi Analyst.`;

    // Persona variations
    const personaMap: Record<string, string> = {
      'Profi Esports Analyst': base + ' Analysiere das Spiel professionell, achte auf Teamkomposition, Power-Spikes und objektive Kontrolle.',
      'Challenger Soloq Spieler': base + ' Antworte wie ein sehr erfahrener SoloQ-Spieler: fokussiert auf Matchups, individuelle Entscheidungen und Macro-Fehler.',
      'Leidenschaftlicher Low Elo Spieler': base + ' Antworte einfach und enthusiastisch, erkläre Basics und hebe offensichtliche Fehler hervor.',
    };

    const personaText = personaMap[persona] || personaMap['Profi Esports Analyst'];

    const fullPrompt = `${personaText}\n\nDu kriegst im Interview folgende Frage zu dem Spiel gestellt:\n${userPrompt}\n\nUnd hast folgende Daten um diese Frage so gut es geht zu beantworten und dabei auf interessante Zusammenhänge aufmerksam zu machen und die Spielsituation so gut wie möglich zu analysieren:\n${JSON.stringify(matchData, null, 2)}`;

    // Map modelMode to model name
    const model = modelMode === 'best' ? 'gpt-4o' : 'gpt-3.5-turbo';

    try {
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model,
          messages: [
            { role: 'system', content: personaText },
            { role: 'user', content: fullPrompt },
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
