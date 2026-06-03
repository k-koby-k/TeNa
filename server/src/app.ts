// The Hono app — pure routing/logic, no transport or storage assumptions.
// Storage, identity and rate-limiting are injected by the caller so the exact
// same routes run under Node (`index.ts`, in-memory) and on Cloudflare
// (`worker.ts`, D1 + KV + signed cookie).

import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Context } from "hono";

import { mockAnalyze, mockChat } from "./mock.js";
import type {
  AnalyzeRequest, AnalyzeResponse, ChatRequest, ChatResponse,
} from "./schemas.js";
import type { StoreApi } from "./store.js";

type Vars = { store: StoreApi; uid: string };

export interface AppOptions {
  /** Build the storage adapter for this request. */
  getStore: (c: Context) => StoreApi;
  /** Resolve the anonymous user id for this request (reads/sets the cookie). */
  getUid: (c: Context) => Promise<string>;
  /** Optional limiter. Returns null when no limiter is configured (local dev). */
  checkRateLimit?: (c: Context) => Promise<{ ok: boolean; retryAfterSec: number } | null>;
  /** Enable permissive CORS (only needed when the API is on a different origin). */
  cors?: boolean;
}

const useMock = () => (process.env.USE_MOCK ?? "true").toLowerCase() === "true";

// Expensive (token-spending) POST endpoints we guard with the rate limiter.
const GUARDED = ["/api/analyze", "/api/chat", "/api/agent/"];

