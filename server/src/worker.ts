// Cloudflare Worker entry. One Worker serves the built SPA (ASSETS binding)
// and the /api/* routes (the shared Hono app), backed by D1 + KV.

import type {
  D1Database, KVNamespace, Fetcher, ExecutionContext,
} from "@cloudflare/workers-types";

import { createApp } from "./app.js";
import { createD1Store, ensureSeeded } from "./store-d1.js";
import { getOrSetUid } from "./identity.js";
import { hit } from "./ratelimit.js";

export interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  RL: KVNamespace;
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  USE_MOCK?: string;
  COOKIE_SECRET?: string;
}

// The agent code reads configuration from process.env (it's shared with the
// Node entry). On Workers we copy the string bindings across once so none of
// that code needs to change. (D1/KV are objects — passed via `c.env` instead.)
function shimEnv(env: Env) {
  const g = globalThis as any;
  g.process = g.process ?? { env: {} };
  g.process.env = g.process.env ?? {};
  for (const k of ["GEMINI_API_KEY", "GEMINI_MODEL", "USE_MOCK", "COOKIE_SECRET"] as const) {
    if (env[k] != null) g.process.env[k] = env[k];
  }
}

// Rate limits: per IP and per cookie, whichever trips first. With a real Gemini
// budget the cap is just a runaway-bot backstop, not a cost guard — so it's set
// generously. 60 AI calls / 10 min ≈ 15 full analyses per person per 10 min.
const AI_LIMIT = 60;          // requests…
const AI_WINDOW_SEC = 600;    // …per 10 minutes

let seeded = false;

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    shimEnv(env);

    const url = new URL(request.url);

    // Everything that isn't an API call is the static SPA. Serve the asset; if
    // it's a missing path with no file extension (a client-side route like
    // /overview), fall back to index.html so deep links work.
    if (!url.pathname.startsWith("/api/")) {
      const res = (await env.ASSETS.fetch(request as any)) as unknown as Response;
      if (res.status === 404 && request.method === "GET" && !url.pathname.split("/").pop()!.includes(".")) {
        const indexReq = new Request(new URL("/index.html", url).toString(), { method: "GET" });
        return env.ASSETS.fetch(indexReq as any) as unknown as Response;
      }
      return res;
    }

    // Seed the demo marketplace into D1 on the first API hit of a cold isolate.
    if (!seeded) {
      try { await ensureSeeded(env.DB); seeded = true; } catch (e) { console.error("[seed]", e); }
    }

    const app = createApp({
      getStore: () => createD1Store(env.DB),
      getUid: (c) => getOrSetUid(c),
      checkRateLimit: async (c) => {
        const ip = c.req.header("cf-connecting-ip") ?? c.req.header("x-forwarded-for") ?? "unknown";
        const uid = c.var.uid;
        const [byIp, byUid] = await Promise.all([
          hit(env.RL, `ip:${ip}`, AI_LIMIT, AI_WINDOW_SEC),
          hit(env.RL, `uid:${uid}`, AI_LIMIT, AI_WINDOW_SEC),
        ]);
        const ok = byIp.ok && byUid.ok;
        return { ok, retryAfterSec: Math.max(byIp.retryAfterSec, byUid.retryAfterSec) };
      },
    });

    return app.fetch(request, env as any, ctx as any);
  },
};
