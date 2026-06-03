# Deploying TeNa to Cloudflare Pages

Deploys as a Cloudflare **Pages** project, which gives the clean URL
**`tena.pages.dev`** (project-name based — no account nickname in it). If the
name `tena` is already taken globally, you'll get e.g. `tena-app.pages.dev`.

One bundled Worker (`dist/_worker.js`) serves the React SPA **and** the
`/api/*` routes. **D1** stores analyses, **KV** holds rate-limit counters, and a
signed httpOnly cookie is the no-login identity.

All commands run from the **repo root**.

## One-time setup

```bash
npx wrangler login                       # opens the browser

# 1) Create the database, then paste ONLY the database_id into wrangler.toml.
#    Keep the binding as "DB" (don't copy the binding name wrangler suggests).
npx wrangler d1 create tena-db
#    → paste database_id into [[d1_databases]] (binding must stay "DB")

# 2) Create the KV namespace, then paste the printed id into wrangler.toml
npx wrangler kv namespace create RL
#    → paste id into [[kv_namespaces]] (binding stays "RL")

# 3) Apply the DB schema to the real (remote) database
npm run db:migrate                       # wrangler d1 migrations apply tena-db --remote

# 4) First deploy — THIS creates the Pages project "tena".
npm run deploy

# 5) Now that the project exists, set the secrets (NOT committed)…
npx wrangler pages secret put GEMINI_API_KEY    # your Google AI Studio key
npx wrangler pages secret put COOKIE_SECRET     # a random string: `openssl rand -hex 32`

# 6) …and redeploy so the secrets take effect.
npm run deploy
```

`USE_MOCK="false"` and `GEMINI_MODEL` already live in `wrangler.toml` `[vars]`.

## Deploy (every time)

```bash
npm run deploy        # builds the SPA, bundles the Worker, then `wrangler pages deploy`
```

It prints your live URL (e.g. `https://tena.pages.dev`).

## Using it

- **Founders**: just the URL. They get an anonymous cookie; their **Recent**
  list is their own analyses, persisted in D1.
- **Bankers**: add `?role=banker` once (e.g. `https://tena.pages.dev/?role=banker`).
  The choice is remembered. The Deal Pipeline reads every analysis from D1.

## Protection (already wired)

- **Rate limit**: 15 AI calls / 10 min, enforced **per IP and per cookie** (KV).
  Over the limit → `429` + a "slow down" message; no Gemini call is made.
- Tune `AI_LIMIT` / `AI_WINDOW_SEC` in `server/src/worker.ts`.

## Local development

Fast path (no Cloudflare needed — Node + in-memory store):

```bash
# terminal 1
cd server && npm run dev      # API on :8000
# terminal 2
npm run dev                   # Vite on :5173, proxies /api → :8000
```

Run the real Pages build against emulated D1/KV (Miniflare):

```bash
npm run db:migrate:local
npm run cf:dev                # builds, then `wrangler pages dev`. Put USE_MOCK="true"
                             # in a root .dev.vars to avoid spending Gemini tokens.
```