export function createApp(opts: AppOptions): Hono<{ Variables: Vars }> {
  const app = new Hono<{ Variables: Vars }>();

  if (opts.cors) {
    app.use("*", cors({ origin: ["http://localhost:5173", "http://localhost:4173"], credentials: true }));
  }

  // Identity + storage on every request.
  app.use("*", async (c, next) => {
    c.set("uid", await opts.getUid(c));
    c.set("store", opts.getStore(c));
    await next();
  });

  // Rate-limit the expensive endpoints (by IP + cookie, done in the limiter).
  app.use("/api/*", async (c, next) => {
    if (c.req.method === "POST" && opts.checkRateLimit && GUARDED.some((p) => c.req.path.startsWith(p))) {
      const r = await opts.checkRateLimit(c);
      if (r && !r.ok) {
        return c.json(
          { error: "rate_limited", detail: "Too many requests — please slow down for a moment." },
          429,
          { "Retry-After": String(r.retryAfterSec) },
        );
      }
    }
    await next();
  });

  app.get("/api/health", (c) => c.json({ ok: true, mode: useMock() ? "mock" : "gemini" }));

  app.post("/api/analyze", async (c) => {
    const req = await c.req.json<AnalyzeRequest>();
    let res: AnalyzeResponse;
    if (useMock()) {
      res = mockAnalyze(req);
    } else {
      try {
        const { analyze } = await import("./llm.js");
        res = await analyze(req);
      } catch (e: any) {
        console.error("[/api/analyze]", e);
        return c.json({ error: "model_error", detail: String(e?.message ?? e) }, 502);
      }
    }
    await c.var.store.record(req, res, { ownerId: c.var.uid, source: "own" });
    return c.json<AnalyzeResponse>(res);
  });

  app.post("/api/chat", async (c) => {
    const req = await c.req.json<ChatRequest>();
    if (useMock()) return c.json<ChatResponse>(mockChat(req.message, req.scenario_context));
    try {
      const { chat } = await import("./llm.js");
      return c.json<ChatResponse>(await chat(req));
    } catch (e: any) {
      console.error("[/api/chat]", e);
      return c.json({ error: "model_error", detail: String(e?.message ?? e) }, 502);
    }
  });

  // --- Voice intake (mic in the chat) ------------------------------------
  app.post("/api/agent/voice", async (c) => {
    try {
      const body = await c.req.parseBody();
      const file = body.file;
      if (!(file instanceof File)) {
        return c.json({ error: "bad_request", detail: "Upload an audio file in the 'file' form field." }, 400);
      }
      if (file.size > 25 * 1024 * 1024) {
        return c.json({ error: "too_large", detail: "Max 25 MB." }, 413);
      }
      const buf = Buffer.from(await file.arrayBuffer());
      const { transcribeAndExtract } = await import("./agents/voice.js");
      const mime = file.type || "audio/webm";
      const result = await transcribeAndExtract(buf.toString("base64"), mime);
      return c.json(result);
    } catch (e: any) {
      console.error("[agent/voice]", e);
      return c.json({ error: "agent_error", detail: String(e?.message ?? e) }, 502);
    }
  });

  // --- Pitch-deck extraction (Profile auto-fill) -------------------------
  app.post("/api/agent/extract-profile", async (c) => {
    try {
      const body = await c.req.parseBody();
      const file = body.file;
      if (!(file instanceof File)) {
        return c.json({ error: "bad_request", detail: "Upload a file in the 'file' form field." }, 400);
      }
      if (file.size > 20 * 1024 * 1024) {
        return c.json({ error: "too_large", detail: "Max 20 MB." }, 413);
      }
      const buf = Buffer.from(await file.arrayBuffer());
      const { extractProfile } = await import("./agents/extract-profile.js");
      const result = await extractProfile(buf.toString("base64"), file.type || "application/pdf");
      return c.json(result);
    } catch (e: any) {
      console.error("[extract-profile]", e);
      return c.json({ error: "agent_error", detail: String(e?.message ?? e) }, 502);
    }
  });

  // --- Geocode search (used by the map's search box) ---------------------
  app.get("/api/geocode/search", async (c) => {
    const q = c.req.query("q") ?? "";
    if (!q.trim()) return c.json({ items: [] });
    if (useMock()) {
      const { mockGeocodeSearch } = await import("./agents/mock-agents.js");
      return c.json(mockGeocodeSearch(q));
    }
    try {
      const { searchPlaces } = await import("./agents/geocode.js");
      return c.json({ items: await searchPlaces(q) });
    } catch (e: any) {
      console.error("[geocode/search]", e);
      return c.json({ items: [] });
    }
  });

  // --- Agent endpoints ---------------------------------------------------
  app.post("/api/agent/location", async (c) => {
    const body = await c.req.json<{ lat: number; lng: number; business_type: string; district?: string; format?: any }>();
    if (typeof body.lat !== "number" || typeof body.lng !== "number" || !body.business_type) {
      return c.json({ error: "bad_request", detail: "lat, lng, business_type are required" }, 400);
    }
    if (useMock()) {
      const { mockLocationAgent } = await import("./agents/mock-agents.js");
      return c.json(mockLocationAgent(body));
    }
    try {
      const { analyzeLocation } = await import("./agents/location.js");
      return c.json(await analyzeLocation(body));
    } catch (e: any) {
      console.error("[agent/location]", e);
      return c.json({ error: "agent_error", detail: String(e?.message ?? e) }, 502);
    }
  });

  app.post("/api/agent/market", async (c) => {
    const body = await c.req.json<{ brief: string; district?: string; business_type?: string }>();
    if (!body.brief?.trim()) return c.json({ error: "bad_request", detail: "brief is required" }, 400);
    if (useMock()) {
      const { mockMarketAgent } = await import("./agents/mock-agents.js");
      return c.json(mockMarketAgent(body));
    }
    try {
      const { analyzeMarket } = await import("./agents/market.js");
      return c.json(await analyzeMarket(body));
    } catch (e: any) {
      console.error("[agent/market]", e);
      return c.json({ error: "agent_error", detail: String(e?.message ?? e) }, 502);
    }
  });

  app.post("/api/agent/synthesize", async (c) => {
    try {
      const body = await c.req.json<any>();
      if (useMock()) {
        const { mockSynthesis } = await import("./agents/mock-agents.js");
        return c.json(mockSynthesis(body));
      }
      const { synthesize } = await import("./agents/synthesize.js");
      return c.json(await synthesize(body));
    } catch (e: any) {
      console.error("[agent/synthesize]", e);
      return c.json({ error: "agent_error", detail: String(e?.message ?? e) }, 502);
    }
  });

  app.post("/api/agent/financials", async (c) => {
    const body = await c.req.json<any>();
    const need = ["business_type", "district", "startup_capital_uzs", "monthly_rent_uzs", "average_ticket_uzs"];
    for (const k of need) {
      if (body[k] == null || body[k] === "" || body[k] === 0) {
        return c.json({ error: "bad_request", detail: `${k} is required` }, 400);
      }
    }
    if (useMock()) {
      const { mockFinancialsAgent } = await import("./agents/mock-agents.js");
      return c.json(mockFinancialsAgent(body));
    }
    try {
      const { analyzeFinancials } = await import("./agents/financials.js");
      return c.json(await analyzeFinancials(body));
    } catch (e: any) {
      console.error("[agent/financials]", e);
      return c.json({ error: "agent_error", detail: String(e?.message ?? e) }, 502);
    }
  });

  // --- History / pipeline ------------------------------------------------
  app.get("/api/history", async (c) => c.json({ items: await c.var.store.listOwn(c.var.uid) }));

  app.get("/api/applications", async (c) => c.json({ items: await c.var.store.listAll() }));

  app.post("/api/history", async (c) => {
    try {
      const body = await c.req.json<{ request: AnalyzeRequest & object; response: AnalyzeResponse }>();
      if (!body?.request || !body?.response?.scenario_id) {
        return c.json({ error: "bad_request", detail: "request and response are required" }, 400);
      }
      const entry = await c.var.store.record(body.request, body.response, { ownerId: c.var.uid, source: "own" });
      return c.json(entry);
    } catch (e: any) {
      return c.json({ error: "bad_request", detail: String(e?.message ?? e) }, 400);
    }
  });

  app.get("/api/history/:id", async (c) => {
    const entry = await c.var.store.get(c.req.param("id"));
    if (!entry) return c.json({ error: "not_found" }, 404);
    return c.json(entry);
  });

  return app;
}
