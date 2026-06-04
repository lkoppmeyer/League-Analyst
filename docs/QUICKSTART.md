# Quick Start Guide

## What's Done

✅ Backend
- Express Server mit TypeScript
- Riot API Client (MATCH-V5)
- In-Memory Cache + Rate Limit Handling
- Domain Mapper (Riot → App format)
- Express Routes (`GET /api/match/:matchId`)

✅ Frontend Integration
- App.tsx now fetches from backend instead of mock
- Error handling & loading states
- Displays real champion names, KDA, gold, items

## Next Steps

### 1. Get Riot Developer API Key
- Go to https://developer.riotgames.com/
- Sign in with your Riot Account
- Create a Development API Key
- Copy the key (it resets every 24h)

### 2. Setup Backend
```bash
cd backend
cp .env.example .env
# Edit .env and paste your API key
RIOT_API_KEY=your_key_here
npm install  # Already done
```

### 3. Start Backend
```bash
cd backend
npm run dev
```
Should see: `✓ Backend server running on http://localhost:3001`

### 4. Start Frontend (in another terminal)
```bash
cd frontend
npm run dev
```
Should see: `✓ Frontend running on http://localhost:5173`

### 5. Test
- Open http://localhost:5173 in browser
- Enter a valid Match ID
- See real match data load!

## Finding Test Match IDs

### Option A: From Professional Matches
1. Go to https://op.gg/pro
2. Find a match from your region
3. Click it and copy the ID from URL

### Option B: Your Own Matches
1. Go to https://op.gg
2. Search your summoner name
3. Find a completed match
4. Copy the match ID

### Format
Match IDs look like:
```
EUW1_654321987_ABCDEF123
NA1_123456789_XYZABC789
KR_987654321_DEFGHI456
```

## Testing Checklist

- [ ] Backend starts without "RIOT_API_KEY not set" error
- [ ] Backend builds successfully (`npm run build` in backend/)
- [ ] Frontend starts and loads
- [ ] Enter a valid Match ID and hit "Laden"
- [ ] See player names, roles, champions loading
- [ ] Click a player and see stats (KDA, gold, items)
- [ ] Second load of same Match ID is faster (cache working)

## If Something Goes Wrong

**"Cannot find module"**
- Run `npm install` again in the folder

**"Connection refused"**
- Make sure backend is running on port 3001
- Make sure frontend is on port 5173

**"Invalid API key"**
- Get a fresh key from developer.riotgames.com
- Riot keys reset every 24h

**"Match not found"**
- Verify match ID is correctformat
- Check match is completed (not live)
- Try a different match ID

## Architecture Overview

```
User Input (Match ID)
         ↓
Frontend App.tsx
         ↓
Backend API (localhost:3001)
         ↓
Cache Check (have we loaded this before?)
         ↓
Riot API (if not cached)
         ↓
Map Data (Riot format → App format)
         ↓
Response JSON
         ↓
Frontend displays players & teams
```

## Next Phase After MVP

Once basic loading works:
- [ ] Add E-Sports APIs for draft/team info
- [ ] AI chat integration (OpenAI)
- [ ] Better team visualization
- [ ] Player history & stats
- [ ] Deployment to production
