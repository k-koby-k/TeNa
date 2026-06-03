-- Persisted analyses. One row per scenario; request/response stored as JSON.
CREATE TABLE IF NOT EXISTS scenarios (
  scenario_id     TEXT PRIMARY KEY,
  owner_id        TEXT,                 -- anonymous cookie id of the submitter (NULL for seeds)
  business_type   TEXT NOT NULL,
  location        TEXT NOT NULL,
  short_label     TEXT NOT NULL,        -- YES | MAYBE | NO
  composite_score INTEGER NOT NULL,
  created_at      TEXT NOT NULL,        -- ISO 8601
  source          TEXT NOT NULL,        -- own | marketplace
  submitted_by    TEXT NOT NULL,
  contact_name    TEXT,
  contact_phone   TEXT,
  request         TEXT NOT NULL,        -- JSON
  response        TEXT NOT NULL         -- JSON
);

CREATE INDEX IF NOT EXISTS idx_scenarios_owner   ON scenarios (owner_id, created_at);
CREATE INDEX IF NOT EXISTS idx_scenarios_created ON scenarios (created_at);
