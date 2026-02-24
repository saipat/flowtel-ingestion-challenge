CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  occurred_at TIMESTAMPTZ NULL,
  received_at TIMESTAMPTZ NULL,
  type TEXT NULL,
  source TEXT NULL,
  payload JSONB NOT NULL,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ingestion_state (
  id INT PRIMARY KEY DEFAULT 1,
  cursor TEXT NULL,
  last_event_id TEXT NULL,
  ingested_count BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO ingestion_state (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;