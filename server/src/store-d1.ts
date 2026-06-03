// Cloudflare D1 (SQLite) implementation of StoreApi. The schema lives in
// migrations/0001_init.sql. Request/response blobs are stored as JSON text.

import type { D1Database } from "@cloudflare/workers-types";
import type { AnalyzeRequest, AnalyzeResponse } from "./schemas.js";
import { seedHistory } from "./seed.js";
import type { HistoryEntry, HistorySummary, RecordMeta, StoreApi } from "./store.js";

const SUMMARY_COLS =
  "scenario_id, owner_id, business_type, location, short_label, composite_score, created_at, source, submitted_by, contact_name, contact_phone";

function rowToSummary(r: any): HistorySummary {
  return {
    scenario_id: r.scenario_id,
    owner_id: r.owner_id ?? null,
    business_type: r.business_type,
    location: r.location,
    short_label: r.short_label,
    composite_score: r.composite_score,
    created_at: r.created_at,
    source: r.source,
    submitted_by: r.submitted_by,
    contact_name: r.contact_name ?? undefined,
    contact_phone: r.contact_phone ?? undefined,
  };
}

export function createD1Store(db: D1Database): StoreApi {
  return {
    async record(req, res, meta) {
      const entry: HistoryEntry = {
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
      await db
        .prepare(
          `INSERT INTO scenarios
             (scenario_id, owner_id, business_type, location, short_label,
              composite_score, created_at, source, submitted_by, contact_name,
              contact_phone, request, response)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
           ON CONFLICT(scenario_id) DO UPDATE SET
             owner_id=excluded.owner_id, business_type=excluded.business_type,
             location=excluded.location, short_label=excluded.short_label,
             composite_score=excluded.composite_score, created_at=excluded.created_at,
             source=excluded.source, submitted_by=excluded.submitted_by,
             contact_name=excluded.contact_name, contact_phone=excluded.contact_phone,
             request=excluded.request, response=excluded.response`,
        )
        .bind(
          entry.scenario_id, entry.owner_id, entry.business_type, entry.location,
          entry.short_label, entry.composite_score, entry.created_at, entry.source,
          entry.submitted_by, entry.contact_name ?? null, entry.contact_phone ?? null,
          JSON.stringify(entry.request), JSON.stringify(entry.response),
        )
        .run();
      return entry;
    },

    async listOwn(ownerId) {
      const { results } = await db
        .prepare(`SELECT ${SUMMARY_COLS} FROM scenarios WHERE owner_id = ? ORDER BY created_at DESC LIMIT 50`)
        .bind(ownerId)
        .all();
      return (results ?? []).map(rowToSummary);
    },

    async listAll() {
      const { results } = await db
        .prepare(`SELECT ${SUMMARY_COLS} FROM scenarios ORDER BY created_at DESC LIMIT 200`)
        .all();
      return (results ?? []).map(rowToSummary);
    },

    async get(id) {
      const row = await db
        .prepare(`SELECT * FROM scenarios WHERE scenario_id = ?`)
        .bind(id)
        .first<any>();
      if (!row) return null;
      return {
        scenario_id: row.scenario_id,
        owner_id: row.owner_id ?? null,
        business_type: row.business_type,
        location: row.location,
        short_label: row.short_label,
        composite_score: row.composite_score,
        created_at: row.created_at,
        request: JSON.parse(row.request) as AnalyzeRequest & object,
        response: JSON.parse(row.response) as AnalyzeResponse,
        source: row.source,
        submitted_by: row.submitted_by,
        contact_name: row.contact_name ?? undefined,
        contact_phone: row.contact_phone ?? undefined,
      };
    },
  };
}

/** Insert the demo marketplace once, if the table is empty. Cheap to call on
 *  every cold start — it short-circuits after the first row exists. */
export async function ensureSeeded(db: D1Database): Promise<void> {
  const row = await db.prepare("SELECT COUNT(*) AS n FROM scenarios").first<{ n: number }>();
  if ((row?.n ?? 0) > 0) return;
  const store = createD1Store(db);
  await seedHistory((req, res, meta) => store.record(req, res, meta));
}
