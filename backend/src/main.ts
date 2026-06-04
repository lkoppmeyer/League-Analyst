import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { RiotApiClient } from './data/riotApiClient.js';
import { Cache, RateLimiter } from './data/cache.js';
import { createMatchRoutes } from './routes/matchRoutes.js';
import { createSummonerRoutes } from './routes/summonerRoutes.js';
import { createAiRoutes } from './routes/aiRoutes.js';
import { MatchData } from './types/app.js';

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 3001;
// Support multiple env var names for convenience (RGAPI provided by user)
const apiKey = process.env.RIOT_API_KEY || process.env.RGAPI;

// Validate API key
if (!apiKey) {
  console.error('ERROR: RIOT_API_KEY (or RGAPI) environment variable not set');
  console.error('Please create a .env file with your Riot Developer API key');
  console.error('Example: RIOT_API_KEY=RGAPI-xxxx npm run dev');
  process.exit(1);
}

// Middleware
app.use(cors());
app.use(express.json());

// Initialize services
const riotApiClient = new RiotApiClient({ apiKey });
const matchCache = new Cache<MatchData>(3600); // 1 hour TTL
const rateLimiter = new RateLimiter(20, 100); // 20/sec, 100/2min

// Routes
const matchRoutes = createMatchRoutes({
  riotApiClient,
  cache: matchCache,
  rateLimiter,
});

const summonerRoutes = createSummonerRoutes({
  riotApiClient,
  cache: matchCache,
  rateLimiter,
});

app.use('/api/match', matchRoutes);
app.use('/api/summoner', summonerRoutes);
app.use('/api/ask', createAiRoutes());

// Health check endpoint
app.get('/health', async (_req, res) => {
  try {
    const status = await riotApiClient.ping();
    return res.json({ status: 'ok', message: 'Backend is running', riotApi: { reachable: true, statusSummary: status?.name || null } });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'unknown error';
    return res.status(502).json({ status: 'error', message: 'Backend running but Riot API check failed', riotApi: { reachable: false, error: errMsg } });
  }
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    statusCode: 404,
  });
});

// Error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    statusCode: 500,
  });
});

// Start server
app.listen(port, () => {
  console.log(`✓ Backend server running on http://localhost:${port}`);
  console.log(`✓ Match endpoint: GET http://localhost:${port}/api/match/:matchId`);
  console.log(`✓ Health check: GET http://localhost:${port}/health`);
});
