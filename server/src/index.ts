// Local dev entry (Node). Runs the same Hono app the Cloudflare Worker runs,
// but with the in-memory store and no rate limiting. Cookie identity still
// works (Web Crypto is available in Node 18+).
import "dotenv/config";
import { serve } from "@hono/node-server";

import { createApp } from "./app.js";
import { createMemoryStore } from "./store.js";
import { getOrSetUid } from "./identity.js";

const PORT = Number(process.env.PORT ?? 8000);

// One store for the whole process so data survives across requests in dev.
const store = createMemoryStore();

const app = createApp({
  getStore: () => store,
  getUid: (c) => getOrSetUid(c),
  cors: true, // the Vite dev server proxies /api, but keep CORS for direct hits
});

serve({ fetch: app.fetch, port: PORT }, ({ port }) => {
  console.log(`fintech server on http://localhost:${port}  mode=${(process.env.USE_MOCK ?? "true") === "true" ? "mock" : "gemini"}`);
});
