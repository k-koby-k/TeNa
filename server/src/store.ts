// Storage abstraction. Two implementations share this interface:
//   • createMemoryStore() — in-process array, used for local `tsx` dev and as
//     a fallback when no D1 binding is present.
//   • createD1Store(db)   — Cloudflare D1 (SQLite), used in production.
//
// Both are async so the route handlers don't care which one is wired in.

import type { AnalyzeRequest, AnalyzeResponse } from "./schemas.js";
import { seedHistory } from "./seed.js";

export interface HistoryEntry {
  scenario_id: string;
  owner_id: string | null;          // anonymous cookie id of whoever ran it
  business_type: string;
  location: string;
  short_label: "YES" | "MAYBE" | "NO";
  composite_score: number;
  created_at: string;
  request: AnalyzeRequest & object;
  response: AnalyzeResponse;
  source: "own" | "marketplace";
  submitted_by: string;
  contact_name?: string;
  contact_phone?: string;
}

/** Row shape returned by the list endpoints — everything except the heavy
 *  request/response blobs. */
export type HistorySummary = Omit<HistoryEntry, "request" | "response">;

export interface RecordMeta {
  ownerId: string | null;
  source?: "own" | "marketplace";
  submittedBy?: string;
  /** Override the timestamp (used by the seeder to backdate demo rows). */
  createdAt?: string;
}

export interface StoreApi {
  record(req: AnalyzeRequest & object, res: AnalyzeResponse, meta: RecordMeta): Promise<HistoryEntry>;
  /** A single person's own analyses (cookie-scoped). */
  listOwn(ownerId: string): Promise<HistorySummary[]>;
  /** Everything — the banker pipeline. */
  listAll(): Promise<HistorySummary[]>;
  get(scenario_id: string): Promise<HistoryEntry | null>;
}

function toEntry(
  req: AnalyzeRequest & object,
  res: AnalyzeResponse,
  meta: RecordMeta,
): HistoryEntry {
  return {
    scenario_id: res.scenario_id,
    owner_id: meta.ownerId,
    business_type: res.business_type,
    location: res.location,
    short_label: res.verdict.short_label,
    composite_score: res.verdict.composite_score,
    created_at: meta.createdAt ?? new Date().toISOString(),
    request: req,
    response: res,
    source: meta.source ?? "own",
    submitted_by: meta.submittedBy ?? "Current account",
    contact_name: (req as AnalyzeRequest).contact_name,
    contact_phone: (req as AnalyzeRequest).contact_phone,
  };
}

const summary = ({ request: _r, response: _s, ...rest }: HistoryEntry): HistorySummary => rest;

// --- In-memory implementation -------------------------------------------

export function createMemoryStore(): StoreApi {
  const rows: HistoryEntry[] = [];
  const api: StoreApi = {
    async record(req, res, meta) {
      const entry = toEntry(req, res, meta);
      rows.unshift(entry);
      if (rows.length > 200) rows.pop();
      return entry;
    },
    async listOwn(ownerId) {
      return rows.filter((e) => e.owner_id === ownerId).map(summary);
    },
    async listAll() {
      return rows.map(summary);
    },
    async get(id) {
      return rows.find((e) => e.scenario_id === id) ?? null;
    },
  };
  // Seed the marketplace so the banker queue isn't empty in local dev.
  seedHistory((req, res, meta) => { void api.record(req, res, meta); });
  return api;
}
