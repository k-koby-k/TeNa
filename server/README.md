# TeNa Backend

Hono server for the AI business analytics prototype.

## Run

```bash
npm install
cp .env.example .env
npm run dev
```

Server URL: `http://localhost:8000`

## Environment

```bash
USE_MOCK=true
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.5-flash
PORT=8000
```

`USE_MOCK=true` returns deterministic demo responses for:

- `/api/analyze`
- `/api/chat`
- `/api/geocode/search`
- `/api/agent/location`
- `/api/agent/market`
- `/api/agent/financials`
- `/api/agent/synthesize`

Deck extraction and voice intake still need Gemini because they process uploaded media.

Set `USE_MOCK=false` to call Gemini and public map services live.

## Endpoints

- `GET /api/health`
- `POST /api/analyze`
- `POST /api/chat`
- `GET /api/history`
- `GET /api/applications`
- `POST /api/history`
- `GET /api/history/:id`
- `GET /api/geocode/search?q=...`
- `POST /api/agent/location`
- `POST /api/agent/market`
- `POST /api/agent/financials`
- `POST /api/agent/synthesize`
- `POST /api/agent/extract-profile`
- `POST /api/agent/voice`

## Demo Notes

The server seeds the bank Deal Pipeline on startup with marketplace-sourced businesses. `/api/history` returns only current-account analyses; `/api/applications` returns the full pipeline. Storage is in memory and resets when the server restarts.
