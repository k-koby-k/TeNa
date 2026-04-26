# AI Business Platform — Backend

Hono + Anthropic Vertex SDK. Same Node toolchain as the frontend.

## Run

```bash
cd server
npm install
cp .env.example .env     # adjust if needed
npm run dev              # http://localhost:8000
```

The Vite dev server proxies `/api/*` to `:8000`.

## GCP / Vertex

Uses the service-account key at `/home/acyu/code/hack/beckend/gcp-stt-key.json`
(project `project-e3410188-c443-4c8c-863`). To call Claude on Vertex you need
the **Vertex AI API** enabled on that project and the service account granted
`roles/aiplatform.user`. Region defaults to `us-east5` where Anthropic models
are published.

Set `USE_MOCK=false` in `.env` to hit Vertex; leave `true` for offline demos.

## Endpoints

- `POST /api/analyze` — full scenario evaluation (5 blocks + verdict)
- `POST /api/chat`    — grounded assistant turn
- `GET  /api/health`  — liveness + mode

## Notes on Vertex

- Model IDs on Vertex use the publisher format `claude-<name>@<date>`
  (e.g. `claude-sonnet-4-5@20250929`). Update `ANTHROPIC_MODEL` to whatever
  is currently published in your region.
- Vertex supports the standard Messages API plus prompt caching. Managed
  Agents are first-party only — not used here.
