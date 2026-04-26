import "dotenv/config";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";

import { mockAnalyze, mockChat } from "./mock.js";
import * as store from "./store.js";
import { seedHistory } from "./seed.js";
import type {
  AnalyzeRequest, AnalyzeResponse, ChatRequest, ChatResponse,
} from "./schemas.js";

const USE_MOCK = (process.env.USE_MOCK ?? "true").toLowerCase() === "true";
const PORT = Number(process.env.PORT ?? 8000);

const app = new Hono();
app.use("*", cors({ origin: ["http://localhost:5173", "http://localhost:4173"] }));

app.get("/api/health", (c) =>
  c.json({ ok: true, mode: USE_MOCK ? "mock" : "gemini" }),
);

app.post("/api/analyze", async (c) => {
  const req = await c.req.json<AnalyzeRequest>();
  let res: AnalyzeResponse;
  if (USE_MOCK) {
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
  store.record(req, res);
  return c.json<AnalyzeResponse>(res);
});

app.post("/api/chat", async (c) => {
  const req = await c.req.json<ChatRequest>();
  if (USE_MOCK) return c.json<ChatResponse>(mockChat(req.message, req.scenario_context));
  try {
    const { chat } = await import("./llm.js");
    return c.json<ChatResponse>(await chat(req));
  } catch (e: any) {
    console.error("[/api/chat]", e);
    return c.json({ error: "model_error", detail: String(e?.message ?? e) }, 502);
  }
});

// --- Voice intake (mic in the chat) -------------------------------------

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
    // MediaRecorder defaults to audio/webm in Chrome; Gemini accepts that.
    const mime = file.type || "audio/webm";
    const result = await transcribeAndExtract(buf.toString("base64"), mime);
    return c.json(result);
  } catch (e: any) {
    console.error("[agent/voice]", e);
    return c.json({ error: "agent_error", detail: String(e?.message ?? e) }, 502);
  }
});

// --- Pitch-deck extraction (Profile auto-fill) --------------------------

app.post("/api/agent/extract-profile", async (c) => {
  // Accepts multipart/form-data with a single "file" field.
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

// --- Geocode search (used by the map's search box) ----------------------

app.get("/api/geocode/search", async (c) => {
  const q = c.req.query("q") ?? "";
  if (!q.trim()) return c.json({ items: [] });
  try {
    const { searchPlaces } = await import("./agents/geocode.js");
    return c.json({ items: await searchPlaces(q) });
  } catch (e: any) {
    console.error("[geocode/search]", e);
    return c.json({ items: [] });
  }
});

// --- Agent endpoints ----------------------------------------------------

app.post("/api/agent/location", async (c) => {
  const body = await c.req.json<{ lat: number; lng: number; business_type: string; district?: string; format?: any }>();
  if (typeof body.lat !== "number" || typeof body.lng !== "number" || !body.business_type) {
    return c.json({ error: "bad_request", detail: "lat, lng, business_type are required" }, 400);
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
    const { synthesize } = await import("./agents/synthesize.js");
    return c.json(await synthesize(body));
  } catch (e: any) {
    console.error("[agent/synthesize]", e);
    return c.json({ error: "agent_error", detail: String(e?.message ?? e) }, 502);
  }
});

app.post("/api/agent/financials", async (c) => {
  const body = await c.req.json<any>();
  const need = ["business_type","district","startup_capital_uzs","monthly_rent_uzs","average_ticket_uzs"];
  for (const k of need) {
    if (body[k] == null || body[k] === "" || body[k] === 0) {
      return c.json({ error: "bad_request", detail: `${k} is required` }, 400);
    }
  }
  try {
    const { analyzeFinancials } = await import("./agents/financials.js");
    return c.json(await analyzeFinancials(body));
  } catch (e: any) {
    console.error("[agent/financials]", e);
    return c.json({ error: "agent_error", detail: String(e?.message ?? e) }, 502);
  }
});

app.get("/api/history", (c) => c.json({ items: store.list() }));

app.get("/api/history/:id", (c) => {
  const entry = store.get(c.req.param("id"));
  if (!entry) return c.json({ error: "not_found" }, 404);
  return c.json(entry);
});

// Pre-seed the banker queue so it isn't empty on first paint.
seedHistory(store.record);

serve({ fetch: app.fetch, port: PORT }, ({ port }) => {
  console.log(`fintech server on http://localhost:${port}  mode=${USE_MOCK ? "mock" : "gemini"}  seeded=${store.list().length} scenarios`);
});
