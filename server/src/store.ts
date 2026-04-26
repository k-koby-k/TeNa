// In-memory history store. Persists for the life of the dev server.
// The frontend never assumes more than this — every successful /analyze
// pushes a row, GET /api/history returns the list newest-first, and
// GET /api/history/:id rehydrates a single past analysis.

import type { AnalyzeRequest, AnalyzeResponse } from "./schemas.js";

export interface HistoryEntry {
  scenario_id: string;
  business_type: string;
  location: string;
  short_label: "YES" | "MAYBE" | "NO";
  composite_score: number;
  created_at: string;
  request: AnalyzeRequest;
  response: AnalyzeResponse;
}

const _history: HistoryEntry[] = [];

export function record(req: AnalyzeRequest, res: AnalyzeResponse): HistoryEntry {
  const entry: HistoryEntry = {
    scenario_id: res.scenario_id,
    business_type: res.business_type,
    location: res.location,
    short_label: res.verdict.short_label,
    composite_score: res.verdict.composite_score,
    created_at: new Date().toISOString(),
    request: req,
    response: res,
  };
  _history.unshift(entry);
  // Keep at most 50 entries — the dashboard's history view caps at 20 anyway.
  if (_history.length > 50) _history.pop();
  return entry;
}

export function list(): Omit<HistoryEntry, "request" | "response">[] {
  return _history.map(({ request: _r, response: _s, ...summary }) => summary);
}

export function get(scenario_id: string): HistoryEntry | undefined {
  return _history.find((e) => e.scenario_id === scenario_id);
}
