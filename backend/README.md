# Backend - LoL E-Sports Team Explorer

Backend API Server für Riot Match Daten mit Caching und Rate-Limit Handling.

## Setup

### 1. Environment Variable
```bash
# Copy example and add your Riot Developer API Key
cp .env.example .env
```

Edit `.env`:
```
RIOT_API_KEY=your_actual_riot_developer_api_key_here
PORT=3001
NODE_ENV=development
```

### 2. Get Riot API Key
- Register at https://developer.riotgames.com/
- Create a Development API key
- The key resets every 24 hours (copy it again if needed)

### 3. Install Dependencies
```bash
npm install
```

### 4. Start Development Server
```bash
npm run dev
```

Server runs on `http://localhost:3001`

## API Endpoints

### Get Match Data
```
GET /api/match/:matchId
```

**Example**:
```bash
curl "http://localhost:3001/api/match/EUW1_12345"
```

**Response**:
```json
{
  "success": true,
  "data": {
    "matchId": "EUW1_12345",
    "blueTeam": {
      "id": "100",
      "name": "Blue Team",
      "side": "blue",
      "win": true,
      "bans": [1, 2, 3],
      "objectives": {
        "baron": 1,
        "dragon": 3,
        "tower": 8,
        "inhibitor": 1,
        "riftHerald": 1
      }
    },
    "redTeam": { /* ... */ },
    "players": [
      {
        "id": "puuid...",
        "name": "PlayerName",
        "role": "Top",
        "team": "blue",
        "championName": "Garen",
        "kills": 5,
        "deaths": 2,
        "assists": 10,
        "goldEarned": 15000,
        "minionsKilled": 250,
        "items": [3044, 3111, 3157]
      }
      /* ... 9 more players */
    ]
  }
}
```

### Health Check
```
GET /health
```

## Finding Test Match IDs

Option 1: Use op.gg to find a player's recent match
```
https://op.gg/{region}/{playerName}
```
Copy a match ID from the URL or client library.

Option 2: Format is typically:
```
{REGION1}_matchTimestamp_matchID
```
Examples:
- EUW1_1234567890_ABCDEF
- NA1_1234567890_GHIJKL
- KR_1234567890_MNOPQR

## Architecture

```
src/
├── main.ts              # Express server & setup
├── routes/
│   └── matchRoutes.ts   # API endpoints
├── data/
│   ├── riotApiClient.ts # Riot API wrapper
│   └── cache.ts         # Cache & RateLimiter
├── domain/
│   └── matchMapper.ts   # Map Riot -> App data
└── types/
    ├── riot.ts          # Riot API types
    └── app.ts           # App types
```

## Features

- ✅ Caching (1 hour TTL)
- ✅ Rate limiting (20 req/sec, 100 req/2min)
- ✅ Error handling (404, 429, 401, timeout)
- ✅ TypeScript with strict types
- ✅ CORS enabled for frontend

## Rate Limits

Development API keys have these limits:
- **20 requests per second**
- **100 requests per 2 minutes**

The backend enforces these limits and returns:
- `429 Too Many Requests` when exceeded
- `Retry-After` header with backoff time

## Build & Run Production

```bash
npm run build
npm start
```

Output will be in `dist/`

## Troubleshooting

**"RIOT_API_KEY not set"**
- Create `.env` file with your API key
- Key resets daily; get a new one if old

**"Match not found" (404)**
- Verify match ID is valid
- Check it's from the correct region
- Match must be completed (post-game)

**"Rate limited" (429)**
- Wait before making more requests
- Check Retry-After header for backoff duration
- Reduce request frequency

**"Invalid API key" (401/403)**
- Verify key in `.env` file
- Get a fresh key from developer.riotgames.com
- Check it's a personal/development key (not production)
